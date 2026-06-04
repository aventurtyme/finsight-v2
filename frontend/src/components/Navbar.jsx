import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { pathname } = useLocation();
  
  const link = (to, label) => (
    <Link
      to={to}
      className={`text-[13px] font-sans transition-colors ${
        pathname === to 
          ? 'text-[var(--fg-primary)] font-medium' 
          : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 border-b border-[var(--border)] bg-[var(--bg-page)]">
      <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/" className="font-serif text-lg text-[var(--fg-primary)] flex items-center gap-2">
          FinSight
        </Link>
        
        <nav className="flex items-center gap-8">
          {link('/sentiment', 'Sentiment')}
          {link('/about', 'About')}
          
          <a
            href="https://github.com/aventurtyme/sc4052-project"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-sans text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}