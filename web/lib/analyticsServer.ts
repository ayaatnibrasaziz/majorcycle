import { createHash } from 'node:crypto';

import type Stripe from 'stripe';

import { GA_MEASUREMENT_ID } from '@/lib/analytics';
import { reportIssue } from '@/lib/observability';

/**
 * Billing events → Google Analytics, from the SERVER (owner-approved 2026-11-16).
 *
 * The browser cannot see what happens at Stripe: a trial turning into a paid plan, a
 * renewal, a failed card, a cancellation, a dispute. The Stripe webhook can, so it
 * reports them through Google's Measurement Protocol.
 *
 * ── Who the event belongs to ───────────────────────────────────────────────────
 * Checkout copies the reader's anonymous Analytics id (from the first-party `_ga`
 * cookie — `GA1.1.<random>.<timestamp>`, never a name or an email) into the Stripe
 * subscription's metadata as `ga_client_id`, and Stripe repeats subscription metadata
 * on every invoice. So a renewal a year later is still credited to the source that
 * brought the reader in (Reddit, YouTube, a search). A subscription made before this
 * existed — or by a reader whose browser blocked the cookie — has none; its events go
 * under a stable id derived one-way from the Stripe customer id, so they still COUNT,
 * just without a source.
 *
 * ── What is sent ───────────────────────────────────────────────────────────────
 * The event name, the plan (monthly/annual), an amount and currency where money moved,
 * and Stripe's own ids for de-duplication (`transaction_id`). Never an email, a name,
 * a card detail or our user id. Live mode only: test-mode events (previews, CI, the
 * owner's test purchases) are never reported, so they cannot pollute the reports.
 *
 * ── Which Stripe events, and which are left out ────────────────────────────────
 *   customer.subscription.created   → trial_started | subscription_started
 *   customer.subscription.updated   → trial_converted (trialing → active),
 *                                     subscription_cancel_requested / _reverted
 *   customer.subscription.deleted   → subscription_ended
 *   invoice.paid (money > 0)        → purchase (with value) — GA's revenue reports
 *   invoice.payment_failed          → payment_failed
 *   charge.dispute.created          → dispute_opened
 * Left out on purpose: invoice.payment_succeeded (fires with invoice.paid for the same
 * payment — would count revenue twice), checkout.session.completed (the same start as
 * subscription.created), invoice.upcoming and trial_will_end (reminders, not things a
 * customer did), invoice.payment_action_required (the same lapse as payment_failed),
 * and the later dispute stages (rare; Stripe's dashboard is the place for them).
 */

export interface GaEvent {
  name: string;
  params: Record<string, string | number | Array<Record<string, string | number>>>;
}
export interface GaHit {
  clientId: string;
  events: GaEvent[];
}

const CLIENT_ID = /^\d{5,}\.\d{5,}$/;

/** The anonymous id inside a `_ga` cookie, or null. `GA1.1.123456789.1700000000` → `123456789.1700000000`. */
export function gaClientIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const m = /(?:^|;\s*)_ga=([^;]+)/.exec(cookieHeader);
  if (!m) return null;
  const parts = decodeURIComponent(m[1]!).split('.');
  const id = parts.slice(-2).join('.');
  return CLIENT_ID.test(id) ? id : null;
}

/** A stable stand-in when no Analytics id was captured: one-way, from the Stripe customer id. */
function fallbackClientId(customer: string | null): string {
  const h = createHash('sha256').update(`mc-ga:${customer ?? 'unknown'}`).digest();
  return `${h.readUInt32BE(0)}.${h.readUInt32BE(4)}`;
}

const custId = (c: string | { id: string } | null | undefined) => (typeof c === 'string' ? c : c?.id ?? null);

function clientIdFrom(meta: Record<string, string> | null | undefined, customer: string | null): string {
  const id = meta?.['ga_client_id'];
  return id && CLIENT_ID.test(id) ? id : fallbackClientId(customer);
}

function planOf(sub: Stripe.Subscription): string {
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'annual' : interval === 'month' ? 'monthly' : 'unknown';
}

/**
 * Pure: which Analytics events a Stripe event means. No network, so it is tested
 * directly (e2e/analytics-server.spec.ts) against the shapes Stripe sends.
 */
