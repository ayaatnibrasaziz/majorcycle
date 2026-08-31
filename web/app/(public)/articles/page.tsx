import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalNotice } from '@/components/LegalNotice';
import { PageFrame } from '@/components/PageFrame';
import { RichText } from '@/components/articles/RichText';
import {
  PLANNED_ARTICLES,
  articleDate,
  articleDateShort,
  articlePath,
  articlesNewestFirst,
  featuredArticle,
} from '@/lib/articles';
import { pageMetadata } from '@/lib/seo';
import { FIGURES } from './content';
import './articles.css';

export const metadata: Metadata = pageMetadata({
  // ⚠️ A LITERAL, not `ARTICLES_INDEX_PATH`. `scripts/check-seo.mjs` reads this
  // file as TEXT and asserts the path matches the registered route; a constant
  // is invisible to it, so the canonical would stop being checked while the page
  // carried on rendering perfectly (14g).
  path: '/articles',
  title: 'Articles',
  // ⚠️ 135 characters. `seo.spec.ts` caps a description at 155 because Google
  // truncates near there — the first version was 162 and lost its last clause in
  // the search result, which is the half that says the pages are free to read.
  //
  // ⚠️ AND THE COMMENT SITS ABOVE THE KEY, NOT BETWEEN IT AND THE STRING.
  // `check-seo.mjs` matches `description:` followed by a quote across at most one
  // newline, so three comment lines in that gap made it report the description as
  // MISSING on a page that had one. A guard that reads source text is sensitive to
  // where a comment goes.
  description:
    'Market analysis and our own measurements, in plain English — real numbers from real companies, and nothing you need an account to read.',
});

/**
 * The Articles index — approved design, direction A.
 *
 * ── Why this is not the layout every competitor uses ─────────────────────────
 *
 * Checked directly before designing: Simply Wall St's `/news` and Motley Fool AU
 * both run a flat vertical list with a thumbnail per row, 22 and 40+ to a page.
 * That is correct for them, because they publish dozens a day and the reader's
 * job is scanning. **We publish about four a month**, and a flat list at n=4
 * reads as abandoned — the same trap the Learn index already documents about
 * card grids. A lead article carrying real weight, then rows, reads as a front
 * page at n=1 and degrades upward as the section fills.
 *
 * ⚠️ **No thumbnails, deliberately.** Every competitor leads with a picture. We
 * have none, each would be a cost we can never re-roll (the Learn masters are
 * not reproducible — `design-system.md` §11), and it creates a permanent
 * per-article obligation nobody would notice going unmet until the page looked
 * broken. **The numbers do the work the images do elsewhere:** every piece here
 * reports a measurement, so the finding is the art. Free, repeatable, and the
 * one thing on this page a competitor cannot copy.
 *
 * ── The featured card IS the product's analyst briefing ──────────────────────
 *
 * Not a lookalike — the same `.briefing` chrome from `globals.css` that the
 * landing page and the signed-in Results screen both render. Owner's words: "the
 * same vibe like the analyst briefing in the landing page … that will look
 * consistent." Resembling it would have been a second copy free to drift
 * (CLAUDE.md 11c); using it cannot.
 *
 * The figure takes the place of the briefing's 56px score ring — same row, same
 * gap, same `flex: none`. ⚠️ **It is a flex CHILD and never a grid track**,
 * because the owner's constraint is that "the article may or may not have any
 * figures": an absent flex child collapses, an absent grid child leaves a hole.
 * That is exactly the `/learn` defect where a two-column track stayed declared
 * after its picture was removed, leaving 532px of text beside 588px of nothing.
 */
