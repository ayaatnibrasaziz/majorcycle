import {
  analyticsEnabledFor,
  analyticsOptedOut,
  isShareableAddress,
  type AnalyticsEvent,
} from '@/lib/analytics';

/**
 * Meta Pixel — the browser half of Meta advertising measurement (owner decision,
 * 2026-11-27, for the Philippines Reels campaign).
 *
 * ── What it is for ──────────────────────────────────────────────────────────────
 * Meta needs to know which ad produced a signup or a trial, so it can show the ad to
 * more people like them. It is NOT where the product is studied: every step of the
 * funnel already goes to Google Analytics (lib/analytics.ts), and that is where drop-off
 * is read. Meta gets the milestones only — see `META_EVENTS`.
 *
 * ── No consent banner, on purpose ───────────────────────────────────────────────
 * Owner decision 2026-11-27: no banner and no opt-out control. The privacy policy
 * names Meta and says what is shared. The one exception is a visitor whose browser is
 * set to a European time zone, where the law requires a yes BEFORE an advertising
 * cookie: the pixel simply never loads for them (`inEuropeanTimeZone`). We do not
 * advertise there. It is a time-zone check, not a location — approximate by design.
 *
 * ── What may leave the browser ─────────────────────────────────────────────────
 * The pixel sends the page address and referrer with every hit, exactly as GA's first
 * hit does, so it shares GA's gate: it never loads, and never sends, while either
 * address carries anything but campaign tags (`isShareableAddress`). Never an email or
 * a name: `autoConfig` is OFF (no automatic button/form scraping), and automatic
 * advanced matching must stay OFF in Events Manager (META_SETUP below). The server
 * half (lib/metaServer.ts) sends trials and payments, with hashed identifiers only.
 *
 * ── META_SETUP: what lives in Meta's dashboard, not here ────────────────────────
 *   - Events Manager → the pixel → Settings: "Automatic advanced matching" OFF,
 *     "Track events automatically without code" OFF.
 *   - Business settings → Brand safety → Domains: majorcycle.com verified (DNS TXT).
 *   - The Conversions API token lives in Vercel as META_CAPI_TOKEN (production only).
 *
 * ── Where it runs ───────────────────────────────────────────────────────────────
 * Only where GA runs (the production host), only when `NEXT_PUBLIC_META_PIXEL_ID` is set
 * at build time, and never in a browser the owner switched off with `#analytics-off`.
 */

export const META_PIXEL_ID = process.env['NEXT_PUBLIC_META_PIXEL_ID'] ?? '';

/** A Meta pixel id is a 15–16 digit number. Anything else is a config mistake: load nothing. */
export function metaPixelIdValid(id: string): boolean {
  return /^\d{15,16}$/.test(id);
}

/**
 * The origins the pixel needs. The SCRIPT is limited to the two paths Meta serves the
 * pixel from — not the whole host, which also serves other people's code. Images and
 * beacons go to www.facebook.com (`/tr/`); neither can run code.
 */
export const META_CSP = {
  script: ['https://connect.facebook.net/en_US/fbevents.js', 'https://connect.facebook.net/signals/'],
  connect: ['https://www.facebook.com', 'https://connect.facebook.net'],
  img: ['https://www.facebook.com'],
} as const;

