'use server';

import { revalidatePath } from 'next/cache';

import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Record that the signed-in user has read and acknowledged the first-login
 * methodology + disclaimer (locked decision #23).
 *
 * A server action, deliberately — the earlier client-side write (browser Supabase
 * client) could fire before the browser session had hydrated, so RLS matched zero
 * rows and PostgREST returned NO error: a silent non-save that left the user stuck
 * behind the modal. Same failure class as the profile save. Here the cookie-bound
 * client is already authenticated (middleware validated the session for this
 * request) and the user id is derived from that session, never trusted from the
 * client, so the write always runs as the user.
 */
export async function acknowledgeDisclaimer(): Promise<{ ok: boolean }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // ── The acknowledgement is WRITE-ONCE ───────────────────────────────────────
  // It is a compliance record (locked decisions #23/#24): the date on which this
  // person was shown the methodology and the disclaimer. Re-stamping it does not
  // add information, it destroys the only copy of it.
  //
  // That is not hypothetical. On 2026-08-27 a failed profile read put the modal in
  // front of an account that had acknowledged on 2026-06-15; pressing the only
  // button on it replaced the June date with that day's, and the original is gone.
  // The read is fixed in lib/entitlement.ts, and this is the second layer: if the
  // gate is ever wrong again, being wrong costs nothing.
  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('acknowledged_disclaimer_at')
    .eq('id', user.id)
    .maybeSingle();

  // Never write blind. An unreadable row here is the same failure that produces a
  // false prompt in the first place, so writing anyway would be writing on exactly
  // the evidence we know to be untrustworthy. The user gets "please try again",
  // which is honest and recoverable; a lost date is neither.
  if (readError || !existing) {
    console.error('acknowledgeDisclaimer: could not read the row before writing', {
      userId: user.id,
      code: readError?.code ?? 'zero_rows',
    });
    return { ok: false };
  }

  if (existing.acknowledged_disclaimer_at) {
    // Already acknowledged. The modal should not have been shown — report success
    // so the router refresh clears it rather than trapping the reader behind an
    // error they cannot act on.
    return { ok: true };
  }

  const { error } = await supabase
    .from('profiles')
    // `.is(...)` repeats the check as a WHERE clause so two tabs racing cannot both
    // write. Postgres decides it, not the gap between our read and our write.
    .update({ acknowledged_disclaimer_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('acknowledged_disclaimer_at', null);
  if (error) {
    console.error('acknowledgeDisclaimer: update failed', error);
    return { ok: false };
  }

  // The (app) layout gates the onboarding modal on this flag across every
  // authenticated route, so revalidate the shared layout (not just one page).
  revalidatePath('/', 'layout');
  return { ok: true };
}
