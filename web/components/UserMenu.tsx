'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';

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

  /**
   * Below 768px the email collapses to the reader's initial (Layer H · H1) — there is
   * no arrangement in which a menu button, a page title, an email address and a 375px
   * screen all fit, and of those the email is the one a reader needs least while using
   * the product. Same button, same menu, same destinations.
   *
   * ⚠️ The circle is `aria-hidden` and the button keeps its `aria-label`, so the
   * ACCESSIBLE NAME is byte-identical at every width. That matters: audit 5A-151 was
   * this control advertising a name that appears nowhere on screen, and the fix there
   * was to make the name contain what is visible. A decorative initial leaves the
   * button with no visible text label at all — which is the icon-button case, not the
   * mismatch case — so WCAG 2.5.3 is satisfied by having nothing to mismatch.
   */
  const initial = email?.trim()?.[0]?.toUpperCase() ?? null;

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
        /* ⚠️ AUDIT 5A-151 — WCAG 2.5.3 "Label in Name" (Level A). This read
           `aria-label="Account menu"`, which REPLACED the visible text rather than
           describing it: the button shows the reader's own email address, and an
           `aria-label` wins over element content when the accessible name is
           computed. So a speech-input user (Dragon, Voice Control) saw their email
           on screen, said it, and nothing happened — the only name the software
           knew was one that appears nowhere on the page. On all six signed-in
           routes, for the life of the component.

           The visible text now leads, so saying what is on screen works, and the
           trailing words keep the hint that this opens a menu.

           ⚠️ NEITHER INSTRUMENT COULD SEE IT, which is the part worth
           remembering. Lighthouse runs the audit and weights it **0**, so
           accessibility scored a clean 100 with the failure inside it. axe carries
           the same rule tagged `wcag21a` — which IS in our tag list — but also
           tagged `experimental`, and axe skips experimental rules by default: it
           appeared in no bucket at all, not violations, not passes, not even
           inapplicable. A rule that never ran is indistinguishable from one that
           passed (CLAUDE.md 14g). `app-a11y.spec.ts` now enables it explicitly. */
        aria-label={`${email ?? 'Account'} — account menu`}
        className={cn(
          'flex items-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[12px] font-medium text-[var(--text-secondary)] transition-all duration-150 hover:border-[var(--brand-bright)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]',
          // Phone: a 38px square, the same size as the drawer's toggle on the other
          // side of the strip, so the two controls framing the title match.
          'h-[38px] w-[38px] justify-center',
          // 768px and up: exactly what it has always been.
          'min-[768px]:h-auto min-[768px]:w-auto min-[768px]:justify-start min-[768px]:gap-1.5 min-[768px]:px-3 min-[768px]:py-[7px]',
        )}
      >
        <UserRound
          className={cn(
            'h-[14px] w-[14px]',
            // With an email there is an initial to show instead; without one (the
            // dev-bypass render) the icon is all there is, at every width.
            initial && 'hidden min-[768px]:block',
          )}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        {initial && (
          <span
            className="min-[768px]:hidden flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[var(--brand-deep)] text-[11px] font-bold text-white"
            aria-hidden="true"
          >
            {initial}
          </span>
        )}
        <span className="hidden min-[768px]:block max-w-[140px] truncate">
          {email ?? 'Account'}
        </span>
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
