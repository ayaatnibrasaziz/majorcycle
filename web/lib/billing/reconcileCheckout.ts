import 'server-only';

import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { customerId, refId, syncSubscription } from '@/lib/billing/sync';

/**
 * Close the gap between paying and the webhook landing (F3 Step 10, 2026-07-29).
 *
 * WHY THIS EXISTS. Stripe sends `checkout.session.completed` BEFORE redirecting the
 * customer, and holds the redirect until our endpoint answers 2xx — but only for **10
 * seconds**. After that the customer is redirected regardless. So if our webhook is slow,
 * failing, or its secret is misconfigured, someone who has just paid lands on /account
 * reading "No plan" with a "Start free trial" button. They have been charged and we are
 * telling them they have nothing. That is the worst failure this product can have.
 *
 * Stripe's documented answer is belt-and-braces: keep the webhook as the guarantee (the
 * customer might close the tab and never load the landing page), AND reconcile on the
 * landing page so the common case is instant and correct.
 * https://docs.stripe.com/checkout/fulfillment
 *
 * SAFETY. `session_id` arrives in the URL bar, where anyone can type anything, so this
 * NEVER trusts it as proof of anything. It retrieves the session from Stripe and refuses
 * unless the session's own `client_reference_id`/`metadata.user_id` — both stamped by
 * /api/checkout at creation — match the signed-in caller. Pasting someone else's session
 * id therefore does nothing at all.
 *
 * FRESHNESS. It re-retrieves the SUBSCRIPTION from Stripe rather than using the copy
 * embedded in the session, so a stale session can't write a stale status over a newer one
 * the webhook already recorded. This is also Stripe's general advice: fetch current state
 * from the API instead of trusting a payload.
 *
 * IDEMPOTENCE. `syncSubscription` is a full overwrite derived from the subscription, so
 * running it after the webhook already ran is a no-op that writes the same values.
 *
 * FAILURE. Best-effort throughout: this runs during a page render, and a Stripe outage
 * must never turn "your payment worked" into an error page. On failure we log and return
 * false; the webhook (which Stripe retries for up to 3 days) remains the guarantee.
 */
export async function reconcileCheckoutSession(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  // Cheap sanity check before spending a Stripe call on arbitrary URL input.
  if (!sessionId.startsWith('cs_') || sessionId.length > 200) return false;

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    // Ownership. Both fields are set by /api/checkout; either one matching is proof,
    // and neither matching means this session isn't ours to act on.
    const owner = session.client_reference_id ?? session.metadata?.['user_id'] ?? null;
    if (owner !== userId) {
      console.error('reconcileCheckout: session does not belong to caller', sessionId);
      return false;
    }

    // `complete` means Checkout finished. For a 7-day trial no money moves yet, so
    // payment_status is `no_payment_required` — treating that as unpaid would refuse to
    // provision exactly the flow we sell.
    if (session.status !== 'complete') return false;

    const admin = createAdminClient();

    // Link the customer even if the subscription isn't readable yet — this is the same
    // thing the `checkout.session.completed` handler does, and it's what lets every
    // later customer-keyed lookup resolve.
    const cust = customerId(session.customer);
    if (cust) {
      await admin.from('profiles').update({ stripe_customer_id: cust }).eq('id', userId);
    }

    const subId = refId(session.subscription);
    if (!subId) return false;

    const sub = await getStripe().subscriptions.retrieve(subId);
    await syncSubscription(admin, sub);
    return true;
  } catch (err) {
    // Logged, never surfaced: the customer's payment DID succeed, and the webhook will
    // land. An error here is our problem to see, not theirs.
    console.error('reconcileCheckout: could not reconcile', sessionId, err);
    return false;
  }
}
