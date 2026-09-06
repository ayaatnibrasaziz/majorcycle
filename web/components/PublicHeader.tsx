'use client';

import Link from 'next/link';

import { BrandLockup } from './BrandLockup';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { NAV_LINKS, showsFullChrome } from '@/lib/publicNav';

/**
 * The ONE header every public page wears.
 *
 * Until Layer G the public pages carried a logo and a "Markets · Live" pill and
 * nothing else — no way to reach pricing, no way to sign in from a legal page,
 * and a landing page with a completely different bar. This is the single
 * definition (CLAUDE.md 11c); the footer and the background live in the layout
 * beside it, so no page can fork the chrome.
 *
 * ⚠️ SESSION-UNAWARE, on purpose. It renders the same links for everybody and
 * never reads `getUser()`. Two reasons: the public layout would then make an Auth
 * round-trip on every sign-in page load, and a header that varies by viewer is a
 * response that varies by viewer (CLAUDE.md 11a) on the one part of the site most
 * likely to be cached one day. The cost is small and stated: a signed-in reader
 * who opens /terms sees "Sign in" — the pages where that would actually mislead
 * (`/`, `/login`, `/signup`, `/deletion-requested`, `/pricing`) all redirect a
 * signed-in reader away in `proxy.ts` before this component renders.
 *
 * A client component only because `usePathname()` decides three things: which nav
 * link is current, which call-to-action to hide, and whether to draw the nav at
 * all. No state, no effects, no data.
 */
/**
 * The two header actions, sized once.
 *
 * The approved system's `.btn` is `font-size:14px; padding:10px 18px` — no fixed
 * height, the padding sets it. This header had them at `h-9 px-3.5 text-[12.5px]`,
 * which is 31.5px tall with 12.5px labels: noticeably smaller and tighter than
 * every other button on the site, on the one control the page most wants pressed.
 * `h-auto` is required because `size: 'default'` ships `h-11`, and a fixed height
 * would win over the padding.
 */
const HEADER_BTN =
  'h-auto py-[10px] px-[18px] text-[length:var(--rd-small)]';

