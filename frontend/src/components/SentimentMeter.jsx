export default function SentimentMeter({ score }) {
  const pct   = ((score + 1) / 2) * 100;
  const isBullish = score >= 0.2;
  const isBearish = score <= -0.2;
  const label = isBullish ? 'Bullish' : isBearish ? 'Bearish' : 'Neutral';
  const pillClass = isBullish ? 'pill-bull' : isBearish ? 'pill-bear' : 'pill-neutral';
  const barColor = isBullish ? 'var(--accent-sage)' : isBearish ? 'var(--accent-rust)' : 'var(--accent-slate)';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Sentiment Analysis
        </span>

        <span className={`sentiment-pill ${pillClass}`}>
          {isBullish ? '▲' : isBearish ? '▼' : '—'} {label} · {score >= 0 ? '+' : ''}{score.toFixed(2)}
        </span>
      </div>

      <div className="w-full h-[6px] bg-[var(--bg-surface)] rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-1000 ease-out"
          style={{ 
            width: `${pct}%`, 
            background: barColor 
          }}
        />
      </div>

      <div className="flex justify-between font-mono text-[10px] text-[var(--fg-muted)] uppercase tracking-wider">
        <span>−1.0 Bearish</span>
        <span className="opacity-50">Neutral</span>
        <span>Bullish +1.0</span>
      </div>
    </div>
  );
}