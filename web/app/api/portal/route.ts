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

export async function POST(request: Request) {
  // Return to the SAME origin the request came from, so a Vercel preview lands
  // back on the preview and prod on prod (mirrors the checkout route).
  const origin = request.headers.get('origin') ?? getSiteURL();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`, { status: 303 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  const customerId = profile?.stripe_customer_id;
  if (!customerId) {
    // No Stripe customer on file → the user has never checked out, so there is
    // nothing to manage. Send them back with a gentle flag (should be rare: the
    // button only shows for subscribed states, which always have a customer id).
    return NextResponse.redirect(`${origin}/account?billing=none`, {
      status: 303,
    });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account`,
    });
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    // Most likely cause in a fresh mode: no active Customer Portal configuration
    // in THIS Stripe mode yet. Log the real reason (owner can't debug a blank
    // failure) and return the user to /account with a clean, retryable message.
    console.error('portal: could not create billing portal session', err);
    return NextResponse.redirect(`${origin}/account?billing=error`, {
      status: 303,
    });
  }
}
