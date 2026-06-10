import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell, Legend,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function fetchPromptSensitivity() {
  const r = await fetch(`${BASE}/evaluation/prompt-sensitivity`);
  return r.json();
}

const VARIANT_META = {
  A: { label: 'Neutral',      color: 'var(--accent-sage)',  desc: 'Balanced, objective assessment.' },
  B: { label: 'Conservative', color: 'var(--accent-rust)',  desc: 'Emphasise downside risk and capital preservation.' },
  C: { label: 'Growth',       color: 'var(--accent-slate)', desc: 'Focus on upside catalysts and momentum.' },
};

const fmt = (n, decimals = 1) =>
  n == null ? '—' : `${(n * 100).toFixed(decimals)}%`;

const fmtReturn = (n) => {
  if (n == null) return '—';
  const pct = (n * 100).toFixed(2);
  return n >= 0 ? `+${pct}%` : `${pct}%`;
};

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-2">
      <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
        {label}
      </p>
      <p className="font-mono text-3xl" style={{ color: color || 'var(--fg-primary)' }}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--fg-muted)] font-sans">{sub}</p>}
    </div>
  );
}

export default function EvaluationPrompts() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchPromptSensitivity()
      .then(d => setRows(d.prompt_sensitivity || []))
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

  // Enrich rows with display metadata
  const enriched = rows.map(r => ({
    ...r,
    ...VARIANT_META[r.prompt_variant] ?? { label: r.prompt_variant, color: 'var(--fg-secondary)', desc: '' },
  }));

  // Active variants (those with data)
  const activeVariants = enriched.filter(r => r.total > 0);
  const hasMultiple    = activeVariants.length > 1;

  // Best success rate
  const bestVariant = enriched
    .filter(r => r.success_rate != null)
    .sort((a, b) => (b.success_rate ?? 0) - (a.success_rate ?? 0))[0];

  // Distribution chart data — Buy / Hold / Reduce breakdown per variant
  const distData = enriched.map(r => ({
    name:   `${r.label} (${r.prompt_variant})`,
    Buy:    r.buy_count    ?? 0,
    Hold:   r.hold_count   ?? 0,
    Reduce: r.reduce_count ?? 0,
    color:  r.color,
  }));

  // Success rate chart
  const successData = enriched
    .filter(r => r.success_rate != null)
    .map(r => ({ name: `${r.label} (${r.prompt_variant})`, value: r.success_rate, color: r.color }));

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
            Research Question 4
          </span>
          <h1 className="font-serif text-4xl text-[var(--fg-primary)] italic">
            Prompt Sensitivity
          </h1>
          <p className="text-[var(--fg-secondary)] text-sm leading-relaxed max-w-lg">
            Does prompt framing affect recommendation reliability? Three variants test whether
            neutral, conservative, or growth-oriented framing produces more accurate predictions.
          </p>
        </div>
      </div>

      {/* Variant descriptions */}
      <div className="grid sm:grid-cols-3 gap-4 fade-up fade-up-2">
        {Object.entries(VARIANT_META).map(([key, meta]) => (
          <div
            key={key}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[11px] px-2 py-0.5 rounded"
                style={{ background: meta.color + '22', color: meta.color }}
              >
                Variant {key}
              </span>
              <span className="font-sans text-[12px] text-[var(--fg-primary)] font-medium">{meta.label}</span>
            </div>
            <p className="text-[11px] text-[var(--fg-secondary)] leading-relaxed">{meta.desc}</p>
          </div>
        ))}
      </div>

      {/* Phase note if only variant A exists */}
      {!hasMultiple && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 fade-up fade-up-2">
          <p className="text-[11px] text-[var(--fg-secondary)] font-sans leading-relaxed">
            <span className="text-[var(--accent-stone)] font-medium">Phase 2 note:</span>{' '}
            Only Variant A (Neutral) data is available. Variants B and C will be added in Phase 3
            via the historical replay engine. The table and charts below will populate automatically
            once multi-variant data exists.
          </p>
        </div>
      )}

      {/* Headline stat cards */}
      {activeVariants.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 fade-up fade-up-3">
          {activeVariants.map(r => (
            <StatCard
              key={r.prompt_variant}
              label={`Variant ${r.prompt_variant} — ${r.label}`}
              value={fmt(r.success_rate)}
              sub={`${r.total} recommendations`}
              color={r.success_rate != null && r.prompt_variant === bestVariant?.prompt_variant
                ? r.color : undefined}
            />
          ))}
        </div>
      )}

      {/* Success rate chart */}
      {successData.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-3">
          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            30-Day Success Rate by Prompt Variant
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={successData} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--fg-muted)' }}
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
                formatter={v => [`${(v * 100).toFixed(1)}%`, 'Success Rate']}
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'DM Mono',
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {successData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-[var(--fg-muted)] font-sans">
            Dashed line = 50% random baseline. Success = recommendation direction matches actual 30-day return direction.
          </p>
        </div>
      )}

      {/* Recommendation distribution chart */}
      {distData.some(d => d.Buy + d.Hold + d.Reduce > 0) && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-4">
          <div className="space-y-1">
            <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
              Recommendation Distribution by Variant
            </p>
            <p className="text-[11px] text-[var(--fg-secondary)] font-sans">
              Conservative framing is expected to produce more Hold/Reduce; Growth framing more Buy.
            </p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distData} barCategoryGap="35%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--fg-muted)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--fg-muted)' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'DM Mono',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: 'DM Mono' }}
              />
              <Bar dataKey="Buy"    fill="var(--accent-sage)"  radius={[2,2,0,0]} />
              <Bar dataKey="Hold"   fill="var(--accent-slate)" radius={[2,2,0,0]} />
              <Bar dataKey="Reduce" fill="var(--accent-rust)"  radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full detail table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-4">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Full Variant Detail
        </p>
        {enriched.length === 0 ? (
          <p className="text-[var(--fg-muted)] text-sm font-mono">No data yet.</p>
        ) : (
          <table className="w-full text-[12px] font-mono">
            <thead>
              <tr className="text-[var(--fg-muted)] text-[10px] uppercase tracking-widest">
                <th className="text-left pb-3">Variant</th>
                <th className="text-right pb-3">Total</th>
                <th className="text-right pb-3">Buy</th>
                <th className="text-right pb-3">Hold</th>
                <th className="text-right pb-3">Reduce</th>
                <th className="text-right pb-3">Avg Conf</th>
                <th className="text-right pb-3">Success</th>
                <th className="text-right pb-3">Avg 30d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {enriched.map(r => (
                <tr key={r.prompt_variant}>
                  <td className="py-3">
                    <span
                      className="font-mono text-[11px] px-2 py-0.5 rounded"
                      style={{ background: r.color + '22', color: r.color }}
                    >
                      {r.prompt_variant} — {r.label}
                    </span>
                  </td>
                  <td className="py-3 text-right text-[var(--fg-secondary)]">{r.total}</td>
                  <td className="py-3 text-right text-[var(--accent-sage)]">{r.buy_count    ?? 0}</td>
                  <td className="py-3 text-right text-[var(--accent-slate)]">{r.hold_count   ?? 0}</td>
                  <td className="py-3 text-right text-[var(--accent-rust)]">{r.reduce_count ?? 0}</td>
                  <td className="py-3 text-right text-[var(--fg-secondary)]">
                    {r.avg_confidence != null ? (r.avg_confidence * 100).toFixed(1) + '%' : '—'}
                  </td>
                  <td className={`py-3 text-right ${
                    r.success_rate == null ? 'text-[var(--fg-muted)]' :
                    r.success_rate >= 0.5  ? 'text-[var(--accent-sage)]' :
                    'text-[var(--accent-rust)]'
                  }`}>
                    {fmt(r.success_rate)}
                  </td>
                  <td className={`py-3 text-right ${
                    r.avg_return_30d == null ? 'text-[var(--fg-muted)]' :
                    r.avg_return_30d >= 0    ? 'text-[var(--accent-sage)]' :
                    'text-[var(--accent-rust)]'
                  }`}>
                    {fmtReturn(r.avg_return_30d)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Methodology note */}
      <div className="border-t border-[var(--border)] pt-6 space-y-2 fade-up fade-up-5">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Methodology
        </p>
        <p className="text-[12px] text-[var(--fg-secondary)] leading-relaxed">
          Each variant uses identical input data (same ticker, same news headlines, same price context)
          but a different framing instruction in the system prompt. The same historical replay dataset
          is fed to each variant, enabling a controlled comparison. Success is defined directionally at
          the 30-day horizon. Phase 3 will run Variants B and C through the full replay pipeline to
          populate this dashboard with comparative data.
        </p>
      </div>

    </div>
  );
}