# FinSight 2.0

**AI Financial Intelligence Evaluation Platform**

FinSight 2.0 evaluates when AI-generated financial analysis can be trusted. It uses public market data as the testing environment, generates structured AI recommendations, tracks real outcomes, and measures reliability across confidence, sector, prompt framing, and benchmark performance.

This is not primarily a stock analysis tool. The core product is an AI evaluation platform with financial markets as the measurable domain.

## Current Version

Product Requirements Document: v2.1, June 2026

Current milestone: Phase 1

Target completion: Mid-July 2026

## What It Does

Phase 1 focuses on building the evaluation data foundation:

1. Generate backdated AI recommendations for selected stocks using historical news and price data.
2. Store recommendations in local PostgreSQL.
3. Calculate 1-day, 7-day, and 30-day outcomes against actual market movement.
4. Compare 30-day performance against SPY as the market benchmark.
5. Expose the stored recommendations and evaluation metrics through the FastAPI backend.

Later phases extend this into dashboard views for confidence calibration, prompt sensitivity, crowd vs AI vs market comparison, sector accuracy, and a written findings page.

## Tech Stack

| Layer | Technology | Host |
|---|---|---|
| Frontend | React + Tailwind CSS + Recharts | Local Vite dev server |
| Backend API | Python + FastAPI | Local uvicorn |
| Database | PostgreSQL | Local Docker container |
| AI | Google Gemini `gemini-2.5-flash-preview` | Remote API |
| Price and fundamentals data | Twelve Data | Remote API |
| News data | Finnhub `/company-news` | Remote API |
| Scheduler | Local script or cron | Local |

Removed from v1.0: Supabase, Alpha Vantage, NewsAPI, Render, and Vercel development deployment.

## API Stack

FinSight 2.0 uses three external APIs:

| API | Purpose |
|---|---|
| Twelve Data | Quotes, historical time series, and statistics |
| Finnhub | Company news headlines |
| Google Gemini | Structured AI recommendation generation |

## Phase 1 Scope

The first milestone is the historical replay and outcome tracking foundation.

Target replay dataset:

| Scope | Value |
|---|---|
| Date range | January 2024 to December 2024 |
| Frequency | One recommendation per ticker per month |
| Prompt variant | Variant A, neutral framing |
| Tickers | 18 |
| Target recommendations | 216 |

Ticker universe:

| Sector | Tickers |
|---|---|
| Technology | AAPL, NVDA, MSFT, AMD |
| Healthcare | JNJ, UNH, PFE |
| Energy | XOM, CVX |
| Financials | JPM, GS |
| Consumer Discretionary | AMZN, TSLA, NKE |
| Industrials | CAT, BA |

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/aventurtyme/sc4052-project.git
cd sc4052-project
```

### 2. Start PostgreSQL with Docker

```bash
docker compose up -d
```

The local database runs in Docker so PostgreSQL does not need to be installed directly on your machine.

### 3. Configure Environment Variables

Create a `.env` file in the `backend/` directory.

```bash
cp backend/.env.example backend/.env
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Local PostgreSQL connection string |
| `TWELVE_DATA_API_KEY` | Twelve Data API key |
| `FINNHUB_API_KEY` | Finnhub API key |
| `GEMINI_API_KEY` | Google AI Studio API key |

### 4. Run the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend default URL:

```text
http://localhost:8000
```

### 5. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL:

```text
http://localhost:5173
```

## Planned Phase 1 Build Order

1. Docker PostgreSQL setup
2. Initial SQL schema
3. Backend PostgreSQL connection layer
4. API key and dependency cleanup
5. Finnhub and Twelve Data fetchers
6. Gemini Variant A structured prompt
7. Historical replay script
8. Outcome tracking script
9. Basic evaluation endpoints
10. Small dry run
11. Full 216-recommendation replay

## Core Database Tables

Phase 1 uses three evaluation tables:

| Table | Purpose |
|---|---|
| `recommendations` | AI recommendation records, including historical replay rows |
| `performance_results` | 1-day, 7-day, and 30-day realized outcome tracking |
| `prompt_variants` | Prompt framing definitions for Variant A, B, and C |

The v1.0 `reports` and `sentiment_aggregation` tables may remain temporarily for compatibility, but new evaluation work should use the v2.1 schema.

## Project Structure

```text
sc4052-project/
├── backend/          # FastAPI app, data fetchers, AI layer, DB access
├── frontend/         # React dashboard
├── finsight_v2.md    # Product Requirements Document v2.1
└── README.md
```

## Research Questions

FinSight 2.0 is designed to answer:

1. How accurate are AI-generated investment recommendations overall?
2. Does AI accuracy vary by sector, market cap, or volatility regime?
3. When AI expresses high confidence, is it actually more accurate?
4. Which prompt framing produces the most reliable recommendations?
5. Does crowd sentiment or AI analysis better predict actual outcomes?

## Status

The repository is currently being migrated from the original v1.0 architecture to the v2.1 local evaluation platform architecture.
