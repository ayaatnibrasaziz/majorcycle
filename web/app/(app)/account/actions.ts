'use server';

import { redirect } from 'next/navigation';

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { sendDeletionScheduledEmail } from '@/lib/email/accountEmails';
import { sendReferralEmail } from '@/lib/email/referralEmails';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/lib/account';

/** Refer-a-friend limits (F2 Part C). */
const REFERRALS_PER_DAY = 10;
const REFERRAL_DEDUPE_DAYS = 30;

/**
 * Subscription states that pin the account's country (Stripe fixes the billing
 * currency per subscription — F3). While in one of these, country can't change.
 * Mirrors the same set in the account page (server is the authority).
 */
const COUNTRY_LOCK_STATES = new Set(['active', 'trialing', 'past_due']);

/**
 * Save the signed-in user's profile (display name, and country when not locked).
 *
 * A server action, deliberately — the earlier client-side write raced its own auth
 * hydration: a cold browser Supabase client could fire the UPDATE before the session
 * loaded, so RLS matched zero rows and PostgREST returned NO error (a silent non-save
 * shown as a false "Saved"). Here the cookie-bound client is already authenticated
 * (the middleware validated the session for this request), so the write always runs
 * as the user. The country lock is re-derived server-side (never trust the client),
 * and only writable columns are touched (billing columns are client-immutable anyway).
 */
export async function updateProfile(input: {
  displayName: string;
  country: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const { data: current } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();
  const countryLocked = COUNTRY_LOCK_STATES.has(current?.subscription_status ?? '');

  const patch: { display_name: string | null; country?: string | null } = {
    display_name: input.displayName.trim().slice(0, 80) || null,
  };
  if (!countryLocked) patch.country = input.country.trim() || null;

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id);
  if (error) {
    console.error('updateProfile: update failed', error);
    return { ok: false, error: 'Could not save your changes. Please try again.' };
  }
  return { ok: true };
}

/** Map a raw subscription status to the reassurance-copy variant for the deletion email. */
function subscriptionEmailKind(
  status: string | null | undefined
): 'paid' | 'trial' | null {
  if (status === 'trialing') return 'trial';
  if (status === 'active' || status === 'past_due') return 'paid';
  return null;
}

/**
 * Schedule the signed-in user's account for deletion (soft-delete + 30-day grace).
 * Sets `deletion_scheduled_at` via the service role (users can't write that column),
 * emails the branded "deletion scheduled" notice, then signs the user out so the
 * account is inaccessible during the grace window. Idempotent: re-requesting while
 * already scheduled doesn't reset the clock or re-send. The purge cron does the
 * permanent delete once the date passes; signing back in + reactivating cancels it.
 */
export async function requestAccountDeletion(formData: FormData): Promise<void> {
  // Device IANA timezone captured in the browser at submit time (hidden field), so
  // the "deletion scheduled" email shows the date in the user's own zone. May be
  // absent (no JS) — the email then falls back to the runtime zone.
  const rawZone = formData.get('timeZone');
  const timeZone = typeof rawZone === 'string' && rawZone ? rawZone : null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('email, display_name, subscription_status, deletion_scheduled_at')
    .eq('id', user.id)
    .single();

  // Only schedule (and email) if not already scheduled — keeps it idempotent.
  if (!profile?.deletion_scheduled_at) {
    const deletionDate = new Date(
      Date.now() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000
    );

    const { error } = await admin
      .from('profiles')
      .update({ deletion_scheduled_at: deletionDate.toISOString() })
      .eq('id', user.id);
    if (error) {
      console.error('requestAccountDeletion: failed to set deletion_scheduled_at', error);
      redirect('/account?error=delete');
    }

    // F3 TODO (paid): set the Stripe subscription to `cancel_at_period_end` — it
    // stays valid through the period the user already paid for, then stops. Deleting
    // must NOT pause or extend it (no delete-and-restore loophole to gain paid time).
    // F3 TODO (trial): record the remaining trial days to restore on reactivation.

    const email = profile?.email ?? user.email ?? '';
    if (email) {
      await sendDeletionScheduledEmail({
        to: email,
        name: profile?.display_name ?? null,
        deletionDate,
        subscriptionKind: subscriptionEmailKind(profile?.subscription_status),
        timeZone,
      });
    }
  }

  // Deactivate: end the session so the account can't be used during the grace
  // window. A returning user signs back in and is funnelled to /reactivate.
  // scope: 'global' here is deliberate — a deletion request should end the
  // account's sessions on EVERY device, not just the one that requested it
  // (unlike the normal Sign-out button, which is local — see auth/signout).
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/deletion-requested');
}

