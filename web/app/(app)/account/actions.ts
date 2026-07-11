'use server';

import { redirect } from 'next/navigation';

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { sendDeletionScheduledEmail } from '@/lib/email/accountEmails';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/lib/account';

/** Subscription states that mean "has a live subscription" (for the email copy). */
const SUBSCRIBED_STATES = new Set(['active', 'trialing', 'past_due']);

/**
 * Schedule the signed-in user's account for deletion (soft-delete + 30-day grace).
 * Sets `deletion_scheduled_at` via the service role (users can't write that column),
 * emails the branded "deletion scheduled" notice, then signs the user out so the
 * account is inaccessible during the grace window. Idempotent: re-requesting while
 * already scheduled doesn't reset the clock or re-send. The purge cron does the
 * permanent delete once the date passes; signing back in + reactivating cancels it.
 */
export async function requestAccountDeletion(): Promise<void> {
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

    // F3 TODO: pause the Stripe subscription (`pause_collection`) and schedule
    // `cancel_at` = deletionDate, so no charge goes out during the grace window.

    const email = profile?.email ?? user.email ?? '';
    if (email) {
      await sendDeletionScheduledEmail({
        to: email,
        name: profile?.display_name ?? null,
        deletionDate,
        hasSubscription: SUBSCRIBED_STATES.has(profile?.subscription_status ?? ''),
      });
    }
  }

  // Deactivate: end the session so the account can't be used during the grace
  // window. A returning user signs back in and is funnelled to /reactivate.
  await supabase.auth.signOut();
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

  // F3 TODO: resume the Stripe subscription (remove `pause_collection` + clear
  // the scheduled `cancel_at`), so the subscription continues with no gap.

  redirect('/results');
}
