/**
 * The Content-Security-Policy, and the one fact that decides which form of it a
 * route receives.
 *
 * ── What a CSP is for, in one paragraph ──────────────────────────────────────
 * A page is content plus code, and code can do anything the page can: read the
 * screen, read what is typed, use the reader's session. The attack this closes is
 * somebody else's script running inside our document — on our domain, with our
 * padlock, holding a customer's session. React escapes text by default and this
 * repo has zero `dangerouslySetInnerHTML` outside the JSON-LD data block, so we
 * are in reasonable shape by habit. **A CSP is the lock rather than the habit.**
 *
 * ── Why there are TWO forms, and it is not a compromise ──────────────────────
 * A nonce is a random token minted per request and stamped onto our own script
 * tags; the browser then runs a script only if it carries that token. Nothing a
 * visitor types can carry it, because their input arrives after the stamp exists
 * and the stamp changes on every page view. It is the strongest form.
 *
 * But a nonce must differ per visit, so it can only exist on a page that is
 * RENDERED per visit. Seven public routes here are prerendered — one file, built
 * once, byte-identical for everyone — and that is deliberate and measured: a
 * prerendered route's click is 77ms against ~674ms dynamic, because Next skips
 * prefetching a dynamic route (architecture.md §7.2c, CLAUDE.md 11s). Minting a
 * nonce for those pages would force them dynamic and hand back that win.
 *
 * ⚠️ **Worse than slow — it would break them.** A prerendered page's HTML was
 * written at build time and its script tags carry no nonce. Send a nonce policy
 * with that file and the browser refuses every script in it: the page renders and
 * then does nothing. So the split is not "strong here, weak there" — the nonce is
 * simply inapplicable to a file that already exists.
 *
 * Those seven carry no session, no form that matters and no personal data. Every
 * route that does — sign-in, sign-up, pricing, password reset, and the whole
 * signed-in product — is *already* rendered per request because it shows one
 * person's data, so the nonce costs nothing there. **The strongest policy lands
 * exactly where a session lives.**
 *
 * ── The list below is fail-SAFE, and that is the point ───────────────────────
 * `NONCE_ROUTES` is an ALLOW-list, not an exclusion list, so an unrecognised path
 * falls to the inline form. That matters because Next serves one prerendered file
 * — `_not-found.html` — for any path that matches no route at all, and no
 * middleware can predict that. Getting the list wrong therefore costs strength on
 * one route; it can never produce a page that loads and does nothing, which is
 * the failure the owner could not debug from outside.
 *
 * ⚠️ The invariant that makes this safe — **no route in NONCE_ROUTES may be
 * prerendered** — is asserted against the BUILD OUTPUT by
 * `pnpm check:render-modes`, which imports this file so there is one list rather
 * than two (11c). Reading the source would only prove somebody typed it.
 */

/**
 * Routes Next renders per request, and which therefore get the nonce.
 *
 * Every one of these is dynamic for a reason recorded elsewhere: `/login`,
 * `/signup`, `/reset-password`, `/pricing`, `/deletion-requested` and
 * `/account/update-password` are `force-dynamic` (see each page and
 * `check-render-modes.mjs`); everything under the signed-in product reads a
 * session.
 */
export const NONCE_ROUTES = [
  '/account',
  '/account/update-password',
  '/deletion-requested',
  '/dev-fixtures',
  '/login',
  '/pricing',
  '/reactivate',
  '/request',
  '/reset-password',
  '/results',
  '/run',
  '/signup',
  '/stocks',
] as const;

/**
 * The one parameterised page: `/stocks/[market]/[ticker]`.
 *
 * ⚠️ Exactly two segments. `/stocks/us/AAPL/report` is a route handler returning a
 * downloaded file, and `/stocks/us/AAPL/anything-else` matches no route at all and
 * must fall through to the inline form so the prerendered 404 still works.
 */
const TICKER_ROUTE = /^\/stocks\/[^/]+\/[^/]+$/;

const NONCE_EXACT: ReadonlySet<string> = new Set(NONCE_ROUTES);

/** Does this path render per request, and so accept a nonce? */
export function usesNonce(pathname: string): boolean {
  const path =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return NONCE_EXACT.has(path) || TICKER_ROUTE.test(path);
}

