import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { currencyForCountry, effectiveBillingCountry } from '@/lib/stripe';
import { hasUsedTrial } from '@/lib/trialGuard';

/**
 * What the upgrade dialog needs to offer the RIGHT thing to THIS reader (F3 Step 10).
 *
 * Fetched when a lock is opened rather than plumbed through every page: the tombstone
 * lookup is a DB round-trip, and a lock is clicked far less often than a page is
 * rendered. Paying for it on click keeps it off the critical path of every free
 * Stock Detail view.
 *
 * Deliberately NOT a source of truth for anything. /api/checkout re-derives all three
 * facts server-side and is the authority — it 409s an existing subscriber and omits
 * `trial_period_days` for a tombstoned email regardless of what this said. This exists
 * so the UI can be honest BEFORE the click, not so it can be trusted after it.
 */
export const dynamic = 'force-dynamic';

const ACTIVE_STATES = new Set(['active', 'trialing', 'past_due']);

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('country, subscription_status, billing_blocked, display_name')
    .eq('id', user.id)
    .single();

  const hasSubscription = ACTIVE_STATES.has(profile?.subscription_status ?? '');
  // Surfaced so a locked feature can say WHY it's locked. A disputed account must
  // never be shown an upsell: /api/checkout 403s it anyway, so offering a plan would
  // be an offer we refuse at the till.
  const billingBlocked = !!profile?.billing_blocked;
  // Only relevant when there's no live plan — and skipping it there also skips a
  // pointless admin-client read for the majority case.
  const trialUsed = hasSubscription
    ? false
    : await hasUsedTrial(createAdminClient(), user.email);

  const hdrs = await headers();
  const currency = currencyForCountry(
    effectiveBillingCountry(profile?.country ?? null, hdrs.get('x-vercel-ip-country')),
  );

  return NextResponse.json(
    {
      currency,
      trialUsed,
      hasSubscription,
      billingBlocked,
      // Prefill the in-place support dialog, so the lock path matches the account
      // page rather than asking a signed-in reader who they are.
      email: user.email ?? null,
      displayName: profile?.display_name ?? null,
    },
    // Per-viewer billing state — must never touch a shared cache (CLAUDE.md 11a).
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
