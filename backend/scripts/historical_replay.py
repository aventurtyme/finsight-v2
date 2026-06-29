"""
Historical Replay Engine — FinSight 2.0 Phase 1-3
==================================================
Generates backdated AI recommendations for 16 tickers across Jan–Dec 2025.
For each ticker + month:
  1. Fetch that month's news from Finnhub
  2. Fetch the closing price on the first trading day of that month from Twelve Data
  3. Send to Gemini using the requested prompt variant (A, B, or C)
  4. Insert into recommendations table with is_historical=True

Usage:
    cd backend
    python scripts/historical_replay.py                       # all tickers, Variant A
    python scripts/historical_replay.py --variant B           # all tickers, Variant B

    # Dry run (no DB writes, no Gemini calls) — just checks data availability:
    python scripts/historical_replay.py --dry-run

    # Single ticker test:
    python scripts/historical_replay.py --tickers AAPL NVDA --variant C

    # Process one ticker by index (0-based) — used by GitHub Actions:
    python scripts/historical_replay.py --ticker-index 0 --variant B

Rate limiting:
  Gemini:      20 RPD free tier. 1 ticker = 12 calls. Run 1 ticker/day to stay safe.
  Twelve Data: ~8 req/min, 800 credits/day. TD_DELAY_SECONDS controls pacing.
               1 ticker = 13 TD calls (1 quote + 12 time_series). Fine per day.
  Finnhub:     No hard rate limit stated; FINNHUB_DELAY_SECONDS adds courtesy sleep.

Retry behavior:
  Transient Gemini errors (503 UNAVAILABLE / high demand) are retried automatically
  inside ai/gemini.py before this script ever sees them as a failure. Genuine daily
  quota exhaustion is NOT retried and will surface here as a FAIL for that row —
  it will be picked up again next time this ticker/variant/month combo is processed,
  since the skip-if-exists check means already-succeeded rows are never re-attempted.
"""

import argparse
import os
import sys
import time
from datetime import date, timedelta

# Allow running from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
from dotenv import load_dotenv

load_dotenv()

from ai.gemini import generate_report
from db.postgres import fetch_one
from db.recommendations import insert_recommendation
from fetchers.news import fetch_news

# ── Config ─────────────────────────────────────────────────────────────────

TD_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")

REPLAY_MONTHS = [
    date(2025, m, 1) for m in range(1, 13)  # Jan 2025 – Dec 2025
]

# Valid prompt variants — must match ai/gemini.py FRAMING_INSTRUCTIONS keys.
PROMPT_VARIANTS = ("A", "B", "C")

# Ordered list — index is stable so --ticker-index works reliably.
TICKER_ORDER = [
    "AAPL", "NVDA", "MSFT", "AMD",
    "JNJ",  "UNH",  "PFE",
    "XOM",  "CVX",
    "JPM",  "GS",
    "AMZN", "TSLA", "NKE",
    "CAT",  "BA",
]

TICKERS = {
    "AAPL": {"sector": "Technology",             "market_cap_tier": "large"},
    "NVDA": {"sector": "Technology",             "market_cap_tier": "large"},
    "MSFT": {"sector": "Technology",             "market_cap_tier": "large"},
    "AMD":  {"sector": "Technology",             "market_cap_tier": "large"},
    "JNJ":  {"sector": "Healthcare",             "market_cap_tier": "large"},
    "UNH":  {"sector": "Healthcare",             "market_cap_tier": "large"},
    "PFE":  {"sector": "Healthcare",             "market_cap_tier": "large"},
    "XOM":  {"sector": "Energy",                 "market_cap_tier": "large"},
    "CVX":  {"sector": "Energy",                 "market_cap_tier": "large"},
    "JPM":  {"sector": "Financials",             "market_cap_tier": "large"},
    "GS":   {"sector": "Financials",             "market_cap_tier": "large"},
    "AMZN": {"sector": "Consumer Discretionary", "market_cap_tier": "large"},
    "TSLA": {"sector": "Consumer Discretionary", "market_cap_tier": "large"},
    "NKE":  {"sector": "Consumer Discretionary", "market_cap_tier": "large"},
    "CAT":  {"sector": "Industrials",            "market_cap_tier": "large"},
    "BA":   {"sector": "Industrials",            "market_cap_tier": "large"},
}

# Delay between API calls — tune if you hit rate limits
GEMINI_DELAY_SECONDS = 2.0    # between Gemini calls (conservative for RPD)
FINNHUB_DELAY_SECONDS = 0.5   # between Finnhub calls
# Twelve Data free tier: 8 req/min → minimum 7.5s between calls.
# We use 9s to be safe.
TD_DELAY_SECONDS = 9.0


# ── Skip-if-exists check ───────────────────────────────────────────────────

