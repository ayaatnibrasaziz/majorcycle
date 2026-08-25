import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * `anon` may READ `profiles` and may write nothing (audit F-024).
 *
 * ── Why this suite exists ───────────────────────────────────────────────────
 * Supabase grants every privilege on a new public table to `anon` and
 * `authenticated`, and safety then rests entirely on row-level security. In July
 * the UPDATE grant for `authenticated` was narrowed to three harmless columns; its
 * sibling `anon` was not, so an anonymous caller held INSERT, UPDATE and DELETE on
 * all 20 columns of `profiles` — `subscription_status` included. It was never
 * exploitable (the row policy compares `auth.uid() = id`, and `auth.uid()` is NULL
 * for an anonymous caller), but it was the missing layer, and this project has been
 * bitten repeatedly by a rule given to one consumer and not its sibling
 * (CLAUDE.md 11c-iv).
 *
 * ⚠️ **The fix made the refusal VISIBLE, and that is what makes it testable.**
 * Measured at the wire before the revoke, an anonymous UPDATE answered
 * `HTTP 200, no error, 0 rows` — indistinguishable from "the row isn't yours" and
 * from a client that silently did nothing. After it: `42501 permission denied for
 * table profiles`.
 *
 * ⚠️ **So the error CODE alone is not enough to assert on.** INSERT already
 * returned 42501 before the revoke — from the row policy, saying "new row violates
 * row-level security policy". A test matching only the code would have passed on
 * the broken state and proved nothing. The MESSAGE is what separates "the grant is
 * gone" from "the policy caught it", so both are asserted, in both directions.
 *
 * This reads the real database rather than the migration that changed it: the grant
 * is a fact about the running system, and a migration file is only a claim that
 * someone once tried to change it (CLAUDE.md 11d).
 *
 * Self-skips without credentials, like the other database suites.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * A uuid belonging to nobody. Table-level permission is checked before rows, so the
 * refusals below never depend on a row existing — deliberately: a test that needed
 * a real profile would be exercising the row policy too, and telling those two
 * failures apart is the entire job of this suite.
 */
const NOBODY = '00000000-0000-0000-0000-000000000000';

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const ANON_WRITES = [
  {
    what: 'UPDATE a subscription',
    run: (c: SupabaseClient) =>
      c.from('profiles').update({ subscription_status: 'active' }).eq('id', NOBODY).select(),
  },
  {
    what: 'INSERT a profile',
    run: (c: SupabaseClient) =>
      c.from('profiles').insert({ id: NOBODY, email: 'nobody@example.com' }).select(),
  },
  {
    what: 'DELETE a profile',
    run: (c: SupabaseClient) => c.from('profiles').delete().eq('id', NOBODY).select(),
  },
];

test.describe('an anonymous caller cannot write profiles', () => {
  test.skip(
    !SUPABASE_URL || !ANON_KEY,
    'set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to run',
  );

  test('CONTROL — the anon key works, and reading profiles is still allowed', async () => {
    // Without this, every assertion below would also pass with a wrong URL, a
    // revoked key, or no network at all: "an error came back" is not "the write was
    // refused". The read must succeed AND return nothing — succeed because the
    // client is real, return nothing because row-level security answers an
    // anonymous caller with an empty set.
    const { data, error } = await anonClient().from('profiles').select('id').limit(1);
    expect(
      error,
      'the anon client itself must work — otherwise the refusals below prove nothing',
    ).toBeNull();
    expect(data, 'row-level security must still hide every row from an anonymous reader').toEqual(
      [],
    );
  });

  for (const { what, run } of ANON_WRITES) {
    test(`anon cannot ${what} — refused by the GRANT, not merely by the policy`, async () => {
      const { error } = await run(anonClient());

      expect(
        error,
        `anon ${what} was not refused at all. Before F-024 this answered 200 / no error / ` +
          '0 rows — silence that looks exactly like success. Check whether a migration ' +
          're-granted writes on profiles to anon.',
      ).not.toBeNull();
      expect(error!.code).toBe('42501');
      expect(
        error!.message,
        'the refusal must come from the missing grant ("permission denied for table"), not ' +
          'from the row policy ("violates row-level security policy") — the second is what ' +
          'INSERT already said while the grant was still in place',
      ).toMatch(/permission denied for table/i);
      expect(error!.message).not.toMatch(/row-level security/i);
    });
  }
});

test.describe('a signed-in customer can still edit their own profile', () => {
  let admin: SupabaseClient;
  let userId: string;

  const RUN = Date.now();
  const EMAIL = `grants-e2e-${RUN}@example.com`;
  const PASSWORD = `E2e!grants-${RUN}`;

  test.skip(!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY, 'needs service credentials');

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      email_confirm: true,
      password: PASSWORD,
    });
    if (error || !data?.user) throw new Error(`could not create user: ${error?.message}`);
    userId = data.user.id;
    await admin.from('profiles').upsert({ id: userId, email: EMAIL }, { onConflict: 'id' });
  });

  test.afterAll(async () => {
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  /**
   * ⚠️ THE CONTROL THAT MATTERS MOST. Every assertion in the suite above is
   * satisfied by a database that refuses EVERYONE — which is exactly what a clumsy
   * revoke produces, and it would surface not as a red test but as a customer
   * unable to save their own name. So prove the three columns `authenticated` is
   * meant to hold are still writable by their owner, and that one it is not meant
   * to hold is still refused.
   */
  test('the three allowed columns still save, and subscription_status still does not', async () => {
    const user = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await user.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    expect(signInError, 'the throwaway account must be able to sign in').toBeNull();

    const { error: allowed } = await user
      .from('profiles')
      .update({ display_name: 'Grants Control', country: 'AU' })
      .eq('id', userId);
    expect(
      allowed,
      'a signed-in customer must still be able to save their display name and country — if ' +
        'this is red, the F-024 revoke went too wide and /account is broken',
    ).toBeNull();

    const { data: saved } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single();
    expect(saved?.display_name).toBe('Grants Control');

    // And July's narrowing still holds: their own row, a column they may not have.
    const { error: refused } = await user
      .from('profiles')
      .update({ subscription_status: 'active' })
      .eq('id', userId);
    expect(
      refused,
      'a customer must not be able to grant themselves a subscription on their own row',
    ).not.toBeNull();
    expect(refused!.code).toBe('42501');
  });
});
