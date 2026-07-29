import 'server-only';

import type Stripe from 'stripe';

import { mapStripeStatus, planFromLookupKey } from '@/lib/stripe';
import type { createAdminClient } from '@/lib/supabase/server';
import { recordTrialConsumed } from '@/lib/trialGuard';

/**
 * The ONE implementation that writes a Stripe subscription onto a profile.
 *
 * It lived inside the webhook route until 2026-07-29, when the checkout landing page
 * gained a reconciler (see lib/billing/reconcileCheckout.ts) and needed the identical
 * write. Two copies of this derivation would drift, and the thing they derive is who has
 * paid — so there is exactly one, here, and both callers use it.
 *
 * "The webhook is the only writer of billing columns" still holds as a RULE about where
 * billing state comes from (Stripe, never the client). The reconciler doesn't weaken it:
 * it re-reads the same subscription from Stripe's API and applies the same function.
 */

export type Admin = ReturnType<typeof createAdminClient>;

/**
 * Who/what an event resolved to. Returned by every handler so the POST handler can
 * stamp the idempotency-ledger row for post-launch auditability (see Part G). Any
 * field may be null when it isn't resolvable for that event.
 */
export type EventContext = {
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
};

export function toISO(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

export function customerId(
  c: string | { id: string } | null | undefined,
): string | null {
  if (!c) return null;
  return typeof c === 'string' ? c : c.id;
}

/** Normalise a Stripe expandable ref (a string id or an expanded object) to its id. */
export function refId(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

/** Look up a profile id by its stored Stripe customer id. */
export async function userIdByCustomer(
  admin: Admin,
  cust: string | null,
): Promise<string | null> {
  if (!cust) return null;
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', cust)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Which profile a subscription belongs to. The subscription's `metadata.user_id`
 * (set at checkout) is the primary link; fall back to the stored stripe_customer_id.
 */
export async function resolveUserId(
  admin: Admin,
  sub: Stripe.Subscription,
): Promise<string | null> {
  return sub.metadata?.['user_id'] ?? (await userIdByCustomer(admin, customerId(sub.customer)));
}

/** Write the full subscription state onto the owning profile (idempotent). */
export async function syncSubscription(
  admin: Admin,
  sub: Stripe.Subscription,
): Promise<EventContext> {
  const cust = customerId(sub.customer);
  const userId = await resolveUserId(admin, sub);
  if (!userId) {
    console.error('billing sync: no profile for subscription', sub.id);
    return { customerId: cust, subscriptionId: sub.id };
  }

  const item = sub.items.data[0];
  const status = mapStripeStatus(sub.status);
  const patch: Record<string, unknown> = {
    stripe_customer_id: cust,
    stripe_subscription_id: sub.id,
    subscription_status: status,
    subscription_plan: planFromLookupKey(item?.price?.lookup_key),
    subscription_currency: sub.currency ?? null,
    current_period_end: toISO(item?.current_period_end),
    // Pinned API 2026-06-24.dahlia: a cancel-at-period-end sets `sub.cancel_at` (the
    // stop timestamp) and leaves the legacy `cancel_at_period_end` boolean FALSE. So
    // derive "scheduled to cancel" from cancel_at; the old boolean is only a fallback.
    // (We only ever schedule period-end cancels — the delete flow + the portal — so
    // cancel_at == current_period_end, which drives the account's "Cancels on" line.)
    cancel_at_period_end: sub.cancel_at != null || (sub.cancel_at_period_end ?? false),
    trial_ends_at: toISO(sub.trial_end),
  };
  // NOTE: we deliberately do NOT clear grace_until here. It is the single-owner dunning
  // marker (set only by invoice.payment_failed, cleared only by the paid/succeeded handler
  // + markCanceled). If this healthy sync also cleared it, a subscription.updated→active
  // arriving before invoice.paid could wipe the marker and swallow the recovery email.

  // Return the email in the same round-trip so a consumed trial can be tombstoned
  // without an extra query.
  const { data: updated } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('email')
    .maybeSingle();

  // Trial-abuse guard (Step 7): once a subscription is trialing, tombstone the email
  // (a record that survives account deletion) so the same address can't farm a second
  // free week. Idempotent + best-effort; the checkout guard and the account/pricing UI
  // read the same tombstone to omit the trial and warn the user before any charge.
  if (status === 'trialing') {
    await recordTrialConsumed(admin, updated?.email ?? null);
  }
  return { userId, customerId: cust, subscriptionId: sub.id };
}
