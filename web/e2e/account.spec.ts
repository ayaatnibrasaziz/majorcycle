import { test, expect, type Page } from '@playwright/test';

/**
 * F2 Account Hub — authenticated interaction suite.
 *
 * Exercises the real /account page against a real session + enforced middleware
 * (the Playwright config boots next dev with DEV_BYPASS_AUTH unset). Runs only
 * when E2E_EMAIL + E2E_PASSWORD are set — same dedicated test account as the
 * auth suite. Deliberately does NOT perform a *successful* password change (that
 * would rotate the shared test account's password); it verifies the guard rails
 * (mismatch + wrong current password) which never mutate the account.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

/** Sign in with the test account and clear the first-login disclaimer modal. */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', EMAIL!);
  await page.fill('input#password', PASSWORD!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/results/);

  const dialog = page.getByRole('dialog', { name: /welcome to majorcycle/i });
  await dialog.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await dialog.isVisible().catch(() => false)) {
    const ack = page.getByRole('checkbox', { name: /i understand and acknowledge/i });
    const proceed = page.getByRole('button', { name: /continue to majorcycle/i });
    await expect(async () => {
      await ack.check();
      await expect(proceed).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await proceed.click();
    await expect(dialog).toBeHidden();
  }
}

/**
 * Open /account and wait for the profile form.
 *
 * No auth-bounce healing here by design. This suite and the auth suite share one
 * test user; a *global* sign-out (the old default) in the concurrently-running
 * auth suite used to revoke THIS suite's session mid-run, bouncing us to /login.
 * That is fixed at the source — the app's Sign-out is now scope:'local' (see
 * app/auth/signout/route.ts), so one session's sign-out no longer revokes another.
 * This helper therefore does NOT re-authenticate: if that regresses, the bounce
 * surfaces as a real failure here instead of being silently masked.
 *
 * The one wait we keep is dev-only: the (app) shell paints from local JWT claims,
 * but the page body awaits its own getUser() (a network call) before rendering the
 * form, so under heavy parallel load on `next dev` the sidebar can show while
 * #displayName hasn't. Wait a BOUNDED time for the form, then throw so the caller's
 * toPass re-navigates — never hang the full retry window on a locator not there yet.
 */
async function gotoAccount(page: Page) {
  await page.goto('/account');
  await page.locator('#displayName').waitFor({ state: 'visible', timeout: 8000 });
}

/**
 * Fill + save the profile, retrying through the dev-only form-render lag
 * (gotoAccount throws if #displayName hasn't painted yet, and toPass re-navigates).
 * If a prior attempt already persisted — a slow reload merely hid the "Saved" toast
 * — the reloaded form shows the target values, so there's nothing left to do.
 */
async function saveProfile(page: Page, displayName: string, country: string) {
  await expect(async () => {
    await gotoAccount(page);
    if (
      (await page.locator('#displayName').inputValue()) === displayName &&
      (await page.locator('#country').inputValue()) === country
    ) {
      return;
    }
    await page.locator('#displayName').fill(displayName);
    await page.locator('#country').selectOption(country);
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 60_000 });
}

/** Reload /account and assert the persisted fields (toPass rides out render lag). */
async function expectAccountFields(
  page: Page,
  displayName: string,
  country: string,
) {
  await expect(async () => {
    await gotoAccount(page);
    await expect(page.locator('#displayName')).toHaveValue(displayName, {
      timeout: 4000,
    });
    await expect(page.locator('#country')).toHaveValue(country, {
      timeout: 4000,
    });
  }).toPass({ timeout: 60_000 });
}

test.describe('account hub (F2)', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('renders the real page in the app shell (desktop + mobile screenshots)', async ({
    page,
  }) => {
    await page.goto('/account');
    // The real page (not a fixture) — heading + all three cards present. The
    // page h1 is sr-only (visible title is the app Header/topbar), so assert it
    // is attached; the card headings below are visible.
    await expect(page.getByRole('heading', { name: /^account$/i })).toBeAttached();
    await expect(page.getByRole('heading', { name: /^profile$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^subscription$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^password$/i })).toBeVisible();
    // Email is read-only and shows the signed-in address.
    await expect(page.locator('#email')).toHaveValue(EMAIL!);
    await expect(page.locator('#email')).toBeDisabled();

    await page.screenshot({ path: 'test-results/f2-account-desktop.png', fullPage: true });
    // Mobile screenshot for visual review. The account content stacks cleanly at
    // 375px; note the app shell (fixed 220px sidebar, no responsive collapse) is
    // desktop-oriented app-wide, which is tracked separately from Part A — so we
    // don't assert document-level width here (it would test the shell, not /account).
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'test-results/f2-account-mobile.png', fullPage: true });
  });

  test('profile save writes display name + country and persists across reload', async ({
    page,
  }) => {
    // Four retrying save/verify blocks; give the whole test room so that, under a
    // loaded parallel run, each block's re-navigation retries have time to land.
    test.setTimeout(180_000);

    // Unique marker guarantees the field is dirty every run (and no collision
    // with residue from a prior run).
    const marker = `E2E ${Date.now()}`;
    await saveProfile(page, marker, 'AU');

    // Round-trip: a fresh navigation pulls the freshly-written row from the DB.
    await expectAccountFields(page, marker, 'AU');

    // Reset so the shared test account isn't left mutated.
    await saveProfile(page, '', '');
    await expectAccountFields(page, '', '');
  });

  test('password form rejects a mismatch and a wrong current password (no change made)', async ({
    page,
  }) => {
    await page.goto('/account');
    const current = page.locator('#currentPassword');
    const next = page.locator('#newPassword');
    const confirm = page.locator('#confirmPassword');
    const update = () => page.getByRole('button', { name: /update password/i });

    // 1) Mismatched new/confirm → client-side validation, no network call.
    await current.fill('placeholder-value');
    await next.fill('brandNewPass1');
    await confirm.fill('brandNewPass2');
    await update().click();
    // Scope to the visible error text (getByRole('alert') also matches Next's
    // route announcer, causing a strict-mode clash).
    await expect(page.getByText(/do not match/i)).toBeVisible();

    // 2) Matching new pair but a WRONG current password → re-auth barrier
    //    rejects it (proves current-password verification). This never changes
    //    the password because the re-auth fails first.
    await confirm.fill('brandNewPass1');
    await current.fill(`definitely-wrong-${Date.now()}`);
    await update().click();
    await expect(page.getByText(/current password is incorrect/i)).toBeVisible();
  });

  test('delete-account card gates submission behind the acknowledgement checkbox', async ({
    page,
  }) => {
    await page.goto('/account');
    await page.getByRole('button', { name: /delete my account/i }).click();

    const schedule = page.getByRole('button', { name: /schedule deletion/i });
    await expect(schedule).toBeDisabled();

    await page
      .getByRole('checkbox', {
        name: /i understand my account will be permanently deleted/i,
      })
      .check();
    await expect(schedule).toBeEnabled();

    // Never actually submit — that would schedule deletion of the shared test
    // account. Cancelling returns the card to its initial state.
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(
      page.getByRole('button', { name: /delete my account/i })
    ).toBeVisible();
  });

  test('refer-a-friend card validates and blocks self-referral (no email sent)', async ({
    page,
  }) => {
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: /^refer a friend$/i })).toBeVisible();

    const name = page.locator('#referrerName');
    const friend = page.locator('#friendEmail');
    const send = () => page.getByRole('button', { name: /send invite/i });

    // 1) Invalid email → client-side validation, no server call / no email.
    await name.fill('Test Referrer');
    await friend.fill('not-an-email');
    await send().click();
    await expect(page.getByText(/valid email address/i)).toBeVisible();

    // 2) Self-referral → the server action rejects it *before* any email is sent
    //    (so this is non-destructive: no Resend send, no referrals row).
    await friend.fill(EMAIL!);
    await send().click();
    await expect(page.getByText(/your own email/i)).toBeVisible();
  });
});
