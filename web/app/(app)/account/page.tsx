import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { currencyForCountry } from '@/lib/stripe';
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

// Friendly messages for a return from /api/portal that couldn't open the portal.
const BILLING_NOTICE: Record<string, string> = {
  error:
    'We couldn’t open billing management just now. Please try again in a moment.',
  none: 'There’s no billing to manage on your account yet.',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing } = await searchParams;
  const billingNotice = (billing && BILLING_NOTICE[billing]) || null;

  const supabase = await createServerSupabaseClient();

  // Full user (not just claims) — we need the email + identity providers to
  // detect Google-only accounts (which have no password to manage).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, country, subscription_status, subscription_plan, trial_ends_at'
    )
    .eq('id', user.id)
    .single();

  const email = user.email ?? '';
  const hasPasswordIdentity =
    user.identities?.some((i) => i.provider === 'email') ?? false;
  const countryLocked = COUNTRY_LOCK_STATES.has(
    profile?.subscription_status ?? ''
  );

  // Billing currency for the in-app "Start free trial" modal. Mirrors /pricing:
  // the user's saved country wins (it also locks their billing currency),
  // otherwise Vercel's edge geo header, otherwise USD.
  let billingCountry = profile?.country ?? null;
  if (!billingCountry) {
    const hdrs = await headers();
    billingCountry = hdrs.get('x-vercel-ip-country');
  }
  const currency = currencyForCountry(billingCountry);

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
          countryLocked={countryLocked}
        />

        <SubscriptionCard
          status={profile?.subscription_status ?? null}
          plan={profile?.subscription_plan ?? null}
          trialEndsAt={profile?.trial_ends_at ?? null}
          currency={currency}
          notice={billingNotice}
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
