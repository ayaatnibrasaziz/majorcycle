import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalNotice } from '@/components/LegalNotice';
import { PageFrame } from '@/components/PageFrame';
import { LEARN_THEMES, articlesByTheme, learnPath } from '@/lib/learn';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  path: '/learn',
  title: 'Learn',
  description:
    'Plain-English explainers on how share prices fall and recover, how to tell a bargain from a broken company, and how to read what MajorCycle shows you.',
});

/**
 * The Learn index.
 *
 * **Grouped by theme, not dated.** An explainer does not expire, and a date
 * column on a list of definitions implies it does — which would make the whole
 * library look stale within a month of not touching it. (The weekly market note
 * is the exact opposite and gets its own dated section; see the page briefs.)
 *
 * **A list, not a grid of cards.** The reader arriving here has either just
 * finished an article or is scanning for the one question they came with. Cards
 * would give every article equal visual weight and roughly triple the scroll
 * for the same information.
 *
 * ⚠️ **Themes with no articles are not rendered.** The library starts with one
 * article and grows, so an empty "Judging the business" heading with nothing
 * under it would be the reader's first impression of an abandoned site. Filtered
 * rather than hidden with CSS, so an empty section is genuinely absent from the
 * markup a crawler reads.
 */
export default function LearnIndexPage() {
  const groups = LEARN_THEMES.map((theme) => ({
    theme,
    articles: articlesByTheme(theme.id),
  })).filter((g) => g.articles.length > 0);

  return (
    <PageFrame width="prose">
      <div className="px-[20px] py-[24px] sm:px-0 sm:py-[8px]">
        <header>
          <h1>Learn</h1>
          <p className="lead mt-[10px]">
            Short, plain-English answers to the questions people actually ask about
            falling share prices — written for someone starting out, with real
            numbers from real companies.
          </p>
        </header>

        <LegalNotice className="mt-7" />

        <div className="mt-10 flex flex-col gap-10">
          {groups.map(({ theme, articles }) => (
            <section key={theme.id}>
              <h2>{theme.label}</h2>
              <p className="small mt-[6px] text-[var(--text-secondary)]">
                {theme.blurb}
              </p>

              {/* `list-none pl-0` opts out of `.reading`'s disc-and-indent prose
                  rules: this is navigation that happens to be a list, not prose.
                  Same opt-out as the legal contents list. */}
              <ul className="mt-5 flex list-none flex-col gap-5 pl-0">
                {articles.map((article) => (
                  <li key={article.slug} className="mt-0">
                    {/* The TITLE is the link, and it is the only link in the row.
                        A second "read more" would give a screen-reader user two
                        links to the same place, one of which says nothing. */}
                    <h3 className="mt-0">
                      <Link href={learnPath(article.slug)} className="no-underline">
                        {article.title}
                      </Link>
                    </h3>
                    <p className="small mt-[4px] text-[var(--text-secondary)]">
                      {article.summary}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="small mt-12 text-[var(--text-secondary)]">
          Looking for the analysis itself rather than the background?{' '}
          <Link href="/">See how MajorCycle works</Link>.
        </p>
      </div>
    </PageFrame>
  );
}
