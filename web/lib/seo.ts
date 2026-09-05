import type { Metadata } from 'next';
import { ARTICLES, articlePath } from '@/lib/articles';
import { LEARN_ARTICLES, learnPath } from '@/lib/learn';
import { SITE_ORIGIN } from '@/lib/url';

/**
 * The ONE sitewide share card. Built by `pnpm build:og-image` into
 * `app/opengraph-image.png`; Next serves it at this path.
 *
 * ⚠️ Stated here rather than left to Next's file convention. The convention DOES
 * attach the image automatically — but only while a route does not export its
 * own `openGraph`, and every public page here exports one via `pageMetadata()`,
 * which replaces the inherited object wholesale. Measured on the wire: the file
 * existed and served 200, `twitter:card` said `summary_large_image`, and there
 * was **no `og:image` tag on any page** — a card that renders as broken rather
 * than gracefully small, which is the exact failure this file already warned
 * about in prose. Reading the source would not have shown it.
 *
 * Same reasoning as `og:title` below: a framework detail nobody re-checks is not
 * a foundation for the most-shared surface we have.
 */
/**
 * The absolute URL for a public page — the ONE form of it.
 *
 * `${SITE_ORIGIN}${path}` is right for every path except the one that matters
 * most: for '/' it yields a trailing slash, and Next normalises the canonical tag
 * to drop it. That left the sitemap advertising `.../` while the page's own
 * canonical said `...` with no slash — the two files whose whole job is to agree
 * on one address, disagreeing about the homepage. Caught by e2e/seo.spec.ts.
 *
 * Both consumers call this, so there is nowhere for the two to drift apart (11c).
 */
