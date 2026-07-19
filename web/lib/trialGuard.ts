import { createHash } from 'node:crypto';

import type { createAdminClient } from '@/lib/supabase/server';

/**
 * Trial-abuse guard (F3 Step 7) — the deterministic **email** half.
 *
 * One free trial per email address. When a trial is first consumed we record a
 * `trial_tombstones` row keyed by a one-way hash of the email; the table is NOT a
 * FK to `profiles`, so the record survives a hard account deletion and a purged
 * user can't farm a fresh trial by re-signing up with the same address. At checkout
 * we look the hash up and omit the free week for a repeat email (they subscribe,
 * billed from day one — never hard-blocked). The same lookup drives the honest
 * "you've already used your free trial" copy shown BEFORE payment.
 *
 * The same-card-across-different-emails vector is handled separately by Stripe's
 * Radar "Free trial abuse" control (a Dashboard setting), so this module only deals
 * with the email signal.
 *
 * Service-role only: `trial_tombstones` has RLS on with no policies, so every call
 * takes the admin client. All functions are best-effort and never throw — a guard
 * failure must never block a legitimate checkout (abuse is rare and Radar backstops).
 */

type Admin = ReturnType<typeof createAdminClient>;

/** One-way key for an email: sha256 of the trimmed, lowercased address (hex). */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/**
 * Has this email already consumed a free trial? Fail-OPEN: on any error we return
 * false (treat as eligible) so a transient DB blip never denies a real new customer
 * their trial — consistent with the "never hard block" rule.
 */
export async function hasUsedTrial(admin: Admin, email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const { data, error } = await admin
    .from('trial_tombstones')
    .select('id')
    .eq('email_hash', hashEmail(email))
    .limit(1);
  if (error) {
    console.error('trialGuard: hasUsedTrial lookup failed', error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Record that `email` has consumed a free trial (idempotent — skips if already
 * present, so re-runs and webhook redeliveries don't pile up duplicate rows).
 * Best-effort: logs and returns on any failure, never throws.
 */
export async function recordTrialConsumed(admin: Admin, email: string | null | undefined): Promise<void> {
  if (!email) return;
  try {
    const emailHash = hashEmail(email);
    const { data, error: lookupErr } = await admin
      .from('trial_tombstones')
      .select('id')
      .eq('email_hash', emailHash)
      .limit(1);
    if (lookupErr) {
      console.error('trialGuard: recordTrialConsumed lookup failed', lookupErr);
      return;
    }
    if (data && data.length > 0) return; // already tombstoned
    const { error: insertErr } = await admin
      .from('trial_tombstones')
      .insert({ email_hash: emailHash });
    if (insertErr) {
      console.error('trialGuard: could not write trial tombstone', insertErr);
    }
  } catch (err) {
    console.error('trialGuard: recordTrialConsumed failed', err);
  }
}
