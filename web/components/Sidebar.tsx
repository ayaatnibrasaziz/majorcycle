'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Compass, ListPlus, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLockup } from '@/components/BrandLockup';
import { planStatus } from '@/lib/planStatus';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

/**
 * How the nav is attached — the pinned rail at 768px and up, or the drawer that
 * slides over the page below it (Layer H · H1).
 *
 * ⚠️ It changes the ROWS' size and nothing else. The content, the order, the group
 * labels, the locks and the licence badge are identical, because a phone reader and a
 * desktop reader are looking for the same four destinations and a second information
 * architecture is a second thing to keep true.
 */
export type NavVariant = 'rail' | 'drawer';

// Grouped by what the viewer OWNS vs what they're buying — which also happens to be
// the order the work actually flows in. The old grouping put Results (an output) above
// Browse, and filed Run Analysis under "Data" beside a support form, so a new user
// landed on an empty table with no hint of what to do first.
//
// Splitting free from premium also makes the paywall legible rather than hidden: a
// free user sees a complete, working DISCOVER group and a SCREEN group wearing locks,
// which advertises what a subscription buys instead of quietly failing.
const NAV_DISCOVER: NavItem[] = [
  {
    label: 'Browse Stocks',
    href: '/stocks',
    icon: <Compass className="w-[15px] h-[15px]" strokeWidth={1.8} />,
  },
  {
    label: 'Request a Ticker',
    href: '/request',
    icon: <ListPlus className="w-[15px] h-[15px]" strokeWidth={1.8} />,
  },
];

// Run Analysis before Results: the verb that produces the noun.
const NAV_SCREEN: NavItem[] = [
  {
    label: 'Run Analysis',
    href: '/run',
    icon: <Play className="w-[15px] h-[15px]" strokeWidth={1.8} />,
  },
  {
    label: 'Results',
    href: '/results',
    icon: <BarChart3 className="w-[15px] h-[15px]" strokeWidth={1.8} />,
  },
];

