import Link from 'next/link';

import {
  LEARN_INDEX_PATH,
  LEARN_THEMES,
  type LearnArticle,
  learnDate,
  learnPath,
} from '@/lib/learn';
import { LegalNotice } from './LegalNotice';
import { PageFrame } from './PageFrame';

/**
 * One Learn article.
 *
 * ── Which type scale, and why it is NOT the legal pages' ─────────────────────
 *
 * `PageFrame width="prose"` turns `.reading` on: 17px body in a 680px column,
 * about 68 characters a line. The three legal documents deliberately run at the
 * small site scale (13px / 560px) instead — and that was an explicit owner
 * instruction *"scoped explicitly to these three pages only"*, recorded in
 * `LegalDoc.tsx`. An article is the one thing on this site somebody actually
 * reads top to bottom after arriving from a search result, so it gets the scale
 * built for reading. Copying the legal sizes here would be inheriting a decision
 * that was made about a different problem.
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
  related,
  children,
}: {
  article: LearnArticle;
  /** Other articles under the same theme. May be empty — the library is new. */
  related: readonly LearnArticle[];
  children: React.ReactNode;
}) {
  const theme = LEARN_THEMES.find((t) => t.id === article.theme);

  return (
    <PageFrame width="prose">
      <article className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
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
              href={LEARN_INDEX_PATH}
              className="micro no-underline text-[var(--text-secondary)]"
            >
              Learn{theme ? ` · ${theme.label}` : ''}
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
              a hurry needs. The brand rule on the left edge is doing real work
              here — it marks this as the answer rather than as the first
              paragraph, and nothing else on an article page uses that device. */}
          <div className="mt-6 border-l-2 border-[var(--brand-mid)] pl-4">
            <p className="lead">{article.answer}</p>
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

          <hr className="mt-10 border-0 border-t border-[var(--border)]" />

          <footer className="mt-6">
            {related.length > 0 && (
              <>
                <p className="micro text-[var(--text-secondary)]">Related</p>
                <ul className="mt-2.5 list-none pl-0">
                  {related.map((r) => (
                    <li key={r.slug} className="mt-0">
                      <Link href={learnPath(r.slug)}>{r.title}</Link>
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
              MajorCycle runs this analysis over 863 companies in the US,
              Australia and Canada. <Link href="/">See how it works</Link>, or{' '}
              <Link href={LEARN_INDEX_PATH}>browse the rest of the library</Link>.
            </p>
          </footer>
        </div>
      </article>
    </PageFrame>
  );
}
