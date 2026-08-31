import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { DELETION_NOTICE_COOKIE, DELETION_NOTICE_PATH } from '@/lib/account';

/**
 * The deletion confirmation, driven for REAL — the one leg the gate tests in
 * `auth.spec.ts` cannot reach.
 *
 * Those tests hand the browser a marker cookie and prove the gate honours it.
 * That is half the story. The other half is whether `requestAccountDeletion`
 * actually *sets* that marker, and it is the half most likely to be wrong,
 * because the Server Action does three things in a row that all touch cookies:
 * it signs the user out globally (Supabase writes its own cookie mutations),
 * then sets the marker, then `redirect()`s — which throws. If the marker were
 * lost anywhere in that sequence the gate would be perfect and the feature would
 * still be broken, and the symptom would be invisible to every other test:
 * a person who really did delete their account bounced to /login with no
 * confirmation.
 *
 * A comment cannot prove that ordering. This does.
 *
 * HOW IT ISOLATES — the same way `entitlement-routes.spec.ts` does, deliberately:
 * it creates its OWN throwaway auth user and deletes it afterwards, so it never
 * touches the shared E2E login account. That matters more here than anywhere
 * else in the suite, because this test's whole purpose is to press the button
 * that schedules an account for permanent deletion. `account.spec.ts` stops
 * short of pressing it for exactly that reason and says so.
 *
 * Side-effects on the throwaway account are nil: `@example.com` is reserved and
 * non-deliverable (the deletion email is refused by Resend and logged), and the
 * Stripe branch is skipped because a fresh account has no subscription id.
 */

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const RUN = Date.now();
const EMAIL = `deletion-e2e-${RUN}@example.com`;
const PASSWORD = `E2e!deletion-${RUN}`;

let admin: SupabaseClient;
let userId: string;

test.describe.configure({ mode: 'serial' });

test.describe('requestAccountDeletion sets the marker its own page requires', () => {
  test.skip(
    !SERVICE_KEY || !SUPABASE_URL || !ANON_KEY,
    'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_{URL,ANON_KEY} to run',
  );

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: created, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      email_confirm: true,
      password: PASSWORD,
    });
    if (error || !created?.user) {
      throw new Error(`could not create deletion test user: ${error?.message}`);
    }
    userId = created.user.id;
    // acknowledged_disclaimer_at keeps the first-login modal from overlaying the
    // delete card we are about to operate.
    await admin.from('profiles').upsert(
      { id: userId, email: EMAIL, acknowledged_disclaimer_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
  });

  test.afterAll(async () => {
    // Deleting the auth user cascades the profiles row away — zero residue, and it
    // runs even if the test failed mid-flow.
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  test('the real flow: delete → signed out → confirmation, with the marker set', async ({
    context,
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto('/login');
    await page.fill('input#email', EMAIL);
    await page.fill('input#password', PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/stocks/, { timeout: 30_000 });

    // The control. Before the action runs, this browser must NOT be able to reach
    // the confirmation — otherwise the assertion after it proves nothing.
    await page.goto(DELETION_NOTICE_PATH);
    await expect(
      page,
      'a signed-in reader must be bounced before we prove anything about the marker',
    ).toHaveURL(/\/stocks/);
    expect(
      (await context.cookies()).some((c) => c.name === DELETION_NOTICE_COOKIE),
      'the marker must not exist before the deletion runs',
    ).toBe(false);

    await page.goto('/account');
    await page.getByRole('button', { name: /delete my account/i }).click();
    await page
      .getByRole('checkbox', { name: /i understand my account will be permanently deleted/i })
      .check();
    await page.getByRole('button', { name: /schedule deletion/i }).click();

    // 1 — the redirect lands on the confirmation and STAYS there. If the marker
    // were lost, the gate would send this to /login and this is where it shows.
    await expect(page).toHaveURL(new RegExp(DELETION_NOTICE_PATH), { timeout: 30_000 });
    await expect(
      page.getByRole('heading', { name: /account deletion scheduled/i }),
    ).toBeVisible();

    // 2 — the marker exists, and has the attributes it is supposed to have. A
    // cookie readable by JavaScript, or scoped to the whole site, would still make
    // the test above pass while being the wrong cookie.
    const marker = (await context.cookies()).find((c) => c.name === DELETION_NOTICE_COOKIE);
    expect(marker, 'requestAccountDeletion did not set the marker').toBeTruthy();
    expect(marker!.httpOnly, 'the marker must be httpOnly').toBe(true);
    expect(marker!.path, 'the marker must be scoped to the page it unlocks').toBe(
      DELETION_NOTICE_PATH,
    );

    // 3 — the session really is gone. The marker must never be mistaken for one.
    await page.goto('/stocks');
    await expect(page, 'the deletion must have signed this browser out').toHaveURL(
      /\/login/,
    );

    // 4 — and the deletion actually happened, not just the redirect.
    const { data: profile } = await admin
      .from('profiles')
      .select('deletion_scheduled_at')
      .eq('id', userId)
      .single();
    expect(
      profile?.deletion_scheduled_at,
      'the flow redirected but never scheduled the deletion',
    ).toBeTruthy();
  });
});
