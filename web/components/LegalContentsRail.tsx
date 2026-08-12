'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { LEGAL_DOCS } from '@/lib/publicNav';
import { useScrollSpy } from '@/lib/useScrollSpy';

/**
 * The sticky contents rail beside a legal document, ≥1024px only.
 *
 * A legal page is navigated rather than read: most readers arrive wanting one
 * clause, and until now the only way to find it was an inline list that scrolled
 * off the top and never came back. The rail lives in what was 600px of empty page
 * beside a 680px column on a 1280px screen.
 *
 * ⚠️ It degrades to plain anchors with JavaScript off. Every entry is a real
 * `href="#id"`, so the rail still WORKS; only the highlight needs the spy. A
 * navigation that stops functioning when a script fails is not a navigation.
 *
 * ⚠️ The scroll-spy is the SAME one the Stock Detail subnav and the offline
 * report use (`lib/useScrollSpy.ts`) — deliberately not a second implementation.
 * Its "last heading above the line" rule is what stops a short clause (and these
 * are all short) from failing to highlight at all, which is the exact defect the
 * IntersectionObserver version it replaced had.
 */
export function LegalContentsRail({
  sections,
}: {
  /** `id` must match the `id` rendered on the matching <section>. */
  sections: readonly { id: string; heading: string }[];
}) {
  const pathname = usePathname() ?? '';

  // A fresh array each render would re-run the spy's effect every render. Keyed
  // on the joined string so the identity is stable while the content is, without
  // reaching for a lint suppression.
  const idsKey = sections.map((s) => s.id).join('|');
  const ids = useMemo(() => idsKey.split('|'), [idsKey]);

  // The line below which a clause counts as current. Read from the same
  // `--header-h` token the sticky header is sized by, and offset to match the
  // sections' own `scroll-mt` — so a heading is highlighted exactly when the
  // anchor jump would have parked it. Hard-coding 58 here would be a second copy
  // of the header's height (CLAUDE.md 11c) that drifts the day the header grows.
  const offset = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
    return (parseFloat(raw) || 58) + 28;
  };

  const { active, setActive, lock } = useScrollSpy(ids, offset);

  const others = LEGAL_DOCS.filter((d) => d.href !== pathname);

  return (
    <nav
      aria-label="Contents"
      className="hidden lg:block lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:max-h-[calc(100vh-var(--header-h)-48px)] lg:overflow-y-auto"
    >
      <p className="micro text-[var(--text-secondary)]">On this page</p>

      {/* `list-none pl-0` and `mt-0` opt this list out of the `.reading` prose
          rules, which are written for lists inside a clause and are wrong here:
          `.reading ol` adds a decimal marker beside the numeral we draw
          ourselves, and `.reading li + li` adds a top margin to every item
          except the first. The utilities win because `.reading` lives in
          @layer base (globals.css). */}
      <ol className="mt-3 flex list-none flex-col gap-0 pl-0">
        {sections.map((s, i) => {
          const isActive = active === s.id;
          return (
            <li key={s.id} className="mt-0">
              <a
                href={`#${s.id}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => {
                  // Set the target active immediately and hold it: without the
                  // lock, the in-flight scroll walks the highlight through every
                  // clause it passes on the way.
                  setActive(s.id);
                  lock();
                }}
                className={`flex items-baseline gap-2.5 border-l-2 py-1.5 pl-3 text-[length:var(--rd-small)] leading-snug no-underline transition-colors ${
                  isActive
                    ? 'border-[var(--brand-mid)] font-semibold text-[var(--brand-mid)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--brand-mid)]'
                }`}
              >
                <span className="font-mono text-[length:var(--rd-micro)] tabular-nums" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{s.heading}</span>
              </a>
            </li>
          );
        })}
      </ol>

      {/* The other two documents. A reader on /terms wanting to know what happens
          to their email address is looking for /privacy, and the footer is a long
          scroll away on a document this tall. Derived from LEGAL_DOCS — the same
          array the footer spreads — so the shelf cannot differ between them. */}
      {others.length > 0 && (
        <div className="mt-8 border-t border-[var(--border)] pt-5">
          <p className="micro text-[var(--text-secondary)]">Other documents</p>
          <ul className="mt-3 flex list-none flex-col gap-2 pl-0">
            {others.map((d) => (
              <li key={d.href} className="mt-0">
                <Link
                  href={d.href}
                  className="text-[length:var(--rd-small)] text-[var(--text-secondary)] no-underline hover:text-[var(--brand-mid)]"
                >
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
