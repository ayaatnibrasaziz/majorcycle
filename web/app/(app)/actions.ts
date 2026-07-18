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

  const { error } = await supabase
    .from('profiles')
    .update({ acknowledged_disclaimer_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error('acknowledgeDisclaimer: update failed', error);
    return { ok: false };
  }

  // The (app) layout gates the onboarding modal on this flag across every
  // authenticated route, so revalidate the shared layout (not just one page).
  revalidatePath('/', 'layout');
  return { ok: true };
}
