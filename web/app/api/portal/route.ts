import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSiteURL } from '@/lib/url';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/portal — open the Stripe Customer Portal for the signed-in user.
 *
 * The portal is Stripe's own hosted page where a customer updates their card,
 * switches monthly⇄annual, sees invoices, or cancels (cancel-at-period-end).
 * We create a short-lived portal session and 303-redirect straight to it, so the
 * `/account` "Manage billing" button can be a plain form POST — no client JS, no
 * Stripe key ever near the browser (same shape as the checkout route + the
 * sign-out form). On the way back, Stripe returns the user to /account.
 *
 * Auth is enforced by proxy.ts (this path is NOT in PUBLIC_PATHS); we re-check the
 * user here too (defence in depth). See plan §5 and docs/data-contracts.md §10.
 */

export const dynamic = 'force-dynamic';

/**
 * Every branch below is a per-caller answer, and the 303's `Location` is the most
 * sensitive thing this app hands out: a live Customer Portal session granting that one
 * customer's card, invoices and cancel button. Route handlers get NO Cache-Control from
 * Next (unlike pages, which get `no-cache, must-revalidate`), so without this the
 * response says nothing at all about caching.
 *
 * Nothing was ever exposed — Vercel's CDN caches only on `s-maxage`/`stale-while-revalidate`
 * and these are POSTs carrying neither. That is exactly the problem: the safety rested on
 * someone else's default rather than on anything we said, which is the failure CLAUDE.md
 * 11a now records THREE times ("say it AND guard it"). Found in live-check Session 3 by
 * reading the headers at the wire; `pnpm check:entitlement-gates` now asserts it.
 */
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

export async function POST(request: Request) {
  // Return to the SAME origin the request came from, so a Vercel preview lands
  // back on the preview and prod on prod (mirrors the checkout route).
  const origin = request.headers.get('origin') ?? getSiteURL();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`, { status: 303, headers: NO_STORE });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, billing_blocked')
    .eq('id', user.id)
    .single();

  // The portal is a second way to spend money — it switches monthly⇄annual (which
  // prorates and charges) and can resume a cancelled subscription. A held account
  // must be refused here for the same reason /api/checkout refuses it: billing_blocked
  // outranks any subscription status, so anything bought while held is paid for and
  // still locked. /account no longer renders this button for a held user, but the
  // endpoint must not depend on the UI hiding it.
  if (profile?.billing_blocked) {
    return NextResponse.redirect(`${origin}/account?billing=blocked`, {
      status: 303,
      headers: NO_STORE,
    });
  }

  const customerId = profile?.stripe_customer_id;
  if (!customerId) {
    // No Stripe customer on file → the user has never checked out, so there is
    // nothing to manage. Send them back with a gentle flag (should be rare: the
    // button only shows for subscribed states, which always have a customer id).
    return NextResponse.redirect(`${origin}/account?billing=none`, {
      status: 303,
      headers: NO_STORE,
    });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account`,
    });
    return NextResponse.redirect(session.url, { status: 303, headers: NO_STORE });
  } catch (err) {
    // Most likely cause in a fresh mode: no active Customer Portal configuration
    // in THIS Stripe mode yet. Log the real reason (owner can't debug a blank
    // failure) and return the user to /account with a clean, retryable message.
    console.error('portal: could not create billing portal session', err);
    return NextResponse.redirect(`${origin}/account?billing=error`, {
      status: 303,
      headers: NO_STORE,
    });
  }
}
