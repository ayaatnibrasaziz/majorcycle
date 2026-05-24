'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, TrendingUp, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ANALYSIS: NavItem[] = [
  {
    label: 'Results',
    href: '/results',
    icon: <BarChart3 className="w-[15px] h-[15px]" strokeWidth={1.8} />,
  },
  {
    label: 'Stock Detail',
    href: '/stocks',
    icon: <TrendingUp className="w-[15px] h-[15px]" strokeWidth={1.8} />,
  },
];

const NAV_DATA: NavItem[] = [
  {
    label: 'Run Analysis',
    href: '/run',
    icon: <Play className="w-[15px] h-[15px]" strokeWidth={1.8} />,
  },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-[10px] px-[18px] py-[9px] mx-2 rounded-[var(--radius-sm)] text-[13px] font-medium transition-all duration-150 select-none',
        isActive
          ? 'bg-[var(--brand-light)] text-[var(--brand-mid)] font-semibold'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]'
      )}
    >
      <span className="w-[18px] flex-shrink-0 flex justify-center text-[15px]">
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

interface SidebarProps {
  subscriptionStatus?: string | null;
}

export function Sidebar({ subscriptionStatus }: SidebarProps) {
  return (
    <aside
      className="fixed top-0 left-0 w-[var(--sidebar-w)] h-screen bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex flex-col z-[100] shadow-[var(--shadow-sm)]"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-[10px] px-[18px] h-[var(--header-h)] border-b border-[var(--border)] flex-shrink-0">
        <div className="w-[34px] h-[34px] rounded-[8px] bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(30,92,179,.3)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 17l5-5 4 3 6-7"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 8h4v4"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
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
          Analysis
        </div>
        {NAV_ANALYSIS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <div className="px-[18px] py-[6px] mt-[10px] text-[9px] font-semibold tracking-[1.2px] uppercase text-[var(--text-muted)]">
          Data
        </div>
        {NAV_DATA.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Bottom: subscription badge */}
      <div className="px-2 py-3 border-t border-[var(--border)] flex-shrink-0">
        <div className="bg-gradient-to-br from-[var(--brand-light)] to-[#dbeafe] border border-[#bfdbfe] rounded-[var(--radius-sm)] px-3 py-2 text-[10px]">
          <div className="text-[var(--text-muted)] font-medium tracking-[0.5px] uppercase">
            Licence Status
          </div>
          <div
            className="font-[var(--font-mono)] text-[10px] text-[var(--brand-mid)] font-semibold mt-0.5"
            aria-label="Subscription status"
          >
            {subscriptionStatus === 'active'
              ? 'Active'
              : subscriptionStatus === 'trialing'
                ? 'Trial Active'
                : 'Free Trial'}
          </div>
        </div>
      </div>
    </aside>
  );
}
