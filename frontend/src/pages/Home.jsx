import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrending } from '../api/finsight';

const FALLBACK = ['AAPL','NVDA','MSFT','TSLA','AMZN','META','GOOGL','AMD'];

export default function Home() {
  const [ticker,   setTicker]   = useState('');
  const [trending, setTrending] = useState([]);
  const [focused,  setFocused]  = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getTrending().then(d => setTrending(d.tickers || [])).catch(() => {});
  }, []);

  const go = (t) => {
    const val = (t || ticker).trim().toUpperCase();
    if (val) navigate(`/report/${val}`);
  };

  const chips = trending.length ? trending : FALLBACK;

  return (
    <main className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center px-6 pt-14">

      <div className="w-full max-w-xl space-y-12 relative">

        <div className="flex justify-center fade-up fade-up-1">
          <span className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-[var(--fg-muted)] border border-[var(--border)] rounded-full px-4 py-1.5 bg-[var(--bg-surface)]">
            Intelligence · Free · Open
          </span>
        </div>

        <div className="text-center space-y-5 fade-up fade-up-2">
          <h1 className="font-serif text-5xl sm:text-6xl text-[var(--fg-primary)] leading-[1.1] tracking-tight">
            Financial intelligence,<br />
            <span className="italic text-[var(--accent-sage)]">on demand.</span>
          </h1>
          <p className="text-[var(--fg-secondary)] text-base max-w-md mx-auto leading-relaxed">
            Enter any stock ticker to generate an institutional-grade financial report via the Gemini 3 Flash engine.
          </p>
        </div>

        <div className="fade-up fade-up-3">
          <div
            className={`flex items-center gap-3 border rounded-lg px-4 py-3 transition-all duration-300 ${
              focused ? 'border-[var(--border-strong)] bg-[var(--bg-card)]' : 'border-[var(--border)] bg-[var(--bg-surface)]'
            }`}
          >
            <span className="text-[var(--fg-muted)] font-mono text-sm shrink-0">$</span>
            <input
              className="flex-1 bg-transparent font-mono text-[var(--fg-primary)] text-sm uppercase placeholder-[var(--fg-muted)] focus:outline-none tracking-widest"
              placeholder="TICKER"
              value={ticker}
              maxLength={6}
              onChange={e => setTicker(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === 'Enter' && go()}
            />
            <button
              onClick={() => go()}
              disabled={!ticker}
              className="btn-primary disabled:opacity-20 disabled:grayscale shrink-0"
            >
              Analyze
            </button>
          </div>
        </div>

        <div className="text-center fade-up fade-up-4">
          <p className="text-[10px] uppercase font-sans tracking-widest text-[var(--fg-muted)] mb-4">
            {trending.length ? 'Trending now' : 'Suggested analysis'}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {chips.map(t => (
              <button 
                key={t} 
                onClick={() => go(t)} 
                className="ticker-chip"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <footer className="text-center text-[10px] text-[var(--fg-muted)] font-mono uppercase tracking-widest fade-up fade-up-5">
          Powered by Gemini 3 Flash · NTU Cloud Computing 2026
        </footer>
      </div>
    </main>
  );
}