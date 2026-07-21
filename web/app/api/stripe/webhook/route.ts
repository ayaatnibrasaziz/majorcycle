import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { getStripe, mapStripeStatus, planFromLookupKey } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { recordTrialConsumed } from '@/lib/trialGuard';
import {
  sendTrialEndingEmail,
  sendPaymentFailedEmail,
  sendPaymentRecoveredEmail,
} from '@/lib/email/billingEmails';

/**
 * Stripe webhook — the ONE writer of the billing columns (the anti-freeload
 * backbone: entitlement is server-derived Stripe truth the client can't forge).
 *
 * Contract (plan §3 / §7A):
 *  - Public path (Stripe posts without cookies) — added to PUBLIC_PATHS.
 *  - Verify the raw body against STRIPE_WEBHOOK_SECRET; bad signature ⇒ 400.
 *  - Idempotent: claim the event id in `stripe_events`; a redelivery is acked + skipped.
 *  - All writes via the service-role admin client (billing columns are client-immutable).
 *  - Handlers re-derive state straight from the event object (no live retrieves), so
 *    they're order-independent and a replay is a no-op. If processing throws we release
 *    the claim and 500 so Stripe retries.
 *
 * Division of labour: `customer.subscription.*` carry the full subscription object and
 * drive the state sync; `checkout.session.completed` just links the Stripe customer to
 * our user; invoices flip active/past_due + the grace clock AND send the branded dunning /
 * recovery emails (step 8); `trial_will_end` sends the branded trial-ending reminder
 * (step 8); `charge.dispute.*` set/clear `billing_blocked` and cancel the sub on a lost
 * dispute (step 8). The Step-7 email trial-tombstone is written in `syncSubscription` when
 * a sub goes trialing (the same-card vector is handled by Stripe Radar, no code here).
 *
 * `grace_until` is the SINGLE-OWNER dunning marker: only `invoice.payment_failed` sets it
 * (first failure), and only the paid/succeeded handler + `markCanceled` clear it. Because
 * it has exactly one setter and its clear == recovery, the failure/recovery emails gate on
 * its transitions and are immune to Stripe's (unordered) event delivery. Every billing
 * email is the LAST, best-effort action in its handler (sendBrandEmail never throws), so a
 * handler never throws after emailing → the event claim is never released-and-reprocessed
 * after a send → no duplicate email. Each send also carries a Resend Idempotency-Key
 * (`<event.id>:<type>`) as a second guarantee against a re-processed redelivery.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GRACE_DAYS = 3;

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Who/what an event resolved to. Returned by every handler so the POST handler can
 * stamp the idempotency-ledger row for post-launch auditability (see Part G). Any
 * field may be null when it isn't resolvable for that event.
 */
type EventContext = {
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
};

