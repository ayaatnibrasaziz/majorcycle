'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

  const lockup = (
    <>
      <Image
        src="/logo.png"
        alt="MajorCycle logo"
        width={34}
        height={34}
        priority
        className="w-[34px] h-[34px] rounded-[8px] shadow-[0_2px_8px_rgba(30,92,179,0.3)] transition-transform group-hover:scale-[1.04]"
      />
      <span className="leading-none">
        <span className="block text-[13px] font-bold text-[var(--brand-deep)] tracking-[-0.3px]">
          MajorCycle
        </span>
        {/* 9px / --text-muted measures 2.69:1 and is a KNOWN deferred exemption in
            e2e/contrast.spec.ts (design-system.md §14 assigns it to Layer H with
            the rest of the sweep). Named there by its text, so it cannot quietly
            cover a second element — do not add another 9px muted label here. */}
        {/* No `font-mono`: the approved system and the app's own Sidebar both set
            this in the UI face. It had picked up the mono family here alone. */}
        <span className="hidden min-[520px]:block text-[9px] font-medium uppercase tracking-[0.8px] text-[var(--text-muted)] mt-[2px]">
          Financial Terminal
        </span>
      </span>
    </>
  );

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
          <Link href="/" className="flex items-center gap-[10px] group flex-none">
            {lockup}
          </Link>
        ) : (
          // Not a link. A confined session that clicks it is redirected straight
          // back by proxy.ts, and a control that visibly does nothing is worse
          // than no control — especially on the two pages a distressed reader
          // sees (a password reset in flight, an account being deleted).
          <div className="flex items-center gap-2.5 flex-none">{lockup}</div>
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
                  as well would leave a 375px header with NO action at all. */}
              {pathname !== '/login' && (
                <Button
                  asChild
                  variant="outline"
                  className={`${HEADER_BTN} ${
                    pathname === '/signup' ? '' : 'hidden min-[520px]:inline-flex'
                  }`}
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
              {pathname !== '/signup' && (
                <Button asChild variant="primary" className={HEADER_BTN}>
                  <Link href="/signup">Create free account</Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
