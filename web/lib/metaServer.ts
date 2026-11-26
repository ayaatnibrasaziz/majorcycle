import { createHash } from 'node:crypto';

import type Stripe from 'stripe';

import { META_PIXEL_ID, metaPixelIdValid } from '@/lib/metaPixel';
import { reportIssue } from '@/lib/observability';
import { SITE_ORIGIN } from '@/lib/url';

/**
 * Trials and payments → Meta's Conversions API, from the SERVER (owner decision
 * 2026-11-27, Philippines campaign). The browser pixel cannot see them: they happen
 * at Stripe, after the reader has left our page. This is the same job
 * lib/analyticsServer.ts does for Google, run from the same webhook.
 *
 * ── Which Stripe events ─────────────────────────────────────────────────────────
 *   customer.subscription.created, trialing     → StartTrial
 *   customer.subscription.created, active       → Subscribe   (no trial: paid today)
 *   customer.subscription.updated, trial→active → Subscribe   (the trial converted)
 *   invoice.paid, money > 0                     → Purchase    (with value — revenue)
 * Nothing else: a cancellation or a failed card is not something Meta should optimise
 * an ad towards, and GA already records them.
 *
 * ── Who the event belongs to ───────────────────────────────────────────────────
 * Checkout copies the reader's Meta browser ids (`_fbp`, and `_fbc` when they arrived
 * from an ad) and their browser's user-agent into the subscription's metadata, and
 * Stripe repeats that metadata on every invoice. We add two HASHED identifiers Meta
 * documents for matching: our user id (`external_id`) and, on an invoice, the email
 * Stripe holds (`em`) — SHA-256 of the trimmed lowercase value, as Meta specifies. The
 * plain email never leaves our server. No IP address, no name, no card detail.
 *
 * ── Where it runs ───────────────────────────────────────────────────────────────
 * Live-mode Stripe events only (previews, CI and the owner's test purchases never
 * reach Meta), and only while META_CAPI_TOKEN and NEXT_PUBLIC_META_PIXEL_ID are set.
 * META_TEST_EVENT_CODE, when set, sends to Events Manager's "Test events" tab instead
 * of the real dataset — for checking the setup, then removed.
 */

/** Graph API version. Each lives about two years; bump deliberately, with a test send. */
export const META_GRAPH_VERSION = 'v24.0';

export interface MetaServerEvent {
  event_name: 'StartTrial' | 'Subscribe' | 'Purchase';
  event_time: number;
  event_id: string;
  action_source: 'website' | 'system_generated';
  event_source_url?: string;
  user_data: Record<string, string | string[]>;
  custom_data: Record<string, string | number>;
}

const FBP = /^fb\.\d\.\d{10,16}\.\d{1,20}$/;
// ⚠️ Bounded so the WHOLE value stays under Stripe's 500-character metadata limit: a
// longer value would make Stripe refuse the checkout session, i.e. the cookie would
// break the one revenue path. Real click ids are ~60–200 characters.
const FBC = /^fb\.\d\.\d{10,16}\.[A-Za-z0-9_-]{1,400}$/;

