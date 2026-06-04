export default function NewsCard({ headline, index = 0 }) {
  const { title, source, published_at } = headline;
  
  return (
    <div
      className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] transition-all cursor-default"
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      <p className="text-[13px] text-[var(--fg-primary)] font-sans leading-relaxed mb-4 group-hover:text-black transition-colors">
        {title}
      </p>
      
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent-slate)]">
          {source}
        </span>
        
        <span className="font-mono text-[10px] text-[var(--fg-muted)]">
          {published_at ? new Date(published_at).toLocaleDateString('en-SG', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          }) : ''}
        </span>
      </div>
    </div>
  );
}