# FinSight 2.0
*AI Financial Intelligence Evaluation Platform*

**Product Requirements Document · v2.2 · June 2026**

---

## 0. How to Use This Document

This document is the single source of truth for FinSight 2.0. It supersedes the original FinSight PRD (v1.0, April 2026) and defines the upgraded platform scope, architecture, and build plan. It is written to be readable both by the developer and by an AI assistant used during development.

**Key conventions:**

- Sections are numbered 0–11 for easy reference.
- Every new feature references the original v1.0 feature it builds on or replaces.
- The AI assistant context block in Section 10 should be pasted at the start of any new Claude session when resuming work.

**Changelog from v2.1:**
- Replaced local Docker PostgreSQL with Neon cloud-hosted PostgreSQL
- Docker removed from the project entirely
- Historical replay year updated from 2024 to 2025
- Historical replay automation added via GitHub Actions daily cron (one ticker per day)
- Skip-if-exists logic added to replay script — re-runs are safe and quota-free
- `--ticker-index` CLI flag added for workflow-driven execution
- `.env` simplified — Docker-specific variables removed

**Changelog from v2.0:**
- Removed Supabase — replaced with local PostgreSQL (now Neon)
- Removed Alpha Vantage and NewsAPI — replaced with Finnhub for news
- Removed Render and Vercel hosting — development and demo run locally
- Updated ticker list and data source strategy for historical replay
- Simplified API stack to: Twelve Data + Finnhub + Gemini only

---

## 1. Project Overview

### 1.1 One-Line Description

FinSight 2.0 is an AI evaluation and decision-support platform that uses financial markets as a testing environment — generating structured investment insights, tracking their historical outcomes, and measuring when AI-generated analysis can actually be trusted.

### 1.2 The Reframe from v1.0

FinSight v1.0 was an AI that generated financial analysis. FinSight 2.0 is a platform that evaluates AI-generated financial analysis. This is a materially different and stronger project concept.

| Dimension | v1.0 (Original) | v2.0 (Upgraded) |
|---|---|---|
| Core question | What does AI think about this stock? | When can AI-generated analysis be trusted? |
| Primary output | AI report card per ticker | Accuracy dashboard + calibration metrics |
| Data requirement | Live API calls only | Historical replay engine + live generation |
| Resume story | Built an AI financial research platform | Built an AI evaluation platform with outcome tracking and calibration testing |
| Target roles | General tech | Product Analytics, Data Analytics, AI Product, Consulting |

### 1.3 Why This Fits the Target Role Profile

The upgraded platform directly demonstrates the competencies that Product Analyst, Data Analyst, and Technology Consulting recruiters screen for:

| Competency | How FinSight 2.0 Demonstrates It |
|---|---|
| Measurement thinking | Defines success metrics for AI outputs; tracks outcomes over time |
| Analytical rigour | Confidence calibration, sector-level accuracy breakdowns, classification metrics |
| AI literacy | Prompt sensitivity analysis shows understanding of model brittleness |
| Insight generation | Written findings narrative: not just dashboards, but conclusions |
| Systems thinking | Crowd vs AI vs Outcome triangle; multi-signal decision framework |

---

## 2. Core Research Questions

Every feature in FinSight 2.0 exists to answer one or more of the following questions. These should be referenced in interviews and in the written findings narrative.

- How accurate are AI-generated investment recommendations overall?
- Does AI accuracy vary by sector, market cap, or volatility regime?
- When AI expresses high confidence, is it actually more accurate? (Calibration)
- Which prompt framing produces the most reliable recommendations?
- Does crowd sentiment or AI analysis better predict actual outcomes?

---

## 3. System Architecture

### 3.1 Architecture Evolution

FinSight 2.0 adds three new layers on top of the v1.0 stack: a Historical Replay Engine, an Outcome Tracking Engine, and an Evaluation & Analytics Layer. The existing generation pipeline is preserved and extended.

**v1.0 Architecture:**
```
News APIs → Gemini Analysis → PostgreSQL → Frontend
```

**v2.0 Architecture:**
```
Finnhub News (historical) → Historical Replay Engine → Recommendation Store
Twelve Data (prices)      → Historical Replay Engine → Recommendation Store
Live Finnhub + Twelve Data → Gemini Analysis (multi-prompt) → Recommendation Store
Recommendation Store → Outcome Tracking Engine → Evaluation Layer → Analytics Dashboard
Crowd Sentiment Layer → Crowd vs AI Comparison Module
```

