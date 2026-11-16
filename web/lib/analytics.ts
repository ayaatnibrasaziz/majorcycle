/**
 * Google Analytics 4 — what it may see, and the one place that says so.
 *
 * Owner decision, 15 Nov 2026: GA4 on the live site, NO cookie banner (we are an
 * Australian business; the Privacy Act requires notice, which the privacy policy
 * gives). Google signals OFF, ads personalisation OFF, event data kept 14 months —
 * those three live in Google's dashboard and are written down here so they are not
 * only in someone else's UI (11bj: a setting you cannot grep is a copy that drifts).
 *
 * ── What leaves the browser, and what never does ──────────────────────────────
 * Every page view and event carries a page address. This site has addresses that
 * must never reach a third party — `/login?next=…`, an `?error=` from the auth
 * callback, a screener's query string. Three layers, in order of strength:
 *   1. the tag never LOADS on a page whose address (or referrer) carries anything
 *      but campaign tags (`isShareableAddress` — read its note: the tag's own first
 *      hit ignores every setting below);
 *   2. `cleanLocation()` builds every address we hand over afterwards: origin +
 *      path, plus ONLY the utm_* campaign tags; enhanced measurement is OFF in the
 *      dashboard, so nothing automatic fires on a later move;
 *   3. the dashboard's "Redact data" list blanks 17 named keys if one ever arrives.
 *
 * ── GA_SETUP: what lives in Google's dashboard, not here (re-check if data looks wrong)
 *   - Google signals OFF; event + user data kept 14 months; enhanced measurement OFF.
 *   - Redact data: email, and the query keys next, error, error_description, code,
 *     token_hash, token, access_token, refresh_token, type, session_id, billing,
 *     reason, plan, mode, email, q, id (NOT `checkout`, which counts trial sign-ups).
 *   - Custom dimensions for our event parameters (method, plan, preset, market,
 *     ticker, feature, location, reason, format, purpose, payment_type, during_trial,
 *     form) and custom metrics (tickers, rows, attempt), or the reports cannot show them.
 *   - Key events: sign_up, begin_checkout, trial_started, subscription_started,
 *     trial_converted, purchase.
 *   - Billing events (trial_started and everything after it) come from the SERVER —
 *     lib/analyticsServer.ts, with the Measurement Protocol secret GA_MP_API_SECRET.
 *   `python ga_insights.py config` (mc-video-tools/insights) reads all of this back from
 *   Google and fails on any difference. A path on this site
 * is never personal (`/stocks/us/AAPL` names a company, not a reader), and the
 * tags are what tells the owner a visit came from Reddit or YouTube.
 *
 * No user id, no email, no name — Google's terms forbid it and nothing here sends
 * one. Event parameters are counts and labels we write ourselves.
 *
 * ── Where it runs ───────────────────────────────────────────────────────────────
 * ONLY on the production host. Not localhost (the e2e suite would fill the reports
 * with robots), not a Vercel preview (the owner's own clicks while reviewing), not
 * the downloaded report (a `file://` page). One host list, below.
 */

export const GA_MEASUREMENT_ID = 'G-61W3M3VW41';

/** The hosts a real reader is on. Anything else loads nothing and sends nothing. */
const ANALYTICS_HOSTS: ReadonlySet<string> = new Set(['www.majorcycle.com', 'majorcycle.com']);

export function analyticsEnabledFor(hostname: string): boolean {
  return ANALYTICS_HOSTS.has(hostname);
}

/**
 * "Don't count this browser" — for the owner's own devices (2026-11-16).
 *
 * Opening `https://www.majorcycle.com/#analytics-off` once in a browser stores a flag
 * there, and from then on the tag never LOADS in that browser: nothing is sent, so
 * nothing needs filtering out later. `#analytics-on` undoes it. Per browser and device,
 * and lost if that browser's site data is cleared — chosen over Google's IP-address
 * filter because a home or mobile IP changes without warning and the filter then
 * silently stops matching. Anyone may opt themselves out; that is harmless.
 */
export const OPT_OUT_KEY = 'mc:analytics-off';

export function analyticsOptedOut(): boolean {
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false; // storage blocked: nothing to read, so the default applies
  }
}

/** Reads `#analytics-off` / `#analytics-on` from the address and stores the choice. */
export function applyOptOutFromHash(hash: string): void {
  try {
    if (hash === '#analytics-off') window.localStorage.setItem(OPT_OUT_KEY, '1');
    else if (hash === '#analytics-on') window.localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // storage blocked: the switch cannot be remembered, and the tag behaves as usual
  }
}

