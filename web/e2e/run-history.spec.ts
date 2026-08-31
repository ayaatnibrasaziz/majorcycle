import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Run tab asks for its own analysis history.
 *
 * ── Why this suite exists (audit F-022, 2026-08-24) ─────────────────────────
 * The history fetch used to run on mount inside `AnalysisProvider`, which wraps
 * EVERY signed-in page from `app/(app)/layout.tsx`. That made Browse and Stock
 * Detail each pull the 236 KB Supabase client onto the critical path and make a
 * database round trip for a row only this screen displays. It now runs in
 * `RunAnalysis`, the sole consumer of `lastRun`.
 *
 * ⚠️ **Nothing covered this.** The move is a behaviour change on a paid surface,
 * and the suite had no spec that drove `/run`'s history at all — so the only thing
 * standing between "moved correctly" and "silently never fetches again" was
 * reading the diff. A missing fetch renders **identically** to a new account with
 * no history: no error, no blank space, just a card that isn't there. That is this
 * project's most-repeated defect shape (CLAUDE.md 11j, 14g).
 *
 * ⚠️ It needs an ENTITLED account, and that is not incidental. The shared e2e
 * account has no subscription, so `/run` correctly renders the upsell and
 * `RunAnalysis` never mounts — against which every assertion below would "pass"
 * while proving nothing. The control at the bottom is what makes that visible.
 *
 * Self-skips without service credentials, like the other account suites.
 */

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const RUN = Date.now();
const EMAIL = `run-history-e2e-${RUN}@example.com`;
const PASSWORD = `E2e!runhistory-${RUN}`;

test.describe('the Run tab fetches its own history', () => {
  let admin: SupabaseClient;
  let userId: string;

  test.skip(
    !SERVICE_KEY || !SUPABASE_URL,
    'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to run',
  );

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

    await admin.from('profiles').upsert(
      {
        id: userId,
        email: EMAIL,
        acknowledged_disclaimer_at: new Date().toISOString(),
        subscription_status: 'active',
      },
      { onConflict: 'id' },
    );
  });

  test.afterAll(async () => {
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  test('opening /run requests the last analysis, and other pages do not', async ({ page }) => {
    test.setTimeout(120_000);

    const historyCalls: string[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/rest/v1/analysis_runs')) {
        historyCalls.push(`${new URL(page.url()).pathname} → ${r.status()}`);
      }
    });

    await page.goto('/login');
    await page.fill('input#email', EMAIL);
    await page.fill('input#password', PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/stocks/, { timeout: 30_000 });

    // ── The half that must NOT happen ────────────────────────────────────────
    // Browse is a signed-in page wrapped by the same provider. It has no business
    // asking for run history, and it did until this change.
    await page.goto('/stocks');
    await page.waitForLoadState('load');
    await page.waitForTimeout(3_000);
    expect(
      historyCalls,
      'Browse must not request analysis history — the provider wraps every signed-in page',
    ).toEqual([]);

    // ── The half that must ───────────────────────────────────────────────────
    await page.goto('/run');
    await page.waitForLoadState('load');

    // ⚠️ CONTROL, and the assertion order matters. If this account were not
    // entitled, `/run` would render the upsell, `RunAnalysis` would never mount,
    // and "no history request" would be correct rather than broken. Prove the
    // screener is actually on screen before concluding anything from silence.
    await expect(
      page.getByRole('button', { name: /run analysis/i }).first(),
      'the screener itself must render, or the absence of a fetch proves nothing',
    ).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(() => historyCalls.length, {
        message:
          'the Run tab never requested analysis_runs — the history fetch moved out of ' +
          'AnalysisProvider and RunAnalysis must now make it (audit F-022)',
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    expect(historyCalls[0]).toContain('/run');
  });
});