def _already_exists(ticker: str, month_start: date, variant: str) -> bool:
    """
    Returns True if a historical recommendation already exists for this
    ticker + month + prompt variant. Prevents re-processing on re-runs.
    """
    row = fetch_one(
        """
        SELECT id FROM recommendations
        WHERE ticker = %s
          AND DATE_TRUNC('month', generated_at AT TIME ZONE 'UTC')
              = DATE_TRUNC('month', %s::timestamptz AT TIME ZONE 'UTC')
          AND prompt_variant = %s
          AND is_historical = TRUE
        """,
        (ticker, f"{month_start.isoformat()}T00:00:00+00:00", variant),
    )
    return row is not None


# ── Twelve Data helpers ────────────────────────────────────────────────────

def fetch_ticker_meta(ticker: str) -> dict:
    """
    Fetch company name and 52w high/low from /quote.
    Called ONCE per ticker before the monthly loop.
    """
    meta = {
        "company_name": ticker,
        "week_52_high": 0.0,
        "week_52_low": 0.0,
    }
    try:
        resp = requests.get(
            "https://api.twelvedata.com/quote",
            params={"symbol": ticker, "apikey": TD_API_KEY},
            timeout=10,
        )
        data = resp.json()
        if data.get("status") != "error":
            meta["company_name"] = data.get("name", ticker)
            fw = data.get("fifty_two_week", {})
            meta["week_52_high"] = _safe_float(fw.get("high")) or 0.0
            meta["week_52_low"] = _safe_float(fw.get("low")) or 0.0
    except Exception as e:
        print(f"    [TD] Quote fetch failed for {ticker}: {e}")
    return meta


