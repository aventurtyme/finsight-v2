import { Link } from 'react-router-dom';

const cards = [
  {
    to: '/evaluation/accuracy',
    label: 'Overall Accuracy',
    description: 'Success rate, average returns by recommendation type, AI vs S&P 500 baseline.',
    accent: 'var(--accent-sage)',
    tag: 'TIER 1',
  },
  {
    to: '/evaluation/calibration',
    label: 'Confidence Calibration',
    description: 'When AI expresses high confidence, is it actually more accurate?',
    accent: 'var(--accent-slate)',
    tag: 'TIER 1',
  },
  {
    to: '/evaluation/sectors',
    label: 'Sector Breakdown',
    description: 'Accuracy and average returns across Technology, Healthcare, Energy and more.',
    accent: 'var(--accent-stone)',
    tag: 'TIER 2',
  },
  {
    to: '/evaluation/crowd-vs-ai',
    label: 'Crowd vs AI',
    description: 'Does crowd sentiment or AI analysis better predict actual market outcomes?',
    accent: 'var(--accent-rust)',
    tag: 'TIER 1',
  },
  {
    to: '/evaluation/prompts',
    label: 'Prompt Sensitivity',
    description: 'How much does prompt framing affect recommendation reliability?',
    accent: 'var(--accent-sage)',
    tag: 'TIER 2',
  },
];

export default function EvaluationHub() {
  return (
    <div className="max-w-3xl mx-auto px-6 pt-32 pb-24 space-y-12">

      {/* Header */}
      <div className="space-y-3 fade-up fade-up-1">
        <span className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          FinSight 2.0 · AI Evaluation Platform
        </span>
        <h1 className="font-serif text-4xl text-[var(--fg-primary)] italic">
          Evaluation Dashboard
        </h1>
        <p className="text-[var(--fg-secondary)] text-sm leading-relaxed max-w-lg">
          Measuring when AI-generated financial analysis can be trusted. Each dashboard
          answers a distinct research question using historical recommendations and
          real market outcomes.
        </p>
      </div>

      {/* Research questions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-3 fade-up fade-up-2">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Core Research Questions
        </p>
        <ul className="space-y-2">
          {[
            'How accurate are AI-generated investment recommendations overall?',
            'Does AI accuracy vary by sector or market conditions?',
            'When AI expresses high confidence, is it actually more accurate?',
            'Which prompt framing produces the most reliable recommendations?',
            'Does crowd sentiment or AI analysis better predict actual outcomes?',
          ].map((q, i) => (
            <li key={i} className="flex gap-3 text-[13px] text-[var(--fg-primary)] leading-relaxed">
              <span className="text-[var(--accent-sage)] font-mono text-[10px] mt-1 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              {q}
            </li>
          ))}
        </ul>
      </div>

      {/* Dashboard cards */}
      <div className="space-y-4 fade-up fade-up-3">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Dashboards
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {cards.map(({ to, label, description, accent, tag }) => (
            <Link
              key={to}
              to={to}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-3
                         hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]
                         transition-all group block"
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-[10px] font-sans font-medium uppercase tracking-[0.12em]"
                  style={{ color: accent }}
                >
                  {tag}
                </p>
                <span className="text-[var(--fg-muted)] group-hover:text-[var(--fg-primary)] transition-colors text-[11px] font-mono">
                  →
                </span>
              </div>
              <p className="font-serif text-lg text-[var(--fg-primary)] leading-tight">
                {label}
              </p>
              <p className="text-[12px] text-[var(--fg-secondary)] leading-relaxed font-sans">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Data note */}
      <div className="border-t border-[var(--border)] pt-8 space-y-2 fade-up fade-up-4">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Dataset
        </p>
        <p className="text-[12px] text-[var(--fg-secondary)] leading-relaxed">
          Phase 1 covers Jan–Dec 2025 across 16 tickers and 6 sectors using Prompt Variant A
          (Neutral framing). Outcome data sourced from Twelve Data historical prices with SPY
          as the 30-day benchmark. Sample size does not support statistical significance claims
          — this platform demonstrates the evaluation methodology.
        </p>
      </div>

    </div>
  );
}