export const pageUrl = (path: string): string =>
  path === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`;

export const OG_IMAGE = {
  url: `${SITE_ORIGIN}/opengraph-image.png`,
  width: 1200,
  height: 630,
  alt: 'MajorCycle — every stock falls; some are further down than usual.',
} as const;

/**
 * THE list of pages a signed-out human may open, and what search engines may do
 * with each. One list, four consumers (rule 11c):
 *
 *   1. `proxy.ts`      — builds PUBLIC_PATHS from it, so a page cannot be listed
 *                        here as public while the middleware still bounces it.
 *   2. `app/sitemap.ts`— emits every `index: true` entry.
 *   3. `app/robots.ts` — cross-checks this list against its own GATED array and
 *                        throws if any page appears in both. (It does NOT derive its
 *                        disallow rules from here: robots.txt is a deny-list of app
 *                        surfaces, so a new gated route inherits the block instead of
 *                        needing to be remembered. An earlier version of this comment
 *                        claimed "everything else is disallowed", which was wrong —
 *                        `/` and `/.well-known` are neither listed here nor blocked.)
 *   4. `pageMetadata()`— canonical + Open Graph for each page.
 *
 * ⚠️ The `(public)` ROUTE GROUP is not the same set and never was. It also holds
 * `/reactivate` and `/account/update-password`, both of which require a session —
 * the folder name describes the layout they share (the centred card), not their
 * reachability. Judge public-ness by this list, never by the directory.
 *
 * ⚠️ `index: false` means "crawl it, but don't list it in results". It is NOT the
 * same as blocking. Blocking a URL in robots.txt stops Google fetching it, so it
 * never sees the noindex and can still index a bare URL it found linked elsewhere.
 * The four sign-in pages therefore stay crawlable on purpose. Never add a path to
 * both this list with `index: false` AND a robots `disallow`.
 */
export type PublicPage = {
  /** Route path, exactly as the middleware will match it. */
  readonly path: string;
  /** Listed in sitemap.xml and indexable, or crawlable-but-noindex. */
  readonly index: boolean;
  /**
   * `<lastmod>`, an ISO date, for a page whose content has a REAL last-changed
   * date. Absent everywhere else, and absent is valid - it means "unknown".
   *
   * WARNING - audit 5A-141. `sitemap.ts` has said since G1 that "when G4 adds
   * articles they carry their real publication dates". G4 shipped, seventeen
   * pieces went live, and the field was never added: the sitemap emits `<loc>`
   * and nothing else. A doc naming a mechanism nobody built is worse than
   * silence, because it converts an open question into a closed one (11ae) -
   * anyone checking whether dates were handled would read that line and stop.
   *
   * It stays OPTIONAL rather than becoming required-with-a-default. The reason
   * the field was omitted in the first place is still right: `new Date()` on
   * every page would tell Google the whole site changed on every deploy, and a
   * sitemap that cries wolf teaches it to ignore the field. Only a page with a
   * genuine date may carry one.
   */
  readonly lastModified?: string;
};

export const PUBLIC_PAGES: readonly PublicPage[] = [
  // ── Indexable: the pages we actually want a stranger to find ───────────────
  // No `priority` / `changeFrequency` — Google ignores both, and a number that looks
  // like a ranking dial but isn't one wastes a future session's time. See sitemap.ts.
  //
  // ⚠️ '/' looks like it opens the whole site, because PUBLIC_PATHS matches
  // `pathname === p || pathname.startsWith(p + '/')`. It does not: for '/' the
  // second arm is `startsWith('//')`, which no real path satisfies. Asserted by
  // the "site is still gated" control in e2e/seo.spec.ts, which runs over every
  // gated route signed out.
  //
  // '/' is ALSO in proxy.ts's SIGNED_OUT_ONLY_PATHS: a signed-in reader gets the
  // app, not the sales pitch.
  //
  // ⚠️ `/methodology` was here until Layer G and is deliberately NOT replaced by
  // an entry for `/#how-it-works`. A fragment is not a URL a crawler can fetch or
  // a middleware can match — the section lives on `/`, which is already listed.
  // The retired path answers 308 from `next.config.ts`; removing it from this list
  // is what makes that redirect reachable, because a path left here would be
  // matched by the middleware first.
  { path: '/', index: true },
  { path: '/pricing', index: true },
  { path: '/contact', index: true },
  { path: '/learn', index: true },
  // ⚠️ A LITERAL, not `ARTICLES_INDEX_PATH`. `scripts/check-seo.mjs` parses this
  // block as TEXT, so a constant here is invisible to it — the page would drop
  // out of the guard's page count and its pageMetadata() call would stop being
  // checked, while everything still rendered (14g).
  { path: '/articles', index: true },
  { path: '/disclaimer', index: true },
  { path: '/terms', index: true },
  { path: '/privacy', index: true },

  // ── Every Learn article, DERIVED from the registry ─────────────────────────
  //
  // ⚠️ Spread, never typed out. These are the pages whose entire purpose is to
  // be found by a stranger, so an article missing from this list fails in the
  // one way nobody would ever notice: it renders perfectly, it is reachable if
  // you know the URL, and it is absent from the sitemap, absent from the
  // middleware allow-list, and rejected by `pageMetadata()` at build time.
  //
  // Four things ride on this one line — the sitemap entry, the canonical tag,
  // the middleware letting a signed-out reader through, and `showsFullChrome()`
  // giving the article the full header rather than the logo-only confinement
  // chrome (that helper asks `OPEN_TO_STRANGERS.has(pathname)`, an exact match,
  // so a derived entry is what makes an article page look like a public page).
  //
  // ⚠️ `check:seo` parses this block STATICALLY with a regex and therefore
  // cannot see these entries at all. That is deliberate and it is why
  // `e2e/learn.spec.ts` asserts the rendered outcome instead — every registered
  // article answering 200, carrying its own canonical, and appearing in the real
  // sitemap.xml. A static guard that cannot see the thing it guards is worse
  // than none, because it reports success (CLAUDE.md 14g).
  ...LEARN_ARTICLES.map((a) => ({
    path: learnPath(a.slug),
    index: true,
    // `reviewed`, not `published` - the registry field already means "last
    // checked against the running product", which is what lastmod is for.
    lastModified: a.reviewed,
  })),

  // ── Every ARTICLE, derived the same way, for the same reasons ─────────────
  //
  // ⚠️ Two registries, one derivation each, and neither may be typed out by
  // hand. The failure this prevents is the quiet one: a piece that renders
  // perfectly, is reachable if you know the URL, and is missing from the
  // sitemap, missing from the middleware allow-list, and rejected by
  // `pageMetadata()` at build time. `check:seo` parses this block with a regex
  // and cannot see a spread at all, so `e2e/articles.spec.ts` asserts the
  // rendered outcome instead — every registered article answering 200, with its
  // own canonical, and present in the real sitemap.xml (CLAUDE.md 14g).
  ...ARTICLES.map((a) => ({
    path: articlePath(a.slug),
    index: true,
    lastModified: a.reviewed,
  })),

  // ── Crawlable but NOT indexable ────────────────────────────────────────────
  // A sign-in form is not a search result. `/deletion-requested` additionally
  // asserts something true of exactly one reader at one moment, so indexing it
  // would be actively wrong.
  { path: '/login', index: false },
  { path: '/signup', index: false },
  { path: '/reset-password', index: false },
  { path: '/deletion-requested', index: false },
] as const;

