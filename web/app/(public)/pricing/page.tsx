import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import type { AccessDenialReason } from '@/lib/entitlement';
import { currencyForCountry, effectiveBillingCountry } from '@/lib/stripe';
import { hasUsedTrial } from '@/lib/trialGuard';
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
 * `?reason=…` is set by `requireEntitled()` when it bounces someone off a premium
 * page. Allow-listed rather than trusted: the value lands in rendered copy, and it
 * arrives from the URL bar where anyone can type anything. An unrecognised value is
 * dropped, so the page simply shows no banner.
 */
const DENIAL_REASONS = new Set<AccessDenialReason>([
  'no_subscription',
  'canceled',
  'payment_failed',
  'billing_blocked',
]);

function parseReason(raw: string | string[] | undefined): AccessDenialReason | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && DENIAL_REASONS.has(value as AccessDenialReason)
    ? (value as AccessDenialReason)
    : null;
}

/**
 * Public pricing shop-window (build-order step 3). Region currency is resolved
 * server-side: a signed-in user's saved country wins (it also locks their billing
 * currency), otherwise Vercel's edge geo header, otherwise USD. The signed-in state
 * decides whether the CTA starts checkout directly or routes a visitor to sign up.
 */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Why they were sent here, if they were sent (F3 Step 10). Without this the page
  // greeted a locked-out subscriber with the same generic shop-window as a first-time
  // visitor — "your payment failed" and "your trial ended" need to read differently.
  const params = await searchParams;
  const reason = parseReason(params.reason);
  // `?start=monthly|annual` — the plan they chose before signing up, round-tripped
  // through the confirmation email so the flow resumes instead of restarting.
  const rawStart = Array.isArray(params.start) ? params.start[0] : params.start;
  const startPlan =
    rawStart === 'monthly' || rawStart === 'annual' ? rawStart : null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let savedCountry: string | null = null;
  let hasSubscription = false;
  // Whether this signed-in visitor has already consumed their free trial (Step 7).
  // Only relevant when they have no live plan; drives the honest "billed today, no
  // free week" CTA + note so /pricing can't produce a surprise charge either.
  let trialUsed = false;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('country, subscription_status')
      .eq('id', user.id)
      .single();
    savedCountry = profile?.country ?? null;
    hasSubscription = ACTIVE_STATES.has(profile?.subscription_status ?? '');
    if (!hasSubscription) {
      trialUsed = await hasUsedTrial(createAdminClient(), user.email);
    }
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
      trialUsed={trialUsed}
      reason={reason}
      startPlan={startPlan}
    />
  );
}
