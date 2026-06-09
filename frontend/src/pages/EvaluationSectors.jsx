import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function fetchSectors() {
  const r = await fetch(`${BASE}/evaluation/sectors`);
  return r.json();
}

const SECTOR_COLORS = {
  'Technology':             'var(--accent-sage)',
  'Healthcare':             'var(--accent-slate)',
  'Energy':                 'var(--accent-stone)',
  'Financials':             'var(--accent-rust)',
  'Consumer Discretionary': '#7a6a8a',
  'Industrials':            '#6a7a6a',
  'Unknown':                'var(--border-strong)',
};

const fmtReturn = (n) => {
  if (n == null) return '—';
  const pct = (n * 100).toFixed(2);
  return n >= 0 ? `+${pct}%` : `${pct}%`;
};

const fmtPct = (n) =>
  n == null ? '—' : `${(n * 100).toFixed(1)}%`;

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-2">
      <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
        {label}
      </p>
      <p className="font-mono text-2xl text-[var(--fg-primary)]">{value}</p>
      {sub && <p className="text-[11px] text-[var(--fg-muted)] font-sans">{sub}</p>}
    </div>
  );
}

export default function EvaluationSectors() {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchSectors()
      .then(d => setSectors(d.sectors || []))
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

  // ── Derived stats ────────────────────────────────────────────────────
  const evaluated = sectors.filter(s => s.evaluated > 0);

  const bestSector = evaluated.length
    ? evaluated.reduce((a, b) =>
        (a.avg_return_30d ?? -Infinity) > (b.avg_return_30d ?? -Infinity) ? a : b)
    : null;

  const worstSector = evaluated.length
    ? evaluated.reduce((a, b) =>
        (a.avg_return_30d ?? Infinity) < (b.avg_return_30d ?? Infinity) ? a : b)
    : null;

  const bestExcess = evaluated.length
    ? evaluated.reduce((a, b) =>
        (a.avg_excess_return_30d ?? -Infinity) > (b.avg_excess_return_30d ?? -Infinity) ? a : b)
    : null;

  // Chart data sorted by avg_return_30d descending
  const chartData = [...sectors]
    .filter(s => s.avg_return_30d != null)
    .sort((a, b) => (b.avg_return_30d ?? 0) - (a.avg_return_30d ?? 0));

  const excessData = [...sectors]
    .filter(s => s.avg_excess_return_30d != null)
    .sort((a, b) => (b.avg_excess_return_30d ?? 0) - (a.avg_excess_return_30d ?? 0));

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
            Research Question 2
          </span>
          <h1 className="font-serif text-4xl text-[var(--fg-primary)] italic">
            Sector Breakdown
          </h1>
          <p className="text-[var(--fg-secondary)] text-sm leading-relaxed max-w-lg">
            Does AI accuracy vary by sector? Covering Technology, Healthcare, Energy,
            Financials, Consumer Discretionary and Industrials.
          </p>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 fade-up fade-up-2">
        <StatCard
          label="Best Performing Sector"
          value={bestSector?.sector ?? '—'}
          sub={`Avg 30d return ${fmtReturn(bestSector?.avg_return_30d)}`}
        />
        <StatCard
          label="Worst Performing Sector"
          value={worstSector?.sector ?? '—'}
          sub={`Avg 30d return ${fmtReturn(worstSector?.avg_return_30d)}`}
        />
        <StatCard
          label="Best vs SPY"
          value={bestExcess?.sector ?? '—'}
          sub={`Avg excess ${fmtReturn(bestExcess?.avg_excess_return_30d)}`}
        />
      </div>

      {/* Avg 30d return by sector */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-3">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Average 30-Day Return by Sector
        </p>
        {chartData.length === 0 ? (
          <p className="text-[var(--fg-muted)] text-sm font-mono py-8 text-center">
            No evaluated data yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="sector"
                tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--fg-muted)' }}
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
              <Bar dataKey="avg_return_30d" radius={[4, 4, 0, 0]}>
                {chartData.map(entry => (
                  <Cell
                    key={entry.sector}
                    fill={SECTOR_COLORS[entry.sector] ?? 'var(--accent-slate)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Avg excess return vs SPY */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-4">
        <div className="space-y-1">
          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            Average Excess Return vs SPY by Sector
          </p>
          <p className="text-[11px] text-[var(--fg-secondary)] font-sans">
            Positive = AI recommendations outperformed the S&P 500 benchmark over the same 30-day window.
          </p>
        </div>
        {excessData.length === 0 ? (
          <p className="text-[var(--fg-muted)] text-sm font-mono py-8 text-center">
            No evaluated data yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={excessData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="sector"
                tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--fg-muted)' }}
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
              <Bar dataKey="avg_excess_return_30d" radius={[4, 4, 0, 0]}>
                {excessData.map(entry => (
                  <Cell
                    key={entry.sector}
                    fill={
                      (entry.avg_excess_return_30d ?? 0) >= 0
                        ? 'var(--accent-sage)'
                        : 'var(--accent-rust)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Detail table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-5">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Full Sector Detail
        </p>
        <table className="w-full text-[12px] font-mono">
          <thead>
            <tr className="text-[var(--fg-muted)] text-[10px] uppercase tracking-widest">
              <th className="text-left pb-3">Sector</th>
              <th className="text-right pb-3">Total</th>
              <th className="text-right pb-3">Evaluated</th>
              <th className="text-right pb-3">Avg 30d</th>
              <th className="text-right pb-3">vs SPY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sectors.map(s => (
              <tr key={s.sector}>
                <td className="py-3 text-[var(--fg-primary)] flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ background: SECTOR_COLORS[s.sector] ?? 'var(--accent-slate)' }}
                  />
                  {s.sector}
                </td>
                <td className="py-3 text-right text-[var(--fg-secondary)]">{s.total}</td>
                <td className="py-3 text-right text-[var(--fg-secondary)]">{s.evaluated}</td>
                <td className={`py-3 text-right ${
                  s.avg_return_30d == null    ? 'text-[var(--fg-muted)]' :
                  s.avg_return_30d >= 0       ? 'text-[var(--accent-sage)]' :
                  'text-[var(--accent-rust)]'
                }`}>
                  {fmtReturn(s.avg_return_30d)}
                </td>
                <td className={`py-3 text-right ${
                  s.avg_excess_return_30d == null ? 'text-[var(--fg-muted)]' :
                  s.avg_excess_return_30d >= 0    ? 'text-[var(--accent-sage)]' :
                  'text-[var(--accent-rust)]'
                }`}>
                  {fmtReturn(s.avg_excess_return_30d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Methodology note */}
      <div className="border-t border-[var(--border)] pt-6 space-y-2 fade-up fade-up-5">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Methodology
        </p>
        <p className="text-[12px] text-[var(--fg-secondary)] leading-relaxed">
          Sectors are assigned at recommendation generation time based on the ticker universe
          defined in the PRD. Average returns are calculated across all evaluated recommendations
          in each sector regardless of recommendation type. Excess return is the difference
          between the ticker's 30-day return and SPY's return over the same window.
        </p>
      </div>

    </div>
  );
}