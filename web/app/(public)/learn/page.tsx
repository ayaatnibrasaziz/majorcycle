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
  // Topics with nothing in them are not rendered — an empty heading with nothing
  // beneath it is a reader's first impression of an abandoned site. Filtered out
  // of the markup rather than hidden with CSS, so a crawler cannot see it either.
  //
  // "Nothing in them" now counts announced titles as well as written ones: a
  // topic listing four pieces that are coming is not empty, it is a plan. That
  // is a different thing from a bare heading, and the owner asked to see the
  // library assembled rather than growing one band at a time.
  const groups = LEARN_THEMES.map((theme) => ({
    theme,
    articles: articlesByTheme(theme.id),
    upcoming: theme.upcoming ?? [],
  })).filter((g) => g.articles.length + g.upcoming.length > 0);

  return (
    <PageFrame width="wide">
      {/* `doc-scale` — the public site's 24/17/13/12. Without it this page took
          `.reading`'s 36/26/20 and became a fourth type scale: a 50% jump in
          heading size crossing from /contact or /terms, for no reason a reader
          could perceive. See globals.css. */}
      <div className="doc-scale px-[20px] py-[24px] sm:px-0 sm:py-[8px]">
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
          {groups.map(({ theme, articles, upcoming }, i) => (
            <section
              key={theme.id}
              className={[
                'grid items-start gap-[30px] border-t border-[var(--border)] py-[34px]',
                // ⚠️ CONDITIONAL, and it was not until 2026-08-16. The two-column
                // track was declared unconditionally, so a topic with no image
                // still got both columns and its text sat in the FIRST one —
                // measured at 1280px: a 532px column with 588px of empty page
                // beside it. `learn.ts` documented the opposite ("renders as a
                // single full-width text block that looks entirely deliberate"),
                // which is what happens only once the track is dropped as well
                // as the picture. Nothing errored and typecheck was green: an
                // absent grid child is not a fault, it is just a hole.
                theme.image ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]' : '',
                // The first band opens the page; a rule above it would read as a
                // divider from the disclaimer rather than between two topics.
                'first:border-t-0 first:pt-[6px]',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <ThemeImage theme={theme} />

              <div
                className={
                  theme.image
                    ? // Alternating sides. `order` only applies once the grid
                      // exists at ≥1024px; below that the layout is a single
                      // column and the picture must always come first, or every
                      // other topic would start with a wall of text.
                      i % 2 === 1
                      ? 'lg:order-first'
                      : undefined
                    : // No picture: hold the header's own 720px measure rather
                      // than letting the band sprawl to the full 1120px frame,
                      // which would strand each article's "4 min" a thousand
                      // pixels from the title it belongs to.
                      'max-w-[720px]'
                }
              >
                <div className="flex flex-wrap items-center gap-[12px]">
                  <span className="font-mono text-[length:var(--pub-label)] font-semibold text-[var(--brand-mid)] opacity-70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="min-w-0 flex-auto">{theme.label}</h2>
                  {/* --pub-label (12px), not the 11px this first carried.
                      `--rd-micro` is a FLOOR on a reading page, not a
                      suggestion — and `contrast.spec.ts` enforces it, so 11px
                      would have failed the build rather than merely looking
                      small. */}
                  {/* Counts what is READABLE, never what is promised. A pill
                      reading "5 articles" over four "Coming soon" rows would be
                      a lie a reader can check in one glance, and this page's
                      entire job is being trusted by a stranger. */}
                  <span className="inline-flex items-center rounded-full border border-[var(--brand-light-border)] bg-[var(--brand-light)] px-[10px] py-[3px] text-[length:var(--pub-label)] font-bold uppercase tracking-[0.08em] text-[var(--brand-mid)]">
                    {articles.length === 0
                      ? 'Coming soon'
                      : `${articles.length} ${articles.length === 1 ? 'article' : 'articles'}`}
                  </span>
                </div>

                {/* NOT `.small`. Under `doc-scale` that maps to --pub-label
                    (12px), which is the FLOOR — right for a date stamp or a
                    label, wrong for a sentence somebody is expected to read to
                    decide whether a topic is for them. Body size, separated
                    from the article titles above it by weight and colour rather
                    than by size. */}
                <p className="mt-[8px] max-w-[60ch] text-[var(--text-secondary)]">
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
                      {/* Title and blurb are both --pub-body (13px); WEIGHT and
                          COLOUR separate them, not size. A half-step up to 14px
                          would be a fifth value on a page that has just been
                          brought down to four, to buy 1px of difference the eye
                          cannot read anyway. Same device the legal contents rail
                          uses for its links. */}
                      <Link
                        href={learnPath(article.slug)}
                        className="flex items-baseline gap-[12px] py-[9px] font-semibold leading-[1.45] no-underline"
                      >
                        <span className="flex-auto">{article.title}</span>
                        <span className="flex-none font-mono text-[length:var(--pub-label)] font-normal text-[var(--text-secondary)]">
                          {article.minutes} min
                        </span>
                      </Link>
                    </li>
                  ))}

                  {/* Announced but not written. A plain <li> with no <a> inside
                      — the whole row is inert, which is the point: a title with
                      no article behind it must not be clickable, must not be
                      focusable, and must not appear in the sitemap. Being a
                      string in `theme.upcoming` rather than a registry entry is
                      what makes all three true by construction rather than by
                      remembering. `aria-disabled` is deliberately NOT used: it
                      describes a control, and this is a sentence. */}
                  {upcoming.map((title) => (
                    <li
                      key={title}
                      className="mt-0 border-t border-[var(--border)] first:border-t-0"
                    >
                      <div className="flex items-baseline gap-[12px] py-[9px] font-semibold leading-[1.45] text-[var(--text-secondary)] opacity-70">
                        <span className="flex-auto">{title}</span>
                        <span className="flex-none font-mono text-[length:var(--pub-label)] font-normal">
                          Coming soon
                        </span>
                      </div>
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
 * ⚠️ Returning `null` is the whole design decision. Without a picture the band
 * collapses to a single full-width text block that looks completely intentional.
 * The alternative — a dashed "1600 × 1000 goes here" box — is exactly the kind of
 * placeholder that reaches production because everybody assumed somebody else
 * would spot it, and it would be visible on the one page whose job is to make
 * strangers trust us. All three topics carry an image today, so this branch is
 * currently unreachable in production; `learn.spec.ts` measures it anyway,
 * because the last time this comment described untested behaviour it was wrong.
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
        width={1600}
        height={1000}
        sizes="(min-width: 1024px) 532px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );
}
