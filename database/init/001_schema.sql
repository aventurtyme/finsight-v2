CREATE TABLE IF NOT EXISTS prompt_variants (
    id SERIAL PRIMARY KEY,
    variant_name VARCHAR(50) NOT NULL UNIQUE,
    framing_instruction TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    company_name TEXT,
    generated_at TIMESTAMPTZ NOT NULL,
    price_data JSONB,
    sentiment_score DOUBLE PRECISION,
    ai_summary JSONB,
    news_headlines JSONB,
    crowd_sentiment_rank INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sentiment_aggregation (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL UNIQUE,
    avg_sentiment DOUBLE PRECISION NOT NULL,
    query_count INT NOT NULL DEFAULT 1,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendations (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    prompt_variant CHAR(1) NOT NULL,
    sentiment_score DOUBLE PRECISION NOT NULL,
    recommendation VARCHAR(10) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    bull_case TEXT,
    bear_case TEXT,
    key_risks JSONB,
    overall_grade CHAR(1),
    grade_rationale TEXT,
    sector VARCHAR(50),
    market_cap_tier VARCHAR(20),
    price_at_time DOUBLE PRECISION,
    is_historical BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT recommendations_prompt_variant_check
        CHECK (prompt_variant IN ('A', 'B', 'C')),
    CONSTRAINT recommendations_recommendation_check
        CHECK (recommendation IN ('Buy', 'Hold', 'Reduce')),
    CONSTRAINT recommendations_confidence_check
        CHECK (confidence >= 0.0 AND confidence <= 1.0),
    CONSTRAINT recommendations_sentiment_score_check
        CHECK (sentiment_score >= -1.0 AND sentiment_score <= 1.0),
    CONSTRAINT recommendations_overall_grade_check
        CHECK (overall_grade IS NULL OR overall_grade IN ('A', 'B', 'C', 'D', 'F')),
    CONSTRAINT recommendations_market_cap_tier_check
        CHECK (market_cap_tier IS NULL OR market_cap_tier IN ('large', 'mid', 'small')),
    CONSTRAINT recommendations_unique_replay_row
        UNIQUE (ticker, generated_at, prompt_variant)
);

CREATE TABLE IF NOT EXISTS performance_results (
    id SERIAL PRIMARY KEY,
    recommendation_id INT NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    return_1d DOUBLE PRECISION,
    return_7d DOUBLE PRECISION,
    return_30d DOUBLE PRECISION,
    spy_return_30d DOUBLE PRECISION,
    evaluated_at TIMESTAMPTZ,
    evaluation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT performance_results_recommendation_unique
        UNIQUE (recommendation_id),
    CONSTRAINT performance_results_status_check
        CHECK (evaluation_status IN ('pending', 'partial', 'complete'))
);

CREATE INDEX IF NOT EXISTS idx_recommendations_ticker_generated_at
    ON recommendations (ticker, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_ticker_generated_at
    ON reports (ticker, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_generated_at
    ON reports (generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendations_sector
    ON recommendations (sector);

CREATE INDEX IF NOT EXISTS idx_recommendations_prompt_variant
    ON recommendations (prompt_variant);

CREATE INDEX IF NOT EXISTS idx_performance_results_status
    ON performance_results (evaluation_status);

INSERT INTO prompt_variants (variant_name, framing_instruction)
VALUES
    ('A', 'Neutral framing: evaluate the available company news, price context, and market conditions without favoring bullish or bearish interpretations.'),
    ('B', 'Conservative framing: emphasize downside risk, uncertainty, and capital preservation when evaluating the same inputs.'),
    ('C', 'Growth framing: emphasize upside potential, catalysts, and long-term growth when evaluating the same inputs.')
ON CONFLICT (variant_name) DO NOTHING;
