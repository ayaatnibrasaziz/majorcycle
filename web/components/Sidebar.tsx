'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, Compass, ListPlus, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UpgradeDialog } from '@/components/UpgradeDialog';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

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
}: {
  item: NavItem;
  locked?: boolean;
  onLockedClick?: (label: string) => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href));

  // The inset margin lives on the WRAPPER, not here. A <button> doesn't stretch the
  // way an <a class="flex"> does, so it needs w-full — and w-full plus mx-2 is 100%
  // + 16px, which overflowed the nav and produced a horizontal scrollbar.
  const className = cn(
    'w-full flex items-center gap-[10px] px-[18px] py-[9px] rounded-[var(--radius-sm)] text-[13px] font-medium transition-all duration-150 select-none',
    isActive
      ? 'bg-[var(--brand-light)] text-[var(--brand-mid)] font-semibold'
      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]'
  );

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
        <Link href={item.href} className={className}>
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
}

// Licence-badge copy per Stripe subscription status. `null`/unknown (a fresh
// account hasn't started a trial — account creation ≠ trial start) reads "No plan".
// Fixes the old fall-through where past_due/canceled wrongly showed "Free Trial".
const LICENCE_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial Active',
  past_due: 'Payment Due',
  canceled: 'Cancelled',
};

// `billing_blocked` is an ORTHOGONAL dimension, not a status value — a disputed
// account keeps whatever Stripe status it had (usually `active`). Reading the status
// alone made the badge announce "ACTIVE" to someone locked out of every paid surface,
// which is the opposite of what the rest of the app was telling them. Entitlement
// already ranks the block above the status (hasAccess / accessDenialReason); the badge
// now agrees.
function licenceLabel(
  status: string | null | undefined,
  billingBlocked?: boolean,
): string {
  if (billingBlocked) return 'On hold';
  return (status && LICENCE_LABELS[status]) || 'No plan';
}

export function Sidebar({
  subscriptionStatus,
  entitled = false,
  billingBlocked = false,
}: SidebarProps) {
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  return (
    <aside
      className="fixed top-0 left-0 w-[var(--sidebar-w)] h-screen bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex flex-col z-[100] shadow-[var(--shadow-sm)]"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-[10px] px-[18px] h-[var(--header-h)] border-b border-[var(--border)] flex-shrink-0">
        <Image
          src="/logo.png"
          alt="MajorCycle logo"
          width={34}
          height={34}
          priority
          className="w-[34px] h-[34px] rounded-[8px] flex-shrink-0 shadow-[0_2px_8px_rgba(30,92,179,.3)]"
        />
        <div>
          <div className="text-[13px] font-bold text-[var(--brand-deep)] tracking-[-0.3px] leading-none">
            MajorCycle
          </div>
          <div className="text-[9px] font-medium text-[var(--text-muted)] tracking-[0.8px] uppercase mt-[2px]">
            Financial Terminal
          </div>
        </div>
      </div>

      {/* Nav: Analysis */}
      <nav className="flex-1 overflow-y-auto pt-1">
        <div className="px-[18px] py-[6px] mt-[10px] text-[9px] font-semibold tracking-[1.2px] uppercase text-[var(--text-muted)]">
          Discover
        </div>
        {NAV_DISCOVER.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <div className="px-[18px] py-[6px] mt-[10px] text-[9px] font-semibold tracking-[1.2px] uppercase text-[var(--text-muted)]">
          Screen
        </div>
        {NAV_SCREEN.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            locked={!entitled}
            onLockedClick={setLockedFeature}
          />
        ))}
      </nav>

      {/* Bottom: subscription badge. Account moved to the header user menu in F3
          Step 10 — keeping a second entry point here just duplicated it. */}
      <div className="px-2 py-3 border-t border-[var(--border)] flex-shrink-0">
        <div className="bg-gradient-to-br from-[var(--brand-light)] to-[#dbeafe] border border-[#bfdbfe] rounded-[var(--radius-sm)] px-3 py-2 text-[10px]">
          <div className="text-[var(--text-muted)] font-medium tracking-[0.5px] uppercase">
            Licence Status
          </div>
          {/* Uppercased in CSS, not in LICENCE_LABELS, so the source strings stay
              readable prose for screen readers and for any other surface reusing them. */}
          <div
            className="font-[var(--font-mono)] text-[10px] text-[var(--brand-mid)] font-semibold mt-0.5 uppercase tracking-[0.5px]"
            aria-label="Subscription status"
          >
            {licenceLabel(subscriptionStatus, billingBlocked)}
          </div>
        </div>
      </div>

      <UpgradeDialog
        open={lockedFeature !== null}
        onOpenChange={(v) => !v && setLockedFeature(null)}
        feature={lockedFeature ?? ''}
      />
    </aside>
  );
}
