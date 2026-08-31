/**
 * Google's Preferred Sources button — one switch, and the two origins it costs.
 *
 * ── What the feature is ──────────────────────────────────────────────────────
 *
 * A reader can tell Google which publishers they want to see more of. Google
 * ships a button publishers can embed so a reader can do that without leaving
 * the article: `publisher.js` draws a localised control, the reader confirms,
 * and Google's own studies say they are then about twice as likely to click that
 * source in future. Documented at
 * developers.google.com/search/docs/appearance/preferred-sources.
 *
 * ── What it costs us, MEASURED rather than assumed ───────────────────────────
 *
 * Google's documentation says nothing about Content-Security-Policy, so the
 * requirement was measured on the production build rather than guessed. Two
 * rounds against `localhost:3200`:
 *
 *   1. script allowed, nothing else → `Framing 'https://news.google.com/'
 *      violates … "frame-src"`, twice. The script loads; the control it draws is
 *      an iframe, and the iframe was refused.
 *   2. script + frame allowed → clean. A fresh tab reported **no console errors
 *      at all**, and the page's whole resource list was exactly two origins:
 *      our own and `https://news.google.com`.
 *
 * So the complete cost is `script-src` + `frame-src`, and nothing under
 * `connect-src`, `img-src` or `font-src` — which is worth writing down, because
 * the tempting move with an undocumented third party is to open all five and
 * never find out which were needed.
 *
 * ⚠️ **The console lied in between, and the tell is worth keeping.** After the
 * frame-src fix the console still showed the OLD violation quoting the OLD
 * policy, because the message buffer survives navigation (CLAUDE.md #7). The
 * wire said one thing and the console another; a brand-new tab settled it.
 *
 * ── Why the widening is SCOPED, not site-wide ────────────────────────────────
 *
 * The button lives on `/articles` and nowhere else. Adding `news.google.com` to
 * the site-wide policy would also grant it on `/login`, `/account` and the whole
 * signed-in product — every page that actually holds a session — to serve a
 * control that never appears there. `proxy.ts` therefore adds the two origins
 * only for this section. The strongest policy stays exactly where a session
 * lives, which is the same reasoning `lib/csp.ts` already applies to the nonce.
 *
 * ⚠️ And while `enabled` is false the policy is not widened AT ALL. There is no
 * "harmless" leftover permission to remember to take out later: the switch moves
 * the button and its two origins together, because a granted origin that nothing
 * uses is an exemption outliving its reason (CLAUDE.md 11t).
 *
 * ── Why it is OFF ────────────────────────────────────────────────────────────
 *
 * Google requires the site to appear in its source-preferences tool
 * (google.com/preferences/source). That page needs the owner's Google account,
 * so it cannot be checked from here.
 *
 * ⚠️ And the button gives no signal either way. On `localhost:3200` — a domain
 * Google has never heard of — it rendered perfectly: Google's own pill reading
 * "Add to Preferred Sources", 1230×60, no errors, inside an iframe carrying
 * `publicationId=publication-id-free`. **Rendering is not approval** (CLAUDE.md
 * 11h, learned when a Google sign-in button drew cleanly on an origin Google
 * later refused with `Error 400`). Shipping it unverified risks a control that
 * looks live and fails when a reader presses it.
 *
 * **To turn it on:** open google.com/preferences/source signed in, search for
 * majorcycle.com, and if it is listed set `enabled` to true here. Nothing else
 * changes — the button, the CSP origins and the guard all follow this one value.
 */
export const PREFERRED_SOURCE = {
  /** Flip to `true` only once majorcycle.com is listed at google.com/preferences/source. */
  enabled: false,

  /** Google's publisher script. `async`, and it is the only script this site loads from a third party besides Google Identity. */
  scriptSrc: 'https://news.google.com/swg/js/v1/publisher.js',

  /**
   * The origins the button needs, measured (above). `script-src` for
   * `publisher.js`, `frame-src` for the control it draws.
   */
  origin: 'https://news.google.com',
} as const;

/**
 * Does this path get the widened policy?
 *
 * Exactly the pages that render the button: the articles section. Written as a
 * prefix test on `/articles` so a new article inherits it, and deliberately not
 * as a list of slugs that would need editing every time a piece is published.
 */
export function usesPreferredSource(pathname: string): boolean {
  if (!PREFERRED_SOURCE.enabled) return false;
  const path =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return path === '/articles' || path.startsWith('/articles/');
}