/**
 * Cancel a scheduled deletion for the signed-in user (reactivation). Clears
 * `deletion_scheduled_at` via the service role and returns them to the app.
 */
export async function reactivateAccount(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ deletion_scheduled_at: null })
    .eq('id', user.id);
  if (error) {
    console.error('reactivateAccount: failed to clear deletion_scheduled_at', error);
    redirect('/reactivate?error=1');
  }

  // F3 TODO (paid): clear `cancel_at_period_end` so the subscription renews normally
  // again — the user keeps only the paid-through time they already had, never extended.
  // F3 TODO (trial): restore the saved remaining trial days.

  redirect('/results');
}

/**
 * Refer-a-friend (F2 Part C). Sends a one-off branded invite from the signed-in
 * member to a friend's email and records a row (for the rate-limit + audit).
 * Guards, in order: honeypot, auth, email validity, required referrer name, no
 * self-referral, ≤10/day, and no re-inviting the same address within 30 days.
 * The email is sent first and only a *successful* send is recorded, so a delivery
 * failure never burns the rate-limit or blocks a retry.
 */
export async function sendReferral(input: {
  friendEmail: string;
  referrerName: string;
  message: string;
  /** Honeypot — a hidden field real users never fill. */
  website: string;
}): Promise<{ ok: boolean; error?: string }> {
  // Bots fill the hidden field. Report success without doing anything so we
  // don't teach the bot how to evade the trap.
  if (input.website?.trim()) return { ok: true };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const friendEmail = input.friendEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(friendEmail)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  const referrerName = input.referrerName.trim().slice(0, 80);
  if (!referrerName) {
    return { ok: false, error: 'Please add your name so your friend knows who invited them.' };
  }
  const message = input.message.trim().slice(0, 300);

  if (user.email && friendEmail === user.email.toLowerCase()) {
    return { ok: false, error: "That's your own email — invite a friend instead." };
  }

  // Rate-limit: at most REFERRALS_PER_DAY sent in the last 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countErr } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', user.id)
    .gte('created_at', since);
  if (countErr) {
    console.error('sendReferral: rate-limit query failed', countErr);
    return { ok: false, error: 'Could not send the invite. Please try again.' };
  }
  if ((count ?? 0) >= REFERRALS_PER_DAY) {
    return {
      ok: false,
      error: `You can send up to ${REFERRALS_PER_DAY} invites a day. Please try again tomorrow.`,
    };
  }

  // Don't let the same friend be re-invited within the dedupe window.
  const dupeSince = new Date(
    Date.now() - REFERRAL_DEDUPE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: dupe } = await supabase
    .from('referrals')
    .select('id')
    .eq('referrer_id', user.id)
    .eq('friend_email', friendEmail)
    .gte('created_at', dupeSince)
    .limit(1)
    .maybeSingle();
  if (dupe) {
    return { ok: false, error: "You've already invited this person recently." };
  }

  // Send first — only a successful send is recorded.
  const sent = await sendReferralEmail({
    to: friendEmail,
    referrerName,
    message: message || null,
  });
  if (!sent) {
    return { ok: false, error: 'Could not send the invite right now. Please try again later.' };
  }

  const { error: insErr } = await supabase.from('referrals').insert({
    referrer_id: user.id,
    friend_email: friendEmail,
    message: message || null,
  });
  if (insErr) {
    // The email already went out; log but don't fail the user's action.
    console.error('sendReferral: insert failed after send', insErr);
  }

  return { ok: true };
}
