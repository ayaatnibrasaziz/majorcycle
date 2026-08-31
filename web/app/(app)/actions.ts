'use server';

import { revalidatePath } from 'next/cache';

import { acknowledgeWriteDecision } from '@/lib/entitlement';
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

  // ⚠️ The DECISION lives in lib/entitlement.ts, not here, and that is the whole
  // point of finding F-033: while these rules sat inside this action they could not
  // be tested at all. This file builds its own Supabase client, so no spec could
  // substitute a stub, and four real protections went unexercised on the one path
  // that has already destroyed a compliance record. `acknowledgeWriteDecision` is
  // pure, so `e2e/onboarding-gate.spec.ts` drives every branch with no credentials.
  const decision = acknowledgeWriteDecision(existing, !!readError);

  if (decision === 'refuse_unreadable') {
    console.error('acknowledgeDisclaimer: could not read the row before writing', {
      userId: user.id,
      code: readError?.code ?? 'zero_rows',
    });
    return { ok: false };
  }

  if (decision === 'skip_already_acknowledged') return { ok: true };

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
