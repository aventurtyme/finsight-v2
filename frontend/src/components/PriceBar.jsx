export default function PriceBar({ data }) {
  const { current_price, price_change_pct, pe_ratio, market_cap, week_52_high, week_52_low } = data;
  const up = parseFloat(price_change_pct) >= 0;

  const fmt = (n) => n == null || n === 'N/A' ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

  const stats = [
    { label: 'Price',     value: `$${fmt(current_price)}` },
    { label: '1D Change', value: `${up ? '▲' : '▼'} ${Math.abs(Number(price_change_pct || 0)).toFixed(2)}%`, color: up ? 'text-[var(--positive)]' : 'text-[var(--negative)]' },
    { label: 'P/E Ratio', value: fmt(pe_ratio) },
    { label: 'Mkt Cap',   value: market_cap ? `$${market_cap}` : '—' },
    { label: '52W High',  value: `$${fmt(week_52_high)}` },
    { label: '52W Low',   value: `$${fmt(week_52_low)}` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="bg-[var(--bg-surface)] rounded-lg p-4 border border-[var(--border)]">
          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)] mb-1">
            {label}
          </p>
          <p className={`font-mono text-[13px] ${color || 'text-[var(--fg-primary)]'}`}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}