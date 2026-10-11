import { randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * A disposable account in a chosen billing state, for a spec that must see what THAT
 * reader sees (11bd: a guard's account is part of its scope).
 *
 * ⚠️ A NEW USER, never a state written onto the shared E2E row — two suites writing
 * `subscription_status` on one profile is a race that surfaces as an unexplainable
 * flake in whichever loses (app-responsive.spec.ts says why at length).
 *
 * `@example.com` is reserved and non-deliverable, and `email_confirm` skips the
 * verification mail, so nothing leaves the building. The spec's `afterAll` must call
 * `remove()`; the nightly `sweep-test-leftovers` job is the backstop when a run dies.
 */

export const HAVE_SERVICE_ROLE = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export interface ThrowawayUser {
  id: string;
  email: string;
  password: string;
  admin: SupabaseClient;
  /** Write further profile fields (billing state, stored amounts…). */
  patch: (fields: Record<string, unknown>) => Promise<void>;
  /** Read profile fields back. */
  read: <T extends Record<string, unknown>>(columns: string) => Promise<T>;
  remove: () => Promise<void>;
}

export async function createThrowawayUser(
  label: string,
  profile: Record<string, unknown> = {},
): Promise<ThrowawayUser> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const run = randomUUID().slice(0, 12);
  const email = `${label}-e2e-${run}@example.com`;
  const password = `E2e!${label}-${run}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error(`could not create user: ${error?.message}`);
  const id = data.user.id;

  const patch = async (fields: Record<string, unknown>) => {
    const { error: e } = await admin.from('profiles').update(fields).eq('id', id);
    if (e) throw new Error(`could not update profile: ${e.message}`);
  };
  // Acknowledged by default: the first-login gate replaces every page while it shows.
  await patch({ acknowledged_disclaimer_at: new Date().toISOString(), ...profile });

  return {
    id,
    email,
    password,
    admin,
    patch,
    read: async <T extends Record<string, unknown>>(columns: string) => {
      const { data: row, error: e } = await admin.from('profiles').select(columns).eq('id', id).single();
      if (e) throw new Error(`could not read profile: ${e.message}`);
      return row as unknown as T;
    },
    remove: async () => {
      await admin.auth.admin.deleteUser(id);
    },
  };
}
