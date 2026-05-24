import Link from 'next/link';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-[8px] bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] flex items-center justify-center shadow-[0_2px_8px_rgba(30,92,179,.3)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 17l5-5 4 3 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 8h4v4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="text-[14px] font-bold text-[var(--brand-deep)] tracking-[-0.3px] leading-none">
            MajorCycle
          </div>
          <div className="text-[9px] font-medium text-[var(--text-muted)] tracking-[0.8px] uppercase mt-[2px]">
            Financial Terminal
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-md)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border)]">
          <h1 className="text-[16px] font-bold text-[var(--text-primary)] tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] text-[var(--text-muted)] mt-1">{subtitle}</p>
          )}
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>

      {/* Footer disclaimer */}
      <p className="mt-4 text-center text-[10px] text-[var(--text-muted)] italic leading-relaxed px-2">
        For educational and research purposes only. Not financial advice.{' '}
        <Link href="/disclaimer" className="underline hover:text-[var(--brand-mid)]">
          Full disclaimer
        </Link>
        .
      </p>
    </div>
  );
}
