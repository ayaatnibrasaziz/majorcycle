'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Play } from 'lucide-react';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/results': {
    title: 'Results',
    subtitle: 'Ranked analysis across your universe',
  },
  '/run': {
    title: 'Run Analysis',
    subtitle: 'Configure and run Major Cycle analysis',
  },
  '/stocks': {
    title: 'Stock Detail',
    subtitle: 'Full Major Cycle breakdown for a single stock',
  },
  '/account': {
    title: 'Account',
    subtitle: 'Subscription and profile settings',
  },
};

function getPageMeta(pathname: string) {
  for (const [prefix, meta] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return meta;
  }
  return { title: 'MajorCycle', subtitle: 'Financial Terminal' };
}

interface HeaderProps {
  lastRunAt?: string | null;
}

export function Header({ lastRunAt }: HeaderProps) {
  const pathname = usePathname();
  const { title, subtitle } = getPageMeta(pathname);

  return (
    <header
      className="fixed top-0 left-[var(--sidebar-w)] right-0 h-[var(--header-h)] bg-[var(--bg-header)] border-b border-[var(--border)] flex items-center justify-between px-6 z-[99] shadow-[var(--shadow-sm)]"
      role="banner"
    >
      <div>
        <div className="text-[15px] font-bold text-[var(--text-primary)] tracking-[-0.3px]">
          {title}
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">{subtitle}</div>
      </div>

      <div className="flex items-center gap-[10px]">
        {lastRunAt && (
          <div className="flex items-center gap-[5px] bg-[var(--bg-stripe)] border border-[var(--border)] rounded-full px-3 py-[5px] text-[11px] text-[var(--text-secondary)] font-[var(--font-mono)]">
            <span
              className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"
              aria-hidden="true"
            />
            Last run: {lastRunAt}
          </div>
        )}

        <Link
          href="/run"
          className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-sm)] px-3.5 py-[7px] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)] transition-all duration-150"
        >
          <Play className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
          Run Analysis
        </Link>
      </div>
    </header>
  );
}