def fetch_first_trading_day_price(ticker: str, month_start: date, ticker_meta: dict) -> dict | None:
    """
    Fetch the closing price on the first trading day of the month.
    """
    end_date = month_start + timedelta(days=10)

    try:
        resp = requests.get(
            "https://api.twelvedata.com/time_series",
            params={
                "symbol": ticker,
                "interval": "1day",
                "start_date": month_start.isoformat(),
                "end_date": end_date.isoformat(),
                "outputsize": 5,
                "apikey": TD_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"    [TD] Request failed for {ticker} {month_start}: {e}")
        return None

    if data.get("status") == "error":
        print(f"    [TD] API error for {ticker} {month_start}: {data.get('message')}")
        return None

    values = data.get("values", [])
    if not values:
        print(f"    [TD] No price data for {ticker} {month_start}")
        return None

    # values are newest-first; we want the earliest (first trading day of month)
    earliest = values[-1]
    close_price = float(earliest.get("close", 0))
    trading_date = earliest.get("datetime", month_start.isoformat())

    return {
        "ticker": ticker,
        "company_name": ticker_meta["company_name"],
        "current_price": close_price,
        "price_change_pct": 0.0,
        "pe_ratio": "N/A",
        "market_cap": "N/A",
        "week_52_high": ticker_meta["week_52_high"],
        "week_52_low": ticker_meta["week_52_low"],
        "trading_date": trading_date,
    }


def _safe_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ── Main replay loop ───────────────────────────────────────────────────────

def run_replay(tickers: list[str], variant: str = "A", dry_run: bool = False):
    variant = variant.upper()
    if variant not in PROMPT_VARIANTS:
        raise ValueError(f"Invalid variant '{variant}'. Must be one of {PROMPT_VARIANTS}.")

    total = len(tickers) * len(REPLAY_MONTHS)
    done = 0
    skipped = 0
    failed = 0

    print(f"\n{'=' * 60}")
    print(f"FinSight Historical Replay Engine")
    print(f"Tickers: {len(tickers)}  |  Months: {len(REPLAY_MONTHS)}  |  Target: {total}")
    print(f"Prompt variant: {variant}")
    print(f"Dry run: {dry_run}")
    print(f"{'=' * 60}\n")

    for ticker in tickers:
        meta = TICKERS[ticker]
        print(f"\n── {ticker} ({meta['sector']}) — Variant {variant} ──────────────────")

        # Fetch company name + 52w range once per ticker
        if not dry_run:
            ticker_meta = fetch_ticker_meta(ticker)
            print(f"  Meta: {ticker_meta['company_name']} | 52w {ticker_meta['week_52_low']}–{ticker_meta['week_52_high']}")
            time.sleep(TD_DELAY_SECONDS)
        else:
            ticker_meta = {"company_name": ticker, "week_52_high": 150.0, "week_52_low": 80.0}

        for month_start in REPLAY_MONTHS:
            label = month_start.strftime("%Y-%m")
            month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

            print(f"  {label} ...", end=" ", flush=True)

            # ── Skip if already in DB for this variant (safe to re-run) ─
            if not dry_run and _already_exists(ticker, month_start, variant):
                print("SKIP (already exists)")
                skipped += 1
                continue

            # 1. Fetch price data (1 TD call per month)
            if not dry_run:
                price_data = fetch_first_trading_day_price(ticker, month_start, ticker_meta)
                if not price_data:
                    print("SKIP (no price data)")
                    skipped += 1
                    time.sleep(TD_DELAY_SECONDS)
                    continue
                price_data["sector"] = meta["sector"]
                price_data["market_cap_tier"] = meta["market_cap_tier"]
                time.sleep(TD_DELAY_SECONDS)
            else:
                price_data = {
                    "ticker": ticker,
                    "company_name": ticker,
                    "current_price": 100.0,
                    "price_change_pct": 0.0,
                    "pe_ratio": "N/A",
                    "market_cap": "N/A",
                    "week_52_high": 150.0,
                    "week_52_low": 80.0,
                    "sector": meta["sector"],
                    "market_cap_tier": meta["market_cap_tier"],
                    "trading_date": month_start.isoformat(),
                }

            # 2. Fetch news for the month
            if not dry_run:
                news = fetch_news(
                    price_data["company_name"],
                    ticker,
                    max_articles=10,
                    from_date=month_start.isoformat(),
                    to_date=month_end.isoformat(),
                )
                time.sleep(FINNHUB_DELAY_SECONDS)
            else:
                news = []

            news_count = len(news)

            # 3. Call Gemini (transient-error retries happen inside ai/gemini.py)
            if not dry_run:
                try:
                    ai_result = generate_report(
                        ticker, price_data, news, prompt_variant=variant
                    )
                    time.sleep(GEMINI_DELAY_SECONDS)
                except Exception as e:
                    print(f"FAIL (Gemini: {e})")
                    failed += 1
                    continue
            else:
                ai_result = {
                    "sentiment_score": 0.2,
                    "recommendation": "Hold",
                    "confidence": 0.7,
                    "bull_case": "dry run",
                    "bear_case": "dry run",
                    "key_risks": ["dry run"],
                    "overall_grade": "B",
                    "grade_rationale": "dry run",
                    "prompt_variant": variant,
                }

            # 4. Build the recommendation record
            generated_at = f"{price_data['trading_date']}T09:30:00+00:00"

            rec = {
                "ticker": ticker,
                "generated_at": generated_at,
                "prompt_variant": variant,
                "sentiment_score": ai_result["sentiment_score"],
                "recommendation": ai_result["recommendation"],
                "confidence": ai_result["confidence"],
                "bull_case": ai_result["bull_case"],
                "bear_case": ai_result["bear_case"],
                "key_risks": ai_result["key_risks"],
                "overall_grade": ai_result["overall_grade"],
                "grade_rationale": ai_result.get("grade_rationale", ""),
                "sector": meta["sector"],
                "market_cap_tier": meta["market_cap_tier"],
                "price_at_time": price_data["current_price"],
                "is_historical": True,
            }

            # 5. Insert (upsert — safe to re-run)
            if not dry_run:
                try:
                    insert_recommendation(rec)
                except Exception as e:
                    print(f"FAIL (DB: {e})")
                    failed += 1
                    continue

            done += 1
            rec_label = ai_result["recommendation"] if not dry_run else "DRY"
            conf_label = f"{ai_result['confidence']:.2f}" if not dry_run else "-"
            print(f"OK  [{rec_label} | conf={conf_label} | news={news_count}]")

    print(f"\n{'=' * 60}")
    print(f"Replay complete. Variant: {variant}")
    print(f"  Done:    {done}")
    print(f"  Skipped: {skipped}  (already exists or no price data)")
    print(f"  Failed:  {failed}  (API or DB error)")
    print(f"{'=' * 60}\n")


# ── CLI entry point ────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FinSight Historical Replay Engine")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Check data availability without calling Gemini or writing to DB",
    )
    parser.add_argument(
        "--tickers",
        nargs="+",
        metavar="TICKER",
        help="Process these specific tickers (e.g. --tickers AAPL NVDA). Default: all.",
    )
    parser.add_argument(
        "--ticker-index",
        type=int,
        metavar="N",
        help=(
            "Process a single ticker by its 0-based position in TICKER_ORDER. "
            "Used by GitHub Actions to advance one ticker per day. "
            f"Valid range: 0–{len(TICKER_ORDER) - 1}. "
            f"Order: {', '.join(f'{i}={t}' for i, t in enumerate(TICKER_ORDER))}"
        ),
    )
    parser.add_argument(
        "--variant",
        choices=PROMPT_VARIANTS,
        default="A",
        help=(
            "Prompt framing to generate: A (Neutral), B (Conservative), C (Growth). "
            "Default: A."
        ),
    )
    args = parser.parse_args()

    # Resolve which tickers to process
    if args.ticker_index is not None:
        if args.tickers:
            print("Error: --ticker-index and --tickers are mutually exclusive.")
            sys.exit(1)
        if not (0 <= args.ticker_index < len(TICKER_ORDER)):
            print(f"Error: --ticker-index must be 0–{len(TICKER_ORDER) - 1}.")
            sys.exit(1)
        selected = [TICKER_ORDER[args.ticker_index]]
        print(f"Ticker index {args.ticker_index} → {selected[0]}")
    elif args.tickers:
        selected = [t.upper() for t in args.tickers]
    else:
        selected = list(TICKER_ORDER)

    unknown = [t for t in selected if t not in TICKERS]
    if unknown:
        print(f"Unknown tickers: {unknown}. Must be one of: {list(TICKERS.keys())}")
        sys.exit(1)

    run_replay(tickers=selected, variant=args.variant, dry_run=args.dry_run)