export function PublicHeader() {
  const pathname = usePathname() ?? '';
  const full = showsFullChrome(pathname);

  // ⚠️ The lockup is `BrandLockup`, shared with the signed-in Sidebar, and it is
  // shared because a hand-maintained copy of it drifted: `leading-none` sat on
  // the wrapper here and on the wordmark there, so the public site's two lines
  // were tighter than the terminal's. Read either file alone and both look
  // right — the defect existed only in the comparison, which is why the owner
  // found it and review did not. Do not re-inline it "just to tweak one thing".
  const lockup = <BrandLockup hideSubtitleOnNarrow interactive />;

  return (
    <header
      // Marked for the contrast guard's sentinel: `position: sticky` is a value
      // nothing has by default, so it proves the stylesheet is actually live
      // before the probe measures. An unstyled page has no low-contrast text and
      // would otherwise score as PERFECT (the flake fixed in G2).
      data-public-header
      className="sticky top-0 z-50 h-[var(--header-h)] bg-[rgba(255,255,255,0.9)] backdrop-blur-[12px] border-b border-[var(--border)]"
    >
      {/* ⚠️ Every gap and pad here is an EXPLICIT px value, not a Tailwind step,
          and that is deliberate. The root font-size is 14px, so Tailwind's rem
          scale lands at 0.875× the number you expect — `gap-5` is 17.5px, not
          20px, and `px-5` is 17.5px, not 20. Measured against the approved
          design system this header was short on every axis: 17.5 where 22 was
          specified, 8.75 where 10 was, 5.25/10.5 where 7/11 was. Individually
          invisible; together the chrome read tighter than the artifact. Same
          trap that hung the landing's dark band 2.5px off-screen. */}
      <div className="h-full w-full max-w-[var(--measure-wide)] mx-auto px-[20px] flex items-center gap-[22px]">
        {full ? (
          <Link href="/" className="group flex-none">
            {lockup}
          </Link>
        ) : (
          // Not a link. A confined session that clicks it is redirected straight
          // back by proxy.ts, and a control that visibly does nothing is worse
          // than no control — especially on the two pages a distressed reader
          // sees (a password reset in flight, an account being deleted).
          <div className="flex-none">{lockup}</div>
        )}

        {full && (
          <>
            <nav aria-label="Main" className="hidden min-[900px]:flex items-center gap-[2px]">
              {NAV_LINKS.map((l) => {
                const current = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    {...(current ? { 'aria-current': 'page' as const } : {})}
                    className={`text-[length:var(--rd-small)] px-[11px] py-[7px] rounded-[var(--radius-sm)] transition-colors ${
                      current
                        ? 'text-[var(--brand-mid)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]'
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-[10px]">
              {/* Hide the offer the reader is already looking at — a "Sign in"
                  button on the sign-in page is noise, and on 375px it is noise
                  competing for the only room the real action has.
                  ⚠️ The narrow-screen collapse below is conditional for a reason:
                  on /signup the primary is the hidden one, so collapsing "Sign in"
                  as well would leave a 375px header with NO action at all — under
                  600px BOTH live in the menu instead, which is the same rule one
                  step further down.

                  ⚠️ **600, and it was 520 for about an hour.** 520 was inherited from
                  the old "Sign in" collapse and was correct before this header grew a
                  menu control. Measured after it did: at 520px the row needs 506px of
                  content in 480px of room, so the page **scrolled sideways by 6px from
                  520 to 525** — a five-pixel band, menu open or closed, invisible to a
                  guard that samples 375 / 360 / 320. Slack first reaches the 12px floor
                  at ~558; 600 leaves 54px. The lockup's own subtitle keeps `min-[520px]`
                  deliberately: it answers a different question (does a 43px subtitle
                  fit?) and has room to spare once these two are out of the row.

                  ⚠️ THREE literals, and Tailwind cannot read a constant — its scanner
                  needs the class in the source. So the invariant is asserted instead of
                  written down: `public-responsive.spec.ts` sweeps every width from 320
                  to 900 and fails if the header ever runs out of room, whatever the
                  breakpoint happens to be. */}
              {pathname !== '/login' && (
                <Button
                  asChild
                  variant="outline"
                  className={`${HEADER_BTN} hidden min-[600px]:inline-flex`}
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
              {pathname !== '/signup' && (
                <Button
                  asChild
                  variant="primary"
                  className={`${HEADER_BTN} hidden min-[600px]:inline-flex`}
                >
                  <Link href="/signup">Create free account</Link>
                </Button>
              )}
              <MenuButton pathname={pathname} />
            </div>
          </>
        )}
      </div>
    </header>
  );
}

/**
 * The phone/tablet menu — audit 5A-156.
 *
 * ⚠️ Below 900px the public site had NO navigation at all. `nav[aria-label="Main"]`
 * is `hidden min-[900px]:flex`, so a reader on a phone saw a logo and one button;
 * the only way to reach Pricing, Learn, Articles or Contact was the footer, at the
 * bottom of documents up to 9,300px tall. Measured on every public page.
 *
 * ⚠️ WHY THE TWO BUTTONS MOVE IN HERE UNDER 520px, rather than the menu being
 * added beside them. The header row is `20 + lockup 118 + CTA 178 + 20 = 336`,
 * which is why every public page overflowed by 18px at 320px (5A-154) and why at
 * 375px the row measured 375.0 — zero slack. There is no arrangement that keeps
 * the full lockup, a menu control AND a 178px call-to-action on a 375px screen;
 * something has to yield. The lockup is the brand and the CTA is the conversion,
 * so the thing that yields is *permanence*: under 520px both actions are the first
 * two items of the menu, one tap away, with the primary drawn as the primary. That
 * reuses the 520px breakpoint the "Sign in" collapse already used rather than
 * inventing a second one.
 *
 * ⚠️ NO-JAVASCRIPT: this panel needs JS, and `/login` + `/signup` are required to
 * work without it. Navigation is not lost — the footer nav is server-rendered on
 * every page and carries all nine links — and the forms themselves are untouched.
 * Said here rather than left as an unstated assumption (14g).
 */
function MenuButton({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      // Escape returns focus to the control that opened the panel — the WAI-ARIA
      // disclosure pattern. Without it a keyboard reader who dismisses the menu is
      // dropped at the top of the document, which is the defect `dialog.tsx`
      // already had to fix once (5A-118). Deliberately NOT done on outside-click:
      // there the reader has already moved their attention somewhere else.
      toggle.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative min-[900px]:hidden">
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-[38px] h-[38px] rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)]"
      >
        {/* Inline SVG rather than an icon dependency, and `aria-hidden` because
            the button already carries its name. Two paths, swapped by state, so
            the control says which way it goes. */}
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? (
            <>
              <path d="M4 4l10 10" />
              <path d="M14 4L4 14" />
            </>
          ) : (
            <>
              <path d="M2.5 5h13" />
              <path d="M2.5 9h13" />
              <path d="M2.5 13h13" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          // Closing here rather than in an effect on `pathname`. The header
          // survives navigation, so without this a reader taps "Learn" and
          // arrives with the menu still covering the page they asked for — and
          // every interactive thing in this panel is a link, so one handler on
          // the container covers all of them. (An effect that calls setState on
          // a route change is a cascading render and the linter says so.)
          onClick={() => setOpen(false)}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(268px,calc(100vw-32px))] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-lift)] p-[12px] flex flex-col gap-[4px]"
        >
          <nav aria-label="Menu" className="flex flex-col">
            {[...NAV_LINKS, { href: '/contact', label: 'Contact' }].map((l) => {
              const current = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  {...(current ? { 'aria-current': 'page' as const } : {})}
                  // 40px tall: a menu row is a primary touch target and is not
                  // covered by WCAG 2.5.8's inline-in-a-sentence exception.
                  className={`flex items-center min-h-[40px] px-[10px] rounded-[var(--radius-sm)] text-[length:var(--rd-small)] transition-colors ${
                    current
                      ? 'text-[var(--brand-mid)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* ⚠️ The two actions sit BELOW the links, and that is an owner decision
              (2026-09-06) rather than a layout accident. The first build put them
              at the top, which made the panel open with two full-width buttons and
              pushed the thing a reader opened a menu FOR — the links — under them.
              A menu leads with navigation; the account offer is the footer of it.
              Only rendered under 520px, where the header itself cannot show them. */}
          <div className="min-[600px]:hidden flex flex-col gap-[8px] pt-[10px] mt-[6px] border-t border-[var(--border)]">
            {pathname !== '/signup' && (
              <Button
                asChild
                variant="primary"
                className="h-auto py-[10px] px-[18px] text-[length:var(--rd-small)] w-full"
              >
                <Link href="/signup">Create free account</Link>
              </Button>
            )}
            {pathname !== '/login' && (
              <Button
                asChild
                variant="outline"
                className="h-auto py-[10px] px-[18px] text-[length:var(--rd-small)] w-full"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
