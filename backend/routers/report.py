from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone, timedelta
from collections import Counter

from db.reports import (
    count_tickers_with_higher_sentiment,
    get_latest_report,
    insert_report,
    list_report_tickers_since,
    list_sentiment_aggregate,
    upsert_sentiment_aggregation,
)
from db.recommendations import insert_recommendation
from fetchers.stock import fetch_stock_data
from fetchers.news import fetch_news
from ai.gemini import generate_report

router = APIRouter(prefix="/api/v1", tags=["reports"])

CACHE_TTL_HOURS = 6

# Sector and market cap tier lookup for the 18 Phase 1 tickers.
# Used when writing to recommendations table.
TICKER_METADATA = {
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


# ── Helpers ────────────────────────────────────────────────────────────────

def _is_fresh(generated_at_str: str) -> bool:
    """Returns True if the cached report is younger than CACHE_TTL_HOURS."""
    ts = datetime.fromisoformat(generated_at_str)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - ts < timedelta(hours=CACHE_TTL_HOURS)


def _infer_market_cap_tier(market_cap_str: str) -> str:
    """Infer tier from formatted market cap string e.g. '$2.50T', '$800.00B'."""
    if not market_cap_str or market_cap_str == "N/A":
        return "large"  # default for unknown
    s = market_cap_str.upper()
    if "T" in s:
        return "large"
    if "B" in s:
        val = float(s.replace("$", "").replace("B", ""))
        if val >= 10:
            return "large"
        elif val >= 2:
            return "mid"
        return "small"
    return "small"


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.post("/report")
async def create_report(
    ticker: str = Query(..., description="Stock ticker symbol, e.g. AAPL"),
    force_refresh: bool = Query(False, description="Skip cache and regenerate"),
    prompt_variant: str = Query("A", description="Prompt framing: A (Neutral), B (Conservative), C (Growth)"),
):
    ticker = ticker.upper().strip()
    prompt_variant = prompt_variant.upper()

    if prompt_variant not in ("A", "B", "C"):
        raise HTTPException(status_code=400, detail="prompt_variant must be A, B, or C.")

    # 1. Cache check (reports table — v1.0 compatibility)
    if not force_refresh:
        cached = get_latest_report(ticker)
        if cached and _is_fresh(cached["generated_at"].isoformat()):
            return cached

    # 2. Fetch market data + news
    try:
        price_data = fetch_stock_data(ticker)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stock data fetch failed: {e}")

    try:
        news = fetch_news(price_data["company_name"], ticker)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"News fetch failed: {e}")

    # 3. Enrich price_data with sector/market_cap_tier for the prompt
    meta = TICKER_METADATA.get(ticker, {})
    price_data["sector"] = meta.get("sector", "Unknown")
    price_data["market_cap_tier"] = meta.get(
        "market_cap_tier",
        _infer_market_cap_tier(price_data.get("market_cap", "N/A")),
    )

    # 4. Generate AI report
    try:
        ai_result = generate_report(ticker, price_data, news, prompt_variant=prompt_variant)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI parse error: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")

    # 5. Compute crowd sentiment rank
    crowd_rank = count_tickers_with_higher_sentiment(ai_result["sentiment_score"]) + 1

    # 6. Assemble and persist legacy report (v1.0 reports table — keeps frontend working)
    now = datetime.now(timezone.utc).isoformat()
    report = {
        "ticker": ticker,
        "company_name": price_data["company_name"],
        "generated_at": now,
        "price_data": {
            "current_price": price_data["current_price"],
            "price_change_pct": price_data["price_change_pct"],
            "pe_ratio": price_data["pe_ratio"],
            "market_cap": price_data["market_cap"],
            "week_52_high": price_data["week_52_high"],
            "week_52_low": price_data["week_52_low"],
        },
        "sentiment_score": ai_result["sentiment_score"],
        "ai_summary": {
            "bull_case": ai_result["bull_case"],
            "bear_case": ai_result["bear_case"],
            "key_risks": ai_result["key_risks"],
            "overall_grade": ai_result["overall_grade"],
            "grade_rationale": ai_result.get("grade_rationale", ""),
        },
        "news_headlines": news[:5],
        "crowd_sentiment_rank": crowd_rank,
    }
    saved_report = insert_report(report)

    # 7. Also write to recommendations table (v2.0 evaluation store)
    try:
        insert_recommendation({
            "ticker": ticker,
            "generated_at": now,
            "prompt_variant": prompt_variant,
            "sentiment_score": ai_result["sentiment_score"],
            "recommendation": ai_result["recommendation"],
            "confidence": ai_result["confidence"],
            "bull_case": ai_result["bull_case"],
            "bear_case": ai_result["bear_case"],
            "key_risks": ai_result["key_risks"],
            "overall_grade": ai_result["overall_grade"],
            "grade_rationale": ai_result.get("grade_rationale", ""),
            "sector": price_data["sector"],
            "market_cap_tier": price_data["market_cap_tier"],
            "price_at_time": price_data["current_price"],
            "is_historical": False,
        })
    except Exception as e:
        # Non-fatal — log but don't fail the response
        print(f"[recommendations] Warning: failed to insert recommendation for {ticker}: {e}")

    # 8. Update crowd sentiment aggregation
    upsert_sentiment_aggregation(ticker, ai_result["sentiment_score"])

    return saved_report


@router.get("/report/{ticker}")
async def get_report(ticker: str):
    """Returns the most recent cached report for a ticker."""
    ticker = ticker.upper().strip()
    result = get_latest_report(ticker)
    if not result:
        raise HTTPException(status_code=404, detail=f"No report found for {ticker}. POST /report first.")
    return result


@router.get("/sentiment/aggregate")
async def get_sentiment_aggregate(limit: int = Query(20, ge=1, le=100)):
    result = list_sentiment_aggregate(limit)
    return {"leaderboard": result, "total": len(result)}


@router.get("/tickers/trending")
async def get_trending():
    """Returns the 10 most queried tickers in the last 24 hours."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    result = list_report_tickers_since(cutoff)
    counts = Counter(r["ticker"] for r in result)
    trending = [{"ticker": t, "query_count": c} for t, c in counts.most_common(10)]
    return {"tickers": trending}