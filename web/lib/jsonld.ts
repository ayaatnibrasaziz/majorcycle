import { LEARN_THEMES, type LearnArticle } from '@/lib/learn';
import { OG_IMAGE, pageUrl } from '@/lib/seo';
import { SITE_ORIGIN } from '@/lib/url';

/**
 * Structured data (JSON-LD) — what a search engine is told about us in machine
 * -readable form.
 *
 * ── The compliance line, and it is the whole reason this file is short ───────
 *
 * ⚠️ **No `FinancialProduct`. No `Rating`. No `Review`. No `AggregateRating`.**
 * Those types state an investment claim in a form a machine will repeat without
 * the page around it — the disclaimer, the "information only" framing, the
 * explanation of what a score is — and decision #24 puts this product firmly on
 * the educational side of that line. A rich result reading "MajorCycle rates
 * AAPL 72/100" is the single most damaging sentence this site could emit, and
 * `Rating` markup is how you emit it by accident.
 *
 * What is here instead is boring on purpose: who publishes the site, and which
 * pages are articles. `Organization`, `WebSite`, `Article` — nothing that
 * asserts anything about a security.
 *
 * ⚠️ **No `SearchAction` on `WebSite`.** It is the conventional thing to add and
 * we do not have a public search endpoint, so declaring one would be describing
 * a feature that does not exist (11k, in machine-readable form).
 *
 * ⚠️ **Every value here is DERIVED**, from `SITE_ORIGIN`, `OG_IMAGE` and the
 * article registry. A JSON-LD block is a second copy of what the page already
 * says, and a second copy is where drift lives (11c) — so nothing in this file
 * is typed by hand that the page itself does not already state.
 */

/** The publisher. Referenced by `@id` from everything else, never re-stated. */
const ORG_ID = `${SITE_ORIGIN}/#organization`;
const SITE_ID = `${SITE_ORIGIN}/#website`;

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'MajorCycle',
    url: SITE_ORIGIN,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_ORIGIN}/logo.png`,
    },
    description:
      'Educational analysis of how far US, Australian and Canadian shares have ' +
      'fallen against their own history of falls and recoveries.',
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: 'MajorCycle',
    url: SITE_ORIGIN,
    inLanguage: 'en-AU',
    publisher: { '@id': ORG_ID },
  };
}

/**
 * One Learn article.
 *
 * ⚠️ `dateModified` is the registry's `reviewed`, not `published`. That field
 * already means "last checked against the running product", which is exactly
 * what `dateModified` is for — and it means a re-verified article tells Google
 * so, rather than looking abandoned.
 */
export function articleJsonLd(article: LearnArticle): Record<string, unknown> {
  const url = pageUrl(`/learn/${article.slug}`);
  return {
    '@type': 'Article',
    headline: article.title,
    description: article.summary,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: article.published,
    dateModified: article.reviewed,
    inLanguage: 'en-AU',
    articleSection: LEARN_THEMES.find((t) => t.id === article.theme)?.label,
    image: [OG_IMAGE.url],
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    isAccessibleForFree: true,
  };
}

/**
 * Serialise a graph for embedding in a `<script type="application/ld+json">`.
 *
 * ⚠️ **`<` must be escaped.** A literal `</script` anywhere in the JSON closes
 * the block early and everything after it is parsed as HTML — the same class of
 * hole `escapeForScriptJson` guards in `lib/report-download.ts`. Nothing here is
 * user input today, which is precisely why it would be forgotten on the day
 * something is.
 */
export function jsonLdScript(nodes: Record<string, unknown>[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': nodes,
  }).replace(/</g, '\u003c');
}
