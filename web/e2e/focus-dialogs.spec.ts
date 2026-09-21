import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { modeFor, ringFailures, walkFocus } from './lib/focusRing';
import { signIn } from './lib/session';

/**
 * Layer H5 — a keyboard reader can see where they are INSIDE a dialog.
 *
 * ⚠️ A CLOSED CONTROL IS OUTSIDE EVERY WALK (11ax). The page walks in
 * `focus-visible.spec.ts` and `app-a11y.spec.ts` cover the navigation menu and the
 * drawer; every other dialog in the product renders nothing until a reader opens it,
 * so none of them was measured at all. This file opens each one and walks it.
 *
 * ⚠️ And the list is GUARDED, not remembered: the last test reads the codebase and
 * fails if a component renders a `DialogContent` that nothing here opens. A hand-written
 * list is exactly what left `/articles` unmeasured for a whole section's life.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** The dialogs this file opens, by the component file that renders each one. */
const COVERED = [
  'components/UpgradeDialog.tsx',
  'components/SupportDialog.tsx',
  'components/account/StartTrialModal.tsx',
  'components/stocks/MethodologyModal.tsx',
  'components/OnboardingModal.tsx',
];

/** Sign in with a specific account (the shared `signIn` helper uses the env one). */
async function signInAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/stocks/, { timeout: 30_000 });
}

/** A real account in a given billing state, deleted afterwards whatever happens. */
async function withThrowawayAccount(
  profile: Record<string, unknown>,
  body: (email: string, password: string) => Promise<void>,
) {
  const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const run = Date.now();
  const email = `focus-dlg-${run}@example.com`;
  const password = `E2e!dlg-${run}`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, password });
  if (error || !data?.user) throw new Error(`could not create user: ${error?.message}`);
  try {
    const { error: upd } = await admin.from('profiles').update(profile).eq('id', data.user.id);
    if (upd) throw new Error(`could not set the account state: ${upd.message}`);
    await body(email, password);
  } finally {
    await admin.auth.admin.deleteUser(data.user.id);
  }
}

async function walkDialog(page: Page, browserName: string, label: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog.first(), `${label} never opened`).toBeVisible({ timeout: 20_000 });
  const readings = await walkFocus(page, { mode: modeFor(browserName) });
  // The control: a walk that stayed on the page behind measures the wrong thing, and a
  // dialog holds its own focus, so its own controls MUST be what the walk reached.
  const inside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return [...document.querySelectorAll('a[href], button, input, select, textarea')].filter(
      (el) => d?.contains(el) && (el as HTMLElement).getClientRects().length > 0,
    ).length;
  });
  expect(inside, `${label} has no controls of its own — nothing to measure`).toBeGreaterThan(0);
  expect(readings.length, `${label}: the walk reached nothing`).toBeGreaterThanOrEqual(1);
  const fails = ringFailures(readings);
  expect(fails, `${label}:\n${fails.join('\n')}`).toEqual([]);
}

test.describe('every dialog shows focus at 375px', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test('the trial modal, on /account', async ({ page, browserName }) => {
    test.setTimeout(240_000);
    await signIn(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/account');
    await expect(page.locator('input#displayName')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /start free trial|^subscribe$/i }).click();
    await walkDialog(page, browserName, 'the trial modal');
  });

  /**
   * ⚠️ The support dialog needs an account whose payment is DISPUTED: it is the only
   * action that can lift a dispute hold, so `SubscriptionCard` renders it for that state
   * and no other. The shared account is an ordinary free one, which is why the first
   * version of this test sat waiting for a button that could never appear — a state a
   * guard cannot reach is a state it does not cover (11bd).
   */
  test('the support dialog, on an account with a payment dispute', async ({ page, browserName }) => {
    test.setTimeout(240_000);
    test.skip(!SERVICE_KEY || !SUPABASE_URL, 'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL');
    await withThrowawayAccount({ billing_blocked: true, subscription_status: 'active', acknowledged_disclaimer_at: new Date().toISOString() }, async (email, password) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await signInAs(page, email, password);
      await page.goto('/account');
      await page.getByRole('button', { name: /contact support/i }).click({ timeout: 60_000 });
      await walkDialog(page, browserName, 'the support dialog');
    });
  });

  test('the upgrade dialog, opened from a locked item in the drawer', async ({ page, browserName }) => {
    test.setTimeout(240_000);
    await signIn(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/stocks');
    await page.locator('[data-shell-menu-toggle]').click();
    await expect(page.getByRole('dialog', { name: /main navigation/i })).toBeVisible();
    // A locked feature on this account — the button that exists to explain the paywall.
    await page.getByRole('button', { name: /run analysis|results/i }).first().click();
    await walkDialog(page, browserName, 'the upgrade dialog');
  });

  test('the methodology modal, on Stock Detail', async ({ page, browserName }) => {
    test.setTimeout(240_000);
    await signIn(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/stocks/us/AAPL');
    await page.getByRole('button', { name: /^methodology$/i }).click({ timeout: 60_000 });
    await walkDialog(page, browserName, 'the methodology modal');
  });

  /**
   * The first-login gate, which `app/(app)/layout.tsx` returns ALONE — so it is the
   * whole page for a brand-new reader, and until now nothing measured it. Its own
   * account, created and deleted here, because the shared one acknowledged long ago.
   */
  test('the first-login disclaimer gate', async ({ page, browserName }) => {
    test.setTimeout(240_000);
    test.skip(!SERVICE_KEY || !SUPABASE_URL, 'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL');
    // A brand-new account has acknowledged nothing, which is the whole point of the gate.
    await withThrowawayAccount({}, async (email, password) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await signInAs(page, email, password);
      await walkDialog(page, browserName, 'the first-login gate');
    });
  });

  /**
   * ⚠️ THE LIST ABOVE IS A CLAIM ABOUT THE PRODUCT, so the product is asked. Any new
   * dialog fails here on the day it is written rather than the day someone remembers
   * this file (14g — a hand-written list is a blind spot with a tidy appearance).
   */
  test('every dialog in the codebase is walked by this file', () => {
    const root = join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.tsx')) files.push(p);
      }
    };
    walk(join(root, 'components'));
    walk(join(root, 'app'));
    const dialogs = files
      .filter((p) => /<DialogContent/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(root, p).replace(/\\/g, '/'))
      .filter((p) => p !== 'components/ui/dialog.tsx' && !p.includes('dev-fixtures'));
    expect(dialogs.length, 'found no dialogs at all — the scan is broken').toBeGreaterThan(3);
    expect(dialogs.filter((d) => !COVERED.includes(d)), 'a dialog nothing here opens').toEqual([]);
    // And the reverse: a name left in COVERED after its dialog is deleted is a line
    // that excuses nothing, which is how an exemption outlives its defect (11t).
    expect(COVERED.filter((c) => !dialogs.includes(c)), 'COVERED names a dialog that no longer exists').toEqual([]);
  });
});
