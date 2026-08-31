import Link from 'next/link';

import { learnDate } from '@/lib/learn';
import { LegalNotice } from './LegalNotice';
import { PageFrame } from './PageFrame';

/**
 * The minimum an article must carry to be rendered here.
 *
 * ⚠️ **Structural, not a convenience.** This component was typed to
 * `LearnArticle` until 2026-08-29, when `/articles` was built and the owner's
 * instruction was that the article page "gets no new design" — the live Learn
 * pages already show it. Reusing the component is the only way to honour that:
 * a second card built to the same spec is a copy free to drift (CLAUDE.md 11c),
 * and the drift would be invisible, because both pages would keep rendering
 * perfectly. So the type widened to the four fields the card actually reads,
 * and the two sections differ only in the data they hand it.
 */
export interface DocArticle {
  readonly title: string;
  readonly answer: string;
  readonly published: string;
  readonly reviewed: string;
}

/** A link out of the article, for the breadcrumb and the related list. */
export interface DocLink {
  readonly href: string;
  readonly label: string;
}

/**
 * One Learn article.
 *
 * ── Which type scale, and why it IS the legal pages' ─────────────────────────
 *
 * `doc-scale` — 24 / 17 / 13 / 12, the sizes every non-landing public page
 * already uses.
 *
 * ⚠️ **This reverses my first decision, and the reversal was settled by
 * measuring.** The first version left `.reading`'s own scale on, arguing that an
 * article is read top to bottom while a legal page is scanned for a clause. That
 * argument is sound in the abstract and it produced, in practice, a **fourth
 * type scale on the public site** — 36/26/20 against 24/17/13 everywhere else
 * and 50/34 on the landing. Crossing from `/contact` into `/learn` was a 50%
 * jump in heading size for no reason a reader could perceive.
 *
 * The owner's instruction on the legal pages (recorded in globals.css) was about
 * the whole site, not those three files: *"throughout all the public pages …
 * There is no need to make it slightly bigger."*
 *
 * ⚠️ **Stated because it is a real trade-off, not a free win:** 13px is small
 * for 900 words of newcomer prose, and I would argue for lifting the document
 * scale a step. That is a change to `--pub-*`, which the legal pages, the auth
 * cards and this page all read — one decision, applied everywhere at once. It
 * is not something an article page gets to opt out of on its own, which is
 * exactly how the fourth scale appeared.
 *
 * ── The card ─────────────────────────────────────────────────────────────────
 *
 * Same border / radius / `--shadow-sm` / surface as the legal document, on
 * purpose. The whole point of G3 was that the public pages stopped reading as
 * two different products; a third card treatment would reopen exactly that.
 *
 * ── The order of the first screen is a COMPLIANCE constraint ─────────────────
 *
 * Heading → answer → notice, and the notice must still be visible without
 * scrolling at 375px (CLAUDE.md #4 / #12 / #24). Those two requirements pull
 * against each other, which is the useful part: the only thing that can push the
 * notice below the fold is an over-long `answer`, so `e2e/learn.spec.ts` both
 * measures the notice at 375px AND caps the answer length. The editorial rule
 * "answer immediately, do not clear your throat" is therefore enforced by a test
 * rather than by whoever is writing that day.
 */
