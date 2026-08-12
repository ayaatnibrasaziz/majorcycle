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
 * `#the-service`, from "The Service". Derived, never authored: an id typed by
 * hand beside a heading is a second copy of that heading, and the two drift the
 * first time the wording is edited (CLAUDE.md 11c). The contents list and the
 * section it points at both call this, so they cannot disagree.
 */
export const sectionId = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Shared chrome for the static legal pages (/disclaimer, /terms, /privacy).
 *
 * Reading frame, not the auth card: these are the documents a reader is most
 * likely to be sent to by someone else, and until Layer G they ran at 13px down
 * a 440px column. Sizes come from `.reading` (globals.css) — this file names no
 * pixel value of its own, so the legal pages and the rest of the content pages
 * cannot drift into two type scales (CLAUDE.md 11c).
 *
 * ⚠️ The furniture here is deliberately the SAME furniture as /methodology — the
 * brand-blue eyebrow, the lead, the bordered notice, the card. Those three pages
 * are one voice, and the owner's report was that they read as two: /methodology
 * had structure and the legal pages were an undifferentiated grey wall.
 *
 * The one thing that is NOT copied is the heading accent. /methodology marks its
 * sections with a bar, because they are concepts. These are NUMBERED, because
 * they are clauses — a legal document is referred to by section number, so the
 * numeral carries information rather than decorating the page.
 *
 * Every page carries the "not financial advice" line (CLAUDE.md #4/#12/#24) —
 * now at the TOP, in the notice, so it is visible without scrolling on a
 * multi-thousand-word document — and a "Back to sign in" link, the safe
 * destination for the logged-out visitor who followed a footer link here.
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
          <p className="micro text-[var(--brand-mid)]">Legal</p>
          <h1 className="mt-3">{title}</h1>

          {/* A chip, not a caption. "Last updated" is the first thing a reader
              checks on a legal page — whether this is the version they were
              shown — so it gets a shape instead of being the smallest, faintest
              line on the page. */}
          <p className="mt-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-stripe)] px-3 py-1 text-[length:var(--rd-micro)] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-mid)]" aria-hidden="true" />
              Last updated {updated}
            </span>
          </p>

          {intro && <div className="lead mt-6">{intro}</div>}

          {/* Same notice as /methodology, same tokens. Moved up from the foot of
              the page: on /terms it previously sat ~2,000 words below the fold,
              which is the one place a "visible without scrolling" line must not
              be (CLAUDE.md #4/#12/#24). */}
          <div className="mt-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-stripe)] px-5 py-4">
            <p className="small">
              <strong>Information only — not financial advice.</strong> MajorCycle
              provides educational and informational analysis. It is not a licensed
              financial adviser, and nothing on this site is a recommendation to buy,
              hold, or sell any security.
            </p>
          </div>

          {/* Contents. Generated from `sections`, so it cannot list a section that
              does not exist or miss one that does. Worth its space on a document
              nobody reads top to bottom: most people arrive wanting one clause. */}
          <nav aria-label="Contents" className="mt-8">
            <p className="micro font-semibold uppercase tracking-[0.1em]">On this page</p>
            {/* `list-none pl-0` and `mt-0` are not cosmetic tidying — they opt this
                ONE list out of the `.reading` prose rules, which are meant for
                lists inside the clauses and are wrong here. `.reading ol` adds a
                1.35em indent and a decimal marker (we draw our own numeral), and
                `.reading li + li` adds a top margin to every item EXCEPT the
                first — which in a two-column grid pushed row 1's left item 8px
                above its neighbour. Measured, not spotted: it reads as "slightly
                off" and nothing else. The utilities win because the `.reading`
                block lives in @layer base (see globals.css). */}
            <ol className="mt-3 grid list-none gap-x-6 gap-y-2 pl-0 sm:grid-cols-2">
              {sections.map((s, i) => (
                <li key={s.heading} className="mt-0 flex items-baseline gap-2.5">
                  {/* --text-secondary. Muted measured 2.97:1 here — caught by the
                      contrast guard added in this same layer, on work written
                      twenty minutes after the guard. Numerals a reader may want
                      to quote ("clause 5") are content, not texture. */}
                  <span
                    className="font-mono text-[length:var(--rd-micro)] font-semibold text-[var(--text-secondary)]"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <a href={`#${sectionId(s.heading)}`} className="text-[length:var(--rd-small)] no-underline">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 flex flex-col gap-10">
            {sections.map((s, i) => (
              <section
                key={s.heading}
                id={sectionId(s.heading)}
                // Clears the sticky header when the contents list jumps here.
                // Without it the heading lands underneath the bar and the reader
                // sees the paragraph after the one they asked for.
                className="scroll-mt-[calc(var(--header-h)+20px)]"
              >
                <h2 className="flex items-baseline gap-3">
                  {/* The numeral is the accent. On --brand-light it measures
                      5.95:1, so it stays a readable reference rather than a
                      decorative watermark. */}
                  <span
                    className="inline-flex h-[26px] min-w-[26px] flex-shrink-0 translate-y-[2px] items-center justify-center rounded-[var(--radius-sm)] bg-[var(--brand-light)] px-1.5 font-mono text-[length:var(--rd-micro)] font-bold text-[var(--brand-mid)]"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.heading}
                </h2>
                <div className="mt-3">{s.body}</div>
              </section>
            ))}
          </div>

          <div className="mt-12 border-t border-[var(--border)] pt-7">
            <p className="small">
              Questions about any of this?{' '}
              <Link href="/contact">Contact us</Link>.
            </p>
            <Link href="/login" className="mt-5 inline-block font-semibold no-underline">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </article>
    </PageFrame>
  );
}