function NavLink({
  item,
  locked = false,
  onLockedClick,
  variant = 'rail',
  onNavigate,
}: {
  item: NavItem;
  locked?: boolean;
  onLockedClick?: (label: string) => void;
  /** `drawer` is the phone presentation — same rows, thumb-sized. */
  variant?: NavVariant;
  /** Called when a real navigation happens, so the drawer can close itself. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href));

  // The inset margin lives on the WRAPPER, not here. A <button> doesn't stretch the
  // way an <a class="flex"> does, so it needs w-full — and w-full plus mx-2 is 100%
  // + 16px, which overflowed the nav and produced a horizontal scrollbar.
  const className = cn(
    'w-full flex items-center gap-[10px] px-[18px] rounded-[var(--radius-sm)] text-[13px] font-medium transition-all duration-150 select-none',
    // ⚠️ A pointer has a cursor and a thumb does not. The rail's 9px padding gives a
    // ~37px row, which is fine under a mouse and under WCAG 2.5.8's 24px floor, but
    // the drawer exists only on touch screens — so its rows take the 44px the
    // approved design asks for. `min-h` rather than more padding, so a label that
    // wraps grows the row instead of overflowing it.
    variant === 'drawer' ? 'min-h-[44px] py-[10px]' : 'py-[9px]',
    isActive
      ? 'bg-[var(--brand-light)] text-[var(--brand-mid)] font-semibold'
      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]'
  );

  // ⚠️ The padlock's `role="img"` below is load-bearing, not decoration — audit 5A-119.
  // An `aria-label` on an element with no role is not reliably announced across screen
  // readers: the label needs something to label. lucide-react injects `aria-hidden` only
  // when NO a11y prop is passed, so passing a label already opts this icon INTO the
  // accessibility tree — the role decides whether it arrives there as anything at all.
  const body = (
    <>
      <span className="w-[18px] flex-shrink-0 flex justify-center text-[15px]">
        {item.icon}
      </span>
      {item.label}
      {locked && (
        <Lock
          className="w-[11px] h-[11px] ml-auto flex-shrink-0 text-[var(--text-muted)]"
          strokeWidth={2}
          role="img"
          aria-label="Requires a subscription"
        />
      )}
    </>
  );

  // A locked row explains itself in place rather than navigating. Sending the reader
  // to /pricing meant losing whatever they were looking at, and the page they landed
  // on couldn't say which feature they'd just reached for. The route still redirects
  // if they type the URL — this is the affordance, not the gate.
  return (
    <div className="px-2">
      {locked ? (
        <button
          type="button"
          className={cn(className, 'text-left')}
          onClick={() => onLockedClick?.(item.label)}
        >
          {body}
        </button>
      ) : (
        // ⚠️ `onNavigate` closes the drawer, and it is on the LINK rather than on an
        // effect watching `pathname`: the shell survives navigation, so without it a
        // reader taps "Results" and arrives at Results with the menu still covering
        // it. The same reasoning, and the same placement, as the public MenuButton.
        <Link href={item.href} className={className} onClick={onNavigate}>
          {body}
        </Link>
      )}
    </div>
  );
}

interface SidebarProps {
  subscriptionStatus?: string | null;
  /** Drives the lock affordance on the premium (SCREEN) group. */
  entitled?: boolean;
  /** Dispute lock — outranks `subscriptionStatus` in the licence badge. */
  billingBlocked?: boolean;
  /** Set to stop at period end: the badge reads "Cancelling", as the Account page does. */
  cancelAtPeriodEnd?: boolean;
}

// The badge reads the SAME function as the Account page's pill (lib/planStatus.ts), so
// the two cannot disagree about a state. It used to keep its own table here, which said
// "Active" for a plan the Account page called "Cancelling".

/**
 * The nav itself — brand, the two groups, the licence badge.
 *
 * ⚠️ **Extracted so the rail and the drawer cannot be two navs.** Layer H gives the
 * signed-in shell a second presentation below 768px, and the obvious way to build that
 * is a second component beside this one. That is 11c: two lists of destinations, two
 * sets of lock rules, two licence badges, drifting the first time one of them is
 * edited. There is one body; `variant` decides only how big the rows are and
 * `headerAction` only what sits beside the lockup.
 */
export function SidebarBody({
  subscriptionStatus,
  entitled = false,
  billingBlocked = false,
  cancelAtPeriodEnd = false,
  variant = 'rail',
  onLockedClick,
  onNavigate,
  headerAction,
}: SidebarProps & {
  variant?: NavVariant;
  onLockedClick: (label: string) => void;
  onNavigate?: () => void;
  headerAction?: React.ReactNode;
}) {
  return (
    <>
      {/* Logo — `BrandLockup`, the same component the public header renders.
          It used to be this markup written out again, and the two copies drifted
          on `leading-none`, `flex-shrink-0` and the gap, so the wordmark sat
          differently inside the terminal than on the public site (owner,
          2026-08-17). The mark's own flex row and 10px gap now live in the
          component; this container keeps only the sidebar's chrome. */}
      <div className="flex items-center gap-2 px-[18px] h-[var(--header-h)] border-b border-[var(--border)] flex-shrink-0">
        <BrandLockup />
        {headerAction}
      </div>

      {/* Nav: Analysis */}
      <nav className="flex-1 overflow-y-auto pt-1" aria-label="Product">
        <div className="px-[18px] py-[6px] mt-[10px] text-[9px] font-semibold tracking-[1.2px] uppercase text-[var(--text-muted)]">
          Discover
        </div>
        {NAV_DISCOVER.map((item) => (
          <NavLink key={item.href} item={item} variant={variant} onNavigate={onNavigate} />
        ))}

        <div className="px-[18px] py-[6px] mt-[10px] text-[9px] font-semibold tracking-[1.2px] uppercase text-[var(--text-muted)]">
          Screen
        </div>
        {NAV_SCREEN.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            locked={!entitled}
            onLockedClick={onLockedClick}
            variant={variant}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* Bottom: subscription badge. Account moved to the header user menu in F3
          Step 10 — keeping a second entry point here just duplicated it. */}
      <div className="px-2 py-3 border-t border-[var(--border)] flex-shrink-0">
        <div className="bg-gradient-to-br from-[var(--brand-light)] to-[#dbeafe] border border-[var(--brand-light-border)] rounded-[var(--radius-sm)] px-3 py-2 text-[10px]">
          <div className="text-[var(--text-muted)] font-medium tracking-[0.5px] uppercase">
            Licence Status
          </div>
          {/* Uppercased in CSS, not in lib/planStatus.ts, so the source strings stay
              readable prose for screen readers and for any other surface reusing them. */}
          {/* ⚠️ The label needs a role to exist at all — `aria-label` on a bare
              <div> is prohibited and silently ignored. `group` is the honest
              choice here: this is a labelled region of text, not an image.
              ⚠️ And note this line renders ONLY for an account with a
              subscription status, so the E2E account (which has none) can never
              reach it — the axe scan that found its twin in WeekRangeGauge was
              structurally incapable of seeing this one. Found by grep, on the
              strength of knowing what the other one looked like. A state no
              fixture reaches is a state no guard covers. */}
          <div
            className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--brand-mid)] font-semibold mt-0.5 uppercase tracking-[0.5px]"
            role="group"
            aria-label="Subscription status"
          >
            {
              planStatus({
                status: subscriptionStatus ?? null,
                billingBlocked,
                entitled,
                cancelAtPeriodEnd,
              }).label
            }
          </div>
        </div>
      </div>

    </>
  );
}

/**
 * The permanent rail — **768px and above only**.
 *
 * Below that the identical body is rendered inside the drawer `AppShell` opens, so
 * this element is hidden rather than narrowed: a 220px column on a 375px screen leaves
 * 155px for the entire product, which is what made every signed-in page scroll
 * sideways (and the entitled screener by 188px).
 *
 * ⚠️ `hidden min-[768px]:flex`. Same width as `md:`; `lib/shell.ts` says why this
 * codebase spells its breakpoints out.
 */
export function Sidebar(props: SidebarProps & { onLockedClick: (label: string) => void }) {
  return (
    <aside
      className="hidden min-[768px]:flex fixed top-0 left-0 w-[var(--sidebar-w)] h-screen bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex-col z-[100] shadow-[var(--shadow-sm)]"
      aria-label="Main navigation"
      data-shell-rail
    >
      <SidebarBody {...props} variant="rail" />
    </aside>
  );
}
