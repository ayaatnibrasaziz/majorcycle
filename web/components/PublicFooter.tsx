'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkPending } from './LinkPending';
import { FOOTER_LINKS, showsFullChrome } from '@/lib/publicNav';

/**
 * The ONE footer every public page wears.
 *
 * Until Layer G it linked only to /disclaimer, which left five public pages with
 * no inbound link from anywhere on the site: a reader could not reach them, and
 * neither could a crawler following links.
 *
 * ⚠️ The NAV hides on the two session-confined pages, for the same reason the
 * header's sign-in buttons do — `showsFullChrome`, one rule serving both. This was
 * missed on the first pass and caught by actually opening
 * `/account/update-password`: the header had correctly collapsed to the logo while
 * the footer below it still offered seven links, every one of which bounces the
 * reader straight back (proxy.ts confines a recovery session to the password page
 * and a deletion-scheduled account to /reactivate). Seven dead links is worse than
 * the two the header used to show, and it is on the page where a reader is least
 * able to absorb the confusion.
 *
 * The disclaimer and the copyright are NOT conditional. They are the legally
 * material lines (CLAUDE.md #4/#12) and they say something true to every reader.
 */
export function PublicFooter({ year }: { year: number }) {
  const pathname = usePathname() ?? '';

  return (
    <footer className="relative z-10 mt-auto bg-[var(--bg-surface)] border-t border-[var(--border)] px-[20px] pt-[30px] pb-[36px]">
      {showsFullChrome(pathname) && (
        <nav
          aria-label="Site"
          className="mx-auto flex max-w-[var(--measure-wide)] flex-wrap justify-center gap-x-[22px] gap-y-[8px]"
        >
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[length:var(--rd-small)] font-medium text-[var(--text-secondary)] hover:text-[var(--brand-mid)] transition-colors"
            >
              {l.label}
              {/* The footer gets the same affordance as the header on purpose.
                  Giving a shared behaviour to one of its two consumers and not
                  the other is the exact defect CLAUDE.md 11c (iv) records — the
                  footer was the component that missed `showsFullChrome`, on this
                  very file. Same links, same waiting, same feedback. */}
              <LinkPending />
            </Link>
          ))}
        </nav>
      )}
      {/* --text-secondary, not --text-muted. Muted measures 2.69:1 on --bg-page
          and 2.9:1 here on --bg-surface (design-system §14), and this is the
          legally material line on every public page — CLAUDE.md #4/#12. A
          disclaimer nobody can read is not a disclaimer. The approved artifact
          set this in `.micro` (12px, muted); that is the one place this
          implementation deliberately departs from it, and the contrast guard is
          what would have caught the alternative. */}
      <p className="mx-auto mt-[16px] max-w-[74ch] text-center text-[length:var(--rd-small)] text-[var(--text-secondary)] leading-relaxed">
        Information only — not financial advice. MajorCycle provides educational
        analysis of US, Australian and Canadian equities. It does not take your
        objectives, financial situation or needs into account.
      </p>
      <p className="mx-auto mt-3 text-center text-[length:var(--rd-micro)] text-[var(--text-secondary)]">
        {/* Passed in from the SERVER layout, not read here. `new Date()` inside a
            client component is evaluated twice — once when the server renders the
            HTML and again when React hydrates — and on New Year's Eve the two can
            disagree (different clocks, different time zones), which React reports
            as a hydration mismatch. One value, computed once, serialised. */}
        © {year} MajorCycle
      </p>
    </footer>
  );
}
