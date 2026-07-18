import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { currencyForCountry, effectiveBillingCountry } from '@/lib/stripe';
import { PricingPlans } from './PricingPlans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start a 7-day free trial of MajorCycle. Monthly or annual — cancel anytime, no charge until day 7. Educational analysis only, not financial advice.',
};

export const dynamic = 'force-dynamic';

// Subscription statuses that mean "already has a live plan" — the CTA becomes
// "Manage your plan" rather than "Start free trial".
const ACTIVE_STATES = new Set(['active', 'trialing', 'past_due']);

/**
 * Public pricing shop-window (build-order step 3). Region currency is resolved
 * server-side: a signed-in user's saved country wins (it also locks their billing
 * currency), otherwise Vercel's edge geo header, otherwise USD. The signed-in state
 * decides whether the CTA starts checkout directly or routes a visitor to sign up.
 */
export default async function PricingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let savedCountry: string | null = null;
  let hasSubscription = false;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('country, subscription_status')
      .eq('id', user.id)
      .single();
    savedCountry = profile?.country ?? null;
    hasSubscription = ACTIVE_STATES.has(profile?.subscription_status ?? '');
  }

  // Edge geo (Vercel sets this at the CDN, ISO alpha-2). Null on localhost.
  const hdrs = await headers();
  const edgeCountry = hdrs.get('x-vercel-ip-country');

  // Same resolution as the account trial modal and /api/checkout, so the price
  // shown here equals the currency Stripe will charge.
  const currency = currencyForCountry(
    effectiveBillingCountry(savedCountry, edgeCountry),
  );

  return (
    <PricingPlans
      currency={currency}
      isLoggedIn={Boolean(user)}
      hasSubscription={hasSubscription}
    />
  );
}