/**
 * The origins Google's documented CSP for GA4 needs. Site-wide, never per route: a
 * client-side navigation keeps the policy of the page the reader started on
 * (lib/turnstile.ts records the day that bit us).
 */
export const GA_CSP = {
  // ⚠️ NOT Google's documented `https://*.googletagmanager.com`. That would let any
  // script from Tag Manager run — including `gtm.js?id=GTM-<anyone's container>`,
  // a well-known way to turn a small HTML injection into arbitrary JavaScript,
  // because a container is code its OWNER writes. A path ending in `/` is a prefix
  // match, so this admits `gtag/js` (and the `gtag/destination` it may fetch) and
  // nothing else on the host. Measured on the wire: GA4 needs no other script.
  script: ['https://www.googletagmanager.com/gtag/'],
  connect: [
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
  ],
  img: ['https://*.google-analytics.com', 'https://*.googletagmanager.com'],
} as const;

/**
 * Query keys Google may see in a page address we build: the campaign tags, the
 * screener horizon (`?preset=long` is a setting, not a person), and `checkout`
 * (`success` / `cancelled` — how a trial sign-up is counted, see GA_SETUP below).
 */
const KEPT_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'checkout', 'preset', 'pullback', 'profit', 'lookback',
];

/**
 * Keys that may be PRESENT when the tag starts, although we never forward them
 * ourselves. The tag's own first hit sends the raw address, so these reach Google's
 * script — and are blanked in the browser by the property's "Redact data" list
 * before anything is sent (both are on it; verified on the wire 2026-11-15).
 * `next` is a path on this site (`/login?next=/stocks/au/BHP`), `error` a fixed code
 * (`auth_callback_failed`). Without them a reader who arrives at a "please sign in"
 * link would not be counted at all on that page. Anything NOT on either list — a
 * token, a code, a Stripe session id — still keeps the tag from loading.
 */
const GATE_ALSO_ALLOWS = ['next', 'error'];

/**
 * The address Google is allowed to see: origin + path + utm tags. Never the rest of
 * the query, never the fragment. An unparseable input yields '' rather than itself.
 */
export function cleanLocation(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return '';
  }
  const kept = new URLSearchParams();
  for (const k of KEPT_PARAMS) {
    const v = url.searchParams.get(k);
    if (v) kept.set(k, v);
  }
  const q = kept.toString();
  return `${url.origin}${url.pathname}${q ? `?${q}` : ''}`;
}

/**
 * May the tag START on this page? Only when neither address carries anything beyond
 * campaign tags — and this is the guarantee, not `cleanLocation()`.
 *
 * ⚠️ WHY A GATE AND NOT ONLY A CLEANER. Measured 2026-11-15 under the live hostname,
 * four configurations of the tag, enhanced measurement on AND off: the tag sends one
 * page view of its own the moment it loads, built from the RAW `document.location`
 * and `document.referrer`. `send_page_view: false`, `page_location` in `config`, and
 * a global `set` before `config` were each ignored by that one hit — every other hit
 * honoured the cleaned address. Google's panel says the same thing in words: with
 * enhanced measurement off "your property will be getting standard page views".
 * A cleaner cannot reach a value it is never asked for, so the tag simply does not
 * load while either address is dirty; the first client-side move to a clean page
 * loads it there instead (components/GoogleAnalytics.tsx). The dashboard's
 * "Redact data" list (18 keys: next, error, code, token_hash…) is the second layer,
 * and it is only a second layer: it names keys, and a key nobody listed would pass.
 *
 * A fragment counts too, unless it is a plain in-page anchor (`#sec-thesis`): an
 * auth provider's implicit flow puts tokens there.
 */
export function isShareableAddress(href: string): boolean {
  if (!href) return true;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  for (const key of url.searchParams.keys()) {
    if (!KEPT_PARAMS.includes(key) && !GATE_ALSO_ALLOWS.includes(key)) return false;
  }
  return url.hash === '' || /^#[\w-]*$/.test(url.hash);
}

/** A referrer keeps only its origin and path — another site's query is not ours to pass on. */
export function cleanReferrer(href: string): string {
  if (!href) return '';
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

/** The events we send ourselves. A closed list, so a typo is a type error. */
export type AnalyticsEvent =
  | 'login'
  | 'sign_up'
  | 'onboarding_complete'
  | 'view_paywall'
  | 'begin_checkout'
  | 'open_billing_portal'
  | 'run_screen'
  | 'export_results'
  | 'download_report'
  | 'request_ticker'
  | 'refer_friend'
  | 'generate_lead'
  | 'account_deletion_requested'
  | 'film_sound_on';

type Params = Record<string, string | number | boolean | Array<Record<string, string | number>>>;

type Gtag = (...args: unknown[]) => void;

function gtag(): Gtag | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { gtag?: Gtag };
  return typeof w.gtag === 'function' ? w.gtag : null;
}

