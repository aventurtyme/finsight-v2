import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function fetchCalibration() {
  const r = await fetch(`${BASE}/evaluation/confidence-bands`);
  return r.json();
}

// Map band label to a midpoint x-value for the calibration curve
const BAND_MIDPOINTS = {
  '<50%%':    0.35,
  '50-70%%':  0.60,
  '70-90%%':  0.80,
  '90-100%%': 0.95,
};

// Display labels (strip the escaped %%)
const BAND_LABELS = {
  '<50%%':    '<50%',
  '50-70%%':  '50–70%',
  '70-90%%':  '70–90%',
  '90-100%%': '90–100%',
};

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

export default function EvaluationCalibration() {
  const [bands,   setBands]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchCalibration()
      .then(d => setBands(d.confidence_bands || []))
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

  // ── Build calibration curve data ─────────────────────────────────────
  // Sort bands by midpoint so the line chart reads left-to-right
  const curveData = bands
    .map(b => ({
      band:       BAND_LABELS[b.confidence_band] ?? b.confidence_band,
      midpoint:   BAND_MIDPOINTS[b.confidence_band] ?? 0.5,
      actual:     b.success_rate,
      ideal:      BAND_MIDPOINTS[b.confidence_band] ?? 0.5,
      total:      b.total,
      successful: b.successful,
    }))
    .sort((a, b) => a.midpoint - b.midpoint);

  // ── Summary stats ─────────────────────────────────────────────────────
  const totalEvaluated = bands.reduce((s, b) => s + (b.total || 0), 0);
  const highConfBand   = bands.find(b => b.confidence_band === '90-100%%');
  const lowConfBand    = bands.find(b => b.confidence_band === '<50%%');

  // Calibration gap: how far actual deviates from ideal on average
  const calibrationGap = curveData.length
    ? curveData.reduce((s, d) => s + Math.abs((d.actual ?? 0) - d.ideal), 0) / curveData.length
    : null;

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
            Research Question 3
          </span>
          <h1 className="font-serif text-4xl text-[var(--fg-primary)] italic">
            Confidence Calibration
          </h1>
          <p className="text-[var(--fg-secondary)] text-sm leading-relaxed max-w-lg">
            When AI expresses high confidence, is it actually more accurate? A perfectly
            calibrated model would show a 90% success rate when it reports 90% confidence.
          </p>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 fade-up fade-up-2">
        <StatCard
          label="Evaluated Recommendations"
          value={totalEvaluated}
          sub="with 30d outcome data"
        />
        <StatCard
          label="High Confidence (90-100%)"
          value={fmt(highConfBand?.success_rate)}
          sub={`${highConfBand?.total ?? 0} recommendations`}
        />
        <StatCard
          label="Low Confidence (<50%)"
          value={fmt(lowConfBand?.success_rate)}
          sub={`${lowConfBand?.total ?? 0} recommendations`}
        />
      </div>

      {/* Calibration curve */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-3">
        <div className="space-y-1">
          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            Calibration Curve
          </p>
          <p className="text-[11px] text-[var(--fg-secondary)] font-sans">
            Ideal calibration = diagonal. Points above the line mean AI is underconfident;
            below means overconfident.
          </p>
        </div>

        {curveData.length < 2 ? (
          <p className="text-[var(--fg-muted)] text-sm font-mono py-8 text-center">
            Not enough data across confidence bands to plot curve yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={curveData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="band"
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
                formatter={(v, name) => [
                  `${(v * 100).toFixed(1)}%`,
                  name === 'actual' ? 'Actual Success Rate' : 'Ideal Calibration',
                ]}
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'DM Mono',
                }}
              />
              <Legend
                formatter={v => v === 'actual' ? 'Actual' : 'Ideal'}
                wrapperStyle={{ fontSize: 11, fontFamily: 'DM Mono' }}
              />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="var(--border-strong)"
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="var(--accent-sage)"
                strokeWidth={2}
                dot={{ fill: 'var(--accent-sage)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Confidence band table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-4 fade-up fade-up-4">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Confidence Band Breakdown
        </p>
        {bands.length === 0 ? (
          <p className="text-[var(--fg-muted)] text-sm font-mono">No data yet.</p>
        ) : (
          <table className="w-full text-[12px] font-mono">
            <thead>
              <tr className="text-[var(--fg-muted)] text-[10px] uppercase tracking-widest">
                <th className="text-left pb-3">Confidence Band</th>
                <th className="text-right pb-3">Count</th>
                <th className="text-right pb-3">Successful</th>
                <th className="text-right pb-3">Success Rate</th>
                <th className="text-right pb-3">vs Ideal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {[...bands]
                .sort((a, b) => (BAND_MIDPOINTS[b.confidence_band] ?? 0) - (BAND_MIDPOINTS[a.confidence_band] ?? 0))
                .map(band => {
                  const ideal     = BAND_MIDPOINTS[band.confidence_band] ?? 0.5;
                  const actual    = band.success_rate ?? 0;
                  const diff      = actual - ideal;
                  const label     = BAND_LABELS[band.confidence_band] ?? band.confidence_band;
                  return (
                    <tr key={band.confidence_band}>
                      <td className="py-3 text-[var(--fg-primary)]">{label}</td>
                      <td className="py-3 text-right text-[var(--fg-secondary)]">{band.total}</td>
                      <td className="py-3 text-right text-[var(--fg-secondary)]">{band.successful ?? 0}</td>
                      <td className="py-3 text-right text-[var(--fg-primary)]">
                        {fmt(band.success_rate)}
                      </td>
                      <td className={`py-3 text-right ${
                        diff > 0.05  ? 'text-[var(--accent-sage)]' :
                        diff < -0.05 ? 'text-[var(--accent-rust)]' :
                        'text-[var(--fg-muted)]'
                      }`}>
                        {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}pp
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-[var(--fg-muted)] font-sans border-t border-[var(--border)] pt-3">
          vs Ideal = actual success rate minus the midpoint of the confidence band.
          Positive = AI is underconfident (performs better than stated). Negative = overconfident.
        </p>
      </div>

      {/* Interpretation */}
      <div className="border-t border-[var(--border)] pt-6 space-y-2 fade-up fade-up-5">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Interpretation
        </p>
        <p className="text-[12px] text-[var(--fg-secondary)] leading-relaxed">
          Confidence scores are self-reported by Gemini based on signal strength and
          consistency. A well-calibrated model shows higher success rates in higher
          confidence bands. The average calibration gap for this dataset
          is {calibrationGap != null ? `${(calibrationGap * 100).toFixed(1)} percentage points` : '—'}.
          Results should be interpreted cautiously given the sample size.
        </p>
      </div>

    </div>
  );
}