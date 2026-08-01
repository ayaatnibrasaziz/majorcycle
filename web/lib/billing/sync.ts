import 'server-only';

import type Stripe from 'stripe';

import { getStripe, mapStripeStatus, planFromLookupKey } from '@/lib/stripe';
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

/**
 * Stripe statuses that mean "this subscription is really running and billing".
 *
 * `incomplete` is deliberately EXCLUDED: it means the first payment never succeeded, so
 * a user retrying checkout after a declined card is doing something legitimate and their
 * second attempt must not be treated as a duplicate.
 */
const LIVE_SUBSCRIPTION_STATES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

/**
 * Refuse a SECOND live subscription for one profile — returns true if `sub` was rejected
 * as a duplicate (and cancelled in Stripe).
 *
 * THE HOLE THIS CLOSES (live-check Session 2, finding B). `/api/checkout` 409s a user who
 * already subscribes, but that guard runs when the Checkout **Session is created**, and
 * nothing ran when one was **completed**. Three concurrent POSTs each returned their own
 * session, and the reachable version needs no concurrency at all: start checkout, abandon
 * it, come back later and start again (status still null, so allowed), then complete BOTH
 * from browser history. That produced two live subscriptions billing the same person,
 * with only the second recorded — and decision #21 (no refunds) leaves no clean remedy.
 *
 * WHY THE LIVE RETRIEVE, AND WHY IT IS SAFE. Cancelling a subscription is destructive, so
 * this must never fire on a legitimate re-subscribe. Our own `stripe_subscription_id` is
 * not enough to judge that: Stripe does not guarantee webhook ORDER, so a new
 * `subscription.created` can arrive before the old `subscription.deleted`, and the column
 * would still name a subscription that is already dead. Asking Stripe directly settles it
 * — the API is always current even when the webhook is late. So:
 *   - old sub genuinely live  → this really is a second one → cancel it
 *   - old sub already cancelled/incomplete → legitimate re-subscribe → let it through
 *
 * We cancel the INCOMING one. The one on file is the established subscription: it owns the
 * billing anchor and, if there was a trial, consumed it.
 *
 * Cancelling does NOT refund. A duplicate caught while `trialing` was never charged, so
 * nothing is owed; a duplicate that already charged needs a manual refund, which is why
 * this logs loudly with both ids rather than failing quietly.
 */
async function rejectDuplicateSubscription(
  admin: Admin,
  userId: string,
  sub: Stripe.Subscription,
): Promise<boolean> {
  const { data: existing } = await admin
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();

  const onFile = existing?.stripe_subscription_id ?? null;
  if (!onFile || onFile === sub.id) return false;

  let live: Stripe.Subscription | null = null;
  try {
    live = await getStripe().subscriptions.retrieve(onFile);
  } catch (err) {
    // Can't confirm the incumbent (deleted, wrong mode, API blip) — do NOT cancel on a
    // guess. Fall through and let the normal write proceed, which is the pre-existing
    // behaviour: at worst we're back to the bug, never wrongly killing a paid plan.
    console.error('billing sync: could not verify existing subscription', onFile, err);
    return false;
  }

  if (!live || !LIVE_SUBSCRIPTION_STATES.has(live.status)) return false;

  try {
    await getStripe().subscriptions.cancel(sub.id);
  } catch (err) {
    // Log and still refuse the write — leaving the profile pointing at the incumbent is
    // the safer of the two states, and the log names both ids for manual cleanup.
    console.error('billing sync: could not cancel duplicate subscription', sub.id, err);
  }

  console.error(
    `billing sync: DUPLICATE SUBSCRIPTION for user ${userId} — kept ${onFile} (${live.status}), ` +
      `cancelled incoming ${sub.id} (${sub.status}). If the duplicate was charged ` +
      '(i.e. it was not trialing), refund it in the Stripe Dashboard — cancelling does not refund.',
  );
  return true;
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

  // Both writers reach the profile through here — the webhook AND the checkout landing
  // page's reconciler — so this one guard covers every way a subscription gets recorded.
  if (await rejectDuplicateSubscription(admin, userId, sub)) {
    return { userId, customerId: cust, subscriptionId: sub.id };
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
