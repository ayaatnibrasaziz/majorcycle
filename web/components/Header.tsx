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
  //
  // `ownsHeading` says the PAGE supplies the h1, so this strip must not. See the
  // note beside the title element below.
  if (pathname.startsWith('/stocks/')) {
    return {
      title: 'Stock Detail',
      subtitle: 'Full Major Cycle breakdown for a single stock',
      ownsHeading: true,
    };
  }
  for (const [prefix, meta] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return { ...meta, ownsHeading: false };
    }
  }
  return { title: 'MajorCycle', subtitle: 'Financial Terminal', ownsHeading: false };
}

interface HeaderProps {
  lastRunAt?: string | null;
  /** Shown on the account menu trigger; omitted in the dev-bypass render. */
  email?: string | null;
}

export function Header({ lastRunAt, email }: HeaderProps) {
  const pathname = usePathname();
  const { title, subtitle, ownsHeading } = getPageMeta(pathname);

  // On a page that names itself, this strip is a label, not the page's heading.
  const Title = ownsHeading ? 'div' : 'h1';

  return (
    <header
      className="fixed top-0 left-[var(--sidebar-w)] right-0 h-[var(--header-h)] bg-[var(--bg-header)] border-b border-[var(--border)] flex items-center justify-between px-6 z-[99] shadow-[var(--shadow-sm)]"
      role="banner"
    >
      <div>
        {/* ⚠️ An <h1>, not a <div> — audit 5A-114. Browse, Run, Results and Stock Detail
            had NO heading of any level: every visible "heading" on them was a styled div,
            so a screen-reader user got one flat run of text with no way to navigate the
            page by structure. This element is already the page title, visibly and
            semantically; it just was not marked as one.

            Fixed HERE rather than on four pages because this header renders the title for
            every signed-in route, so the pages cannot drift apart again (11c). `/account`
            and `/request` had their own `sr-only` h1 and have had it removed — the page
            title now comes from one place, and no page ends up with two h1s.

            ⚠️ Invisible to the a11y guard by construction: `app-a11y.spec.ts` runs axe
            with `wcag2a/2aa/21a/21aa`, and axe tags its heading rules `best-practice`, so
            the scan was green and had never had an opinion. The tag list is a claim about
            what the guard can see (14g).

            ⚠️ EXCEPT where the page names itself (`ownsHeading`), which today is Stock
            Detail and its not-found. Those pages already display something more specific
            than a route label — the company's name, or "Not in our coverage yet" — and a
            page's h1 should say WHICH page it is, not which kind. "Stock Detail" was the
            same six words on all 863 of them (owner, 2026-09-04). There the strip renders
            as a plain <div> so the page's own h1 is the only one; the classes are
            unchanged and Tailwind's preflight already gives an h1 `font-size: inherit`,
            `font-weight: inherit` and no margin, so the two tags paint identically.
            ⚠️ It also removes a duplicate nobody had measured: `NotInCoverage` carries
            its own h1, so an unknown ticker was serving TWO — a state the "exactly one"
            test above could not see, because no unknown ticker is in APP_PATHS. */}
        <Title className="text-[15px] font-bold text-[var(--text-primary)] tracking-[-0.3px]">
          {title}
        </Title>
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
