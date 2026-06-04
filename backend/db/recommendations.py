from psycopg.types.json import Jsonb

from db.postgres import execute, fetch_all, fetch_one


def insert_recommendation(recommendation: dict) -> dict:
    return execute(
        """
        INSERT INTO recommendations (
            ticker,
            generated_at,
            prompt_variant,
            sentiment_score,
            recommendation,
            confidence,
            bull_case,
            bear_case,
            key_risks,
            overall_grade,
            grade_rationale,
            sector,
            market_cap_tier,
            price_at_time,
            is_historical
        )
        VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (ticker, generated_at, prompt_variant)
        DO UPDATE SET
            sentiment_score = EXCLUDED.sentiment_score,
            recommendation = EXCLUDED.recommendation,
            confidence = EXCLUDED.confidence,
            bull_case = EXCLUDED.bull_case,
            bear_case = EXCLUDED.bear_case,
            key_risks = EXCLUDED.key_risks,
            overall_grade = EXCLUDED.overall_grade,
            grade_rationale = EXCLUDED.grade_rationale,
            sector = EXCLUDED.sector,
            market_cap_tier = EXCLUDED.market_cap_tier,
            price_at_time = EXCLUDED.price_at_time,
            is_historical = EXCLUDED.is_historical
        RETURNING *
        """,
        (
            recommendation["ticker"].upper(),
            recommendation["generated_at"],
            recommendation["prompt_variant"],
            recommendation["sentiment_score"],
            recommendation["recommendation"],
            recommendation["confidence"],
            recommendation.get("bull_case"),
            recommendation.get("bear_case"),
            Jsonb(recommendation.get("key_risks")),
            recommendation.get("overall_grade"),
            recommendation.get("grade_rationale"),
            recommendation.get("sector"),
            recommendation.get("market_cap_tier"),
            recommendation.get("price_at_time"),
            recommendation.get("is_historical", False),
        ),
    )


def list_recommendations(limit: int = 100, ticker: str | None = None) -> list[dict]:
    if ticker:
        return fetch_all(
            """
            SELECT *
            FROM recommendations
            WHERE ticker = %s
            ORDER BY generated_at DESC
            LIMIT %s
            """,
            (ticker.upper(), limit),
        )

    return fetch_all(
        """
        SELECT *
        FROM recommendations
        ORDER BY generated_at DESC
        LIMIT %s
        """,
        (limit,),
    )


def get_recommendation(recommendation_id: int) -> dict | None:
    return fetch_one(
        """
        SELECT *
        FROM recommendations
        WHERE id = %s
        """,
        (recommendation_id,),
    )


def list_recommendations_without_complete_performance(limit: int = 100) -> list[dict]:
    return fetch_all(
        """
        SELECT r.*
        FROM recommendations r
        LEFT JOIN performance_results p
            ON p.recommendation_id = r.id
        WHERE p.id IS NULL
            OR p.evaluation_status <> 'complete'
        ORDER BY r.generated_at ASC
        LIMIT %s
        """,
        (limit,),
    )


def upsert_performance_result(result: dict) -> dict:
    return execute(
        """
        INSERT INTO performance_results (
            recommendation_id,
            return_1d,
            return_7d,
            return_30d,
            spy_return_30d,
            evaluated_at,
            evaluation_status
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (recommendation_id)
        DO UPDATE SET
            return_1d = EXCLUDED.return_1d,
            return_7d = EXCLUDED.return_7d,
            return_30d = EXCLUDED.return_30d,
            spy_return_30d = EXCLUDED.spy_return_30d,
            evaluated_at = EXCLUDED.evaluated_at,
            evaluation_status = EXCLUDED.evaluation_status,
            updated_at = NOW()
        RETURNING *
        """,
        (
            result["recommendation_id"],
            result.get("return_1d"),
            result.get("return_7d"),
            result.get("return_30d"),
            result.get("spy_return_30d"),
            result.get("evaluated_at"),
            result["evaluation_status"],
        ),
    )
