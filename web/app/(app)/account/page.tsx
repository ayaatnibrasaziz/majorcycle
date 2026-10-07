import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { hasAccess } from '@/lib/entitlement';
import { reconcileCheckoutSession } from '@/lib/billing/reconcileCheckout';
import { fillNextCharge, nextChargeAction } from '@/lib/billing/sync';
import { TRIAL_PERIOD_DAYS, currencyForCountry, effectiveBillingCountry } from '@/lib/stripe';
import { hasUsedTrial } from '@/lib/trialGuard';
import { ProfileForm } from '@/components/account/ProfileForm';
import { SubscriptionCard, type NoticeTone } from '@/components/account/SubscriptionCard';
import { LocalDate } from '@/components/LocalDate';
import { PasswordForm } from '@/components/account/PasswordForm';
import { ReferAFriendCard } from '@/components/account/ReferAFriendCard';
import { DeleteAccountCard } from '@/components/account/DeleteAccountCard';
import { deletionSubscriptionKindToday } from '@/lib/deletionSubscription';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/lib/account';

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
  cancelled: 'Checkout cancelled. You haven’t been charged.',
};

// `success` is deliberately NOT in the map above: what to say depends on whether the
// plan actually landed, which isn't known until the reconciler has run and the profile
// has been read. Asserting "your plan is set up below" from the URL alone put that
// sentence directly above a card reading "NO PLAN" — and it did so precisely in the
// case the reconciler exists for (Stripe slow or erroring AND the webhook not yet
// arrived). Telling a paying customer both at once is worse than either alone.
//
// ⚠️ And it depends on WHICH plan landed (beta review D-2, 2026-10-03): a free trial
// charges nothing, so "Payment received" told a trial customer they had paid. The
// message now follows the status the card below will show.
const CHECKOUT_SUCCESS_NOTICE = 'Payment received — your plan is set up below.';
const CHECKOUT_SUCCESS_PENDING_NOTICE =
  'Setting up your plan. Refresh in a few seconds and it’ll appear. Nothing further is needed from you.';

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
  searchParams: Promise<{ billing?: string; checkout?: string; session_id?: string; plan?: string }>;
}) {
  const { billing, checkout, session_id: sessionId, plan: chosenPlan } = await searchParams;
  // The plan picked on /pricing before signing up (beta review A-4). Anything else is ignored.
  const initialPlan = chosenPlan === 'annual' ? 'annual' : chosenPlan === 'monthly' ? 'monthly' : undefined;

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
  const reconciled =
    checkout === 'success' && sessionId
      ? await reconcileCheckoutSession(sessionId, user.id)
      : false;

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, country, subscription_status, subscription_plan, trial_ends_at, cancel_at_period_end, current_period_end, billing_blocked, grace_until, stripe_subscription_id, next_charge_amount, next_charge_currency, next_charge_plan'
    )
    .eq('id', user.id)
    .single();

  // Stripe's own figure for the next charge (lib/billing/sync.ts). Normally stored on
  // every Stripe change; filled in here, once, when a renewing plan has none yet.
  let nextCharge =
    profile?.next_charge_amount != null && profile.next_charge_currency
      ? {
          amount: profile.next_charge_amount,
          currency: profile.next_charge_currency,
          plan: (profile.next_charge_plan ?? null) as 'monthly' | 'annual' | null,
        }
      : null;
  if (
    !nextCharge &&
    profile?.stripe_subscription_id &&
    nextChargeAction(profile.subscription_status, profile.cancel_at_period_end ?? false) === 'preview'
  ) {
    nextCharge = await fillNextCharge(createAdminClient(), user.id, profile.stripe_subscription_id);
  }

  // `grace_until` is selected purely so the Subscription card can tell the two
  // halves of `past_due` apart. Without it the card read the status alone and told a
  // reader whose grace window had closed to "update your card to keep access" — the
  // access was already gone. Reuses the shared rule so the card, the sidebar badge
  // and the paywall can never disagree about who is entitled.
  const entitled = hasAccess(profile);

  // Only claim the plan is "set up below" when the card below will actually show one.
  // Either half is enough: the reconciler provisioned it, or the webhook already had.
  // Otherwise the payment is confirmed but provisioning is still in flight, and we say
  // exactly that rather than pointing at a card that reads "No plan".
  const liveStatus = profile?.subscription_status ?? null;
  let checkoutNotice: ReactNode = null;
  let noticeTone: NoticeTone = 'warning';
  if (checkout === 'success') {
    if (liveStatus === 'trialing') {
      noticeTone = 'info';
      checkoutNotice = profile?.trial_ends_at ? (
        <>
          <b>Your {TRIAL_PERIOD_DAYS}-day free trial has started.</b> You won’t be charged
          until <LocalDate iso={profile.trial_ends_at} fallback="the trial ends" />.
        </>
      ) : (
        <b>Your {TRIAL_PERIOD_DAYS}-day free trial has started.</b>
      );
    } else if (liveStatus === 'active') {
      noticeTone = 'success';
      checkoutNotice = CHECKOUT_SUCCESS_NOTICE;
    } else if (!liveStatus && !reconciled) {
      noticeTone = 'info';
      checkoutNotice = CHECKOUT_SUCCESS_PENDING_NOTICE;
    }
    // Cancelled / lapsed / past-due: nothing to celebrate — the card says what is true.
  }

  // A held account's card already says the same thing in full, so the portal's
  // "blocked" bounce adds nothing but the sentence twice, one above the other.
  const billingNotice =
    billing === 'blocked' && profile?.billing_blocked ? null : billing && BILLING_NOTICE[billing];
  const notice: ReactNode =
    checkoutNotice ||
    (checkout && CHECKOUT_NOTICE[checkout]) ||
    billingNotice ||
    null;
  if (!checkoutNotice && notice) noticeTone = 'warning';

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

      <div className="flex flex-col gap-4">
        <ProfileForm
          email={email}
          initialDisplayName={profile?.display_name ?? ''}
          initialCountry={profile?.country ?? ''}
          suggestedCountry={edgeCountry ?? ''}
          countryLocked={countryLocked}
        />

        <SubscriptionCard
          initialPlan={initialPlan}
          status={profile?.subscription_status ?? null}
          plan={profile?.subscription_plan ?? null}
          trialEndsAt={profile?.trial_ends_at ?? null}
          cancelAtPeriodEnd={profile?.cancel_at_period_end ?? false}
          currentPeriodEnd={profile?.current_period_end ?? null}
          currency={currency}
          trialUsed={trialUsed}
          notice={notice}
          billingBlocked={profile?.billing_blocked ?? false}
          entitled={entitled}
          displayName={profile?.display_name ?? ''}
          email={email}
          nextChargeAmount={nextCharge?.amount ?? null}
          nextChargeCurrency={nextCharge?.currency ?? null}
          nextChargePlan={nextCharge?.plan ?? null}
          graceUntil={profile?.grace_until ?? null}
          noticeTone={noticeTone}
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
          subscription={deletionSubscriptionKindToday(
            {
              subscription_status: profile?.subscription_status ?? null,
              billing_blocked: profile?.billing_blocked ?? false,
              current_period_end: profile?.current_period_end ?? null,
            },
            ACCOUNT_DELETION_GRACE_DAYS,
          )}
        />
      </div>
    </div>
  );
}