function toISO(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

function customerId(
  c: string | { id: string } | null | undefined,
): string | null {
  if (!c) return null;
  return typeof c === 'string' ? c : c.id;
}

/** Normalise a Stripe expandable ref (a string id or an expanded object) to its id. */
function refId(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

/** Look up a profile id by its stored Stripe customer id. */
async function userIdByCustomer(
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
async function resolveUserId(
  admin: Admin,
  sub: Stripe.Subscription,
): Promise<string | null> {
  return sub.metadata?.['user_id'] ?? (await userIdByCustomer(admin, customerId(sub.customer)));
}

/** Which profile an invoice belongs to (subscription metadata snapshot, then customer). */
async function resolveUserIdFromInvoice(
  admin: Admin,
  invoice: Stripe.Invoice,
): Promise<string | null> {
  return (
    invoice.parent?.subscription_details?.metadata?.['user_id'] ??
    (await userIdByCustomer(admin, customerId(invoice.customer)))
  );
}

/**
 * Which profile a dispute belongs to. A `Stripe.Dispute` carries only the charge id, not
 * the customer — so this is the ONE place the webhook does a live Stripe retrieve (to read
 * the charge's customer). Deliberate exception to the "handlers re-derive from the event,
 * no retrieves" rule: disputes are rare + real-money, so a single retrieve is fine. Failure
 * is swallowed (logged) — a dispute we can't attribute simply doesn't flip billing_blocked.
 */
async function resolveUserIdFromDispute(
  admin: Admin,
  dispute: Stripe.Dispute,
): Promise<EventContext> {
  let cust: string | null = null;
  try {
    const chargeId = refId(dispute.charge);
    if (chargeId) {
      const charge = await getStripe().charges.retrieve(chargeId);
      cust = customerId(charge.customer);
    }
  } catch (err) {
    console.error('stripe webhook: could not retrieve charge for dispute', dispute.id, err);
  }
  return { userId: await userIdByCustomer(admin, cust), customerId: cust };
}

/** Write the full subscription state onto the owning profile (idempotent). */
async function syncSubscription(
  admin: Admin,
  sub: Stripe.Subscription,
): Promise<EventContext> {
  const cust = customerId(sub.customer);
  const userId = await resolveUserId(admin, sub);
  if (!userId) {
    console.error('stripe webhook: no profile for subscription', sub.id);
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

/** Subscription ended for good → lapse to a free (canceled) account. */
async function markCanceled(admin: Admin, sub: Stripe.Subscription): Promise<EventContext> {
  const cust = customerId(sub.customer);
  const userId = await resolveUserId(admin, sub);
  if (!userId) {
    console.error('stripe webhook: no profile for canceled subscription', sub.id);
    return { customerId: cust, subscriptionId: sub.id };
  }
  // Only lapse the account if this deleted sub is the one currently on file (or none is).
  // A DIFFERENT subscription id on file means this deletion is stale — e.g. the user
  // cancelled an old sub and started a new one, and Stripe delivered the old
  // `subscription.deleted` out of order (delivery order isn't guaranteed). Guarding on the
  // id means a late deletion of a superseded sub can never clobber a newer active one.
  await admin
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      trial_ends_at: null,
      grace_until: null,
      cancel_at_period_end: false,
    })
    .eq('id', userId)
    .or(`stripe_subscription_id.eq.${sub.id},stripe_subscription_id.is.null`);
  return { userId, customerId: cust, subscriptionId: sub.id };
}

/** Route a verified event to its handler. Unknown/deferred types are no-op (acked). */
async function handleEvent(admin: Admin, event: Stripe.Event): Promise<EventContext> {
  switch (event.type) {
    case 'checkout.session.completed': {
      // Link the Stripe customer to our user. The subscription state itself arrives
      // via customer.subscription.created (full object) — no retrieve needed here.
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const cust = customerId(session.customer);
      if (userId && cust) {
        await admin
          .from('profiles')
          .update({ stripe_customer_id: cust })
          .eq('id', userId);
      }
      // (Trial tombstone is written from the trialing customer.subscription.* sync,
      // where the trial flag is authoritative — see syncSubscription.)
      return {
        userId: userId ?? null,
        customerId: cust,
        subscriptionId: refId(session.subscription),
      };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return syncSubscription(admin, event.data.object as Stripe.Subscription);
    case 'customer.subscription.deleted':
      return markCanceled(admin, event.data.object as Stripe.Subscription);
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      // A successful payment clears any payment-failure grace clock. It must NOT
      // set 'active' unconditionally: a trial subscription's $0 invoice is marked
      // paid the instant the trial starts, and forcing 'active' here would clobber
      // the 'trialing' status that customer.subscription.created/updated set (those
      // events are the authoritative status writer). So we only *recover* a
      // past_due account back to active — an atomic guarded update that never
      // downgrades 'trialing' (or resurrects 'canceled'), and is order-independent
      // vs the accompanying subscription.* event. The renewed period end arrives on
      // that subscription.updated event.
      const invoice = event.data.object as Stripe.Invoice;
      const cust = customerId(invoice.customer);
      const subscriptionId = refId(invoice.parent?.subscription_details?.subscription);
      const userId = await resolveUserIdFromInvoice(admin, invoice);
      if (!userId) {
        console.error('stripe webhook: no profile for paid invoice', invoice.id);
        return { customerId: cust, subscriptionId };
      }
      // Act only on the sub currently on file. A payment for an OLD/superseded sub (or a
      // non-subscription invoice) must not recover a DIFFERENT current subscription —
      // symmetric to the payment_failed + deletion guards (event order isn't guaranteed).
      if (!subscriptionId) return { userId, customerId: cust, subscriptionId };
      // Recover a past_due account back to active (guarded — never downgrades trialing or
      // resurrects canceled, and only for the current sub; order-independent vs subscription.*).
      await admin
        .from('profiles')
        .update({ subscription_status: 'active' })
        .eq('id', userId)
        .eq('subscription_status', 'past_due')
        .eq('stripe_subscription_id', subscriptionId);
      // Clear the single-owner dunning marker. A returned row means grace WAS set, i.e. we
      // just recovered from a real failure → send the branded "you're all set" email. Of
      // invoice.paid vs invoice.payment_succeeded (both fire for one payment), only the
      // first to clear it emails; the second sees NULL and no-ops. A normal renewal and the
      // $0 trial-start invoice never set grace, so they never trigger this. Email is the
      // last, best-effort action.
      const { data: recovered } = await admin
        .from('profiles')
        .update({ grace_until: null })
        .eq('id', userId)
        .eq('stripe_subscription_id', subscriptionId)
        .not('grace_until', 'is', null)
        .select('email, display_name')
        .maybeSingle();
      if (recovered?.email) {
        await sendPaymentRecoveredEmail({
          to: recovered.email,
          name: recovered.display_name ?? null,
          idempotencyKey: `${event.id}:payment_recovered`,
        });
      }
      return { userId, customerId: cust, subscriptionId };
    }
    case 'invoice.payment_failed':
    case 'invoice.payment_action_required': {
      // Two ways a renewal doesn't get paid: the card is declined (payment_failed) or it
      // needs fresh authentication the customer must complete off-session, e.g. 3-D Secure
      // (payment_action_required). Both leave the sub past_due and both need the same nudge —
      // "sort out your payment to keep access" — so they share this dunning path.
      const invoice = event.data.object as Stripe.Invoice;
      const cust = customerId(invoice.customer);
      const subscriptionId = refId(invoice.parent?.subscription_details?.subscription);
      const userId = await resolveUserIdFromInvoice(admin, invoice);
      if (!userId) {
        console.error('stripe webhook: no profile for failed invoice', invoice.id);
        return { customerId: cust, subscriptionId };
      }
      // Only dun a RENEWAL of the sub currently on file. Skip `subscription_create` (the
      // initial signup charge — the sub is 'incomplete' and hosted Checkout handles that on
      // its own page). Skip if we can't identify the sub, or it isn't the one on file: a
      // stale/old failure — or one arriving after cancellation (id now null) — must NOT lock
      // a cancelled or newer-active account (event order isn't guaranteed).
      if (invoice.billing_reason === 'subscription_create' || !subscriptionId) {
        return { userId, customerId: cust, subscriptionId };
      }
      // Reflect past_due (agrees with the subscription.updated event; ordering-safe), for
      // the current sub only.
      await admin
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('id', userId)
        .eq('stripe_subscription_id', subscriptionId);
      // Anchor grace on the FIRST failure only: grace_until is the single-owner dunning
      // marker, so this guarded set (only where it's currently NULL) fires exactly once —
      // even if subscription.updated→past_due landed first (that never sets grace). A
      // returned row == first failure → send the branded "update your card" email (last,
      // best-effort). Later Smart-Retry failures see grace already set and stay silent.
      const graceUntil = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: firstFailure } = await admin
        .from('profiles')
        .update({ grace_until: graceUntil })
        .eq('id', userId)
        .eq('stripe_subscription_id', subscriptionId)
        .is('grace_until', null)
        .select('email, display_name, subscription_currency, subscription_plan')
        .maybeSingle();
      if (firstFailure?.email) {
        await sendPaymentFailedEmail({
          to: firstFailure.email,
          name: firstFailure.display_name ?? null,
          currency: firstFailure.subscription_currency,
          plan: firstFailure.subscription_plan,
          graceDays: GRACE_DAYS,
          idempotencyKey: `${event.id}:payment_failed`,
        });
      }
      return { userId, customerId: cust, subscriptionId };
    }
    case 'customer.subscription.trial_will_end': {
      // Fires ~3 days before the trial ends → send the branded trial-ending reminder.
      const sub = event.data.object as Stripe.Subscription;
      const cust = customerId(sub.customer);
      const userId = await resolveUserId(admin, sub);
      const ctx: EventContext = { userId, customerId: cust, subscriptionId: sub.id };
      // Skip if the trial is already scheduled to cancel — the user won't be charged, so a
      // "you'll be charged" reminder would be false (they got the cancellation email).
      if (!userId || sub.cancel_at != null) return ctx;
      const { data: prof } = await admin
        .from('profiles')
        .select('email, display_name, subscription_currency, subscription_plan, trial_reminder_sent')
        .eq('id', userId)
        .maybeSingle();
      // Belt-and-suspenders on top of stripe_events idempotency: only send once. Mark
      // handled FIRST (so a redelivery is guarded even if the send no-op'd), email LAST.
      if (prof?.email && prof.trial_reminder_sent !== 'trial_will_end') {
        await admin
          .from('profiles')
          .update({ trial_reminder_sent: 'trial_will_end' })
          .eq('id', userId);
        await sendTrialEndingEmail({
          to: prof.email,
          name: prof.display_name ?? null,
          currency: prof.subscription_currency,
          plan: prof.subscription_plan,
          idempotencyKey: `${event.id}:trial_ending`,
        });
      }
      return ctx;
    }
    case 'charge.dispute.created': {
      // A chargeback opened. Revoke access ONLY for a real dispute (funds moved) — a mere
      // inquiry (status warning_*) hasn't taken money, so it must not lock a legit customer.
      const dispute = event.data.object as Stripe.Dispute;
      const ctx = await resolveUserIdFromDispute(admin, dispute);
      if (ctx.userId && !dispute.status.startsWith('warning')) {
        await admin.from('profiles').update({ billing_blocked: true }).eq('id', ctx.userId);
      }
      return ctx;
    }
    case 'charge.dispute.funds_withdrawn': {
      // Funds actually pulled (a real chargeback, incl. an inquiry that escalated) → lock.
      const dispute = event.data.object as Stripe.Dispute;
      const ctx = await resolveUserIdFromDispute(admin, dispute);
      if (ctx.userId) {
        await admin.from('profiles').update({ billing_blocked: true }).eq('id', ctx.userId);
      }
      return ctx;
    }
    case 'charge.dispute.closed': {
      const dispute = event.data.object as Stripe.Dispute;
      const ctx = await resolveUserIdFromDispute(admin, dispute);
      if (!ctx.userId) return ctx;
      if (dispute.status === 'won') {
        // We won → restore access.
        await admin.from('profiles').update({ billing_blocked: false }).eq('id', ctx.userId);
      } else {
        // Lost → keep access revoked AND cancel the sub so it can't renew / re-dispute.
        const { data: prof } = await admin
          .from('profiles')
          .select('stripe_subscription_id')
          .eq('id', ctx.userId)
          .maybeSingle();
        if (prof?.stripe_subscription_id) {
          try {
            await getStripe().subscriptions.cancel(prof.stripe_subscription_id);
          } catch (err) {
            console.error('stripe webhook: cancel after lost dispute failed', ctx.userId, err);
          }
        }
      }
      return ctx;
    }
    case 'charge.dispute.funds_reinstated': {
      // Funds returned (dispute resolved in our favour) → restore access.
      const dispute = event.data.object as Stripe.Dispute;
      const ctx = await resolveUserIdFromDispute(admin, dispute);
      if (ctx.userId) {
        await admin.from('profiles').update({ billing_blocked: false }).eq('id', ctx.userId);
      }
      return ctx;
    }
    default:
      return {}; // acknowledged, no-op
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('stripe webhook: STRIPE_WEBHOOK_SECRET is not set');
    return new NextResponse('Webhook not configured', { status: 500 });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    // Bad signature (or tampered body) — reject so Stripe surfaces it, don't retry-loop.
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: claim the event id with an ON CONFLICT DO NOTHING upsert. Stripe
  // legitimately redelivers events, so a duplicate must be a clean no-op. `.select()`
  // returns the row only when THIS request won the claim; an empty result means the
  // id was already recorded → ack + skip so side effects happen exactly once. Using
  // ignoreDuplicates (rather than a plain insert that trips the primary-key
  // constraint) means a redelivery no longer logs a Postgres error. Concurrency-safe:
  // of two racing deliveries, exactly one gets the row back and processes the event.
  const { data: claimed, error: claimErr } = await admin
    .from('stripe_events')
    .upsert(
      { id: event.id, type: event.type },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    .select('id');
  if (claimErr) {
    console.error('stripe webhook: could not record event', claimErr);
    return new NextResponse('Storage error', { status: 500 }); // let Stripe retry
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  let ctx: EventContext;
  try {
    ctx = await handleEvent(admin, event);
  } catch (err) {
    console.error('stripe webhook: handler failed', event.type, err);
    // Release the claim so Stripe's automatic retry reprocesses this event.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return new NextResponse('Handler error', { status: 500 });
  }

  // Stamp the just-claimed ledger row with who/what this event resolved to, for
  // post-launch auditability (`select … from stripe_events where user_id = …`).
  // Best-effort: the event is already handled, so a failed enrich must not 500 (that
  // would make Stripe retry an event whose side effects already ran).
  if (ctx.userId || ctx.customerId || ctx.subscriptionId) {
    const { error: enrichErr } = await admin
      .from('stripe_events')
      .update({
        user_id: ctx.userId ?? null,
        stripe_customer_id: ctx.customerId ?? null,
        stripe_subscription_id: ctx.subscriptionId ?? null,
      })
      .eq('id', event.id);
    if (enrichErr) {
      console.error('stripe webhook: could not enrich event row', event.id, enrichErr);
    }
  }

  return NextResponse.json({ received: true });
}
