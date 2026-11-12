import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { createThrowawayUser, HAVE_SERVICE_ROLE, type ThrowawayUser } from './lib/throwawayUser';

/**
 * Beta-tester grants (supabase/migrations/20261112000000_tester_grants.sql).
 *
 * The Reddit offer promised testers 6 months of premium, no card, "nothing is charged
 * when it ends". A hand grant has no end date, so the only thing standing between a
 * tester and free access FOREVER is `end_expired_tester_grants()`, run nightly by
 * pg_cron. Nothing on any page shows whether it works — a grant that never ends looks
 * exactly like a grant that has not ended yet — so it is driven here against the real
 * database with throwaway `@example.com` accounts.
 *
 * ⚠️ The load-bearing control is the PAYING tester: an end job that cancels everyone
 * whose date has passed passes every other assertion in this file, and would cut off a
 * customer who started paying during their free period.
 */

test.describe('tester grants', () => {
  test.skip(!HAVE_SERVICE_ROLE, 'needs the service-role key to drive the database');

  const made: ThrowawayUser[] = [];
  test.afterAll(async () => {
    for (const u of made) await u.remove();
  });

  const status = async (u: ThrowawayUser) =>
    (await u.read<{ subscription_status: string | null }>('subscription_status')).subscription_status;
  const grantRow = async (u: ThrowawayUser) => {
    const { data, error } = await u.admin
      .from('tester_grants')
      .select('expires_at, ended_at, end_outcome')
      .eq('user_id', u.id)
      .single();
    if (error) throw new Error(error.message);
    return data as { expires_at: string; ended_at: string | null; end_outcome: string | null };
  };
  const expireNow = async (u: ThrowawayUser) => {
    const { error } = await u.admin
      .from('tester_grants')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('user_id', u.id);
    if (error) throw new Error(error.message);
  };
  const runEndJob = async (u: ThrowawayUser) => {
    const { error } = await u.admin.rpc('end_expired_tester_grants');
    if (error) throw new Error(error.message);
  };

  test('a grant switches premium on for six months, and the nightly job switches it off', async () => {
    const u = await createThrowawayUser('testergrant');
    made.push(u);
    const { error } = await u.admin.rpc('grant_tester_access', {
      p_email: u.email,
      p_source: 'test',
      p_handle: 'probe',
      p_months: 6,
    });
    expect(error).toBeNull();
    expect(await status(u)).toBe('active');

    const days = (Date.parse((await grantRow(u)).expires_at) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(180);
    expect(days).toBeLessThan(185);

    // Before the end date the job leaves the grant alone.
    await runEndJob(u);
    expect(await status(u)).toBe('active');
    expect((await grantRow(u)).ended_at).toBeNull();

    await expireNow(u);
    await runEndJob(u);
    expect(await status(u)).toBe('canceled');
    const row = await grantRow(u);
    expect(row.end_outcome).toBe('ended');
    expect(row.ended_at).not.toBeNull();
  });

  test('a tester who started PAYING is never cut off by the end job', async () => {
    const u = await createThrowawayUser('testerpaying');
    made.push(u);
    const { error } = await u.admin.rpc('grant_tester_access', {
      p_email: u.email,
      p_source: 'test',
      p_handle: 'probe',
    });
    expect(error).toBeNull();
    await u.patch({ stripe_customer_id: `cus_E2E_TESTER_${u.id.slice(0, 8)}` });

    await expireNow(u);
    await runEndJob(u);
    expect(await status(u)).toBe('active');
    expect((await grantRow(u)).end_outcome).toBe('skipped_now_paying');
  });

  test('an account already paying through Stripe is refused a hand grant', async () => {
    const u = await createThrowawayUser('testerrefused', {
      stripe_customer_id: `cus_E2E_TESTER_${Date.now()}`,
      subscription_status: 'active',
    });
    made.push(u);
    const { error } = await u.admin.rpc('grant_tester_access', {
      p_email: u.email,
      p_source: 'test',
      p_handle: 'probe',
    });
    expect(error?.message).toContain('has a Stripe record');
  });

  test('the public roles cannot grant, end, or read tester grants', async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const g = await anon.rpc('grant_tester_access', { p_email: 'x@example.com', p_source: 't', p_handle: 't' });
    expect(g.error?.message).toContain('permission denied for function');
    const e = await anon.rpc('end_expired_tester_grants');
    expect(e.error?.message).toContain('permission denied for function');
    const r = await anon.from('tester_grants').select('id');
    expect(r.error?.message).toContain('permission denied for table');
  });
});
