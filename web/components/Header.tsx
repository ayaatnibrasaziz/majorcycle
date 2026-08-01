'use client';

import { usePathname } from 'next/navigation';

import { UserMenu } from '@/components/UserMenu';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/results': {
    title: 'Results',
    subtitle: 'Ranked analysis across your universe',
  },
  '/run': {
    title: 'Run Analysis',
    subtitle: 'Configure and run Major Cycle analysis',
  },
  '/request': {
    title: 'Request a Ticker',
    subtitle: 'Add US, Australian, or Canadian stocks to our coverage',
  },
  '/stocks': {
    title: 'Browse Stocks',
    subtitle: 'Search and explore the universe',
  },
  '/account': {
    title: 'Account',
    subtitle: 'Subscription and profile settings',
  },
};

function getPageMeta(pathname: string) {
  // A deeper /stocks/[market]/[ticker] path is a single-stock detail view, not
  // the browse landing — keep its own title rather than inheriting "Browse".
  if (pathname.startsWith('/stocks/')) {
    return {
      title: 'Stock Detail',
      subtitle: 'Full Major Cycle breakdown for a single stock',
    };
  }
  for (const [prefix, meta] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return meta;
  }
  return { title: 'MajorCycle', subtitle: 'Financial Terminal' };
}

interface HeaderProps {
  lastRunAt?: string | null;
  /** Shown on the account menu trigger; omitted in the dev-bypass render. */
  email?: string | null;
}

export function Header({ lastRunAt, email }: HeaderProps) {
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

        {/* Run Analysis lived here too, duplicating the sidebar's SCREEN group.
            Removed in F3 Step 10 — one entry point per destination. */}
        <UserMenu email={email} />
      </div>
    </header>
  );
}
