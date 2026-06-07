"""
Outcome Tracking Engine — FinSight 2.0 Phase 1
===============================================
For every recommendation without a complete performance result, fetches
actual subsequent price data from Twelve Data and calculates:
  - return_1d:      % change 1 trading day after recommendation date
  - return_7d:      % change 7 trading days after recommendation date
  - return_30d:     % change 30 trading days after recommendation date
  - spy_return_30d: SPY ETF % change over the same 30-day window (benchmark)

Results are written to the performance_results table.
Rows are marked 'partial' if the 30-day window hasn't closed yet,
and 'complete' once all three return fields are available.

Usage:
    cd backend
    python scripts/outcome_tracking.py

    # Dry run — prints what would be calculated without writing to DB:
    python scripts/outcome_tracking.py --dry-run

    # Limit how many recommendations to process in one run:
    python scripts/outcome_tracking.py --limit 50

Run this script:
  - Once after the initial replay to backfill all historical rows
  - Daily (or via a second GitHub Actions cron) to update live recommendations

Rate limiting:
  Twelve Data: 8 req/min free tier. Each recommendation = 2 TD calls
  (1 for the ticker, 1 for SPY). TD_DELAY_SECONDS controls pacing.
  At 9s delay: 50 recommendations ≈ 15 minutes.
"""

import argparse
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
from dotenv import load_dotenv

load_dotenv()

from db.recommendations import (
    list_recommendations_without_complete_performance,
    upsert_performance_result,
)

# ── Config ──────────────────────────────────────────────────────────────────

TD_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "")

# Delay between Twelve Data calls — stays within 8 req/min free tier.
# Each recommendation makes 2 calls (ticker + SPY), so effective rate is
# one recommendation every 18s, well within the limit.
TD_DELAY_SECONDS = 9.0

# How many calendar days to fetch around each target date.
# Wider window handles weekends and market holidays.
FETCH_WINDOW_DAYS = 10

# Trading day offsets we care about
OFFSETS = {
    "1d": 1,
    "7d": 7,
    "30d": 30,
}


# ── Twelve Data helpers ──────────────────────────────────────────────────────

