import Link from 'next/link';
import { PageFrame } from './PageFrame';

export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

interface LegalDocProps {
  title: string;
  /** Human-readable date, e.g. "5 July 2026". */
  updated: string;
  intro?: React.ReactNode;
  sections: LegalSection[];
}

/**
 * Shared chrome for the static legal pages (/disclaimer, /terms, /privacy).
 *
 * Reading frame, not the auth card: these are the documents a reader is most
 * likely to be sent to by someone else, and until Layer G they ran at 13px down
 * a 440px column. Sizes come from `.reading` (globals.css) — this file names no
 * pixel value of its own, so the legal pages and the rest of the content pages
 * cannot drift into two type scales (CLAUDE.md 11c).
 *
 * Every page carries the "not financial advice" line (CLAUDE.md #4/#12/#24) and
 * a "Back to sign in" link — the safe destination for the logged-out visitor
 * who followed a footer link here.
 */
export function LegalDoc({ title, updated, intro, sections }: LegalDocProps) {
  return (
    <PageFrame width="prose">
      {/* --shadow-sm, not --shadow-lift. The auth card is a small object floating
          on the page and reads better lifted; a 2,000-word document IS the page,
          and a heavy ambient blur under it just looks like it is about to slide
          off. Same radius, same border, same surface — the two are one family. */}
      <article className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="px-7 py-9 sm:px-12 sm:py-12">
          <h1>{title}</h1>
          <p className="micro mt-3">Last updated {updated}</p>

          {intro && <div className="lead mt-6">{intro}</div>}

          <div className="mt-10 flex flex-col gap-9">
            {sections.map((s) => (
              <section key={s.heading}>
                <h2>{s.heading}</h2>
                <div className="mt-3">{s.body}</div>
              </section>
            ))}
          </div>

          <div className="mt-12 pt-7 border-t border-[var(--border)]">
            {/* --text-secondary (inherited), never --text-muted: this is the
                legally material line, and muted measures 2.97:1 here. */}
            <p className="small">
              Information only — not financial advice. MajorCycle provides educational
              and informational analysis. It is not a licensed financial adviser, and
              nothing on this site is a recommendation to buy, hold, or sell any
              security.
            </p>
            <Link href="/login" className="mt-6 inline-block font-semibold no-underline">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </article>
    </PageFrame>
  );
}