/** EU/EEA, UK and Switzerland, read from the browser's own time-zone setting. */
export function inEuropeanTimeZone(timeZone: string): boolean {
  if (timeZone.startsWith('Europe/')) return true;
  return ['Atlantic/Reykjavik', 'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Faroe'].includes(
    timeZone,
  );
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

/** One Meta event for one of OUR events, or nothing. */
export interface MetaEvent {
  name: string;
  /** Standard events go through `track`; our own names through `trackCustom`. */
  custom: boolean;
  params: Record<string, string | number | string[]>;
  /** Shared with the server copy of the same event so Meta keeps one (48 h window). */
  eventId?: string;
}

/**
 * Which of our events Meta hears. Standard names where Meta has one (it optimises on
 * those), our own for the two retargeting signals. Everything else stays in GA only.
 *
 * Meta's own guidance (Conversions API best practices, read 2026-11-27) is to send the
 * important events from BOTH the browser and the server, paired by `event_id`:
 *   - CompleteRegistration: browser here, server at the first sign-in
 *     (app/(app)/actions.ts), both `reg_<user id>`.
 *   - InitiateCheckout: SERVER ONLY (app/api/checkout/route.ts). The browser leaves for
 *     Stripe the instant the session exists, so a browser hit there is the one most
 *     likely to be lost, and the server copy carries everything Meta matches on.
 *   - StartTrial / Subscribe / Purchase: server only — they happen at Stripe.
 */
export function metaEventFor(event: AnalyticsEvent, params: Record<string, unknown>): MetaEvent | null {
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  switch (event) {
    case 'sign_up':
      return {
        name: 'CompleteRegistration',
        custom: false,
        params: { content_name: 'free_account', status: str(params['method']) ?? 'unknown' },
      };
    case 'view_item': {
      const item = (Array.isArray(params['items']) ? params['items'][0] : null) as Record<string, unknown> | null;
      const ticker = str(item?.['item_id']);
      const market = str(item?.['item_category']);
      return {
        name: 'ViewContent',
        custom: false,
        params: {
          content_type: 'stock',
          ...(ticker ? { content_ids: [ticker] } : {}),
          ...(market ? { content_category: market } : {}),
        },
      };
    }
    case 'view_paywall': {
      const feature = str(params['feature']);
      return { name: 'ViewPaywall', custom: true, params: feature ? { feature } : {} };
    }
    case 'run_screen':
      return { name: 'RunScreen', custom: true, params: {} };
    default:
      return null;
  }
}

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

function fbq(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const f = (window as Window & { fbq?: Fbq }).fbq;
  return typeof f === 'function' ? f : null;
}

/** True when this browser, on this page, may run the pixel at all. */
export function metaPixelAllowedHere(): boolean {
  if (typeof window === 'undefined') return false;
  if (!metaPixelIdValid(META_PIXEL_ID)) return false;
  if (!analyticsEnabledFor(window.location.hostname)) return false;
  if (analyticsOptedOut()) return false;
  if (inEuropeanTimeZone(browserTimeZone())) return false;
  return true;
}

/** Both addresses the pixel will send must be shareable, for THIS hit. */
function addressesClean(): boolean {
  return isShareableAddress(window.location.href) && isShareableAddress(document.referrer);
}

/** Events recorded before the pixel was installed (same idea as GA's queue). */
const pending: MetaEvent[] = [];

/**
 * Install the pixel. Called once after the page has loaded. Returns false (and does
 * nothing) wherever it must not run, or while this page's address is not shareable —
 * the caller tries again on the next page.
 */
export function installMetaPixel(): boolean {
  if (!metaPixelAllowedHere()) return false;
  const w = window as Window & { fbq?: Fbq; _fbq?: Fbq };
  if (w.fbq) return true;
  if (!addressesClean()) return false;
  // Meta's documented loader, written out: a queue that fbevents.js drains on arrival.
  const f: Fbq = function fbqShim(...args: unknown[]) {
    if (f.callMethod) f.callMethod(...args);
    else f.queue!.push(args);
  };
  f.push = f;
  f.loaded = true;
  f.version = '2.0';
  f.queue = [];
  w.fbq = f;
  w._fbq = f;
  // No automatic scraping of buttons, forms or page metadata. Must come BEFORE init.
  f('set', 'autoConfig', false, META_PIXEL_ID);
  f('init', META_PIXEL_ID);
  f('track', 'PageView');
  for (const e of pending.splice(0)) send(f, e);
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  return true;
}

function send(f: Fbq, e: MetaEvent): void {
  if (e.eventId) f(e.custom ? 'trackCustom' : 'track', e.name, e.params, { eventID: e.eventId });
  else f(e.custom ? 'trackCustom' : 'track', e.name, e.params);
}

/** A page view on a client-side move. Skipped on a page whose address is not shareable. */
export function trackMetaPageView(): void {
  try {
    const f = fbq();
    if (f && addressesClean()) f('track', 'PageView');
  } catch {
    // Advertising measurement must never break the page.
  }
}

/** Called by `track()` in lib/analytics.ts for every event; forwards only the mapped ones. */
export function trackMeta(event: AnalyticsEvent, params: Record<string, unknown>, eventId?: string): void {
  try {
    const mapped = metaEventFor(event, params);
    if (!mapped) return;
    const e: MetaEvent = eventId ? { ...mapped, eventId } : mapped;
    const f = fbq();
    if (f) {
      if (addressesClean()) send(f, e);
      return;
    }
    if (metaPixelAllowedHere() && pending.length < 20) pending.push(e);
  } catch {
    // As above.
  }
}
