import { expect, test, type Page } from '@playwright/test';

import { HAVE_SERVICE_ROLE, createThrowawayUser, type ThrowawayUser } from './lib/throwawayUser';
import { signInAs } from './lib/session';

/**
 * A running screen survives a visit to a public page, and the browser asks before a
 * reload ends one (owner, 2026-10-03). The run's state lives in the tab, not in the
 * signed-in shell (lib/analysis.tsx, "THE RUN'S STATE LIVES HERE").
 *
 * ⚠️ The move has to be a CLIENT-SIDE navigation — a link, not a typed address — or
 * the tab reloads and the run ends by design. `window.next.router.push` is exactly
 * what a <Link> calls; the spec checks the tab really was not reloaded.
 */

const SHORT = ['AAPL', 'MSFT', 'KO', 'JNJ', 'XOM'];
// Long enough to still be running after a reload, a page change and a second reload.
const LONG = [
  ...SHORT, 'NVDA', 'AMZN', 'META', 'TSLA', 'PEP', 'WMT', 'BHP.AX', 'CBA.AX', 'RIO.AX',
  'TD.TO', 'RY.TO', 'ENB.TO', 'CSL.AX', 'WES.AX', 'SHOP.TO',
];

async function startRun(page: Page, tickers: string[] = SHORT): Promise<void> {
  const csv = ['Ticker', ...tickers, ''].join('\n');
  await page.locator('input[type="file"]').setInputFiles({ name: 'l.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('button', { name: new RegExp(`^Run Analysis · ${tickers.length}`) })).toBeEnabled();
  await page.getByRole('button', { name: /^Run Analysis/ }).click();
  await expect(page.locator('.progress-bar-wrap')).toBeVisible();
}

const go = (page: Page, href: string) =>
  page.evaluate((h) => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(h), href);

test.describe('a screen in progress', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!HAVE_SERVICE_ROLE, 'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to run');
  test.setTimeout(240_000);

  let user: ThrowawayUser;
  test.beforeAll(async () => {
    user = await createThrowawayUser('runnav', { subscription_status: 'active', grace_until: null, billing_blocked: false });
  });
  test.afterAll(async () => user?.remove());

  test('carries on through a visit to a public page, and its results are there after', async ({ page }) => {
    await signInAs(page, user.email, user.password);
    await page.goto('/run');
    await startRun(page);
    await page.evaluate(() => ((window as unknown as { __sameTab: string }).__sameTab = 'yes'));

    await go(page, '/learn');
    await expect(page).toHaveURL(/\/learn$/);
    // Really outside the signed-in shell: no app rail.
    await expect(page.locator('[data-shell-rail]')).toHaveCount(0);

    await go(page, '/run');
    await expect(page).toHaveURL(/\/run$/);
    expect(await page.evaluate(() => (window as unknown as { __sameTab?: string }).__sameTab), 'the tab never reloaded').toBe('yes');
    await expect(page.getByText('Your last run did not finish.')).toHaveCount(0);
    // Still going, or already done — never lost.
    await expect(page.getByRole('button', { name: 'View Full Results' })).toBeVisible({ timeout: 180_000 });
    await go(page, '/results');
    await expect(page.locator('.results-table tbody tr')).toHaveCount(5, { timeout: 30_000 });
  });

  test('the browser asks before a reload ends a run, and only then', async ({ page, browserName }) => {
    await signInAs(page, user.email, user.password);
    await page.goto('/run');

    /* ⚠️ Firefox under Playwright never DRAWS the leave prompt — not on a reload and
       not on `page.close({ runBeforeUnload: true })`, Playwright's own route — although
       the page has been clicked and the handler cancels the event (measured
       2026-10-11; Chromium shows the prompt in the same probe). So in Firefox the
       spec asks the page itself: does a leave get cancelled now? Same claim, same
       control, one step short of the browser's own dialog. */
    if (browserName === 'firefox') {
      const asks = () =>
        page.evaluate(() => {
          const e = new Event('beforeunload', { cancelable: true });
          window.dispatchEvent(e);
          return e.defaultPrevented;
        });
      expect(await asks(), 'CONTROL: nothing running, nothing asked').toBe(false);
      await startRun(page, LONG);
      expect(await asks()).toBe(true);
      await go(page, '/learn');
      await expect(page).toHaveURL(/\/learn$/);
      expect(await asks(), 'still asks on a public page mid-run').toBe(true);
      await go(page, '/run');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect.poll(asks, { message: 'stops asking once the run is cancelled' }).toBe(false);
      return;
    }

    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.type());
      await d.dismiss();
    });

    // CONTROL: nothing running, nothing asked.
    await page.reload();
    expect(dialogs).toEqual([]);

    await startRun(page, LONG);
    await page.reload({ timeout: 5_000 }).catch(() => {});
    await expect.poll(() => dialogs).toEqual(['beforeunload']);
    // Choosing to stay keeps the run.
    await expect(page.locator('.progress-bar-wrap')).toBeVisible();

    // And it still asks while the reader is on a PUBLIC page mid-run, where the
    // signed-in shell (and its provider) is not mounted.
    await go(page, '/learn');
    await expect(page).toHaveURL(/\/learn$/);
    dialogs.length = 0;
    await page.reload({ timeout: 5_000 }).catch(() => {});
    await expect.poll(() => dialogs).toEqual(['beforeunload']);
    await go(page, '/run');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
