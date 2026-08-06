import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES } from '@/lib/seo';
import { SITE_ORIGIN } from '@/lib/url';

/**
 * /sitemap.xml — the map Google reads.
 *
 * Derived from PUBLIC_PAGES (lib/seo.ts) rather than a list of its own, so a page
 * can never be public-and-indexable while being absent here, or listed here while
 * the middleware bounces the crawler.
 *
 * ⚠️ Like robots.txt, this file existing is not enough — `/sitemap.xml` is in
 * PUBLIC_ENDPOINTS because the middleware matcher covers it. Proven on the wire.
 *
 * One file is correct: Next's sitemap-index machinery only applies past 50,000
 * URLs, and no stock page is listed here by design (owner decision, 2026-08-04 —
 * the product stays gated; search traffic comes from written content instead).
 *
 * NO `lastModified`. The obvious implementation is `new Date()`, which would tell
 * Google every page changed on every deploy — a sitemap that cries wolf teaches it
 * to ignore the field entirely, which is worse than omitting it. An absent lastmod
 * is valid and simply means "unknown". When G4 adds articles they carry their real
 * publication dates, which is the only kind of date worth sending.
 *
 * NO `priority` and NO `changeFrequency` either. Both were emitted until the G1
 * audit, and both are **ignored by Google** — its documentation says so outright,
 * and Bing has said the same of `changefreq`. They are not harmful, they are inert,
 * which is worse in one specific way: `priority: 0.9` reads like a ranking dial, so
 * the next person to open this file could spend an afternoon tuning numbers that do
 * nothing and conclude the SEO work is done. A `<loc>`-only sitemap is the complete,
 * honest version. (Removing them is why `PublicPage` no longer carries those fields.)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.filter((page) => page.index).map((page) => ({
    url: `${SITE_ORIGIN}${page.path}`,
  }));
}
