import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { getStripe, mapStripeStatus, planFromLookupKey } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';

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
 * our user; invoices flip active/past_due + the grace clock. Not yet handled (later
 * steps, deliberately): trial-tombstone writes + card-fingerprint guard (step 7),
 * billing emails (step 8), dispute events (step 8) — subscribing to those now is safe,
 * they're acknowledged as no-ops.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GRACE_DAYS = 3;

type Admin = ReturnType<typeof createAdminClient>;

function toISO(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

function customerId(
  c: string | { id: string } | null | undefined,
): string | null {
  if (!c) return null;
  return typeof c === 'string' ? c : c.id;
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

/** Write the full subscription state onto the owning profile (idempotent). */
async function syncSubscription(
  admin: Admin,
  sub: Stripe.Subscription,
): Promise<void> {
  const userId = await resolveUserId(admin, sub);
  if (!userId) {
    console.error('stripe webhook: no profile for subscription', sub.id);
    return;
  }

  const item = sub.items.data[0];
  const status = mapStripeStatus(sub.status);
  const patch: Record<string, unknown> = {
    stripe_customer_id: customerId(sub.customer),
    stripe_subscription_id: sub.id,
    subscription_status: status,
    subscription_plan: planFromLookupKey(item?.price?.lookup_key),
    subscription_currency: sub.currency ?? null,
    current_period_end: toISO(item?.current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    trial_ends_at: toISO(sub.trial_end),
  };
  // Healthy states clear the 3-day payment-failure grace clock.
  if (status === 'active' || status === 'trialing') patch['grace_until'] = null;

  await admin.from('profiles').update(patch).eq('id', userId);
}

/** Subscription ended for good → lapse to a free (canceled) account. */
async function markCanceled(admin: Admin, sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserId(admin, sub);
  if (!userId) {
    console.error('stripe webhook: no profile for canceled subscription', sub.id);
    return;
  }
  await admin
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      trial_ends_at: null,
      grace_until: null,
      cancel_at_period_end: false,
    })
    .eq('id', userId);
}

/** Route a verified event to its handler. Unknown/deferred types are no-op (acked). */
async function handleEvent(admin: Admin, event: Stripe.Event): Promise<void> {
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
      // TODO (step 7): write the trial tombstone (email hash + card fingerprint).
      // TODO (step 8): send the trial-started / subscription-confirmed email.
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscription(admin, event.data.object as Stripe.Subscription);
      return;
    case 'customer.subscription.deleted':
      await markCanceled(admin, event.data.object as Stripe.Subscription);
      return;
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
      const userId = await resolveUserIdFromInvoice(admin, invoice);
      if (!userId) {
        console.error('stripe webhook: no profile for paid invoice', invoice.id);
        return;
      }
      await admin.from('profiles').update({ grace_until: null }).eq('id', userId);
      await admin
        .from('profiles')
        .update({ subscription_status: 'active' })
        .eq('id', userId)
        .eq('subscription_status', 'past_due');
      return;
    }
    case 'invoice.payment_failed': {
      // Past_due + open the 3-day grace window before the hard lock.
      const invoice = event.data.object as Stripe.Invoice;
      const userId = await resolveUserIdFromInvoice(admin, invoice);
      if (!userId) {
        console.error('stripe webhook: no profile for failed invoice', invoice.id);
        return;
      }
      const graceUntil = new Date(
        Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      await admin
        .from('profiles')
        .update({ subscription_status: 'past_due', grace_until: graceUntil })
        .eq('id', userId);
      // TODO (step 8): send the branded "payment failed — update your card" email.
      return;
    }
    case 'customer.subscription.trial_will_end':
      // Backup only — the primary day-5/day-7 reminders are cron-driven (step 8).
      // Recorded in stripe_events for observability; no DB write.
      return;
    // TODO (step 8): charge.dispute.created/.closed/.funds_withdrawn/.funds_reinstated
    // → set/clear billing_blocked (revoke access on dispute, restore only if won).
    default:
      return; // acknowledged, no-op
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

  // Idempotency: claim the event id. A duplicate delivery hits the primary-key
  // conflict (23505) → ack + skip so side effects happen exactly once.
  const { error: claimErr } = await admin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });
  if (claimErr) {
    if (claimErr.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('stripe webhook: could not record event', claimErr);
    return new NextResponse('Storage error', { status: 500 }); // let Stripe retry
  }

  try {
    await handleEvent(admin, event);
  } catch (err) {
    console.error('stripe webhook: handler failed', event.type, err);
    // Release the claim so Stripe's automatic retry reprocesses this event.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return new NextResponse('Handler error', { status: 500 });
  }

  return NextResponse.json({ received: true });
}
