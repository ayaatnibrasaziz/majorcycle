import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-[420px] mx-auto">
      {/* Mobile-only logo (hero handles desktop) */}
      <Link
        href="/"
        className="lg:hidden flex items-center justify-center gap-2.5 mb-8"
      >
        <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] flex items-center justify-center shadow-[0_4px_14px_rgba(30,92,179,0.35)]">
          <TrendingUp className="w-[22px] h-[22px] text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[16px] font-bold text-[var(--brand-deep)] tracking-[-0.3px] leading-none">
            MajorCycle
          </div>
          <div className="text-[9px] font-medium uppercase tracking-[1.2px] text-[var(--text-muted)] mt-1">
            Financial Terminal
          </div>
        </div>
      </Link>

      {/* Heading */}
      <div className="mb-7">
        <h1 className="text-[26px] font-bold text-[var(--text-primary)] tracking-[-0.5px] leading-[1.15]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13.5px] text-[var(--text-secondary)] mt-2 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Form body */}
      {children}

      {/* Footer disclaimer */}
      <p className="mt-8 text-center text-[11px] text-[var(--text-muted)] leading-relaxed">
        For educational and research purposes only. Not financial advice.{' '}
        <Link href="/disclaimer" className="underline hover:text-[var(--brand-mid)] transition-colors">
          Full disclaimer
        </Link>
        .
      </p>
    </div>
  );
}