/**
 * Send one event. A no-op wherever analytics is not running — off the production
 * host, before the reader's first page has set it up, or with a blocker installed —
 * so a caller never has to ask.
 */
export function track(event: AnalyticsEvent, params: Params = {}): void {
  try {
    const g = gtag();
    if (g) {
      g('event', event, params);
      return;
    }
    // Not installed YET: the tag waits for the page to finish loading, so anything a
    // page records the moment it appears (a paywall, a first-login screen) would be
    // lost. Hold it until `installAnalytics` runs — and only on the live host, so a
    // queue never grows where the tag will never come.
    if (
      typeof window !== 'undefined' &&
      analyticsEnabledFor(window.location.hostname) &&
      !analyticsOptedOut() &&
      pending.length < 20
    ) {
      pending.push([event, params]);
    }
  } catch {
    // Analytics must never break the thing the reader was doing.
  }
}

/** Events recorded before the tag was installed (see `track`). */
const pending: Array<[AnalyticsEvent, Params]> = [];

/**
 * Record a page view for the current address (cleaned).
 *
 * ⚠️ WAITS FOR A TITLE. The ticker page streams its `<title>` in after the route has
 * changed (CLAUDE.md, P7: it sits in the body), so a view sent on the path change
 * reached Google with a BLANK page name — measured 2026-11-15 on /stocks/us/AAPL,
 * while every other page's name was right. Up to 3 s, then it goes anyway.
 */
export function trackPageView(waited = 0): void {
  const g = gtag();
  if (!g) return;
  if (!document.title && waited < 3000) {
    window.setTimeout(() => trackPageView(waited + 100), 100);
    return;
  }
  try {
    g('set', {
      page_location: cleanLocation(window.location.href),
      page_referrer: cleanReferrer(document.referrer),
      page_title: document.title,
    });
    g('event', 'page_view');
  } catch {
    // As above.
  }
}

/**
 * Install the tag. Called once, after the page has finished loading, so Google's
 * script never competes with the page the reader is waiting for.
 */
export function installAnalytics(): boolean {
  if (typeof window === 'undefined' || !analyticsEnabledFor(window.location.hostname)) {
    return false;
  }
  if (analyticsOptedOut()) return false;
  const w = window as Window & { dataLayer?: unknown[]; gtag?: Gtag };
  if (w.gtag) return true;
  if (!isShareableAddress(window.location.href) || !isShareableAddress(document.referrer)) {
    return false;
  }
  w.dataLayer = w.dataLayer ?? [];
  // gtag.js reads the `arguments` OBJECT off the queue, not an array — the shape
  // Google's own snippet pushes. An array is silently ignored.
  w.gtag = function gtagShim() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  // Advertising use refused outright, before anything else is queued. Measured
  // 2026-11-15: with only `allow_google_signals: false` in the config, the tag still
  // tried to post every hit to www.google.com/g/collect (an advertising endpoint,
  // `npa=0`) — the CSP refused it, but the attempt should not happen at all. Consent
  // mode's `denied` for the three ad signals is the switch Google documents for that.
  w.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  w.gtag('set', { allow_google_signals: false, allow_ad_personalization_signals: false });
  w.gtag('js', new Date());
  // ⚠️ `set` BEFORE `config`, not only inside it. Measured 2026-11-15 under the live
  // hostname: with the cleaned address passed to `config` alone, the tag's own
  // first page view still went out with the RAW address, query string and all.
  // A global `set` reaches every hit the tag sends, its automatic ones included.
  w.gtag('set', {
    page_location: cleanLocation(window.location.href),
    page_referrer: cleanReferrer(document.referrer),
  });
  // The FIRST page view is the tag's own (it sends one on load whatever `config`
  // says — see `isShareableAddress`). Leaving `send_page_view` at its default means
  // exactly one is sent: measured, `config` plus the tag's own collapse into one
  // hit, where `send_page_view: false` plus a manual event counted the page TWICE.
  // Every later page is `trackPageView()`, called on each path change.
  w.gtag('config', GA_MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  // Queued AFTER `config`, so they carry this page's cleaned address.
  for (const [event, params] of pending.splice(0)) w.gtag('event', event, params);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
  return true;
}
