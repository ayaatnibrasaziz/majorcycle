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
 * `/api/` covers every route handler and Python function in one line.
 *
 * ⚠️ These are PLAIN PREFIXES on purpose — deliberately NOT `/stocks$` + `/stocks/`,
 * which would be the precise way to say "this page and its children, nothing else".
 * RFC 9309 does define `$`, but a crawler that has not implemented it treats the `$`
 * as a literal character, so `Disallow: /stocks$` matches no real URL and the whole
 * paid product becomes crawlable. That is a FAIL-OPEN wildcard on a paywalled site.
 *
 * A plain prefix fails the other way: it also blocks a hypothetical future
 * `/stocks-explained`, which is over-blocking — annoying, never harmful. For a gated
 * product that is the correct direction to be wrong in, and the contradiction check
 * below turns that over-blocking into a loud build error rather than a silent one.
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

/** Indexes pages to cite them in AI answers — free distribution, sends readers back. */
const AI_SEARCH_ALLOWED = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'];

/**
 * Fetched because a REAL PERSON asked the assistant about this page. Not a crawler
 * at all — closer to a visitor who happens to be reading through a tool. Someone
 * asking "what is MajorCycle?" is a potential customer, so blocking these would be
 * self-harm dressed up as caution.
 *
 * ⚠️ Named explicitly rather than left to `*`, and this is the whole reason why:
 * user-agent groups do NOT inherit. If `*` is ever tightened, anything relying on it
 * silently loses access. The original G1 file covered these only through `*`, which
 * worked but would not have survived that edit — and the failure would have been
 * invisible, because nobody watches what an assistant *can't* see.
 *
 * (OpenAI and Perplexity both document that these user-initiated fetches may ignore
 * robots.txt anyway. Stating the permission costs nothing and removes the ambiguity.)
 */
const AI_USER_TRIGGERED_ALLOWED = ['ChatGPT-User', 'Claude-User', 'Perplexity-User'];

/** Copies the writing into a model. Returns nothing, competes with the reason to visit. */
const AI_TRAINING_BLOCKED = ['GPTBot', 'ClaudeBot', 'Google-Extended'];

export default function robots(): MetadataRoute.Robots {
  // Assert the two policies can't contradict each other. A path that is noindex is
  // still crawlable BY DESIGN (see lib/seo.ts) — blocking it here would stop Google
  // ever reading the noindex, leaving it free to index a bare URL from a stray link.
  // This is the single easiest way to get robots.txt wrong, so it is checked rather
  // than merely commented.
  // ⚠️ `startsWith` with NO path-segment boundary, on purpose. This mirrors what a
  // robots.txt parser actually does — plain octet-prefix matching — so the check and
  // the emitted file agree exactly.
  //
  // It is therefore DIFFERENT from proxy.ts, which matches `p === path ||
  // path.startsWith(p + '/')` because URL routing works in path segments. Do not
  // "align" the two: they model different systems, and making this one segment-aware
  // would let `/stocks-explained` pass the check while robots.txt still blocked it —
  // reintroducing exactly the silent over-block this exists to surface.
  const contradictions = PUBLIC_PAGES.filter((p) =>
    GATED.some((g) => p.path.startsWith(g)),
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
      // ⚠️ NO `allow: '/'` on any of these groups, deliberately.
      //
      // It is redundant — under RFC 9309 and Google's own rules, anything not
      // matched by a Disallow is already allowed. And it is the only line that could
      // ever CONFLICT with a Disallow. Correctly implemented parsers resolve that by
      // longest-path-wins (`/stocks`, 7 octets, beats `/`, 1 octet — verified against
      // both Google's docs and RFC 9309, so `allow: '/'` was in fact safe here).
      //
      // But a naive crawler that takes the FIRST matching rule instead would read
      // `Allow: /` and crawl the entire paid product. Removing the line means no
      // parser, however sloppy, can reach that conclusion — the policy stops
      // depending on a precedence subtlety and becomes true by construction.
      //
      // ⚠️ Groups do NOT inherit. A crawler uses only the most specific matching
      // user-agent group and ignores `*` entirely, which is exactly why the three AI
      // search bots repeat the full disallow list rather than relying on `*`. That
      // repetition is GENERATED from the one GATED array, never hand-copied — if it
      // were pasted, tightening `*` later would silently leave the named bots open.
      { userAgent: '*', disallow: GATED },

      // AI search, and assistants fetching on a person's behalf — same access as any
      // other search engine. Public pages yes, the paid product no.
      ...[...AI_SEARCH_ALLOWED, ...AI_USER_TRIGGERED_ALLOWED].map((userAgent) => ({
        userAgent,
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