/** A `_fbp` / `_fbc` cookie value, or null when absent or not the shape Meta writes. */
export function metaCookieFrom(cookieHeader: string | null, name: '_fbp' | '_fbc'): string | null {
  if (!cookieHeader) return null;
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(cookieHeader);
  if (!m) return null;
  let v: string;
  try {
    v = decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
  return (name === '_fbp' ? FBP : FBC).test(v) ? v : null;
}

/**
 * The metadata checkout adds, so Meta can tie a trial back to the ad click. Stripe caps
 * a metadata value at 500 characters, so the user-agent is cut there.
 */
export function metaCheckoutMetadata(cookieHeader: string | null, userAgent: string | null): Record<string, string> {
  const fbp = metaCookieFrom(cookieHeader, '_fbp');
  const fbc = metaCookieFrom(cookieHeader, '_fbc');
  const ua = userAgent?.trim().slice(0, 500);
  return {
    ...(fbp ? { meta_fbp: fbp } : {}),
    ...(fbc ? { meta_fbc: fbc } : {}),
    ...(ua ? { meta_ua: ua } : {}),
  };
}

/** SHA-256 hex of the normalised value — Meta's required form for `em` and `external_id`. */
export function metaHash(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

const custId = (c: string | { id: string } | null | undefined) => (typeof c === 'string' ? c : c?.id ?? null);

function userData(meta: Record<string, string> | null | undefined, email: string | null | undefined, customer: string | null) {
  const ud: Record<string, string | string[]> = {};
  const userId = meta?.['user_id'];
  // Our user id when checkout recorded it; otherwise the Stripe customer, so the same
  // person is still the same person across their trial and every renewal.
  const external = userId || customer;
  if (external) ud['external_id'] = [metaHash(external)];
  if (email) ud['em'] = [metaHash(email)];
  if (meta?.['meta_fbp']) ud['fbp'] = meta['meta_fbp'];
  if (meta?.['meta_fbc']) ud['fbc'] = meta['meta_fbc'];
  if (meta?.['meta_ua']) ud['client_user_agent'] = meta['meta_ua'];
  return ud;
}

/** Website when a browser was behind it (we hold its user-agent); otherwise system-generated. */
function source(ud: Record<string, string | string[]>, inBrowser: boolean): Pick<MetaServerEvent, 'action_source' | 'event_source_url'> {
  return inBrowser && ud['client_user_agent']
    ? { action_source: 'website', event_source_url: `${SITE_ORIGIN}/account` }
    : { action_source: 'system_generated' };
}

function planValue(sub: Stripe.Subscription): Record<string, string | number> {
  const price = sub.items?.data?.[0]?.price as { unit_amount?: number | null; recurring?: { interval?: string } | null } | undefined;
  const plan = price?.recurring?.interval === 'year' ? 'annual' : price?.recurring?.interval === 'month' ? 'monthly' : 'unknown';
  const out: Record<string, string | number> = { currency: sub.currency.toUpperCase(), content_name: plan };
  if (price?.unit_amount != null) out['value'] = price.unit_amount / 100;
  return out;
}

/**
 * Pure: which Meta events a Stripe event means. No network, so it is tested directly
 * (e2e/meta-server.spec.ts) against the shapes Stripe sends.
 */
export function metaEventsForStripeEvent(event: Stripe.Event): MetaServerEvent[] {
  if (!event.livemode) return [];
  const base = { event_time: event.created, event_id: event.id };
  switch (event.type) {
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription;
      const name = sub.status === 'trialing' ? 'StartTrial' : sub.status === 'active' ? 'Subscribe' : null;
      if (!name) return [];
      const ud = userData(sub.metadata, null, custId(sub.customer));
      return [{ ...base, event_name: name, ...source(ud, true), user_data: ud, custom_data: planValue(sub) }];
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const prev = (event.data.previous_attributes ?? {}) as Partial<Stripe.Subscription>;
      if (!(prev.status === 'trialing' && sub.status === 'active')) return [];
      // The trial ended on its own clock, days after the reader's visit.
      const ud = userData(sub.metadata, null, custId(sub.customer));
      return [{ ...base, event_name: 'Subscribe', ...source(ud, false), user_data: ud, custom_data: planValue(sub) }];
    }
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice;
      if (!inv.amount_paid) return []; // the $0 invoice a trial opens with
      const meta = inv.parent?.subscription_details?.metadata ?? null;
      const ud = userData(meta, inv.customer_email, custId(inv.customer));
      const first = inv.billing_reason === 'subscription_create';
      return [{
        ...base,
        event_name: 'Purchase',
        // A first payment with no trial is made during the checkout visit; a renewal is not.
        ...source(ud, first),
        user_data: ud,
        custom_data: {
          currency: inv.currency.toUpperCase(),
          value: inv.amount_paid / 100,
          content_name: first ? 'first_payment' : 'renewal',
          ...(inv.id ? { order_id: inv.id } : {}),
        },
      }];
    }
    default:
      return [];
  }
}

/** Send. Best-effort and bounded like the GA half: Meta must never slow or fail a webhook. */
export async function sendToMeta(events: MetaServerEvent[]): Promise<unknown> {
  const token = process.env['META_CAPI_TOKEN'];
  if (!token || !metaPixelIdValid(META_PIXEL_ID) || events.length === 0) return null;
  const testCode = process.env['META_TEST_EVENT_CODE'];
  try {
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // The token rides in the BODY, never the URL — a URL is what ends up in logs.
      body: JSON.stringify({ data: events, access_token: token, ...(testCode ? { test_event_code: testCode } : {}) }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      reportIssue('meta: Conversions API rejected an event', { level: 'warning', tags: { status: String(res.status) } });
    }
    return res.ok ? await res.json().catch(() => null) : null;
  } catch (err) {
    reportIssue('meta: could not reach the Conversions API', { cause: err, level: 'warning' });
    return null;
  }
}

/** The webhook's one call: map, then send. Never throws. */
export async function reportStripeEventToMeta(event: Stripe.Event): Promise<void> {
  try {
    await sendToMeta(metaEventsForStripeEvent(event));
  } catch (err) {
    reportIssue('meta: could not map a Stripe event', { cause: err, level: 'warning', tags: { eventType: event.type } });
  }
}
