import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function fetchCrowdVsAI() {
  const r = await fetch(`${BASE}/evaluation/crowd-vs-ai`);
  return r.json();
}

const fmt = (n, decimals = 1) =>
  n == null ? '—' : `${(n * 100).toFixed(decimals)}%`;

const fmtReturn = (n) => {
  if (n == null) return '—';
  const pct = (n * 100).toFixed(2);
  return n >= 0 ? `+${pct}%` : `${pct}%`;
};

function StatCard({ label, value, sub, highlight }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-2">
      <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
        {label}
      </p>
      <p className={`font-mono text-3xl ${highlight || 'text-[var(--fg-primary)]'}`}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--fg-muted)] font-sans">{sub}</p>}
    </div>
  );
}

export default function EvaluationCrowdVsAI() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchCrowdVsAI()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
      <div className="spinner" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
      <p className="text-[var(--accent-rust)] font-mono text-sm">{error}</p>
    </div>
  );

  const summary = data?.summary ?? {};
  const detail  = data?.detail  ?? [];

  // ── Bar chart: AI vs Crowd comparison ───────────────────────────────
  const barData = [
    { label: 'AI',    value: summary.ai_success_rate,    fill: 'var(--accent-sage)'  },
    { label: 'Crowd', value: summary.crowd_success_rate, fill: 'var(--accent-slate)' },
    { label: 'Baseline (50%)', value: 0.5,               fill: 'var(--border-strong)'},
  ];

  // ── Disagreement analysis ────────────────────────────────────────────
  // Cases where AI and crowd signals diverge (AI bullish, crowd bearish or vice versa)
  const disagreements = detail.filter(row => {
    if (row.ai_sentiment == null || row.crowd_sentiment == null) return false;
    const aiPositive    = row.ai_sentiment    >  0.1;
    const crowdPositive = row.crowd_sentiment >  0.1;
    const aiNegative    = row.ai_sentiment    < -0.1;
    const crowdNegative = row.crowd_sentiment < -0.1;
    return (aiPositive && crowdNegative) || (aiNegative && crowdPositive);
  });

  const aiWonDisagreements    = disagreements.filter(r => r.ai_correct === true).length;
  const crowdWonDisagreements = disagreements.filter(r => r.crowd_correct === true).length;

  // ── Per-ticker success rates ─────────────────────────────────────────
  const byTicker = {};
  detail.forEach(row => {
    if (!byTicker[row.ticker]) byTicker[row.ticker] = { ai: [], crowd: [] };
    if (row.ai_correct    != null) byTicker[row.ticker].ai.push(row.ai_correct    ? 1 : 0);
    if (row.crowd_correct != null) byTicker[row.ticker].crowd.push(row.crowd_correct ? 1 : 0);
  });

  const tickerRows = Object.entries(byTicker)
    .map(([ticker, { ai, crowd }]) => ({
      ticker,
      ai_rate:    ai.length    ? ai.reduce((a,b)=>a+b,0)    / ai.length    : null,
      crowd_rate: crowd.length ? crowd.reduce((a,b)=>a+b,0) / crowd.length : null,
      count:      Math.max(ai.length, crowd.length),
    }))
    .sort((a,b) => b.count - a.count);

  // Determine overall winner label
  const aiRate    = summary.ai_success_rate    ?? 0;
  const crowdRate = summary.crowd_success_rate ?? 0;
  const winnerLabel =
    Math.abs(aiRate - crowdRate) < 0.01 ? 'Tied'
    : aiRate > crowdRate ? 'AI leads'
    : 'Crowd leads';

  return (
    <div className="max-w-3xl mx-auto px-6 pt-32 pb-24 space-y-10">

      {/* Back + header */}
      <div className="space-y-4 fade-up fade-up-1">
        <Link
          to="/evaluation"
          className="text-[var(--fg-muted)] hover:text-[var(--fg-primary)] text-[11px] font-mono uppercase tracking-widest transition-colors"
        >
          ← Evaluation
        </Link>
        <div className="space-y-2">
          <span className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            Research Question 5
          </span>
          <h1 className="font-serif text-4xl text-[var(--fg-primary)] italic">
            Crowd vs AI
          </h1>
          <p className="text-[var(--fg-secondary)] text-sm leading-relaxed max-w-lg">
            Does aggregated crowd sentiment or AI analysis better predict 30-day market outcomes?
            Success is directional: the signal's implied direction must match actual return direction.
          </p>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 fade-up fade-up-2">
        <StatCard
          label="AI Success Rate"
          value={fmt(summary.ai_success_rate)}
          sub={`${summary.total_evaluated ?? 0} evaluated`}
          highlight={aiRate > crowdRate ? 'text-[var(--accent-sage)]' : undefined}
        />
        <StatCard
          label="Crowd Success Rate"
          value={fmt(summary.crowd_success_rate)}
          sub="vs AI sentiment signal"
          highlight={crowdRate > aiRate ? 'text-[var(--accent-sage)]' : undefined}
        />
        <StatCard
          label="Overall Verdict"
          value={winnerLabel}
          sub="by directional accuracy"
        />
        <StatCard
          label="Disagreements"
          value={disagreements.length}
          sub={`AI won ${aiWonDisagreements} · Crowd ${crowdWonDisagreements}`}
        />
      </div>

      {/* Bar chart comparison */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-3">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Success Rate Comparison
        </p>
        {summary.total_evaluated == null || summary.total_evaluated === 0 ? (
          <p className="text-[var(--fg-muted)] text-sm font-mono py-8 text-center">
            No evaluated data yet.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--fg-muted)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                  domain={[0, 1]}
                  tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--fg-muted)' }}
                  axisLine={false} tickLine={false}
                />
                <ReferenceLine y={0.5} stroke="var(--fg-muted)" strokeDasharray="4 4" />
                <Tooltip
                  formatter={v => [`${(v * 100).toFixed(1)}%`]}
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: 'DM Mono',
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-[var(--fg-muted)] font-sans">
              Dashed line = 50% random baseline. Crowd signal defined as positive/negative when
              avg sentiment exceeds ±0.1; AI defined by its recommendation direction.
            </p>
          </>
        )}
      </div>

      {/* Disagreement analysis */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-4">
        <div className="space-y-1">
          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            Disagreement Analysis
          </p>
          <p className="text-[11px] text-[var(--fg-secondary)] font-sans">
            Cases where AI and crowd signals pointed in opposite directions.
            Who was right when they disagreed?
          </p>
        </div>

        {disagreements.length === 0 ? (
          <p className="text-[var(--fg-muted)] text-sm font-mono">
            No disagreements in evaluated data yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-surface)] rounded-lg p-4 space-y-1 text-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--fg-muted)]">AI Won</p>
                <p className="font-mono text-2xl text-[var(--accent-sage)]">
                  {disagreements.length
                    ? `${((aiWonDisagreements / disagreements.length) * 100).toFixed(0)}%`
                    : '—'
                  }
                </p>
                <p className="text-[11px] text-[var(--fg-muted)]">{aiWonDisagreements} of {disagreements.length}</p>
              </div>
              <div className="bg-[var(--bg-surface)] rounded-lg p-4 space-y-1 text-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--fg-muted)]">Crowd Won</p>
                <p className="font-mono text-2xl text-[var(--accent-slate)]">
                  {disagreements.length
                    ? `${((crowdWonDisagreements / disagreements.length) * 100).toFixed(0)}%`
                    : '—'
                  }
                </p>
                <p className="text-[11px] text-[var(--fg-muted)]">{crowdWonDisagreements} of {disagreements.length}</p>
              </div>
            </div>

            {/* Disagreement detail table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono mt-2">
                <thead>
                  <tr className="text-[var(--fg-muted)] text-[10px] uppercase tracking-widest">
                    <th className="text-left pb-3">Ticker</th>
                    <th className="text-right pb-3">AI Sentiment</th>
                    <th className="text-right pb-3">Crowd Sentiment</th>
                    <th className="text-right pb-3">30d Return</th>
                    <th className="text-right pb-3">AI ✓</th>
                    <th className="text-right pb-3">Crowd ✓</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {disagreements.slice(0, 20).map((row, i) => (
                    <tr key={i}>
                      <td className="py-2 text-[var(--fg-primary)]">{row.ticker}</td>
                      <td className={`py-2 text-right ${row.ai_sentiment >= 0 ? 'text-[var(--accent-sage)]' : 'text-[var(--accent-rust)]'}`}>
                        {row.ai_sentiment != null ? (row.ai_sentiment >= 0 ? '+' : '') + row.ai_sentiment.toFixed(2) : '—'}
                      </td>
                      <td className={`py-2 text-right ${row.crowd_sentiment >= 0 ? 'text-[var(--accent-sage)]' : 'text-[var(--accent-rust)]'}`}>
                        {row.crowd_sentiment != null ? (row.crowd_sentiment >= 0 ? '+' : '') + row.crowd_sentiment.toFixed(2) : '—'}
                      </td>
                      <td className={`py-2 text-right ${row.return_30d == null ? 'text-[var(--fg-muted)]' : row.return_30d >= 0 ? 'text-[var(--accent-sage)]' : 'text-[var(--accent-rust)]'}`}>
                        {fmtReturn(row.return_30d)}
                      </td>
                      <td className="py-2 text-right">
                        {row.ai_correct    === true  ? '✓' :
                         row.ai_correct    === false ? '✗' : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {row.crowd_correct === true  ? '✓' :
                         row.crowd_correct === false ? '✗' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {disagreements.length > 20 && (
                <p className="text-[10px] text-[var(--fg-muted)] mt-3 font-mono">
                  Showing 20 of {disagreements.length} disagreements.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Per-ticker breakdown */}
      {tickerRows.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-5">
          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            Per-Ticker Success Rates
          </p>
          <table className="w-full text-[12px] font-mono">
            <thead>
              <tr className="text-[var(--fg-muted)] text-[10px] uppercase tracking-widest">
                <th className="text-left pb-3">Ticker</th>
                <th className="text-right pb-3">Evaluated</th>
                <th className="text-right pb-3">AI Rate</th>
                <th className="text-right pb-3">Crowd Rate</th>
                <th className="text-right pb-3">Edge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {tickerRows.map(row => {
                const edge = row.ai_rate != null && row.crowd_rate != null
                  ? row.ai_rate - row.crowd_rate
                  : null;
                return (
                  <tr key={row.ticker}>
                    <td className="py-2 text-[var(--fg-primary)]">{row.ticker}</td>
                    <td className="py-2 text-right text-[var(--fg-secondary)]">{row.count}</td>
                    <td className={`py-2 text-right ${
                      row.ai_rate == null   ? 'text-[var(--fg-muted)]' :
                      row.ai_rate >= 0.5    ? 'text-[var(--accent-sage)]' :
                      'text-[var(--accent-rust)]'
                    }`}>
                      {fmt(row.ai_rate)}
                    </td>
                    <td className={`py-2 text-right ${
                      row.crowd_rate == null ? 'text-[var(--fg-muted)]' :
                      row.crowd_rate >= 0.5  ? 'text-[var(--accent-sage)]' :
                      'text-[var(--accent-rust)]'
                    }`}>
                      {fmt(row.crowd_rate)}
                    </td>
                    <td className={`py-2 text-right ${
                      edge == null   ? 'text-[var(--fg-muted)]' :
                      edge >  0.05   ? 'text-[var(--accent-sage)]' :
                      edge < -0.05   ? 'text-[var(--accent-rust)]' :
                      'text-[var(--fg-secondary)]'
                    }`}>
                      {edge == null ? '—' : `${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(1)}pp`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-[var(--fg-muted)] font-sans border-t border-[var(--border)] pt-3">
            Edge = AI success rate minus Crowd success rate. Positive means AI outperformed crowd for that ticker.
          </p>
        </div>
      )}

      {/* Methodology note */}
      <div className="border-t border-[var(--border)] pt-6 space-y-2 fade-up fade-up-5">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Methodology
        </p>
        <p className="text-[12px] text-[var(--fg-secondary)] leading-relaxed">
          Crowd sentiment is the rolling average sentiment score from all prior FinSight queries for
          each ticker. AI success is defined directionally: Buy = positive 30d return, Reduce = negative,
          Hold = within ±2%. Crowd success uses the same ±0.1 threshold to classify the sentiment signal
          as positive, negative, or neutral. Only recommendations with completed 30-day outcome data are included.
        </p>
      </div>

    </div>
  );
}