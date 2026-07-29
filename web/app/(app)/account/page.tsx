import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { reconcileCheckoutSession } from '@/lib/billing/reconcileCheckout';
import { currencyForCountry, effectiveBillingCountry } from '@/lib/stripe';
import { hasUsedTrial } from '@/lib/trialGuard';
import { ProfileForm } from '@/components/account/ProfileForm';
import { SubscriptionCard } from '@/components/account/SubscriptionCard';
import { PasswordForm } from '@/components/account/PasswordForm';
import { ReferAFriendCard } from '@/components/account/ReferAFriendCard';
import { DeleteAccountCard } from '@/components/account/DeleteAccountCard';

export const metadata: Metadata = {
  title: 'Account',
  description: 'Manage your MajorCycle profile, subscription, and password.',
};

export const dynamic = 'force-dynamic';

// Subscription states that pin the account's country (Stripe fixes currency per
// subscription — F3). While in one of these, the country field is read-only.
const COUNTRY_LOCK_STATES = new Set(['active', 'trialing', 'past_due']);

// Returning from Stripe Checkout. Success is deliberately understated — the Subscription
// card right below states the real status, and this only needs to confirm the payment
// landed. Cancelling must say "not charged" out loud: someone who backed out of a payment
// page wants that in writing.
const CHECKOUT_NOTICE: Record<string, string> = {
  success: 'Payment received — your plan is set up below.',
  cancelled: 'Checkout cancelled. You haven’t been charged.',
};

// Friendly messages for a return from /api/portal that couldn't open the portal.
const BILLING_NOTICE: Record<string, string> = {
  error:
    'We couldn’t open billing management just now. Please try again in a moment.',
  none: 'There’s no billing to manage on your account yet.',
  blocked:
    'Billing management is unavailable while a payment dispute is being resolved. Contact support and we’ll sort it out with you.',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; checkout?: string; session_id?: string }>;
}) {
  const { billing, checkout, session_id: sessionId } = await searchParams;
  const notice =
    (checkout && CHECKOUT_NOTICE[checkout]) ||
    (billing && BILLING_NOTICE[billing]) ||
    null;

  const supabase = await createServerSupabaseClient();

  // Full user (not just claims) — we need the email + identity providers to
  // detect Google-only accounts (which have no password to manage).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Just back from Stripe Checkout: reconcile BEFORE reading the profile, so the card
  // below shows the plan they just bought rather than "No plan". Stripe holds the
  // redirect for our webhook's 2xx but gives up after 10 seconds, so this is what stops
  // a paying customer being told they have nothing. Ownership of `session_id` is proven
  // against the session itself — see lib/billing/reconcileCheckout.ts. Best-effort: the
  // webhook (retried by Stripe for 3 days) remains the guarantee.
  if (checkout === 'success' && sessionId) {
    await reconcileCheckoutSession(sessionId, user.id);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, country, subscription_status, subscription_plan, trial_ends_at, cancel_at_period_end, current_period_end, billing_blocked'
    )
    .eq('id', user.id)
    .single();

  const email = user.email ?? '';
  const hasPasswordIdentity =
    user.identities?.some((i) => i.provider === 'email') ?? false;
  const countryLocked = COUNTRY_LOCK_STATES.has(
    profile?.subscription_status ?? ''
  );

  // Billing currency for the in-app "Start free trial" modal, and the auto-fill
  // suggestion for the country dropdown. The saved country wins (it also locks
  // the billing currency); only when there's none do we consult Vercel's edge geo
  // header (empty on localhost). `edgeCountry` is passed to the form as a
  // changeable default when nothing is saved yet — never written until the user
  // saves or starts a trial.
  const savedCountry = profile?.country ?? null;
  let edgeCountry: string | null = null;
  if (!savedCountry) {
    const hdrs = await headers();
    edgeCountry = hdrs.get('x-vercel-ip-country');
  }
  const currency = currencyForCountry(effectiveBillingCountry(savedCountry, edgeCountry));

  // Only a user with no live subscription can start a trial; for them, check whether
  // this email has already consumed one (Step 7 tombstone). If so, the trial modal
  // tells them — before payment — that subscribing is billed today, no free week.
  const subStatus = profile?.subscription_status ?? null;
  const trialUsed =
    !subStatus || subStatus === 'canceled'
      ? await hasUsedTrial(createAdminClient(), user.email)
      : false;

  return (
    <div className="max-w-3xl">
      {/* The visible page title comes from the app Header (topbar). Keep an
          sr-only h1 for the document outline / screen readers — matching the
          other app pages (Results, Request a Ticker). */}
      <h1 className="sr-only">Account</h1>

      <div className="flex flex-col gap-4">
        <ProfileForm
          email={email}
          initialDisplayName={profile?.display_name ?? ''}
          initialCountry={profile?.country ?? ''}
          suggestedCountry={edgeCountry ?? ''}
          countryLocked={countryLocked}
        />

        <SubscriptionCard
          status={profile?.subscription_status ?? null}
          plan={profile?.subscription_plan ?? null}
          trialEndsAt={profile?.trial_ends_at ?? null}
          cancelAtPeriodEnd={profile?.cancel_at_period_end ?? false}
          currentPeriodEnd={profile?.current_period_end ?? null}
          currency={currency}
          trialUsed={trialUsed}
          notice={notice}
          billingBlocked={profile?.billing_blocked ?? false}
          displayName={profile?.display_name ?? ''}
          email={email}
        />

        {hasPasswordIdentity ? (
          <PasswordForm email={email} />
        ) : (
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Password</h2>
            </div>
            <div className="card-body">
              <div className="flex items-start gap-2.5 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                <KeyRound
                  className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--text-muted)]"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <p>
                  You sign in with Google, so there&apos;s no password to manage
                  here. Manage your sign-in security in your Google account.
                </p>
              </div>
            </div>
          </section>
        )}

        <ReferAFriendCard initialName={profile?.display_name ?? ''} />

        <DeleteAccountCard
          subscriptionStatus={profile?.subscription_status ?? null}
        />
      </div>
    </div>
  );
}