export function ArticleDoc({
  article,
  section,
  related,
  footerNote,
  cta,
  children,
}: {
  article: DocArticle;
  /** Where this article belongs — the breadcrumb, and the crawler's only signal
   *  that the page is part of a section. */
  section: DocLink;
  /** Sibling articles. May be empty — a section starts with one piece. */
  related: readonly DocLink[];
  /** The closing invitation. Supplied by the section, because Learn's wording
   *  ("browse the rest of the library") is wrong for a dated article list. */
  footerNote: React.ReactNode;
  /**
   * The closing offer, rendered AFTER the body and OUTSIDE
   * `[data-article-body]`. Optional: Learn pages pass nothing.
   *
   * ⚠️ **Outside the body container is the whole point, for the same reason the
   * JSON-LD block sits outside it.** Two guards read that container's TEXT — the
   * reading-time check and the duplicate-prose check — so an identical block
   * inside every article would inflate every stated reading time and make every
   * pair of articles look like they share long runs of copy. It renders in the
   * same visual position either way; only the guards can tell the difference,
   * which is exactly the kind of thing that is discovered three months later.
   */
  cta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PageFrame width="prose">
      <article className="doc-scale overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
        {/* Explicit px, not Tailwind steps — the root font-size is 14px, so the
            rem scale lands at 0.875× and `sm:p-10` computes to 35px where the
            design system specifies 32/30. Same trap as the auth card, the legal
            card and the header gaps. */}
        <div className="px-[20px] py-[24px] sm:px-[32px] sm:py-[30px]">
          <header>
            {/* A real link, not a decorative label. A reader who arrived cold
                from a search result has no other route into the library, and
                this is also the only internal link telling a crawler that the
                article belongs to a section. */}
            <Link
              href={section.href}
              className="micro no-underline text-[var(--text-secondary)]"
            >
              {section.label}
            </Link>

            <h1 className="mt-[6px]">{article.title}</h1>

            {/* Dated, and honestly. `published` is when it went up; `reviewed`
                is when it was last checked against the running product — which
                for anything quoting a figure or describing a screen is the date
                that actually matters (CLAUDE.md 11k). `<time>` so the dates are
                machine-readable rather than only human-readable. */}
            <p className="small mt-[8px] text-[var(--text-secondary)]">
              Published <time dateTime={article.published}>{learnDate(article.published)}</time>
              {' · Last reviewed '}
              <time dateTime={article.reviewed}>{learnDate(article.reviewed)}</time>
            </p>
          </header>

          <hr className="mt-6 border-0 border-t border-[var(--border)]" />

          {/* THE ANSWER. Directly under the heading, before any prose, because
              that is the shape a search engine quotes and the shape a reader in
              a hurry needs.

              ⚠️ **A PANEL, and at body size — owner decision, 2026-08-17.** It
              was a bare 2px rule around `.lead` (17px), and the owner's note was
              that it "reads too big". The instinct to reach for a size between
              17 and 13 has to be refused: the public site has exactly FOUR sizes
              (24/17/13/12), and inventing a fifth is precisely how a stray type
              scale appeared once already (CLAUDE.md 11c-vi). So the EMPHASIS
              moves off the type and onto the container — tinted ground, a 3px
              brand rule, a full border — and the text drops to ordinary body
              size in `--text-primary`.

              The device is deliberately not new: it is the one the Methodology
              modal already uses on the Stock Detail page
              (`components/stocks/MethodologyModal.tsx`), which is where the
              owner pointed. A reader who meets it in an article and again
              inside the product should recognise it as the same thing.

              Explicit px, not Tailwind steps — the root font-size is 14px, so
              `px-3.5` computes to 12.25px rather than the 14 the design system
              means. Same trap the card padding above documents. */}
          <div className="mt-6 rounded-[var(--radius-sm)] border border-[var(--border)] border-l-[3px] border-l-[var(--brand-mid)] bg-[var(--bg-stripe)] px-[14px] py-[12px]">
            <p className="text-[var(--text-primary)]">{article.answer}</p>
          </div>

          <LegalNotice className="mt-6" />

          {/* The body. Plain `.reading` prose — h2/h3, paragraphs and lists all
              inherit the reading scale from PageFrame, so an article body is
              written as ordinary markup and cannot invent its own sizes.

              ⚠️ `data-article-body` exists for the type-scale guard, and it is
              here because the first version of that test had no way to name this
              region. It asked for `article p` and measured the FIRST paragraph in
              the card — the "Published … Last reviewed" line, which is `.small`
              at 14px — then failed claiming the article was not using the reading
              scale. The page was correct; the selector was pointing at furniture.
              Same shape as the legal-doc line-band bug: a measurement aimed at
              the wrong node reports a real-looking number. */}
          <div data-article-body className="mt-8">
            {children}
          </div>

          {cta}

          <hr className="mt-10 border-0 border-t border-[var(--border)]" />

          <footer className="mt-6">
            {related.length > 0 && (
              <>
                <p className="micro text-[var(--text-secondary)]">Related</p>
                <ul className="mt-2.5 list-none pl-0">
                  {related.map((r) => (
                    <li key={r.href} className="mt-0">
                      <Link href={r.href}>{r.label}</Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* A quiet invitation, never a wall (the brief's words). Someone who
                came for a definition and got one has already been served; the
                offer is here because it would be strange to hide it, not because
                the article is bait. */}
            <p className={`small text-[var(--text-secondary)]${related.length > 0 ? ' mt-6' : ''}`}>
              {footerNote}
            </p>
          </footer>
        </div>
      </article>
    </PageFrame>
  );
}
