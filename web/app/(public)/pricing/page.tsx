import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { currencyForCountry, effectiveBillingCountry } from '@/lib/stripe';
import { PricingPlans } from './PricingPlans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start a 7-day free trial of MajorCycle. Monthly or annual — cancel anytime, no charge until day 7. Educational analysis only, not financial advice.',
};

export const dynamic = 'force-dynamic';

/**
 * Public pricing shop-window — for signed-out visitors only (owner decision, 2026-07-29).
 *
 * A SIGNED-IN reader is redirected to /account. Everything this page could tell them
 * about their own billing — that they already have a plan, that their trial is used,
 * that a dispute has put the account on hold — is told better on /account, beside the
 * actions that change it, inside the app shell they are already in. Sending them here
 * instead used to strip away the sidebar, the header and the account menu, so the page
 * read as if they had been logged out.
 *
 * That redirect is what lets this page be unconditional. It previously branched on
 * `?reason=`, `billing_blocked`, `hasSubscription` and `trialUsed`; none of those
 * readers can arrive any more, and an unreachable branch about someone's money is a
 * branch that can quietly become wrong.
 *
 * Region currency is resolved server-side from Vercel's edge geo header (USD elsewhere),
 * so the sticker price matches what Stripe will charge.
 */
export default async function PricingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /account shows them their real state, whatever it is. Nothing is carried across —
  // the account page already says the right thing on its own.
  if (user) redirect('/account');

  // Edge geo (Vercel sets this at the CDN, ISO alpha-2). Null on localhost.
  const hdrs = await headers();
  const currency = currencyForCountry(
    effectiveBillingCountry(null, hdrs.get('x-vercel-ip-country')),
  );

  return <PricingPlans currency={currency} />;
}
