from datetime import datetime, timezone

from psycopg.types.json import Jsonb

from db.postgres import execute, fetch_all, fetch_one


def get_latest_report(ticker: str) -> dict | None:
    return fetch_one(
        """
        SELECT *
        FROM reports
        WHERE ticker = %s
        ORDER BY generated_at DESC
        LIMIT 1
        """,
        (ticker.upper(),),
    )


def insert_report(report: dict) -> dict:
    return execute(
        """
        INSERT INTO reports (
            ticker,
            company_name,
            generated_at,
            price_data,
            sentiment_score,
            ai_summary,
            news_headlines,
            crowd_sentiment_rank
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            report["ticker"].upper(),
            report.get("company_name"),
            report["generated_at"],
            Jsonb(report.get("price_data")),
            report.get("sentiment_score"),
            Jsonb(report.get("ai_summary")),
            Jsonb(report.get("news_headlines")),
            report.get("crowd_sentiment_rank"),
        ),
    )


def count_tickers_with_higher_sentiment(sentiment_score: float) -> int:
    row = fetch_one(
        """
        SELECT COUNT(*) AS count
        FROM sentiment_aggregation
        WHERE avg_sentiment > %s
        """,
        (sentiment_score,),
    )
    return row["count"] if row else 0


def upsert_sentiment_aggregation(ticker: str, new_score: float) -> None:
    ticker = ticker.upper()
    existing = fetch_one(
        """
        SELECT *
        FROM sentiment_aggregation
        WHERE ticker = %s
        """,
        (ticker,),
    )
    now = datetime.now(timezone.utc)

    if existing:
        query_count = existing["query_count"]
        new_avg = round((existing["avg_sentiment"] * query_count + new_score) / (query_count + 1), 4)
        execute(
            """
            UPDATE sentiment_aggregation
            SET avg_sentiment = %s,
                query_count = %s,
                last_updated = %s
            WHERE ticker = %s
            RETURNING *
            """,
            (new_avg, query_count + 1, now, ticker),
        )
        return

    execute(
        """
        INSERT INTO sentiment_aggregation (ticker, avg_sentiment, query_count, last_updated)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (ticker, round(new_score, 4), 1, now),
    )


def list_sentiment_aggregate(limit: int) -> list[dict]:
    return fetch_all(
        """
        SELECT *
        FROM sentiment_aggregation
        ORDER BY avg_sentiment DESC
        LIMIT %s
        """,
        (limit,),
    )


def list_report_tickers_since(cutoff: str) -> list[dict]:
    return fetch_all(
        """
        SELECT ticker
        FROM reports
        WHERE generated_at > %s
        """,
        (cutoff,),
    )
