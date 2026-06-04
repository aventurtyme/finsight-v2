from fastapi import APIRouter, Query

from db.postgres import fetch_all, fetch_one
from db.recommendations import list_recommendations

router = APIRouter(prefix="/api/v1/evaluation", tags=["evaluation"])


@router.get("/recommendations")
async def get_recommendations(
    ticker: str | None = Query(None, description="Optional ticker filter"),
    limit: int = Query(100, ge=1, le=500),
):
    return {
        "recommendations": list_recommendations(limit=limit, ticker=ticker),
        "limit": limit,
    }


@router.get("/performance")
async def get_performance(limit: int = Query(100, ge=1, le=500)):
    rows = fetch_all(
        """
        SELECT
            p.*,
            r.ticker,
            r.generated_at,
            r.prompt_variant,
            r.recommendation,
            r.confidence,
            r.sector
        FROM performance_results p
        JOIN recommendations r
            ON r.id = p.recommendation_id
        ORDER BY r.generated_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    return {"performance_results": rows, "limit": limit}


@router.get("/summary")
async def get_summary():
    row = fetch_one(
        """
        SELECT
            COUNT(*) AS total_recommendations,
            COUNT(p.id) AS evaluated_recommendations,
            COUNT(*) FILTER (
                WHERE p.return_30d IS NOT NULL
                    AND (
                        (r.recommendation = 'Buy' AND p.return_30d > 0)
                        OR (r.recommendation = 'Reduce' AND p.return_30d < 0)
                        OR (r.recommendation = 'Hold' AND ABS(p.return_30d) <= 0.02)
                    )
            ) AS successful_30d_recommendations
        FROM recommendations r
        LEFT JOIN performance_results p
            ON p.recommendation_id = r.id
        """
    )
    total_evaluated = row["evaluated_recommendations"] or 0
    successful = row["successful_30d_recommendations"] or 0
    success_rate = successful / total_evaluated if total_evaluated else None

    return {
        **row,
        "success_rate_30d": success_rate,
    }


@router.get("/confidence-bands")
async def get_confidence_bands():
    rows = fetch_all(
        """
        WITH scored AS (
            SELECT
                CASE
                    WHEN r.confidence >= 0.9 THEN '90-100%'
                    WHEN r.confidence >= 0.7 THEN '70-90%'
                    WHEN r.confidence >= 0.5 THEN '50-70%'
                    ELSE '<50%'
                END AS confidence_band,
                CASE
                    WHEN p.return_30d IS NULL THEN NULL
                    WHEN r.recommendation = 'Buy' AND p.return_30d > 0 THEN 1
                    WHEN r.recommendation = 'Reduce' AND p.return_30d < 0 THEN 1
                    WHEN r.recommendation = 'Hold' AND ABS(p.return_30d) <= 0.02 THEN 1
                    ELSE 0
                END AS is_successful
            FROM recommendations r
            JOIN performance_results p
                ON p.recommendation_id = r.id
            WHERE p.return_30d IS NOT NULL
        )
        SELECT
            confidence_band,
            COUNT(*) AS total,
            SUM(is_successful) AS successful,
            AVG(is_successful::DOUBLE PRECISION) AS success_rate
        FROM scored
        GROUP BY confidence_band
        ORDER BY
            CASE confidence_band
                WHEN '90-100%' THEN 1
                WHEN '70-90%' THEN 2
                WHEN '50-70%' THEN 3
                ELSE 4
            END
        """
    )
    return {"confidence_bands": rows}


@router.get("/sectors")
async def get_sector_summary():
    rows = fetch_all(
        """
        SELECT
            COALESCE(r.sector, 'Unknown') AS sector,
            COUNT(*) AS total,
            COUNT(p.id) AS evaluated,
            AVG(p.return_30d) AS avg_return_30d,
            AVG(p.return_30d - p.spy_return_30d) AS avg_excess_return_30d
        FROM recommendations r
        LEFT JOIN performance_results p
            ON p.recommendation_id = r.id
        GROUP BY COALESCE(r.sector, 'Unknown')
        ORDER BY sector
        """
    )
    return {"sectors": rows}