export default function ArticlesIndexPage() {
  const featured = featuredArticle();
  const rest = articlesNewestFirst().filter((a) => a.slug !== featured?.slug);
  const Figure = featured ? FIGURES[featured.slug as keyof typeof FIGURES] : undefined;

  return (
    <PageFrame width="wide">
      {/* `doc-scale` — the public site's 24/17/13/12, the same scale `/learn`
          takes. The two index pages are siblings; a reader crossing between them
          should not meet a different hierarchy. */}
      <div className="doc-scale px-[20px] py-[24px] sm:px-0 sm:py-[8px]">
        <header className="max-w-[720px]">
          <p className="micro font-bold uppercase tracking-[.14em] text-[var(--brand-mid)]">
            Articles
          </p>
          <h1 className="mt-[10px]">What&rsquo;s happening, and what it means</h1>
          {/* Owner's wording, 2026-08-29. Three earlier drafts were rejected: two
              for leaning on PROCESS ("the method shown, every figure sourced")
              rather than telling the reader what they get, and one for listing
              the kinds of piece — which reads as a table of contents and dates
              the moment a fourth kind appears. This one names the READER
              instead, which nothing we publish later can falsify. The closing
              clause is Learn's, reused on purpose. */}
          <p className="lead mt-[14px] text-[var(--text-secondary)]">
            Written for anyone following the market — no jargon, real numbers from
            real companies, and nothing you need an account to read.
          </p>
        </header>

        <LegalNotice className="mt-7 max-w-[720px]" />

        {featured && (
          <div className="mt-[30px]">
            <div className="briefing art-brief">
              {Figure && (
                <div className="art-figblock">
                  <Figure />
                </div>
              )}
              <div className="art-body">
                <div className="art-head">
                  <span className="briefing-title">Featured</span>
                  <span className="art-when">
                    <time className="art-when-d" dateTime={featured.published}>
                      {articleDate(featured.published)}
                    </time>
                    {/* A span, not a bare "·" between two literal spaces — the
                        spacing is a decision, and a decision should not be
                        something a formatter can collapse. */}
                    <span className="art-sep">·</span>
                    {featured.minutes} min read
                  </span>
                </div>
                <h2 className="art-h">
                  <Link href={articlePath(featured.slug)}>{featured.title}</Link>
                </h2>
                <p className="briefing-text">
                  <RichText parts={featured.deck} />
                </p>
                <div className="briefing-pills">
                  {featured.facts.map((f) => (
                    <span className="b-pill" key={f.label}>
                      <b className="b-pill-n" style={{ color: 'var(--brand-mid)' }}>
                        {f.value}
                      </b>{' '}
                      {f.label}
                    </span>
                  ))}
                </div>
                <Link className="art-read" href={articlePath(featured.slug)}>
                  Read the analysis
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        {PLANNED_ARTICLES.length > 0 && (
          <>
            <div className="art-secn">
              <h2>Coming next</h2>
              <span className="art-secn-c">
                {PLANNED_ARTICLES.length} in progress
              </span>
            </div>
            {/* ⚠️ A `<div>`, never an `<a>`. These are promises, and a promise
                that looks clickable is worse than no promise at all — the reader
                clicks, nothing happens, and the section stops being believable.
                `articles.spec.ts` asserts no link exists inside a planned row. */}
            {PLANNED_ARTICLES.map((p) => (
              <div className="art-row art-soon" key={p.title}>
                <div className="art-d">{p.due}</div>
                <div>
                  <div className="art-t">{p.title}</div>
                  <div className="art-f">{p.blurb}</div>
                </div>
                <span className="art-soonk">Planned</span>
              </div>
            ))}
          </>
        )}

        {rest.length > 0 && (
          <>
            <div className="art-secn">
              <h2>Published</h2>
              <span className="art-secn-c">
                {rest.length} {rest.length === 1 ? 'article' : 'articles'}
              </span>
            </div>
            {rest.map((a) => (
              <Link className="art-row" href={articlePath(a.slug)} key={a.slug}>
                <div className="art-d">
                  <time dateTime={a.published}>{articleDateShort(a.published)}</time>
                  <span className="art-rt">{a.minutes} min</span>
                </div>
                <div>
                  <div className="art-t">{a.title}</div>
                  {/* The FINDING, not a summary. On this site the number is the
                      thing worth scanning, and it is what replaces the thumbnail
                      every competitor leads with. */}
                  <div className="art-f">
                    <RichText parts={a.finding} />
                  </div>
                </div>
                <span className="art-kk">{a.region}</span>
              </Link>
            ))}
          </>
        )}

        {/* ⚠️ This used to promise that "every figure here is measured with the
            same code the product runs, over the same price history" — true of
            the first article and a claim about EVERY future one, made on a page
            whose whole purpose is to fill up with pieces nobody has written yet
            (owner, 2026-08-29). An article may quote a regulator, a company
            filing or a study we did not run. What can be promised for all of
            them is that each one says where its numbers came from. */}
        <p className="small mt-12 max-w-[720px] text-[var(--text-secondary)]">
          Every article says where its figures came from and which day they were
          taken. If you want the terms explained first,{' '}
          <Link href="/learn">start with the Learn library</Link>.
        </p>
      </div>
    </PageFrame>
  );
}

