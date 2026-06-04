import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAggregate } from '../api/finsight';
import SentimentMeter from '../components/SentimentMeter';

export default function Sentiment() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAggregate(30).then(d => setData(d.leaderboard || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 pt-32 pb-24 bg-[var(--bg-page)] min-h-screen">
      <div className="mb-12 space-y-3 fade-up fade-up-1">
        <span className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Market Intelligence Layer
        </span>
        <h1 className="font-serif text-4xl text-[var(--fg-primary)] italic">Crowd Sentiment</h1>
        <p className="text-[var(--fg-secondary)] text-sm leading-relaxed max-w-lg">
          Aggregated AI sentiment across all active FinSight queries. This leaderboard represents the collective market mood derived from real-time data ingestion.
        </p>
      </div>
      {loading ? (
        <div className="flex justify-center py-24"><div className="spinner" /></div>
      ) : data.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-center py-12 space-y-4">
          <p className="text-[var(--fg-muted)] text-sm font-sans uppercase tracking-widest">No sentiment data recorded.</p>
          <Link to="/" className="text-[var(--fg-primary)] text-sm font-medium hover:underline block">
            Analyze a ticker to begin →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((item, i) => (
            <Link
              key={item.ticker}
              to={`/report/${item.ticker}`}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 flex items-start gap-6 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] transition-all group block"
            >
              <span className="font-mono text-[var(--fg-muted)] text-[11px] mt-1 w-6 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>              
              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex justify-between items-end">
                  <span className="font-mono text-lg text-[var(--fg-primary)] group-hover:text-[var(--accent-sage)] transition-colors">
                    ${item.ticker}
                  </span>
                  <span className="text-[10px] text-[var(--fg-muted)] font-mono uppercase tracking-widest">
                    {item.query_count} Institutional Queries
                  </span>
                </div>
                <SentimentMeter score={item.avg_sentiment} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}