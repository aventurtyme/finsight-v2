import os
import requests
from dotenv import load_dotenv

load_dotenv()

TD_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "")

def fetch_stock_data(ticker: str) -> dict:
    ticker = ticker.upper().strip()
    
    # ── 1. TWELVE DATA (Price & Real-time) ──────────────────────────
    try:
        td_data = requests.get(
            "https://api.twelvedata.com/quote",
            params={"symbol": ticker, "apikey": TD_API_KEY},
            timeout=10,
        ).json()
        
        if td_data.get("status") == "error":
            raise ValueError(f"TD Error: {td_data.get('message')}")
            
        result = {
            "ticker": ticker,
            "company_name": td_data.get("name", ticker),
            "current_price": _safe_float(td_data.get("close")) or 0.0,
            "price_change_pct": _safe_float(td_data.get("percent_change")) or 0.0,
            "week_52_high": _safe_float(td_data.get("fifty_two_week", {}).get("high")) or 0.0,
            "week_52_low": _safe_float(td_data.get("fifty_two_week", {}).get("low")) or 0.0,
            "pe_ratio": "N/A",
            "market_cap": "N/A"
        }
    except Exception as e:
        print(f"!!! Twelve Data critical failure: {e}")
        return _get_fallback_data(ticker)

    # ── 2. TWELVE DATA (Statistics/Fundamentals) ────────────────────
    # If this fails, keep the "N/A" values from the quote response.
    try:
        stats_data = requests.get(
            "https://api.twelvedata.com/statistics",
            params={"symbol": ticker, "apikey": TD_API_KEY},
            timeout=10,
        ).json()
        if stats_data.get("status") != "error":
            valuations = stats_data.get("valuations") or {}
            statistics = stats_data.get("statistics") or {}
            result["pe_ratio"] = _safe_float(
                valuations.get("trailing_pe") or valuations.get("forward_pe")
            ) or "N/A"
            raw_cap = _safe_float(statistics.get("market_capitalization"))
            result["market_cap"] = _format_market_cap(raw_cap)
    except Exception as e:
        print(f"[Twelve Data] Warning: could not fetch statistics for {ticker}: {e}")

    return result

def _safe_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def _format_market_cap(value) -> str:
    if not value: return "N/A"
    if value >= 1e12: return f"${value / 1e12:.2f}T"
    if value >= 1e9: return f"${value / 1e9:.2f}B"
    if value >= 1e6: return f"${value / 1e6:.2f}M"
    return f"${value:,.0f}"

def _get_fallback_data(ticker):
    return {
        "ticker": ticker,
        "company_name": ticker,
        "current_price": 0.0,
        "price_change_pct": 0.0,
        "week_52_high": 0.0,
        "week_52_low": 0.0,
        "pe_ratio": "N/A",
        "market_cap": "N/A",
    }