/**
 * Where the browser may load things from. Read off what the site actually does,
 * not what it might: measured across 22 pages on the production build,
 * **every violation was `script-src-elem :: inline`** and there were zero for
 * `style-src`, `img-src`, `font-src`, `connect-src`, `frame-src`, `form-action`,
 * `base-uri` or `object-src`.
 *
 * ⚠️ `https://accounts.google.com` under `style-src` is not decoration. It was
 * missing while the policy was Report-Only, so `/login` and `/signup` each
 * reported `style-src-elem :: https://accounts.google.com/gsi/style`. Nothing
 * broke, because reporting does not block — **which is exactly the danger. A
 * Report-Only policy that is wrong is a trap primed for whoever flips it**, and
 * the thing it would have broken is the Google sign-in button.
 */
function directives(supabaseOrigin: string, siteOrigin: string): Record<string, string[]> {
  return {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    // ⚠️ `billing.stripe.com` is here because of ONE button, and it is the button a
    // paying customer presses to change their card or cancel. `SubscriptionCard`
    // opens the Customer Portal with a real `<form method="post" action="/api/portal">`,
    // and that route answers `303 → https://billing.stripe.com/p/session/…`. Whether
    // `form-action` is checked against the REDIRECT as well as the original target has
    // moved with browser versions — Chrome shipped it, reverted it because it broke SSO
    // flows, and Safari has behaved differently again. Naming the destination removes
    // the question instead of betting on it. Everything else on the site posts to self,
    // via a server action or a JS handler; the Checkout hand-off is
    // `window.location.href`, a script-initiated navigation that `form-action` never
    // governs. Kept OFF the `frame-src`/`connect-src` lists for the same reason: state
    // what the site does, not what it might.
    'form-action': ["'self'", 'https://billing.stripe.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
    'img-src': ["'self'", 'data:', siteOrigin],
    'font-src': ["'self'"],
    'connect-src': ["'self'", supabaseOrigin, 'https://accounts.google.com'],
    'frame-src': ['https://accounts.google.com'],
  };
}

export function supabaseOriginForCsp(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : 'https://*.supabase.co';
  } catch {
    return 'https://*.supabase.co';
  }
}

/**
 * Build the policy.
 *
 * @param nonce  the per-request token, or `null` for a prerendered route, which
 *               gets `'unsafe-inline'` instead — see the header comment for why
 *               that is the only thing a pre-built file can accept.
 * @param dev    adds `'unsafe-eval'`. Turbopack's hot reloading compiles modules
 *               with `eval` in development and nowhere else, so refusing it would
 *               break the dev server and the e2e suite that boots one, while
 *               proving nothing about what ships. ⚠️ It is gated on NODE_ENV,
 *               which Next sets itself — `next build` cannot produce it.
 */
export function contentSecurityPolicy({
  nonce,
  dev,
  supabaseUrl,
  siteOrigin,
}: {
  nonce: string | null;
  dev: boolean;
  supabaseUrl: string | undefined;
  /**
   * `SITE_ORIGIN` from `lib/url.ts`, passed IN rather than imported. This file is
   * loaded three ways — by the Edge middleware, by Playwright, and by
   * `check-render-modes.mjs` through Node's type stripping, which resolves no
   * path aliases — so it deliberately has no imports of its own. `check:seo`
   * enforces the one-origin rule and caught the literal here (G1: it had been in
   * five files and one disagreed).
   */
  siteOrigin: string;
}): string {
  const script = [
    "'self'",
    nonce ? `'nonce-${nonce}'` : "'unsafe-inline'",
    ...(dev ? ["'unsafe-eval'"] : []),
    'https://accounts.google.com',
    'https://apis.google.com',
  ];

  const all: Record<string, string[]> = {
    ...directives(supabaseOriginForCsp(supabaseUrl), siteOrigin),
    'script-src': script,
  };

  // Stable order so a diff of two policies reads as a diff of intent.
  return Object.keys(all)
    .sort()
    .map((key) => `${key} ${all[key]!.join(' ')}`)
    .join('; ');
}

/**
 * 16 random bytes, base64. `crypto.getRandomValues` + `btoa` rather than
 * `Buffer`, because this runs in the Edge runtime where Node's Buffer is a
 * polyfill we should not depend on. The alphabet matches the one Next's own
 * parser accepts (`get-script-nonce-from-header.js`).
 */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