export function gaHitForStripeEvent(event: Stripe.Event): GaHit | null {
  if (!event.livemode) return null;
  switch (event.type) {
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription;
      const name = sub.status === 'trialing' ? 'trial_started' : sub.status === 'active' ? 'subscription_started' : null;
      if (!name) return null;
      return {
        clientId: clientIdFrom(sub.metadata, custId(sub.customer)),
        events: [{ name, params: { plan: planOf(sub), currency: sub.currency.toUpperCase() } }],
      };
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const prev = (event.data.previous_attributes ?? {}) as Partial<Stripe.Subscription>;
      const events: GaEvent[] = [];
      const plan = planOf(sub);
      if (prev.status === 'trialing' && sub.status === 'active') {
        events.push({ name: 'trial_converted', params: { plan } });
      }
      if ('cancel_at_period_end' in prev && prev.cancel_at_period_end !== sub.cancel_at_period_end) {
        events.push({
          name: sub.cancel_at_period_end ? 'subscription_cancel_requested' : 'subscription_cancel_reverted',
          params: { plan, during_trial: sub.status === 'trialing' ? 'yes' : 'no' },
        });
      }
      return events.length ? { clientId: clientIdFrom(sub.metadata, custId(sub.customer)), events } : null;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const endedInTrial = sub.trial_end != null && (sub.ended_at ?? 0) <= sub.trial_end;
      return {
        clientId: clientIdFrom(sub.metadata, custId(sub.customer)),
        events: [{
          name: 'subscription_ended',
          params: {
            plan: planOf(sub),
            during_trial: endedInTrial ? 'yes' : 'no',
            reason: sub.cancellation_details?.reason ?? 'unknown',
          },
        }],
      };
    }
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice;
      if (!inv.amount_paid) return null; // the $0 invoice a trial opens with
      const meta = inv.parent?.subscription_details?.metadata ?? null;
      const value = inv.amount_paid / 100;
      const currency = inv.currency.toUpperCase();
      return {
        clientId: clientIdFrom(meta, custId(inv.customer)),
        events: [{
          name: 'purchase',
          params: {
            transaction_id: inv.id ?? event.id,
            value,
            currency,
            payment_type: inv.billing_reason === 'subscription_create' ? 'first_payment' : 'renewal',
            items: [{ item_id: 'majorcycle_subscription', item_name: 'MajorCycle subscription', price: value, quantity: 1 }],
          },
        }],
      };
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      return {
        clientId: clientIdFrom(inv.parent?.subscription_details?.metadata ?? null, custId(inv.customer)),
        events: [{ name: 'payment_failed', params: { attempt: inv.attempt_count ?? 0, value: inv.amount_due / 100, currency: inv.currency.toUpperCase() } }],
      };
    }
    case 'charge.dispute.created': {
      const d = event.data.object as Stripe.Dispute;
      const charge = typeof d.charge === 'string' ? null : d.charge;
      return {
        clientId: fallbackClientId(custId(charge?.customer ?? null)),
        events: [{ name: 'dispute_opened', params: { value: d.amount / 100, currency: d.currency.toUpperCase(), reason: d.reason } }],
      };
    }
    default:
      return null;
  }
}

/**
 * Send a hit. Best-effort and bounded: Analytics must never slow a webhook enough to
 * make Stripe retry, nor fail one. Off when the secret is not configured.
 */
export async function sendToGoogleAnalytics(hit: GaHit, opts: { debug?: boolean } = {}): Promise<unknown> {
  const secret = process.env['GA_MP_API_SECRET'];
  if (!secret) return null;
  const host = opts.debug ? 'https://www.google-analytics.com/debug/mp/collect' : 'https://www.google-analytics.com/mp/collect';
  const url = `${host}?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${encodeURIComponent(secret)}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: hit.clientId, events: hit.events }),
      signal: AbortSignal.timeout(2500),
    });
    if (opts.debug) return await res.json();
    if (!res.ok) {
      reportIssue('analytics: Measurement Protocol rejected a hit', { level: 'warning', tags: { status: String(res.status) } });
    }
    return null;
  } catch (err) {
    reportIssue('analytics: could not reach Measurement Protocol', { cause: err, level: 'warning' });
    return null;
  }
}

/** The webhook's one call: map, then send. Never throws. */
export async function reportStripeEventToAnalytics(event: Stripe.Event): Promise<void> {
  try {
    const hit = gaHitForStripeEvent(event);
    if (hit) await sendToGoogleAnalytics(hit);
  } catch (err) {
    reportIssue('analytics: could not map a Stripe event', { cause: err, level: 'warning', tags: { eventType: event.type } });
  }
}
