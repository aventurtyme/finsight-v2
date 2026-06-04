const stack = [
  { tech: 'React + Tailwind + Recharts', role: 'Frontend',        host: 'Local Vite' },
  { tech: 'Python + FastAPI',            role: 'Backend API',     host: 'Local uvicorn' },
  { tech: 'Google Gemini 2.5 Flash',     role: 'AI Layer',        host: 'Remote API' },
  { tech: 'PostgreSQL',                  role: 'Database',        host: 'Local Docker' },
  { tech: 'Twelve Data + Finnhub',       role: 'Data Ingestion',  host: 'Remote APIs' },
  { tech: 'Local script / cron',         role: 'Scheduler',       host: 'Local' },
];

export default function About() {
  return (
    <div className="max-w-[720px] mx-auto px-6 pt-32 pb-24 space-y-16">

      {/* Intro Section */}
      <div className="space-y-4 fade-up fade-up-1">
        <span className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          NTU Cloud Computing · Topic 8: X-as-a-Service
        </span>
        <h1 className="font-serif text-4xl text-[var(--fg-primary)]">About FinSight</h1>
        <p className="text-[var(--fg-secondary)] text-base leading-relaxed font-sans">
          FinSight evaluates when AI-generated financial analysis can be trusted. It uses public
          markets as a measurable environment for testing recommendation accuracy, confidence
          calibration, and prompt sensitivity.
        </p>
      </div>

      {/* Evaluation Loop */}
      <div className="space-y-6 fade-up fade-up-2">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Evaluation Loop
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 space-y-3">
            <p className="text-[var(--accent-sage)] font-mono text-[10px] uppercase tracking-widest">
              STEP 1 - AI Output
            </p>
            <p className="text-[13px] text-[var(--fg-primary)] leading-relaxed">
              Generate structured recommendations from historical news, price context, and prompt variants.
            </p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 space-y-3">
            <p className="text-[var(--accent-slate)] font-mono text-[10px] uppercase tracking-widest">
              STEP 2 - Outcome Tracking
            </p>
            <p className="text-[13px] text-[var(--fg-primary)] leading-relaxed">
              Compare each recommendation against 1-day, 7-day, and 30-day realized returns.
            </p>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="space-y-4 fade-up fade-up-3">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Infrastructure Stack
        </p>
        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-card)] divide-y divide-[var(--border)]">
          {stack.map(({ tech, role, host }) => (
            <div key={tech} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-surface)] transition-colors">
              <span className="font-mono text-[13px] text-[var(--fg-primary)] flex-1">{tech}</span>
              <span className="font-sans text-[11px] text-[var(--fg-muted)] hidden sm:block w-32 uppercase tracking-tighter">{role}</span>
              <span className="font-mono text-[11px] text-[var(--accent-stone)] w-20 text-right">{host}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="space-y-3 fade-up fade-up-4 pt-8 border-t border-[var(--border)]">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Data Sources & Disclaimer
        </p>
        <p className="text-[var(--fg-secondary)] text-[12px] leading-relaxed">
          Market data via <span className="text-[var(--fg-primary)] font-medium">Twelve Data</span>. 
          News via <span className="text-[var(--fg-primary)] font-medium">Finnhub</span>. 
          AI recommendations via <span className="text-[var(--fg-primary)] font-medium">Google Gemini 2.5 Flash</span>. 
          FinSight is a student project for academic purposes - not financial advice.
        </p>
      </div>

    </div>
  );
}