### 3.2 Component Breakdown

| Component | Technology | Host | Responsibility | v1.0 / New |
|---|---|---|---|---|
| Frontend | React + Tailwind CSS | Local (Vite dev server) | Dashboard, report viewer, evaluation dashboards | Extended |
| Backend API | Python + FastAPI | Local (uvicorn) | REST endpoints, prompt routing | Extended |
| AI Layer | Google Gemini gemini-2.5-flash-preview | Remote API | Multi-prompt report generation, confidence scoring | Extended |
| Historical Replay Engine | Python script + GitHub Actions | GitHub (automated) | Feeds historical news + prices into Gemini; stores backdated recommendations | New |
| Outcome Tracking Engine | Python script | Local (run on schedule) | Calculates 1d / 7d / 30d returns for each recommendation | New |
| Evaluation Layer | Python (pandas, scipy) | Local via FastAPI | Computes accuracy metrics, calibration curves, sector breakdowns | New |
| Database | PostgreSQL | Neon (cloud-hosted) | Stores recommendations, performance results, prompt variants | Updated (was local Docker) |
| Scheduler | GitHub Actions cron | GitHub | Daily replay automation — one ticker per day | Updated (was local cron) |
| Version Control | Git + GitHub | GitHub | Source code, public repo | Unchanged |

**Note on deployment:** The project runs locally for development. A clean deployment to Railway (backend) and Vercel (frontend) will be done once before applications open in January 2027.

**Note on database:** Neon is used instead of local Docker PostgreSQL. Neon's free tier provides 0.5 GB storage, no inactivity pausing, and handles GitHub Actions connection patterns cleanly.

### 3.3 API Stack

Streamlined to three APIs only.

| API | Purpose | Endpoint(s) Used |
|---|---|---|
| **Twelve Data** | Live + historical price data, fundamentals | `/quote`, `/time_series`, `/statistics` |
| **Finnhub** | News headlines (live + historical) | `/company-news` |
| **Google Gemini** | AI report generation (3 prompt variants) | `gemini-2.5-flash-preview` |

**Twelve Data free tier:** 800 credits/day, 8 req/min. The replay script uses a 9-second delay between calls to stay within the rate limit. One ticker = 13 TD calls (1 quote + 12 time_series).

**Finnhub free tier:** `/company-news` supports date-range queries per ticker with historical headlines going back approximately 2 years, covering the Jan–Dec 2025 replay window.

**Gemini free tier:** 20 requests/day. One ticker = 12 Gemini calls. The GitHub Actions workflow processes one ticker per day to stay within this limit.

### 3.4 Database Schema

Neon PostgreSQL. The v1.0 `reports` and `sentiment_aggregation` tables are retained. Three new tables are added for v2.0.

**recommendations** (replaces/extends v1.0 reports for evaluation purposes):
```sql
id               SERIAL PRIMARY KEY,
ticker           VARCHAR(10) NOT NULL,
generated_at     TIMESTAMPTZ NOT NULL,
prompt_variant   CHAR(1) NOT NULL,          -- 'A', 'B', or 'C'
sentiment_score  FLOAT NOT NULL,
recommendation   VARCHAR(10) NOT NULL,      -- 'Buy', 'Hold', 'Reduce'
confidence       FLOAT NOT NULL,            -- 0.0 to 1.0, self-reported by model
bull_case        TEXT,
bear_case        TEXT,
key_risks        JSONB,
overall_grade    CHAR(1),
grade_rationale  TEXT,
sector           VARCHAR(50),
market_cap_tier  VARCHAR(20),               -- 'large', 'mid', 'small'
price_at_time    FLOAT,
is_historical    BOOLEAN DEFAULT FALSE      -- TRUE for replay data
```

**performance_results** (new):
```sql
id                  SERIAL PRIMARY KEY,
recommendation_id   INT REFERENCES recommendations(id),
return_1d           FLOAT,
return_7d           FLOAT,
return_30d          FLOAT,
spy_return_30d      FLOAT,                  -- S&P 500 benchmark (SPY ETF)
evaluated_at        TIMESTAMPTZ,
evaluation_status   VARCHAR(20)             -- 'pending', 'partial', 'complete'
```

**prompt_variants** (new):
```sql
id                    SERIAL PRIMARY KEY,
variant_name          VARCHAR(50),
framing_instruction   TEXT,
created_at            TIMESTAMPTZ
```

---

## 4. Historical Replay — Ticker List and Scope

