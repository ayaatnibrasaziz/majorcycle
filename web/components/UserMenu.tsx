'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';

/**
 * Account menu in the header (F3 Step 10).
 *
 * Sign out used to sit loose at the foot of the sidebar. Moving it into the Account
 * page would have made it two clicks — precisely the wrong direction on a shared or
 * public computer — so it lives here instead: still one click, but out of the nav.
 *
 * Sign-out remains a native form POST to /auth/signout (no client JS in the action
 * itself), so it keeps working even if hydration hasn't run — the same progressive
 * enhancement the old sidebar button had.
 */
export function UserMenu({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape — a menu that can only be dismissed by
  // re-clicking the trigger is a trap for keyboard and touch users alike.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-[7px] text-[12px] font-medium text-[var(--text-secondary)] transition-all duration-150 hover:border-[var(--brand-bright)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]"
      >
        <UserRound className="h-[14px] w-[14px]" strokeWidth={1.8} aria-hidden="true" />
        <span className="max-w-[140px] truncate">{email ?? 'Account'}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-[120] min-w-[180px] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-md)]"
        >
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-[8px] px-3 py-2.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]"
          >
            <UserRound className="h-[14px] w-[14px]" strokeWidth={1.8} aria-hidden="true" />
            Account
          </Link>
          <form action="/auth/signout" method="post" className="border-t border-[var(--border)]">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-[8px] px-3 py-2.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]"
            >
              <LogOut className="h-[14px] w-[14px]" strokeWidth={1.8} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