def fetch_price_series(symbol: str, start: date, end: date) -> dict[str, float]:
    """
    Fetches daily closing prices for `symbol` between start and end dates.
    Returns a dict of {date_str: close_price}, e.g. {"2025-02-03": 185.42}.
    Returns an empty dict on any failure.
    """
    try:
        resp = requests.get(
            "https://api.twelvedata.com/time_series",
            params={
                "symbol": symbol,
                "interval": "1day",
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "outputsize": 60,   # enough for a 30-day window including weekends
                "apikey": TD_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"    [TD] Request failed for {symbol} {start}–{end}: {e}")
        return {}

    if data.get("status") == "error":
        print(f"    [TD] API error for {symbol}: {data.get('message')}")
        return {}

    values = data.get("values", [])
    return {v["datetime"]: float(v["close"]) for v in values if "datetime" in v and "close" in v}


def get_nth_trading_day_price(
    prices: dict[str, float],
    base_date: date,
    n_trading_days: int,
) -> float | None:
    """
    Given a price dict (date_str → close) and a base date, returns the
    closing price n trading days after the base date.

    Trading days are determined by whichever dates actually appear in the
    price series — no hardcoded calendar needed.
    """
    # Sort all available dates after base_date in ascending order
    future_dates = sorted(
        d for d in prices
        if datetime.strptime(d, "%Y-%m-%d").date() > base_date
    )

    if len(future_dates) < n_trading_days:
        return None   # window hasn't closed yet

    target_date_str = future_dates[n_trading_days - 1]
    return prices[target_date_str]


def calculate_return(price_start: float, price_end: float) -> float:
    """Returns % return, rounded to 6 decimal places."""
    if price_start == 0:
        return 0.0
    return round((price_end - price_start) / price_start, 6)


# ── Core processing ──────────────────────────────────────────────────────────

def process_recommendation(rec: dict, dry_run: bool = False) -> str:
    """
    Fetches outcome data for a single recommendation and upserts the result.
    Returns a status string for logging: 'complete', 'partial', 'skip', or 'fail'.
    """
    ticker = rec["ticker"]
    rec_id = rec["id"]

    # Parse generated_at — may be a datetime object (from psycopg) or a string
    generated_at = rec["generated_at"]
    if isinstance(generated_at, str):
        generated_at = datetime.fromisoformat(generated_at)
    if generated_at.tzinfo is None:
        generated_at = generated_at.replace(tzinfo=timezone.utc)

    base_date = generated_at.date()
    today = date.today()

    # If the recommendation was generated today there's nothing to measure yet
    if base_date >= today:
        return "skip"

    # Fetch window: base_date+1 through base_date+45 (generous buffer for holidays)
    fetch_start = base_date + timedelta(days=1)
    fetch_end = min(base_date + timedelta(days=45), today)

    # ── Fetch ticker prices ──────────────────────────────────────────────
    ticker_prices = fetch_price_series(ticker, fetch_start, fetch_end)
    time.sleep(TD_DELAY_SECONDS)

    if not ticker_prices:
        return "fail"

    # Get base price = closing price ON the recommendation date (or nearest prior)
    # We fetch a small window before base_date to get it
    base_window_start = base_date - timedelta(days=FETCH_WINDOW_DAYS)
    base_window_prices = fetch_price_series(ticker, base_window_start, base_date)
    time.sleep(TD_DELAY_SECONDS)

    if not base_window_prices:
        return "fail"

    # Base price = the last available close on or before base_date
    base_dates_available = sorted(
        d for d in base_window_prices
        if datetime.strptime(d, "%Y-%m-%d").date() <= base_date
    )
    if not base_dates_available:
        return "fail"

    base_price = base_window_prices[base_dates_available[-1]]

    # ── Calculate returns for each offset ───────────────────────────────
    returns = {}
    for label, n in OFFSETS.items():
        price_at_n = get_nth_trading_day_price(ticker_prices, base_date, n)
        if price_at_n is not None:
            returns[label] = calculate_return(base_price, price_at_n)

    if not returns:
        return "fail"

    # ── Fetch SPY for the 30d benchmark ─────────────────────────────────
    spy_return_30d = None
    if "30d" in returns:
        spy_prices = fetch_price_series("SPY", fetch_start, fetch_end)
        time.sleep(TD_DELAY_SECONDS)

        spy_base_window = fetch_price_series("SPY", base_window_start, base_date)
        time.sleep(TD_DELAY_SECONDS)

        if spy_prices and spy_base_window:
            spy_base_dates = sorted(
                d for d in spy_base_window
                if datetime.strptime(d, "%Y-%m-%d").date() <= base_date
            )
            if spy_base_dates:
                spy_base_price = spy_base_window[spy_base_dates[-1]]
                spy_price_30d = get_nth_trading_day_price(spy_prices, base_date, 30)
                if spy_price_30d is not None:
                    spy_return_30d = calculate_return(spy_base_price, spy_price_30d)

    # ── Determine evaluation status ──────────────────────────────────────
    has_all = all(k in returns for k in ("1d", "7d", "30d"))
    status = "complete" if (has_all and spy_return_30d is not None) else "partial"

    # ── Upsert result ────────────────────────────────────────────────────
    result = {
        "recommendation_id": rec_id,
        "return_1d":      returns.get("1d"),
        "return_7d":      returns.get("7d"),
        "return_30d":     returns.get("30d"),
        "spy_return_30d": spy_return_30d,
        "evaluated_at":   datetime.now(timezone.utc).isoformat(),
        "evaluation_status": status,
    }

    if not dry_run:
        upsert_performance_result(result)

    return status


# ── Main loop ────────────────────────────────────────────────────────────────

def run_outcome_tracking(limit: int = 100, dry_run: bool = False):
    pending = list_recommendations_without_complete_performance(limit=limit)

    total = len(pending)
    counts = {"complete": 0, "partial": 0, "skip": 0, "fail": 0}

    print(f"\n{'=' * 60}")
    print(f"FinSight Outcome Tracking Engine")
    print(f"Pending: {total}  |  Dry run: {dry_run}")
    print(f"{'=' * 60}\n")

    if total == 0:
        print("Nothing to process — all recommendations are up to date.")
        return

    for i, rec in enumerate(pending, 1):
        ticker = rec["ticker"]
        generated_at = rec["generated_at"]
        rec_id = rec["id"]

        # Format generated_at for display
        if isinstance(generated_at, datetime):
            label_date = generated_at.strftime("%Y-%m-%d")
        else:
            label_date = str(generated_at)[:10]

        print(f"  [{i:>3}/{total}] {ticker} {label_date} (id={rec_id}) ...", end=" ", flush=True)

        try:
            status = process_recommendation(rec, dry_run=dry_run)
        except Exception as e:
            print(f"FAIL (unexpected: {e})")
            counts["fail"] += 1
            continue

        counts[status] += 1

        if status == "complete":
            print("COMPLETE")
        elif status == "partial":
            print("PARTIAL (30d window not yet closed)")
        elif status == "skip":
            print("SKIP (generated today)")
        else:
            print("FAIL (no price data)")

    print(f"\n{'=' * 60}")
    print(f"Outcome tracking complete.")
    print(f"  Complete: {counts['complete']}")
    print(f"  Partial:  {counts['partial']}  (re-run once 30d window closes)")
    print(f"  Skipped:  {counts['skip']}  (generated today)")
    print(f"  Failed:   {counts['fail']}  (no price data from Twelve Data)")
    print(f"{'=' * 60}\n")


# ── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FinSight Outcome Tracking Engine")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Calculate returns and print results without writing to the database",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        metavar="N",
        help="Maximum number of recommendations to process in one run (default: 100)",
    )
    args = parser.parse_args()

    run_outcome_tracking(limit=args.limit, dry_run=args.dry_run)