### 4.1 Target Tickers

16 tickers across 6 sectors. Chosen for news coverage depth, sector diversity, and analytical contrast value.

| Sector | Tickers | Notes |
|---|---|---|
| Technology | AAPL, NVDA, MSFT, AMD | High news coverage — expect strongest AI accuracy here |
| Healthcare | JNJ, UNH, PFE | Mix of stable and volatile; tests AI on uncertainty |
| Energy | XOM, CVX | Macro-driven — AI may underperform crowd here |
| Financials | JPM, GS | Earnings-sensitive; good for calibration testing |
| Consumer Discretionary | AMZN, TSLA, NKE | High volatility and narrative-driven; TSLA especially useful for prompt sensitivity |
| Industrials | CAT, BA | Lower analyst coverage noise; tests degradation on quieter stocks |

### 4.2 Replay Scope

- **Date range:** January 2025 – December 2025
- **Frequency:** One recommendation per ticker per month (monthly sampling)
- **Total data points:** 16 tickers × 12 months = 192 recommendations (baseline, Variant A only)
- **With all 3 prompt variants:** 192 × 3 = 576 recommendations total (Phase 3)
- **Outcome data:** Real Twelve Data historical prices — ground truth is actual market data, not fabricated

### 4.3 Replay Automation

The replay is automated via GitHub Actions. The workflow runs daily at 02:00 UTC, processing one ticker per day. It auto-advances through the ticker list using day-of-year mod 16. The full 16-ticker dataset completes in 16 days.

The script checks the database before each row — if the recommendation already exists, it is skipped without any API calls. This makes re-runs safe and prevents wasting Gemini quota.

Ticker index order (stable — used by `--ticker-index` flag and GitHub Actions):

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

### 4.4 News Data Approach

Finnhub `/company-news` is the sole news source for both historical replay and live generation. For dates where Finnhub returns sparse results (fewer than 3 headlines), the prompt is still sent to Gemini with available data and a note that news coverage was limited. This is recorded in the recommendation metadata and factored into the findings narrative as a data quality observation.

---

## 5. Feature Specifications

### 5.1 Tier 1 — Core (Must Ship)

**Feature 1: Historical Replay Engine**

Purpose: Seed the recommendation database with 190+ backdated data points without waiting months for real-time accumulation.

How it works:
- For each ticker and target month in Jan–Dec 2025, fetch headlines from Finnhub `/company-news` for that month.
- Fetch the closing price on the first trading day of that month from Twelve Data `/time_series`.
- Feed the historical news + price data into Gemini using Variant A (Neutral) prompt.
- Store the recommendation with `generated_at` set to the historical date and `is_historical = TRUE`.
- Outcome tracking then fetches actual subsequent returns using Twelve Data historical prices.
- Automated via GitHub Actions — one ticker per day.

Target output: 192 historical recommendations (16 tickers × 12 months) across 6 sectors before launching the evaluation dashboard.

---

**Feature 2: Outcome Tracking Engine**

Purpose: For every recommendation (historical or live), calculate actual subsequent market returns and store them for evaluation.

Calculated fields per recommendation:

| Field | Definition | Data Source |
|---|---|---|
| return_1d | % price change 1 trading day after recommendation date | Twelve Data `/time_series` |
| return_7d | % price change 7 trading days after recommendation date | Twelve Data `/time_series` |
| return_30d | % price change 30 trading days after recommendation date | Twelve Data `/time_series` |
| spy_return_30d | SPY ETF % change over same 30-day window (benchmark) | Twelve Data `/time_series` |

---

**Feature 3: Confidence Calibration Dashboard**

Purpose: Answer the question — when AI expresses high confidence, is it actually more accurate?

Dashboard displays:
- Confidence band vs. success rate table (bands: 90–100%, 70–90%, 50–70%, <50%).
- Success rate defined as: recommendation direction matched actual 30-day return direction.
- Visual calibration curve: ideal calibration line vs. actual observed accuracy.

---

**Feature 4: Crowd vs AI Comparison**

Purpose: Compare the predictive accuracy of crowd sentiment vs. AI recommendations against actual market outcomes.

Dashboard displays:
- Side-by-side success rate: Crowd vs. AI vs. Buy-and-Hold S&P 500.
- Disagreement analysis: cases where AI and crowd diverge — who was right?
- Sector-level comparison: does crowd wisdom outperform AI in certain sectors?

### 5.2 Tier 2 — High Value (Build After Tier 1)

