import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { generateReport } from '../api/finsight';
import GradeBadge     from '../components/GradeBadge';
import SentimentMeter from '../components/SentimentMeter';
import PriceBar       from '../components/PriceBar';
import NewsCard       from '../components/NewsCard';

export default function Report() {
  const { ticker } = useParams();
  const navigate   = useNavigate();
  const [report,   setReport]  = useState(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState(null);
  const [search,   setSearch]  = useState('');

  useEffect(() => {
    setLoading(true); setError(null); setReport(null);
    generateReport(ticker)
      .then(setReport)
      .catch(e => setError(e.response?.data?.detail || 'Could not generate report. Check the ticker and try again.'))
      .finally(() => setLoading(false));
  }, [ticker]);

  // Loading State
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 pt-14 bg-[var(--bg-page)]">
      <div className="spinner" />
      <p className="text-[var(--fg-secondary)] text-[13px] font-mono">
        Aggregating intelligence for <span className="text-[var(--accent-sage)]">{ticker}</span>…
      </p>
      <p className="text-[var(--fg-muted)] text-[11px] font-mono">Synchronizing cloud data nodes</p>
    </div>
  );

  // Error State
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 pt-14 px-6 bg-[var(--bg-page)]">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg max-w-md w-full p-8 text-center space-y-4">
        <p className="text-[var(--accent-rust)] font-mono text-sm uppercase tracking-wide">{error}</p>
        <Link to="/" className="text-[var(--fg-primary)] text-sm hover:underline font-medium block">← Return to Search</Link>
      </div>
    </div>
  );

  const r = report;
  const s = r.ai_summary;

  return (
    <div className="max-w-3xl mx-auto px-6 pt-32 pb-24 space-y-10 bg-[var(--bg-page)] text-[var(--fg-primary)]">

      {/* Top bar: Nav + Search */}
      <div className="flex items-center gap-4 fade-up fade-up-1">
        <Link to="/" className="text-[var(--fg-muted)] hover:text-[var(--fg-primary)] text-[11px] font-mono uppercase tracking-widest transition-colors">
          ← Index
        </Link>
        <div className="flex-1 border-b border-[var(--border)]" />
        <div className="flex gap-2">
          <input
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-3 py-1.5 font-mono text-[11px] text-[var(--fg-primary)] uppercase placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--border-strong)] transition-colors w-28"
            placeholder="TICKER"
            value={search}
            maxLength={6}
            onChange={e => setSearch(e.target.value.toUpperCase().replace(/[^A-Z]/g,''))}
            onKeyDown={e => { if (e.key === 'Enter' && search) navigate(`/report/${search}`); }}
          />
          <button
            onClick={() => search && navigate(`/report/${search}`)}
            className="bg-[var(--fg-primary)] text-[var(--bg-page)] text-[11px] font-medium px-4 py-1.5 rounded-md hover:opacity-90"
          >
            GO
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 fade-up fade-up-2">
        <div className="space-y-1">
          <span className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            Intelligence Report · {r.ticker} · {new Date(r.generated_at).toLocaleDateString('en-SG')}
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl text-[var(--fg-primary)] leading-tight italic">
            {r.company_name}
          </h1>
        </div>
        <GradeBadge grade={s.overall_grade} size="lg" />
      </div>

      {/* Price Bar */}
      <div className="fade-up fade-up-3">
        <PriceBar data={r.price_data} />
      </div>

      {/* Sentiment Analytics */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 fade-up fade-up-4 space-y-6">
        <SentimentMeter score={r.sentiment_score} />
        {r.crowd_sentiment_rank && (
          <div className="flex justify-between items-center border-t border-[var(--border)] pt-4">
            <span className="text-[10px] uppercase tracking-widest text-[var(--fg-muted)]">Crowd Aggregation</span>
            <span className="font-mono text-[11px] text-[var(--fg-primary)] bg-[var(--bg-surface)] px-2 py-1 rounded">
              RANK #{r.crowd_sentiment_rank}
            </span>
          </div>
        )}
      </div>

      {/* Bull / Bear Cases */}
      <div className="grid sm:grid-cols-2 gap-6 fade-up fade-up-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-3">
          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--positive)]">
            Bull Thesis
          </p>
          <p className="text-[13px] text-[var(--fg-primary)] leading-relaxed font-sans">{s.bull_case}</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-3">
          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--negative)]">
            Bear Thesis
          </p>
          <p className="text-[13px] text-[var(--fg-primary)] leading-relaxed font-sans">{s.bear_case}</p>
        </div>
      </div>

      {/* Key Risks */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 fade-up fade-up-5 space-y-4">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Risk Assessment
        </p>
        <ul className="space-y-4">
          {s.key_risks.map((risk, i) => (
            <li key={i} className="flex gap-4 text-[13px] text-[var(--fg-primary)] leading-relaxed">
              <span className="text-[var(--accent-rust)] text-[10px] mt-1 shrink-0 italic">!</span>
              {risk}
            </li>
          ))}
        </ul>
      </div>

      {/* Grade Rationale */}
      <div className="space-y-3 fade-up fade-up-5 pt-4">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            Rating Justification
          </p>
        </div>
        <p className="text-[13px] text-[var(--fg-secondary)] leading-relaxed font-serif italic border-l-2 border-[var(--accent-stone)] pl-6 py-1">
          {s.grade_rationale}
        </p>
      </div>

      {/* News Feed */}
      <div className="space-y-4 fade-up fade-up-5 pt-8 border-t border-[var(--border)]">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Analysis Source Data
        </p>
        <div className="space-y-3">
          {r.news_headlines.map((h, i) => <NewsCard key={i} headline={h} index={i} />)}
        </div>
      </div>

    </div>
  );
}