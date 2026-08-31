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
 * ⚠️ **And it had never been fixed here.** Measured 2026-08-23 on the production
 * build, `/stocks/us/ZZZZNOTREAL` answered **200**, and so did `/stocks/xx/AAPL`.
 * The August fix deleted the *root* `app/loading.tsx` and stopped; the signed-in
 * product kept `app/(app)/loading.tsx`, whose Suspense shell still flushed before
 * the status was set. Audit finding **F-011**.
 *
 * **Fixed the same day, and the fix cost nothing** — see
 * `stocks/[market]/[ticker]/layout.tsx` for the mechanism. The obvious remedy
 * (delete every `loading.tsx`) would have taken the skeleton off the heaviest page
 * in the product; instead the existence check moved into a layout above the
 * boundary, and only the *group-level* loading file went. Measured after: the
 * ticker page still paints its skeleton at **389ms**, and the four routes that
 * lost the group skeleton all load in **380–945ms**, where Next's router keeps the
 * previous page visible anyway.
 *
 * So the status assertions below are the point of the file. The
 * reader-facing ones matter just as much and are kept: the bug survived for months
 * precisely because **nothing on screen looked wrong**.
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

  test('an unknown ticker answers 404, not 200 — F-011', async ({ page }) => {
    // The regression guard. A `loading.tsx` reintroduced at `(app)` or `stocks/`
    // level puts a Suspense boundary back above the layout that does this check,
    // and the status silently reverts to 200 while every page still renders
    // perfectly. That is exactly how the bug survived from launch to 2026-08-23,
    // so this assertion is the only thing that would notice.
    const res = await page.goto('/stocks/us/ZZZZNOTREAL');
    expect(res?.status()).toBe(404);
  });

  test('an unknown MARKET answers 404 too', async ({ page }) => {
    // A separate branch — `isValidMarket` refuses before the database is touched.
    const res = await page.goto('/stocks/xx/AAPL');
    expect(res?.status()).toBe(404);
  });

  test('a real ticker still answers 200', async ({ page }) => {
    // The control. Without it, a change that 404'd every stock would satisfy both
    // assertions above — and that is not a hypothetical: it is the shape of the
    // 11e bug, where a failed database read made every ticker look absent.
    //
    // ⚠️ `waitUntil: 'commit'` because this test wants the STATUS LINE and nothing
    // else. The default waits for `load`, which on this page means the charts and
    // the Python cycle analysis — and under full-suite load on the dev server that
    // exceeded the 60s timeout and made this test flaky on its first full run.
    // A flaky result on a test written the same day is far likelier to be the
    // test's fault than the harness's (CLAUDE.md 11i), and it was: waiting for
    // three seconds of rendering to read a header that arrived in the first
    // packet. The two 404 assertions are left on the default wait — those pages
    // are tiny, and the stricter wait is free there.
    const res = await page.goto('/stocks/us/AAPL', { waitUntil: 'commit' });
    expect(res?.status()).toBe(200);
  });

  test('the ticker page still shows its loading skeleton', async ({ page }) => {
    // ⚠️ The other half of the fix, and the reason it was worth doing properly.
    // Deleting every `loading.tsx` would also have produced correct statuses, at
    // the cost of the skeleton on the slowest page we ship. If someone later
    // "simplifies" by removing the ticker route's own loading.tsx, the statuses
    // stay green and the reader silently gets a blank screen for ~3 seconds
    // instead. This is what notices.
    await page.goto('/stocks');
    const nav = page.goto('/stocks/us/MSFT', { waitUntil: 'commit' });
    await expect(page.locator('.animate-pulse').first()).toBeVisible({ timeout: 5000 });
    await nav;
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
