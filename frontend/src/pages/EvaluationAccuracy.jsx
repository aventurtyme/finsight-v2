import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function fetchSummary() {
  const r = await fetch(`${BASE}/evaluation/summary`);
  return r.json();
}
async function fetchPerformance() {
  const r = await fetch(`${BASE}/evaluation/performance?limit=500`);
  return r.json();
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-2">
      <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
        {label}
      </p>
      <p className="font-mono text-3xl text-[var(--fg-primary)]">{value}</p>
      {sub && <p className="text-[11px] text-[var(--fg-muted)] font-sans">{sub}</p>}
    </div>
  );
}

const fmt = (n, decimals = 1) =>
  n == null ? '—' : `${(n * 100).toFixed(decimals)}%`;

const fmtReturn = (n) => {
  if (n == null) return '—';
  const pct = (n * 100).toFixed(2);
  return n >= 0 ? `+${pct}%` : `${pct}%`;
};

export default function EvaluationAccuracy() {
  const [summary,     setSummary]     = useState(null);
  const [performance, setPerformance] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    Promise.all([fetchSummary(), fetchPerformance()])
      .then(([s, p]) => {
        setSummary(s);
        setPerformance(p.performance_results || []);
      })
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

  // ── Derive per-recommendation-type stats from performance rows ──────────
  const byType = { Buy: [], Hold: [], Reduce: [] };
  performance.forEach(p => {
    if (p.return_30d != null && byType[p.recommendation]) {
      byType[p.recommendation].push(p.return_30d);
    }
  });

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const typeData = ['Buy', 'Hold', 'Reduce'].map(type => ({
    type,
    count: byType[type].length,
    avg_return: avg(byType[type]),
  }));

  // ── Success rate vs 50% baseline bar data ───────────────────────────────
  const successRate = summary?.success_rate_30d ?? 0;
  const benchmarkData = [
    { label: 'AI Success Rate', value: successRate,  fill: 'var(--accent-sage)' },
    { label: 'Random Baseline', value: 0.5,          fill: 'var(--border-strong)' },
  ];

  // ── SPY outperformance ───────────────────────────────────────────────────
  const withSpy = performance.filter(p => p.return_30d != null && p.spy_return_30d != null);
  const avgExcess = avg(withSpy.map(p => p.return_30d - p.spy_return_30d));
  const beatSpy = withSpy.filter(p => p.return_30d > p.spy_return_30d).length;
  const beatSpyRate = withSpy.length ? beatSpy / withSpy.length : null;

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
            Research Question 1
          </span>
          <h1 className="font-serif text-4xl text-[var(--fg-primary)] italic">
            Overall Accuracy
          </h1>
          <p className="text-[var(--fg-secondary)] text-sm leading-relaxed max-w-lg">
            How accurate are AI-generated investment recommendations overall?
            Success is defined as the recommendation direction matching the actual
            30-day return direction.
          </p>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 fade-up fade-up-2">
        <StatCard
          label="30d Success Rate"
          value={fmt(summary?.success_rate_30d)}
          sub={`${summary?.successful_30d_recommendations ?? '—'} of ${summary?.evaluated_recommendations ?? '—'} evaluated`}
        />
        <StatCard
          label="Total Recommendations"
          value={summary?.total_recommendations ?? '—'}
          sub="Variant A, Jan–Dec 2025"
        />
        <StatCard
          label="Beat SPY Rate"
          value={fmt(beatSpyRate)}
          sub={`${beatSpy} of ${withSpy.length} outperformed`}
        />
        <StatCard
          label="Avg Excess Return"
          value={fmtReturn(avgExcess)}
          sub="vs SPY 30-day benchmark"
        />
      </div>

      {/* AI vs baseline bar chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-3">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          AI Success Rate vs Random Baseline
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={benchmarkData} barCategoryGap="40%">
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
              {benchmarkData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-[var(--fg-muted)] font-sans">
          Dashed line = 50% random baseline. A value above 50% indicates the AI adds
          predictive signal beyond random chance.
        </p>
      </div>

      {/* Returns by recommendation type */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-4">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Average 30-Day Return by Recommendation Type
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={typeData} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="type"
              tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--fg-muted)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={v => `${(v * 100).toFixed(1)}%`}
              tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--fg-muted)' }}
              axisLine={false} tickLine={false}
            />
            <ReferenceLine y={0} stroke="var(--fg-muted)" strokeDasharray="4 4" />
            <Tooltip
              formatter={v => [`${(v * 100).toFixed(2)}%`]}
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                fontFamily: 'DM Mono',
              }}
            />
            <Bar dataKey="avg_return" radius={[4, 4, 0, 0]}>
              {typeData.map((entry) => (
                <Cell
                  key={entry.type}
                  fill={
                    entry.type === 'Buy'    ? 'var(--accent-sage)'  :
                    entry.type === 'Reduce' ? 'var(--accent-rust)'  :
                    'var(--accent-slate)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Summary table */}
        <div className="border-t border-[var(--border)] pt-4">
          <table className="w-full text-[12px] font-mono">
            <thead>
              <tr className="text-[var(--fg-muted)] text-[10px] uppercase tracking-widest">
                <th className="text-left pb-2">Type</th>
                <th className="text-right pb-2">Count</th>
                <th className="text-right pb-2">Avg 30d Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {typeData.map(({ type, count, avg_return }) => (
                <tr key={type}>
                  <td className="py-2 text-[var(--fg-primary)]">{type}</td>
                  <td className="py-2 text-right text-[var(--fg-secondary)]">{count}</td>
                  <td className={`py-2 text-right ${
                    avg_return == null ? 'text-[var(--fg-muted)]' :
                    avg_return >= 0 ? 'text-[var(--accent-sage)]' : 'text-[var(--accent-rust)]'
                  }`}>
                    {fmtReturn(avg_return)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology note */}
      <div className="border-t border-[var(--border)] pt-6 space-y-2 fade-up fade-up-5">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Methodology
        </p>
        <p className="text-[12px] text-[var(--fg-secondary)] leading-relaxed">
          Success is defined directionally: Buy recommendations are successful if the 30-day
          return is positive, Reduce if negative, Hold if within ±2%. Returns are calculated
          from the closing price on the recommendation date. SPY ETF is used as the market
          benchmark over the same 30-day window.
        </p>
      </div>

    </div>
  );
}