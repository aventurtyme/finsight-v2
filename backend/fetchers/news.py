import os
from datetime import date, timedelta

import requests
from dotenv import load_dotenv

load_dotenv()

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
FINNHUB_COMPANY_NEWS_URL = "https://finnhub.io/api/v1/company-news"


def fetch_news(
    company_name: str,
    ticker: str,
    max_articles: int = 10,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict]:
    """Fetch recent or historical company news from Finnhub."""
    if not FINNHUB_API_KEY:
        raise RuntimeError("Missing FINNHUB_API_KEY in environment.")

    today = date.today()
    params = {
        "symbol": ticker.upper().strip(),
        "from": from_date or (today - timedelta(days=30)).isoformat(),
        "to": to_date or today.isoformat(),
        "token": FINNHUB_API_KEY,
    }

    try:
        response = requests.get(FINNHUB_COMPANY_NEWS_URL, params=params, timeout=10)
        response.raise_for_status()
        articles = response.json()
    except Exception as e:
        print(f"[Finnhub] Warning: could not fetch news for {ticker}: {e}")
        return []

    company_keyword = company_name.split()[0].lower() if company_name else ticker.lower()
    normalized = []
    for article in articles:
        headline = article.get("headline", "")
        if not headline:
            continue
        if ticker.lower() not in headline.lower() and company_keyword not in headline.lower():
            continue

        published_at = article.get("datetime")
        normalized.append(
            {
                "title": headline,
                "source": article.get("source", ""),
                "published_at": _format_unix_date(published_at),
                "url": article.get("url", ""),
                "summary": article.get("summary", ""),
            }
        )

    return normalized[:max_articles]


def _format_unix_date(value: int | None) -> str:
    if not value:
        return ""
    return date.fromtimestamp(value).isoformat()