**Feature 5: Prompt Sensitivity Analysis**

Three prompt variants tested on the same ticker inputs:

| Variant | Framing Instruction | Hypothesis |
|---|---|---|
| A — Neutral | Balanced, objective assessment. No bias toward optimism or caution. | Baseline |
| B — Conservative | Emphasise downside risks, capital preservation, margin of safety. | Expected to produce more Hold/Reduce |
| C — Growth-Oriented | Focus on growth catalysts, upside potential, momentum. | Expected to produce more Buy; test for optimistic bias |

---

**Feature 6: Sector-Level Accuracy Breakdown**

Sectors tracked: Technology, Healthcare, Energy, Financials, Consumer Discretionary, Industrials.

Metrics per sector: success rate (30d), average return of Buy recommendations, average confidence score.

### 5.3 Tier 3 — Include with Correct Framing

**Feature 7: Statistical Analysis (Regression + Classification)**

- OLS regression: sentiment score and confidence score as predictors of 30-day return. Report R², p-values, coefficients.
- Classification metrics: accuracy, precision, recall, F1 (positive 30d return = class 1).

Framing: demonstrate the methodology, not conclusive results. Sample size does not support statistical significance claims.

---

## 6. REST API Design

### 6.1 Base URL (Local Development)

```
http://localhost:8000/api/v1
```

### 6.2 Endpoints

| Method | Endpoint | Description | v1.0 / New |
|---|---|---|---|
| POST | /report | Generate report. Accepts `prompt_variant` param (A/B/C). | Updated |
| GET | /report/{ticker} | Returns most recent cached report. | Unchanged |
| GET | /sentiment/aggregate | Crowd sentiment leaderboard. | Unchanged |
| GET | /evaluation/summary | Overall accuracy metrics: success rate, avg return by recommendation type. | New |
| GET | /evaluation/calibration | Confidence calibration data by band. | New |
| GET | /evaluation/sectors | Accuracy breakdown by sector. | New |
| GET | /evaluation/prompt-sensitivity | Success rate comparison across prompt variants A/B/C. | New |
| GET | /evaluation/crowd-vs-ai | Crowd vs AI vs S&P 500 accuracy comparison. | New |
| GET | /health | Health check. | Unchanged |

---

## 7. AI Layer — Prompt Design

### 7.1 Model

Google Gemini 2.5 Flash Preview (`gemini-2.5-flash-preview`) via the `google-genai` Python SDK. API key in `.env`, never exposed to frontend.

### 7.2 System Prompt (All Variants)

```
You are FinSight, a professional financial analyst AI. Given structured data about a
publicly traded company, you will produce a concise, accurate financial intelligence
report. You MUST respond ONLY with a valid JSON object. No preamble, no markdown,
no explanation outside the JSON.

JSON schema:
{
  "sentiment_score": float between -1.0 and 1.0,
  "recommendation": "Buy" | "Hold" | "Reduce",
  "confidence": float between 0.0 and 1.0,
  "bull_case": string,
  "bear_case": string,
  "key_risks": [array of 3-5 short strings],
  "overall_grade": "A" | "B" | "C" | "D" | "F",
  "grade_rationale": string
}

{FRAMING_INSTRUCTION}
```

### 7.3 Framing Instructions by Variant

| Variant | Framing Instruction |
|---|---|
| A — Neutral | Provide a balanced, objective assessment. Do not bias your recommendation toward optimism or caution. |
| B — Conservative | Analyse conservatively, emphasising downside risks, capital preservation, and margin of safety. Weight negative signals more heavily. |
| C — Growth-Oriented | Focus on growth catalysts, upside potential, and momentum. Weight positive signals and forward-looking indicators more heavily. |

### 7.4 User Prompt Template

```
Analyze the following company and return a JSON report.

Company: {company_name} ({ticker})
Sector: {sector} | Market Cap Tier: {market_cap_tier}
Current Price: ${current_price} | P/E Ratio: {pe_ratio} | Market Cap: {market_cap}
52W High: {week_52_high} | 52W Low: {week_52_low} | 1D Change: {price_change_pct}%

Recent News Headlines:
{news_headlines_list}

Based on all of the above, generate the JSON report.
```

### 7.5 Confidence Score

The `confidence` field (0.0 to 1.0) is self-reported by the model based on the strength and consistency of input signals. It is the primary input to the Confidence Calibration Dashboard.

---

## 8. Frontend Design

### 8.1 Pages and Components

