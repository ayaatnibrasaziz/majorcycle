'use client';

import { useEffect, useState } from 'react';

import { Header } from '@/components/Header';
import { Sidebar, SidebarBody } from '@/components/Sidebar';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import {
  Dialog,
  DialogClose,
  DialogDrawerContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AnalysisProvider } from '@/lib/analysis';
import { SHELL_DESKTOP_MIN_PX } from '@/lib/shell';

/**
 * The signed-in chrome — rail, header, page — as ONE component.
 *
 * ── Why it exists (Layer H · H1, 2026-09-14) ───────────────────────────────
 * Below 768px the rail becomes a drawer, and a drawer has two halves that must agree:
 * the button in the header and the panel it opens. Left in their own components they
 * would need the same open state passed to both, and the same nav props passed to
 * both — and a rule handed to two consumers separately is the shape this codebase has
 * been bitten by repeatedly (11c-iv). One owner, one state, one set of props.
 *
 * It also removes a duplicate that was already here: `app/(app)/layout.tsx` wrote the
 * `<main>` element, its offsets and the disclaimer strip **twice**, once in the
 * dev-bypass branch and once in the real one. Adding a breakpoint to each would have
 * made that two places to get the same number right.
 *
 * ⚠️ **`<main>` lives here**, so the page's left offset sits beside the header's and
 * the rail's rather than a file away. All three move together or the layout tears.
 */
export function AppShell({
  email,
  lastRunAt,
  subscriptionStatus,
  entitled = false,
  billingBlocked = false,
  children,
}: {
  email?: string | null;
  lastRunAt?: string | null;
  subscriptionStatus?: string | null;
  entitled?: boolean;
  billingBlocked?: boolean;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  /**
   * A locked nav row explains itself in a dialog, and there is now more than one place
   * to click one — the rail and the drawer. ONE piece of state and ONE `UpgradeDialog`,
   * rather than an instance inside each nav: two would be two dialogs to keep in step,
   * on the paywall surface (11c).
   */
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);

  /**
   * Close the drawer when the viewport grows past the breakpoint.
   *
   * ⚠️ Not cosmetic. Above 768px the toggle is `display:none`, so a reader who opens
   * the drawer on a phone and rotates to landscape — or drags a desktop window wider —
   * would be left with a modal whose only visible dismissal is the backdrop, while the
   * rail it duplicates is now permanently on screen behind it. Escape still works, but
   * "still works" is not the same as "is discoverable".
   */
  useEffect(() => {
    const wide = window.matchMedia(`(min-width: ${SHELL_DESKTOP_MIN_PX}px)`);
    const sync = () => {
      if (wide.matches) setNavOpen(false);
    };
    sync();
    wide.addEventListener('change', sync);
    return () => wide.removeEventListener('change', sync);
  }, []);

  const navProps = {
    subscriptionStatus,
    entitled,
    billingBlocked,
    onLockedClick: setLockedFeature,
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <Sidebar {...navProps} />

        <Header
          email={email}
          lastRunAt={lastRunAt}
          menuButton={
            // A REAL `<DialogTrigger>`, which `ui/dialog.tsx` notes no other dialog in
            // this app uses. That is the whole reason the button and the drawer live
            // under one `<Dialog>`: it gives Radix the trigger ref, so Escape returns
            // focus HERE rather than dropping the reader at the top of the document —
            // the defect 5A-112 had to fix once already.
            <DialogTrigger asChild>
              <button
                type="button"
                /* A stable hook, because the accessible NAME is not unique on this
                   page: the account button next to it is labelled "<email> — account
                   menu", so any locator matching /menu/i finds both. Harmless for a
                   reader (the two are in different places and read differently) and
                   fatal for a test, which is how the drawer spec first failed. */
                data-shell-menu-toggle
                aria-label={navOpen ? 'Close menu' : 'Open menu'}
                className="min-[768px]:hidden flex flex-shrink-0 items-center justify-center w-[38px] h-[38px] rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)]"
              >
                {/* Inline SVG rather than an icon dependency, and `aria-hidden`
                    because the button already carries its name — the same control the
                    public header draws, so both sides of the product open their menus
                    with the same glyph. */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M2.5 5h13" />
                  <path d="M2.5 9h13" />
                  <path d="M2.5 13h13" />
                </svg>
              </button>
            </DialogTrigger>
          }
        />

        <DialogDrawerContent aria-describedby={undefined} data-shell-drawer>
          {/* A dialog needs a name. `sr-only` because the visible equivalent is the
              brand lockup below it, which names the product rather than the control. */}
          <DialogTitle className="sr-only">Main navigation</DialogTitle>
          <SidebarBody
            {...navProps}
            variant="drawer"
            onNavigate={() => setNavOpen(false)}
            headerAction={
              <DialogClose
                aria-label="Close menu"
                className="ml-auto flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 18 18"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M4 4l10 10" />
                  <path d="M14 4L4 14" />
                </svg>
              </DialogClose>
            }
          />
        </DialogDrawerContent>
      </Dialog>

      <main
        /* The page's offset, the header's and the rail's are ONE decision written three
           times — Tailwind's scanner cannot read a constant, so they stay three
           literals and `app-responsive.spec.ts` sweeps every width to prove they still
           agree. `min-[768px]:` rather than `md:` — same number, see lib/shell.ts. */
        /* ⚠️ `p-6` at EVERY width, and the first draft of this line narrowed it to
           `p-4` on a phone to buy 14px of content. That produced a 7px sideways scroll
           on the ticker page at every width from 320 to 760 — a constant, which is the
           tell that it is not a wide table. The Stock Detail sub-nav is
           `sticky … -mx-6 px-6`: it bleeds 21px each side to reach the edges of THIS
           element's padding, so it holds a second copy of the page gutter (11c-v), and
           narrowing the gutter here left it hanging 21 − 14 = 7px over each edge.
           Recorded rather than quietly refactored — the sub-nav is on a paid surface,
           and `p-6` costs nothing measurable: every route except the screener at 320px
           is clean with it. */
        className="min-[768px]:ml-[var(--sidebar-w)] mt-[var(--header-h)] p-6 min-h-[calc(100vh-var(--header-h))]"
        id="main-content"
      >
        {/* Disclaimer strip — required on all authenticated pages (#4, #12). */}
        <div className="mb-4 px-3 py-2 bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[11px] text-[var(--text-muted)] italic">
          ⚠ For educational and research purposes only. Not financial advice.
          Always conduct independent due diligence.
        </div>
        <AnalysisProvider>{children}</AnalysisProvider>
      </main>

      <UpgradeDialog
        open={lockedFeature !== null}
        onOpenChange={(v) => !v && setLockedFeature(null)}
        feature={lockedFeature ?? ''}
      />
    </div>
  );
}
