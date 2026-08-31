/**
 * A stock that has stopped trading must say so — and a stock that is trading must
 * never be accused of it.
 *
 * THE DEFECT THIS GUARDS (audit F-035, measured on the deployed preview
 * 2026-08-31, hours after the first five tickers were retired):
 *
 *   /stocks/us/BK    200   2,317,955 B   first price $157.13   says-not-trading=false
 *   /stocks/us/AAPL  200   2,065,991 B   first price $319.70   says-not-trading=false
 *
 * `BK` had been retired that morning. Its page rendered a full chart, a full
 * analysis and a price frozen at its last trading day, presented identically to a
 * live stock. A repo-wide grep found no UI string anywhere about a company having
 * stopped trading.
 *
 * ⚠️ Browse, the peer medians, `/api/request-ticker` and `/api/listings/status` ALL
 * filter `is_active`. `lib/stocks.ts` did not — CLAUDE.md 11c-iv, four consumers
 * given a rule and a fifth not — and `readStockRow` does `select('*')`, so the flag
 * was already sitting in the row with nothing reading it.
 *
 * ── Why the presence case is not driven here ────────────────────────────────
 * ⚠️ Asserting the notice APPEARS needs a ticker that is retired, and which tickers
 * are retired is live data that the nightly sweep changes underneath the test. A
 * spec pinned to `BK` would pass today and become a false failure the moment the
 * universe moved — or worse, a false PASS if it were written to skip when the
 * ticker is missing. Seeding a fake retired stock is no better: the cron would then
 * try to fetch it.
 *
 * So this file splits the claim the way the evidence allows, and says which half is
 * which (11c-ix — where a guard can only see part of a thing, name the part):
 *   · the DECISION is driven exhaustively and purely, below;
 *   · the ABSENCE is driven against a real page, which is the direction that would
 *     hurt a customer who has done nothing wrong;
 *   · the PRESENCE was verified by hand on the preview and is recorded in
 *     docs/layer-g-audit.md with the before/after measurement.
 */

import { expect, test } from '@playwright/test';

import { shouldShowDelistedNotice } from '../components/stocks/DelistedNotice';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('the delisting decision', () => {
  test('an explicitly retired stock is announced', () => {
    expect(shouldShowDelistedNotice({ isActive: false })).toBe(true);
  });

  test('a trading stock is not', () => {
    // The control. A predicate returning true for everything passes the test
    // above and would put a "no longer trades" notice on all 866 live stocks.
    expect(shouldShowDelistedNotice({ isActive: true })).toBe(false);
  });

  test('UNKNOWN means trading, never delisted', () => {
    /**
     * ⚠️ The one that matters. Telling a customer a healthy company has stopped
     * trading is far worse than failing to tell them about a real delisting: the
     * first is a false statement about a company on a page carrying our analysis,
     * the second is the status quo we shipped for the section's whole life.
     *
     * `undefined` is reachable three ways — a row written before the column
     * existed, a read that drops the field, and a shape change — so this is not a
     * defensive nicety.
     */
    expect(shouldShowDelistedNotice({})).toBe(false);
    expect(shouldShowDelistedNotice({ isActive: null })).toBe(false);
    expect(shouldShowDelistedNotice(null)).toBe(false);
    expect(shouldShowDelistedNotice(undefined)).toBe(false);
  });
});

test.describe('a live stock is never accused of delisting', () => {
  /**
   * ⚠️ **THIS TEST SIGNS IN, AND THE FIRST VERSION DID NOT — which made it
   * worthless in a way that looked fine.** Written signed-out it fetched
   * `/stocks/us/AAPL`, got redirected to `/login` by the proxy, found no notice in
   * the sign-in page and passed. It went on passing under a sabotage that made the
   * notice fire for **every stock in the universe**, because it had never loaded a
   * stock page at all. A test that cannot reach its subject reports exactly what a
   * passing one reports (CLAUDE.md 14g) — and it was the deliberate break, not
   * review, that showed it.
   *
   * This is also the only assertion here that touches the WIRING. The pure tests
   * above prove the decision; only this proves the component was actually rendered
   * into the page and returns null for a trading company.
   */
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test('AAPL renders, and carries no delisting notice', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/login');
    await page.fill('input#email', EMAIL!);
    await page.fill('input#password', PASSWORD!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/stocks/, { timeout: 30_000 });

    await page.goto('/stocks/us/AAPL');

    // THE CONTROL, and it is what the signed-out version lacked: prove we are
    // looking at the stock page before believing anything absent from it.
    //
    // ⚠️ Not `getByRole('heading')` — the company name and ticker render in plain
    // `div`/`span`s with no heading role, so that locator found nothing and failed
    // for a reason that had nothing to do with this test. The section anchor is
    // structural and is what the page's own subnav scrolls to.
    await expect(page.locator('#sec-thesis')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('AAPL', { exact: true }).first()).toBeVisible();

    await expect(page.getByTestId('delisted-notice')).toHaveCount(0);
    expect(await page.content()).not.toContain('no longer trades');
  });
});
