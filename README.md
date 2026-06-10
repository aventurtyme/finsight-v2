# FinSight 2.0

**AI Financial Intelligence Evaluation Platform**

FinSight 2.0 evaluates when AI-generated financial analysis can be trusted. It generates structured investment recommendations via Google Gemini, tracks real market outcomes against those recommendations, and measures reliability across confidence bands, sectors, prompt framings, and crowd sentiment signals.

This is not primarily a stock analysis tool. The core product is an AI evaluation platform that uses financial markets as a measurable, ground-truth testing environment.

---

## What It Does

1. Generates backdated and live AI recommendations for selected stocks using historical news and price data.
2. Stores recommendations in Neon PostgreSQL with metadata: sector, market cap tier, prompt variant, confidence score.
3. Calculates 1-day, 7-day, and 30-day outcomes against actual market prices.
4. Compares performance against SPY as the market benchmark.
5. Exposes evaluation metrics through a FastAPI backend and React dashboard.

### Evaluation dashboards

| Dashboard | Research Question |
|---|---|
| Overall Accuracy | How accurate are AI recommendations overall? |
| Confidence Calibration | When AI expresses high confidence, is it actually more accurate? |
| Sector Breakdown | Does accuracy vary by sector or market conditions? |
| Crowd vs AI | Does crowd sentiment or AI analysis better predict outcomes? |
| Prompt Sensitivity | Which prompt framing produces the most reliable recommendations? |

---

## Tech Stack

| Layer | Technology | Host |
|---|---|---|
| Frontend | React + Tailwind CSS + Recharts | Local Vite dev server |
| Backend API | Python + FastAPI | Local uvicorn |
| Database | PostgreSQL | Neon (cloud-hosted) |
| AI | Google Gemini `gemini-3.5-flash` | Remote API |
| Price and fundamentals | Twelve Data | Remote API |
| News | Finnhub `/company-news` | Remote API |
| Replay automation | GitHub Actions (daily cron) | GitHub |

---

## API Stack

| API | Purpose |
|---|---|
| Twelve Data | Quotes, historical time series, and statistics |
| Finnhub | Company news headlines (live and historical) |
| Google Gemini | Structured AI recommendation generation |

---

## Ticker Universe

18 tickers across 6 sectors. Replay covers Jan–Dec 2025 at monthly frequency.

| Sector | Tickers |
|---|---|
| Technology | AAPL, NVDA, MSFT, AMD |
| Healthcare | JNJ, UNH, PFE |
| Energy | XOM, CVX |
| Financials | JPM, GS |
| Consumer Discretionary | AMZN, TSLA, NKE |
| Industrials | CAT, BA |

---

## Prompt Variants

Three framing variants are tested on the same input data to measure prompt sensitivity.

| Variant | Framing |
|---|---|
| A — Neutral | Balanced, objective assessment. No bias toward optimism or caution. |
| B — Conservative | Emphasise downside risks, capital preservation, and margin of safety. |
| C — Growth | Focus on growth catalysts, upside potential, and momentum. |

---

## Database Schema

| Table | Purpose |
|---|---|
| `recommendations` | AI recommendation records including historical replay rows |
| `performance_results` | 1-day, 7-day, and 30-day realised outcome tracking |
| `prompt_variants` | Prompt framing definitions for Variants A, B, and C |
| `reports` | Legacy v1.0 report store — keeps the live report frontend working |
| `sentiment_aggregation` | Crowd sentiment leaderboard data |

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/aventurtyme/sc4052-project.git
cd sc4052-project
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `TWELVE_DATA_API_KEY` | Twelve Data API key |
| `FINNHUB_API_KEY` | Finnhub API key |
| `GEMINI_API_KEY` | Google AI Studio API key |

### 3. Initialise the database

Paste `database/init/001_schema.sql` into the Neon SQL Editor and run it, or use psql:

```bash
psql "your-neon-connection-string" -f database/init/001_schema.sql
```

### 4. Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 5. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Automation

Two GitHub Actions workflows run daily:

| Workflow | Schedule | Purpose |
|---|---|---|
| `historical_replay.yml` | 02:00 UTC | Processes one ticker per day through the replay engine |
| `outcome_tracking.yml` | 03:00 UTC | Calculates realised returns for all pending recommendations |

Both can be triggered manually from the Actions tab with optional overrides. The replay script skips rows already in the database, so re-runs are safe.

### GitHub Actions secrets required

| Secret | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `GEMINI_API_KEY` | Google AI Studio key |
| `TWELVE_DATA_API_KEY` | Twelve Data key |
| `FINNHUB_API_KEY` | Finnhub key |

---

## Running Scripts Manually

**Historical replay — single ticker:**

```bash
cd backend
python scripts/historical_replay.py --tickers AAPL
python scripts/historical_replay.py --ticker-index 0   # AAPL
```

**Outcome tracking:**

```bash
python scripts/outcome_tracking.py
python scripts/outcome_tracking.py --limit 50
python scripts/outcome_tracking.py --dry-run
```

**Ticker index reference:**

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

---

## Project Structure

```
sc4052-project/
├── backend/
│   ├── ai/               # Gemini client and prompt builder
│   ├── db/               # PostgreSQL access layer
│   ├── fetchers/         # Twelve Data and Finnhub fetchers
│   ├── routers/          # FastAPI route handlers
│   ├── scripts/          # historical_replay.py and outcome_tracking.py
│   └── main.py
├── database/
│   └── init/
│       └── 001_schema.sql
├── frontend/             # React dashboard
├── .github/
│   └── workflows/
│       ├── historical_replay.yml
│       └── outcome_tracking.yml
├── finsight_v2.md        # Product Requirements Document v2.2
└── README.md
```

---

## Research Questions

1. How accurate are AI-generated investment recommendations overall?
2. Does AI accuracy vary by sector, market cap, or volatility regime?
3. When AI expresses high confidence, is it actually more accurate?
4. Which prompt framing produces the most reliable recommendations?
5. Does crowd sentiment or AI analysis better predict actual outcomes?