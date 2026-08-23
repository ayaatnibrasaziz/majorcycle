import { test, expect, type Page } from '@playwright/test';

/**
 * A ticker we do not cover, and a market that does not exist.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * The Layer G coverage map found that the whole 523-test suite contained **one**
 * assertion on a 404 status, and it was for an unknown Learn slug. An unknown
 * *ticker* — the far likelier typo, since readers type these — was not tested
 * anywhere, by any string. That matters because CLAUDE.md **11r** records a
 * sitewide soft-404 (every `notFound()` answering 200) fixed on 2026-08-18, so
 * the route with no assertion on it was the one that would regress in silence.
 *
 * ⚠️ **And it had regressed — or rather, was never fixed here.** Measured
 * 2026-08-23 on the production build: `/stocks/us/ZZZZNOTREAL` answers **200**,
 * and so does `/stocks/xx/AAPL`. The August fix deleted the *root*
 * `app/loading.tsx`; `app/(app)/loading.tsx` and the ticker route's own
 * `loading.tsx` are still there, so the Suspense shell still flushes before the
 * status is set. Recorded as **F-011**; the fix is a trade-off only the owner can
 * make (removing those files also removes the skeleton from the slowest page in
 * the product), so **no status assertion is made below** — one would either fail
 * or enshrine the defect.
 *
 * What IS asserted is the half that is unambiguous and would still be true after
 * either decision: **the reader gets the right page.** That is the part a customer
 * actually experiences, and it is currently correct — which is precisely why the
 * status bug survived. Nothing on screen looks wrong.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

/** Sign in with the shared test account and clear the first-login modal. */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', EMAIL!);
  await page.fill('input#password', PASSWORD!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/stocks/);

  const dialog = page.getByRole('dialog', { name: /welcome to majorcycle/i });
  await dialog.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('checkbox', { name: /i understand and acknowledge/i }).check();
    await page.getByRole('button', { name: /continue to majorcycle/i }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  }
}

test.describe('a ticker we do not cover', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('an unknown ticker gets the coverage page, not an error and not a blank', async ({ page }) => {
    await page.goto('/stocks/us/ZZZZNOTREAL');
    await expect(page.getByRole('heading', { name: /not in our coverage yet/i })).toBeVisible();
  });

  test('and it offers the way out — request it', async ({ page }) => {
    // The page's whole job. Without this the reader hits a dead end on a typo,
    // and the universe never auto-expands (decision #12/#16) because nobody asks.
    await page.goto('/stocks/us/ZZZZNOTREAL');
    const request = page.getByRole('link', { name: /request/i }).first();
    await expect(request).toBeVisible();
    await expect(request).toHaveAttribute('href', /\/request/);
  });

  test('a market that does not exist is refused the same way', async ({ page }) => {
    // `isValidMarket()` runs before the database is touched, so this is a
    // different code path from the unknown-ticker one above and needs its own case.
    await page.goto('/stocks/xx/AAPL');
    await expect(page.getByRole('heading', { name: /not in our coverage yet/i })).toBeVisible();
  });

  test('a ticker we DO cover is not mistaken for a missing one', async ({ page }) => {
    // The control. Without it, a change that showed "not in our coverage" for
    // every stock would pass all three tests above.
    await page.goto('/stocks/us/AAPL');
    await expect(page.getByRole('heading', { name: /not in our coverage yet/i })).toHaveCount(0);
    await expect(page.getByText(/current drawdown/i).first()).toBeVisible();
  });

  test('a lowercase unknown ticker resolves the same way', async ({ page }) => {
    // URLs are typed by humans. `ticker-routing.spec.ts` proves lowercase resolves
    // for a real symbol; this is the miss case, which takes the other branch.
    await page.goto('/stocks/us/zzzznotreal');
    await expect(page.getByRole('heading', { name: /not in our coverage yet/i })).toBeVisible();
  });

  test('the report route refuses an unknown ticker rather than serving an empty one', async ({ page }) => {
    // Whatever the refusal is — 402 for an unentitled viewer, 404 once F-011 is
    // decided — it must never be a 200 carrying a blank report. Asserting "not
    // 200" is deliberately weaker than a status literal: the entitlement of the
    // shared test account is not this file's subject, and pinning it here would
    // make this test fail for a reason that has nothing to do with tickers.
    const res = await page.goto('/stocks/us/ZZZZNOTREAL/report');
    expect(res?.status(), 'an unknown ticker must not yield a downloadable report').not.toBe(200);
  });
});
