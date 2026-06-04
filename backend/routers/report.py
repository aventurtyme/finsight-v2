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
from fetchers.stock import fetch_stock_data
from fetchers.news import fetch_news
from ai.gemini import generate_report

router = APIRouter(prefix="/api/v1", tags=["reports"])

CACHE_TTL_HOURS = 6


# ── Helpers ────────────────────────────────────────────────────────────────

def _is_fresh(generated_at_str: str) -> bool:
    """Returns True if the cached report is younger than CACHE_TTL_HOURS."""
    ts = datetime.fromisoformat(generated_at_str)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - ts < timedelta(hours=CACHE_TTL_HOURS)


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.post("/report")
async def create_report(
    ticker: str = Query(..., description="Stock ticker symbol, e.g. AAPL"),
    force_refresh: bool = Query(False, description="Skip cache and regenerate"),
):
    ticker = ticker.upper().strip()

    # 1. Cache check
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

    # 3. Generate AI report
    try:
        ai_result = generate_report(ticker, price_data, news)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI parse error: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")

    # 4. Compute crowd sentiment rank (how many tickers rank higher)
    crowd_rank = count_tickers_with_higher_sentiment(ai_result["sentiment_score"]) + 1

    # 5. Assemble report
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

    # 6. Persist report to PostgreSQL
    saved_report = insert_report(report)

    # 7. Update crowd sentiment aggregation
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
    """
    Returns the crowd-sourced sentiment leaderboard.
    This is Utility 2 — the aggregated output of every user query.
    """
    result = list_sentiment_aggregate(limit)
    return {"leaderboard": result, "total": len(result)}


@router.get("/tickers/trending")
async def get_trending():
    """Returns the 10 most queried tickers in the last 24 hours."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    result = list_report_tickers_since(cutoff)
    counts = Counter(r["ticker"] for r in result)
    trending = [{"ticker": t, "query_count": c} for t, c in counts.most_common(10)]
    return {"trending": trending}