/**
 * Public paths that are NOT pages — machine endpoints that must bypass the auth
 * redirect. Kept beside the page list so `proxy.ts` has one import, but separate
 * from it because none of these belong in a sitemap or carry metadata.
 */
export const PUBLIC_ENDPOINTS: readonly string[] = [
  '/auth/callback',
  '/auth/confirm',
  // Generated by app/robots.ts and app/sitemap.ts. Creating those files is NOT
  // enough on its own: the middleware matcher covers both, so without this a
  // crawler asking for /robots.txt gets a 307 to /login — which is what the live
  // site did until Layer G G1 (verified 2026-08-06).
  '/robots.txt',
  '/sitemap.xml',
  // Well-known URIs (RFC 8615) — e.g. /.well-known/security.txt.
  '/.well-known',
  // Cron endpoints run without a user session (Vercel Cron sends a Bearer secret,
  // not cookies). Each route enforces its own CRON_SECRET check.
  '/api/cron',
  // Stripe posts webhook events server-to-server; the route verifies every request
  // with the signature secret, so an unsigned POST is rejected 400 inside it.
  '/api/stripe/webhook',
] as const;

/** Path → page, for the metadata helper and the guards. */
const BY_PATH = new Map(PUBLIC_PAGES.map((p) => [p.path, p]));

/**
 * Canonical + Open Graph metadata for one public page.
 *
 * Every public page must call this rather than hand-rolling `alternates` or
 * `openGraph`, so the canonical origin and the card shape are stated once. The
 * static guard (`pnpm check:seo`) fails the build on any public page that doesn't.
 *
 * Why canonical matters here specifically: the apex domain redirects to `www`, so
 * without an explicit canonical the same page is reachable at two addresses and
 * Google has to guess which is the real one — and may split the credit between them.
 *
 * The share image is ONE sitewide asset (`app/opengraph-image.png`, built by
 * `pnpm build:og-image`). Next's file convention emits its url/type/width/height
 * automatically and applies it to every child route, so it is not restated here —
 * one image, one declaration.
 *
 * ⚠️ There is deliberately no per-page or per-stock card. A share image is fetched
 * by anonymous crawlers and cached publicly, so a card carrying a rating or a score
 * would publish paid output on a CDN (CLAUDE.md 11a/11b) — a paywall bypass wearing
 * the clothes of a marketing asset.
 *
 * `twitter.card` is now `summary_large_image`, which is only honest BECAUSE the
 * image exists: claiming a large card without shipping one renders broken rather
 * than gracefully small.
 */
export function pageMetadata(opts: {
  path: string;
  title: string;
  description: string;
  /**
   * Present when the page is a piece of WRITING rather than a part of the site.
   *
   * WARNING - audit 5A-140. Every one of the 17 Learn and Articles pages shipped
   * `og:type: website`, which is what this function returns when nothing says
   * otherwise. That is the tag a social card, a reader-mode and an AI crawler use
   * to decide whether a URL is a document with an author and a date or simply a
   * page of a site - and both dates already existed in the two registries.
   *
   * Stated HERE rather than in each page, so the two callers cannot disagree, and
   * so a third one gets it for free (11c-iv).
   */
  article?: { readonly published: string; readonly modified: string };
}): Metadata {
  const page = BY_PATH.get(opts.path);
  if (!page) {
    // A page calling this with a path that isn't registered is a bug: it would get
    // a canonical URL but never appear in the sitemap or the middleware's allow
    // list. Fail loudly at build time rather than ship a half-registered page.
    throw new Error(
      `pageMetadata: "${opts.path}" is not in PUBLIC_PAGES (web/lib/seo.ts). ` +
        `Add it there first — that list also drives proxy.ts and the sitemap.`,
    );
  }

  const url = pageUrl(opts.path);

  // The root layout's `'%s | MajorCycle'` template is applied to <title>. Whether it
  // also reaches og:title is a framework detail I am not willing to depend on — an
  // untitled-looking share card is exactly the kind of thing nobody notices for
  // months. Stated in full here, and asserted on the rendered HTML by e2e/seo.spec.ts.
  const fullTitle = `${opts.title} | MajorCycle`;

  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    // Crawlable-but-noindex. Stated per page rather than via a robots.txt block,
    // for the reason in the PublicPage doc comment above.
    ...(page.index ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      ...(opts.article
        ? {
            type: 'article' as const,
            publishedTime: opts.article.published,
            modifiedTime: opts.article.modified,
          }
        : { type: 'website' as const }),
      siteName: 'MajorCycle',
      title: fullTitle,
      description: opts.description,
      url,
      locale: 'en_AU',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      images: [OG_IMAGE.url],
      title: fullTitle,
      description: opts.description,
    },
  };
}