| Page / Route | Description | v1.0 / New |
|---|---|---|
| / (Home / Search) | Ticker search bar. Trending tickers. Prompt variant selector (A/B/C). | Updated |
| /report/:ticker | Report card. Shows prompt variant used and confidence score. | Updated |
| /evaluation | Main evaluation hub. Links to all sub-dashboards. | New |
| /evaluation/accuracy | Overall AI accuracy: success rate, avg returns by recommendation type, AI vs S&P 500. | New |
| /evaluation/calibration | Confidence calibration curve. Confidence band vs success rate table. | New |
| /evaluation/sectors | Sector-level accuracy heatmap and breakdown table. | New |
| /evaluation/prompts | Prompt sensitivity comparison: success rate and return distribution by variant. | New |
| /evaluation/crowd-vs-ai | Crowd vs AI vs S&P 500 comparison. Disagreement analysis. | New |
| /findings | Written insights narrative (200–300 words). The analytical conclusions page. | New |
| /sentiment | Crowd sentiment leaderboard (unchanged from v1.0). | Unchanged |
| /about | Project description, data sources, methodology. | Updated |

### 8.2 The Findings Page

The `/findings` page is the most important page for interview purposes. It is a short written synthesis of what the evaluation data actually shows, updated as data accumulates.

Target structure:
- Overall accuracy: headline number and what it means.
- Most interesting finding: sector disparity, calibration breakdown, or prompt sensitivity result.
- Crowd vs AI: which signal was more predictive, and under what conditions.
- Limitations: sample size, model version, data period, news coverage gaps.
- Implications: what this suggests about deploying AI in financial decision-making.

### 8.3 Design Principles

- Light-mode aesthetic consistent with v1.0 (existing CSS variables preserved).
- Evaluation dashboards are chart-forward — Recharts for calibration curves and bar charts.
- The report card remains screenshot-able for LinkedIn / demo purposes.
- Mobile-responsive. No login required for demo.

---

## 9. Project Milestones and Timeline

Target completion: mid-July 2026. Applications open: January 2027 intake.

| Phase | Dates | Focus | Key Deliverables |
|---|---|---|---|
| Phase 1 | Early June | Foundation + Data | Set up Neon PostgreSQL. Run schema. Update fetchers (Twelve Data + Finnhub only). Update Gemini prompt for confidence + recommendation fields. Build Historical Replay Engine. Automate via GitHub Actions. Seed 192 historical recommendations. Verify outcome data quality. |
| Phase 2 | Mid–Late June | Evaluation Core | Build Outcome Tracking Engine. Build Confidence Calibration Dashboard. Build Crowd vs AI Comparison module. Wire up evaluation API endpoints. |
| Phase 3 | Early July | Prompt Sensitivity + Sectors | Run historical replay for Variants B and C. Build Sector Accuracy Dashboard. Build Prompt Sensitivity Dashboard. |
| Phase 4 | Mid July | Polish + Narrative | Write /findings narrative based on actual data. Add statistical analysis (Tier 3). Polish UI. Update resume bullets. Prep interview talking points. |
| Buffer | Late July | Deployment + Review | Single clean deployment to Railway + Vercel. Final QA. Ensure demo runs cleanly. GitHub repo public and documented. |

---

## 10. AI Assistant Context Block

Paste the following block at the start of any new Claude session when resuming work on this project.

