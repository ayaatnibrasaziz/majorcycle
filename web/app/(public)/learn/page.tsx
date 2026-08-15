import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { LegalNotice } from '@/components/LegalNotice';
import { PageFrame } from '@/components/PageFrame';
import {
  LEARN_THEMES,
  type LearnThemeMeta,
  articlesByTheme,
  learnPath,
} from '@/lib/learn';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  path: '/learn',
  title: 'Learn',
  description:
    'Plain-English explainers on how share prices fall and recover, how to tell a bargain from a broken company, and how to read what MajorCycle shows you.',
});

/**
 * The Learn index — the approved "theme bands" design.
 *
 * ── What was approved, and what was rejected ─────────────────────────────────
 *
 * The owner rejected the first version (a plain themed list, no pictures) and
 * chose direction **A** from three drawn in the design artifact
 * (`claude.ai/code/artifact/fd8cbcdc…`): one illustration per TOPIC, alternating
 * left and right, with the article titles listed beside it.
 *
 * ⚠️ **Direction B — a picture per ARTICLE — is the better browsing experience
 * and was deliberately not chosen YET.** A card grid needs roughly nine articles
 * before it stops looking abandoned, and the library has one. A never looks
 * half-built: adding an article makes a list one line longer. If the library
 * reaches a dozen pieces, revisit B — the data shape here already supports it.
 *
 * The heading is the owner's own wording. The first draft named only falls,
 * which is one of three topics — a reader who came to ask "is this company any
 * good?" would have thought they were on the wrong page.
 *
 * ── Why this page is `wide` and the legal documents are not ──────────────────
 *
 * A browse page is not a reading page. At the 680px reading column the bands
 * gave a 325px image; at `wide` they give 532px, and the pictures are the entire
 * point of the design. The prose inside it is still held to a column — the frame
 * is wide for the layout, not for the words.
 */
export default function LearnIndexPage() {
  // Topics with nothing in them are not rendered. The library grows one article
  // at a time, and an empty "Judging the business" heading with nothing beneath
  // it would be a reader's first impression of an abandoned site. Filtered out
  // of the markup rather than hidden with CSS, so a crawler cannot see it either.
  const groups = LEARN_THEMES.map((theme) => ({
    theme,
    articles: articlesByTheme(theme.id),
  })).filter((g) => g.articles.length > 0);

  return (
    <PageFrame width="wide">
      <div className="px-[20px] py-[24px] sm:px-0 sm:py-[8px]">
        {/* The words stay in a column even though the frame is wide — 1120px of
            17px lead copy is about 130 characters a line, twice the readable
            band. Same reasoning as the legal documents' own measure. */}
        <header className="max-w-[720px]">
          <p className="micro text-[var(--brand-mid)]">Learn</p>
          <h1 className="mt-[10px]">Before you buy anything</h1>
          <p className="lead mt-[16px]">
            Written for someone starting out — no jargon, real numbers from real
            companies, and nothing you need an account to read.
          </p>
        </header>

        <LegalNotice className="mt-7 max-w-[720px]" />

        <div className="mt-10 flex flex-col">
          {groups.map(({ theme, articles }, i) => (
            <section
              key={theme.id}
              className={[
                'grid items-start gap-[30px] border-t border-[var(--border)] py-[34px]',
                'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]',
                // The first band opens the page; a rule above it would read as a
                // divider from the disclaimer rather than between two topics.
                'first:border-t-0 first:pt-[6px]',
              ].join(' ')}
            >
              <ThemeImage theme={theme} />

              <div
                // Alternating sides. `order` only applies once the grid exists
                // at ≥1024px; below that the layout is a single column and the
                // picture must always come first, or every other topic would
                // start with a wall of text.
                className={i % 2 === 1 ? 'lg:order-first' : undefined}
              >
                <div className="flex flex-wrap items-center gap-[12px]">
                  <span className="font-mono text-[length:var(--pub-label)] font-semibold text-[var(--brand-mid)] opacity-70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="min-w-0 flex-auto">{theme.label}</h2>
                  <span className="inline-flex items-center rounded-full border border-[var(--brand-light-border)] bg-[var(--brand-light)] px-[10px] py-[4px] text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-mid)]">
                    {articles.length} {articles.length === 1 ? 'article' : 'articles'}
                  </span>
                </div>

                <p className="small mt-[8px] max-w-[60ch] text-[var(--text-secondary)]">
                  {theme.blurb}
                </p>

                {/* `list-none pl-0` opts out of `.reading`'s disc-and-indent prose
                    rules: this is navigation that happens to be a list. Same
                    opt-out as the legal contents rail. */}
                <ul className="mt-[18px] list-none pl-0">
                  {articles.map((article) => (
                    <li
                      key={article.slug}
                      className="mt-0 border-t border-[var(--border)] first:border-t-0"
                    >
                      {/* The title is the only link in the row. A second "read
                          more" would give a screen-reader user two links to the
                          same place, one of which says nothing. */}
                      <Link
                        href={learnPath(article.slug)}
                        className="flex items-baseline gap-[12px] py-[9px] text-[14px] font-medium leading-[1.4] no-underline"
                      >
                        <span className="flex-auto">{article.title}</span>
                        <span className="flex-none font-mono text-[11px] text-[var(--text-secondary)]">
                          {article.minutes} min
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        <p className="small mt-12 max-w-[720px] text-[var(--text-secondary)]">
          Looking for the analysis itself rather than the background?{' '}
          <Link href="/">See how MajorCycle works</Link>.
        </p>
      </div>
    </PageFrame>
  );
}

/**
 * The topic illustration, or nothing at all.
 *
 * ⚠️ Returning `null` is the whole design decision. Until the Canva images
 * exist, the band collapses to a single full-width text block that looks
 * completely intentional. The alternative — a dashed "1200 × 750 goes here" box
 * — is exactly the kind of placeholder that reaches production because everybody
 * assumed somebody else would spot it, and it would be visible on the one page
 * whose job is to make strangers trust us.
 *
 * `sizes` is stated because the band is half a 1120px frame on desktop and full
 * width on a phone; without it Next serves the largest candidate to everyone.
 */
function ThemeImage({ theme }: { theme: LearnThemeMeta }) {
  if (!theme.image) return null;

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
      <Image
        src={theme.image.src}
        alt={theme.image.alt}
        width={1200}
        height={750}
        sizes="(min-width: 1024px) 532px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );
}
