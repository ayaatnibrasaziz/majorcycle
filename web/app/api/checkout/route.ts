import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSiteURL } from '@/lib/url';
import {
  getStripe,
  resolvePriceId,
  currencyForCountry,
  TRIAL_PERIOD_DAYS,
  type PlanKey,
} from '@/lib/stripe';

/**
 * POST /api/checkout — start a subscription via Stripe hosted Checkout.
 *
 * Auth is enforced by proxy.ts (this path is NOT in PUBLIC_PATHS); we re-check the
 * user here anyway (defence in depth — never trust the middleware alone). The body
 * is `{ plan: 'monthly' | 'annual' }`. We resolve the Price by lookup_key, force the
 * charge currency from the user's country (AU→AUD, CA→CAD, else USD — locked), apply
 * the 7-day trial in code (not on the Price), and return `{ url }` for the browser to
 * redirect to. NO Stripe secret ever reaches the client — hosted Checkout is a plain
 * redirect. See plan §2 and docs/data-contracts.md §10.
 */

export const dynamic = 'force-dynamic';

// Statuses that already have (or recently had) a live subscription — starting a
// second checkout would create a duplicate. These are sent to billing management
// instead. `canceled`/null may start a fresh subscription.
const ACTIVE_STATES = new Set(['active', 'trialing', 'past_due']);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
  const plan = body?.plan;
  if (plan !== 'monthly' && plan !== 'annual') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('country, stripe_customer_id, subscription_status')
    .eq('id', user.id)
    .single();

  // Already subscribed → don't let them stack a second subscription.
  if (ACTIVE_STATES.has(profile?.subscription_status ?? '')) {
    return NextResponse.json(
      { error: 'You already have a subscription. Manage it from your account.' },
      { status: 409 },
    );
  }

  const currency = currencyForCountry(profile?.country);

  let priceId: string;
  try {
    priceId = await resolvePriceId(plan as PlanKey);
  } catch (err) {
    // Missing price = the product/prices weren't built in THIS Stripe mode
    // (test vs live are isolated). Log the real cause (owner can't debug a blank
    // 500), but surface a clean message — never a stack trace — to the user.
    console.error('checkout: could not resolve price', plan, err);
    return NextResponse.json(
      { error: 'Billing is temporarily unavailable. Please try again shortly.' },
      { status: 500 },
    );
  }

  // Return to the SAME origin the request came from — so a Vercel preview deploy
  // lands back on the preview (not production), and prod lands on prod. Falls back
  // to the canonical site URL for any caller without an Origin header.
  const origin = request.headers.get('origin') ?? getSiteURL();

  // TODO (F3 build-step 7 — trial-abuse guard): before creating the session, hash
  // the user's email and, if it matches a `trial_tombstones` row, omit the trial so
  // a repeat customer subscribes with no free week (locked decision C). For now every
  // eligible checkout gets the 7-day trial.

  const stripeCustomerId = profile?.stripe_customer_id ?? null;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Force the multi-currency Price to charge (and lock) this currency.
      currency,
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        // Carried on the subscription so the webhook can map it back to our user
        // even if the Customer was created fresh by Checkout.
        metadata: { user_id: user.id },
      },
      // Reuse the existing Customer if we have one; otherwise let Checkout create it
      // and prefill the email (the webhook captures the new id). `customer` and
      // `customer_email` are mutually exclusive, so only ever set one.
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: user.email ?? undefined }),
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      // NO `payment_method_types` (Stripe guidance — omit so eligible methods show
      // dynamically; the owner tunes them in Dashboard → Payment methods).
      // Tax stays OFF at launch — one-line flip when GST registration lands (decision D).
      automatic_tax: { enabled: false },
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Could not start checkout. Please try again.' },
        { status: 502 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // A Stripe API / network failure — log the real error for diagnosis, return a
    // clean retry message to the user (no internal details leak).
    console.error('checkout: stripe session create failed', err);
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 502 },
    );
  }
}