```
--- PROJECT CONTEXT (paste at start of session) ---

Project: FinSight 2.0 — AI Financial Intelligence Evaluation Platform
Version: 2.2 (infrastructure update, June 2026)
Target completion: Mid-July 2026 | Applications: Jan 2027 internship intake

Core concept: Evaluate WHEN AI-generated financial analysis can be trusted.
Not a financial analysis tool — an AI evaluation platform using financial markets as the testing environment.

Stack:
Backend: Python + FastAPI (local uvicorn)
Frontend: React + Tailwind + Recharts (local Vite)
Database: PostgreSQL on Neon (cloud-hosted, free tier)
AI: Google Gemini gemini-2.5-flash-preview (3 prompt variants: Neutral / Conservative / Growth)
Data: Twelve Data API (prices + fundamentals) + Finnhub (news only)
Replay automation: GitHub Actions daily cron — one ticker per day
Repo: https://github.com/aventurtyme/sc4052-project.git

Docker: NOT used. Removed in v2.2.

APIs used (3 total):
- Twelve Data: /quote, /time_series, /statistics
- Finnhub: /company-news
- Google Gemini: gemini-2.5-flash-preview

Removed from v1.0: Alpha Vantage, NewsAPI, Supabase, Render, Vercel (dev), Docker

Ticker list (16 tickers, 6 sectors), stable index order:
0=AAPL, 1=NVDA, 2=MSFT, 3=AMD (Technology)
4=JNJ, 5=UNH, 6=PFE (Healthcare)
7=XOM, 8=CVX (Energy)
9=JPM, 10=GS (Financials)
11=AMZN, 12=TSLA, 13=NKE (Consumer Discretionary)
14=CAT, 15=BA (Industrials)

Historical replay scope: Jan 2025 – Dec 2025, monthly per ticker, Variant A first
Target data points: 192 (Phase 1), 576 with all 3 variants (Phase 3)

Replay automation: .github/workflows/historical_replay.yml
- Runs daily at 02:00 UTC
- One ticker per day (stays within Gemini 20 RPD free tier)
- Auto-advances via day-of-year mod 16
- Skip-if-exists logic prevents re-processing

New in v2.0:
1. Historical Replay Engine (seed 192 backdated recommendations)
2. Outcome Tracking Engine (1d / 7d / 30d returns vs SPY benchmark)
3. Confidence Calibration Dashboard
4. Crowd vs AI vs Market Comparison
5. Prompt Sensitivity Analysis (3 variants — which framing is most reliable?)
6. Sector-Level Accuracy Breakdown
7. /findings page — written analytical narrative

Target roles: Product Analyst, Data Analyst, BI Analyst, Growth Analyst, Customer Analytics (primary); Technology Consulting, Data & AI Consulting (secondary)

Current milestone: [INSERT CURRENT PHASE/TASK HERE]

--- END CONTEXT ---
```

---

## 11. Resume and Interview Positioning

### 11.1 Recommended Resume Bullet

Built an AI financial intelligence evaluation platform (FinSight 2.0) that generated 190+ structured investment recommendations via Google Gemini, tracked historical market outcomes, and measured AI accuracy across confidence bands, sectors, and prompt framings — identifying conditions under which AI analysis is and is not reliable.

### 11.2 Key Interview Talking Points

- **On the core concept:** "Most AI finance projects just generate analysis. I wanted to know if the analysis was actually any good — so I built the evaluation layer on top."
- **On the API simplification:** "I deliberately streamlined to three APIs — Twelve Data, Finnhub, and Gemini — to reduce failure surface area and keep the architecture clean. Fewer moving parts means more reliable demos."
- **On confidence calibration:** "We found that AI confidence scores were reasonably predictive above 80% but essentially uninformative below 70% — which has direct implications for how you'd deploy this in a real workflow." *(Adjust with actual findings.)*
- **On prompt sensitivity:** "Running the same ticker through three different prompt framings showed meaningful variance in recommendations — which tells you the output is sensitive to how you ask the question, not just what the data says."
- **On crowd vs AI:** "The crowd sentiment layer outperformed AI on [sector] but underperformed on [sector] — which suggests hybrid signals could be more robust than either alone." *(Adjust with actual findings.)*
- **On limitations:** "With ~190 data points, I can't claim statistical significance — but I can demonstrate the methodology. The framework scales with data, and the findings narrative is honest about sample size constraints."

### 11.3 Portfolio Differentiation

| Project | Primary Competency Demonstrated |
|---|---|
| QBE (if applicable) | Analytics, segmentation, business recommendations |
| Singtel (if applicable) | Personalization, customer strategy |
| OpenF1 (if applicable) | Data engineering, execution |
| FinSight 2.0 | AI evaluation, measurement, experimentation, decision science |

FinSight 2.0 fills the evaluation and measurement competency gap — a distinct and increasingly valued skill set across all target roles.

---

## 12. Out of Scope

| Feature | Reason Excluded |
|---|---|
| Portfolio Mode | Shifts story back to financial dashboard; does not add evaluation competency |
| Email Digest | Personalisation feature; irrelevant to target role profile |
| Options Sentiment (put/call ratio) | Domain complexity without analytical payoff for target roles |
| Voice Interface | UI feature; no analytical signal |
| Mobile App (React Native) | Engineering complexity; no differentiation for analyst/consulting roles |
| Docker | Removed in v2.2 — unnecessary complexity for a cloud-DB project |
| Technical indicators (RSI, MACD, EMA) | Required additional API calls; removed with Alpha Vantage |

---

*FinSight 2.0 PRD • v2.2 • June 2026 • For internal development use*