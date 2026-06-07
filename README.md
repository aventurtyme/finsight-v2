# FinSight 2.0

**AI Financial Intelligence Evaluation Platform**

FinSight 2.0 evaluates when AI-generated financial analysis can be trusted. It uses public market data as the testing environment, generates structured AI recommendations, tracks real outcomes, and measures reliability across confidence, sector, prompt framing, and benchmark performance.

This is not primarily a stock analysis tool. The core product is an AI evaluation platform with financial markets as the measurable domain.

## Current Version

Product Requirements Document: v2.2, June 2026

Current milestone: Phase 1

Target completion: Mid-July 2026

## What It Does

Phase 1 focuses on building the evaluation data foundation:

1. Generate backdated AI recommendations for selected stocks using historical news and price data (Jan–Dec 2025).
2. Store recommendations in Neon PostgreSQL.
3. Calculate 1-day, 7-day, and 30-day outcomes against actual market movement.
4. Compare 30-day performance against SPY as the market benchmark.
5. Expose the stored recommendations and evaluation metrics through the FastAPI backend.

Later phases extend this into dashboard views for confidence calibration, prompt sensitivity, crowd vs AI vs market comparison, sector accuracy, and a written findings page.

## Tech Stack

| Layer | Technology | Host |
|---|---|---|
| Frontend | React + Tailwind CSS + Recharts | Local Vite dev server |
| Backend API | Python + FastAPI | Local uvicorn |
| Database | PostgreSQL | Neon (cloud-hosted) |
| AI | Google Gemini `gemini-2.5-flash-preview` | Remote API |
| Price and fundamentals data | Twelve Data | Remote API |
| News data | Finnhub `/company-news` | Remote API |
| Replay automation | GitHub Actions (daily cron) | GitHub |

Docker is not used. The database runs on Neon's free tier.

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
| Date range | January 2025 to December 2025 |
| Frequency | One recommendation per ticker per month |
| Prompt variant | Variant A, neutral framing |
| Tickers | 16 |
| Target recommendations | 192 |

Ticker universe:

| Sector | Tickers |
|---|---|
| Technology | AAPL, NVDA, MSFT, AMD |
| Healthcare | JNJ, UNH, PFE |
| Energy | XOM, CVX |
| Financials | JPM, GS |
| Consumer Discretionary | AMZN, TSLA, NKE |
| Industrials | CAT, BA |

## Historical Replay Automation

The replay script runs automatically via GitHub Actions — one ticker per day to stay within Gemini's 20 requests/day free tier limit.

The workflow (`.github/workflows/historical_replay.yml`) runs daily at 02:00 UTC and auto-advances through the 16-ticker list. It can also be triggered manually from the Actions tab with an optional ticker index override.

The script skips any row already in the database, so re-runs are safe and won't consume API quota.

Rate limiting built into the script:
- Gemini: 2s delay between calls
- Twelve Data: 9s delay between calls (stays within 8 req/min free tier)
- Finnhub: 0.5s courtesy delay

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/aventurtyme/sc4052-project.git
cd sc4052-project
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
cp backend/.env.example backend/.env
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `TWELVE_DATA_API_KEY` | Twelve Data API key |
| `FINNHUB_API_KEY` | Finnhub API key |
| `GEMINI_API_KEY` | Google AI Studio API key |

No Docker is required. The database runs on Neon.

### 3. Set Up the Database

Run the schema SQL against your Neon database. The easiest way is to paste the contents of `database/init/001_schema.sql` into the Neon SQL Editor on the dashboard and click Run.

Alternatively, if you have `psql` installed:

```bash
psql "your-neon-connection-string" -f database/init/001_schema.sql
```

### 4. Run the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend default URL:

```
http://localhost:8000
```

### 5. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL:

```
http://localhost:5173
```

## Running the Replay Script Manually

To run a single ticker manually:

```bash
cd backend
python scripts/historical_replay.py --tickers AAPL
```

To run by ticker index (matches the GitHub Actions index):

```bash
python scripts/historical_replay.py --ticker-index 0   # AAPL
python scripts/historical_replay.py --ticker-index 1   # NVDA
```

Ticker index reference:

| Index | Ticker | Index | Ticker |
|---|---|---|---|
| 0 | AAPL | 8 | CVX |
| 1 | NVDA | 9 | JPM |
| 2 | MSFT | 10 | GS |
| 3 | AMD | 11 | AMZN |
| 4 | JNJ | 12 | TSLA |
| 5 | UNH | 13 | NKE |
| 6 | PFE | 14 | CAT |
| 7 | XOM | 15 | BA |

To dry-run without making any API calls or DB writes:

```bash
python scripts/historical_replay.py --dry-run
```

## GitHub Actions Setup

Add the following secrets to your repository (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `GEMINI_API_KEY` | Google AI Studio key |
| `TWELVE_DATA_API_KEY` | Twelve Data key |
| `FINNHUB_API_KEY` | Finnhub key |

To trigger a manual run: Actions → "Historical Replay — Daily Batch" → Run workflow. You can specify a ticker index or enable dry run from the dispatch form.

## Core Database Tables

| Table | Purpose |
|---|---|
| `recommendations` | AI recommendation records, including historical replay rows |
| `performance_results` | 1-day, 7-day, and 30-day realized outcome tracking |
| `prompt_variants` | Prompt framing definitions for Variant A, B, and C |
| `reports` | Legacy v1.0 report store — keeps the live frontend working |
| `sentiment_aggregation` | Crowd sentiment leaderboard data |

## Project Structure

```
sc4052-project/
├── backend/
│   ├── ai/               # Gemini client and prompt builder
│   ├── db/               # PostgreSQL access layer
│   ├── fetchers/         # Twelve Data and Finnhub fetchers
│   ├── routers/          # FastAPI route handlers
│   ├── scripts/          # historical_replay.py and outcome tracking
│   └── main.py
├── database/
│   └── init/
│       └── 001_schema.sql
├── frontend/             # React dashboard
├── .github/
│   └── workflows/
│       └── historical_replay.yml
├── finsight_v2.md        # Product Requirements Document v2.2
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

Phase 1 in progress. Historical replay running via GitHub Actions — one ticker per day.