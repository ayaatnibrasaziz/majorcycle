import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES } from '@/lib/seo';
import { SITE_ORIGIN } from '@/lib/url';

/**
 * /robots.txt — what each crawler may read.
 *
 * ⚠️ This file existing is NOT sufficient. `/robots.txt` matches the middleware
 * matcher, so a crawler asking for it was answered with a 307 to /login until it
 * was added to PUBLIC_ENDPOINTS in lib/seo.ts. Verified on the live site
 * (2026-08-06): `curl -sI https://www.majorcycle.com/robots.txt` → 307. Any change
 * here must be re-proved on the wire, not in the source.
 *
 * Everything the product actually sells stays gated (owner decision, 2026-08-04):
 * no ticker page, screener route or account page is crawlable, and this file must
 * never become the thing that quietly opens one. The disallow list is therefore
 * written as an explicit deny of every app surface rather than an allow-list of
 * public ones — a new gated route added later inherits the block by sitting under
 * an existing prefix, whereas an allow-list would have silently exposed it.
 */

/**
 * Gated surfaces. Prefix matches, so `/stocks` also covers `/stocks/us/AAPL`.
 * `/api` covers every route handler and Python function in one line.
 */
const GATED = [
  '/api/',
  '/stocks',
  '/run',
  '/results',
  '/request',
  '/account',
  '/reactivate',
  '/dev-fixtures',
  // The auth exchange endpoints — machine callbacks carrying one-time tokens.
  '/auth/',
];

/**
 * AI crawlers, split by what they DO with the page (owner decision, 2026-08-04).
 * Verified against each vendor's own published bot documentation.
 *
 * The distinction is search vs training, not company: OpenAI and Anthropic each run
 * both kinds, and we treat their two bots differently. A search bot fetches a page
 * to answer a question NOW and cites us, which sends readers back — that is free
 * distribution. A training crawler copies the writing into a model, which returns
 * nothing and competes with the reason to visit.
 */
const AI_SEARCH_ALLOWED = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'];
const AI_TRAINING_BLOCKED = ['GPTBot', 'ClaudeBot', 'Google-Extended'];

export default function robots(): MetadataRoute.Robots {
  // Assert the two policies can't contradict each other. A path that is noindex is
  // still crawlable BY DESIGN (see lib/seo.ts) — blocking it here would stop Google
  // ever reading the noindex, leaving it free to index a bare URL from a stray link.
  // This is the single easiest way to get robots.txt wrong, so it is checked rather
  // than merely commented.
  const contradictions = PUBLIC_PAGES.filter((p) =>
    GATED.some((g) => p.path === g || p.path.startsWith(g)),
  );
  if (contradictions.length > 0) {
    throw new Error(
      `robots.ts: ${contradictions.map((p) => p.path).join(', ')} is a public page ` +
        `but also matches the gated disallow list. A blocked URL can never be read, ` +
        `so its noindex would never be seen. Fix one list or the other.`,
    );
  }

  return {
    rules: [
      // Ordinary search engines: read the public pages, stay out of the app.
      { userAgent: '*', allow: '/', disallow: GATED },

      // AI search — same access as any other search engine.
      ...AI_SEARCH_ALLOWED.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: GATED,
      })),

      // AI training — nothing at all.
      ...AI_TRAINING_BLOCKED.map((userAgent) => ({ userAgent, disallow: '/' })),
    ],
    // Referencing the sitemap here is how it gets discovered. Google RETIRED the
    // old "ping the sitemap on deploy" endpoint in 2023 and it now returns 404, so
    // this line plus a one-time submission in Search Console is the whole mechanism.
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
