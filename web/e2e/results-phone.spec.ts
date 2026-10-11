import { randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

import { RUNNING_KEY } from '../lib/analysis';
import { RUN_SNAPSHOT, RUN_SNAPSHOT_ROWS, SNAPSHOT_KEY } from './fixtures/runSnapshot';
import { signInAs } from './lib/session';

/**
 * The phone Results page (owner-approved design, 2026-10-02).
 *
 * Until then a phone showed the same four boxes per stock whatever the Simple /
 * Analyst / Full switch said, had no way to sort, and there was no Market filter
 * anywhere. These drive the real page, signed in as a throwaway PAID account (the
 * screener is premium, so a free session would measure the upsell — 11bd).
 *
 * ⚠️ The load-bearing test is the PARITY one: every value on a phone card must read
 * exactly as the same cell in the desktop table. Both are in the DOM at once (one is
 * hidden by width), so the comparison needs no second page load.
 */

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const GROUPS = {
  Simple: [] as string[],
  Analyst: ['MajorCycle Verdict', 'Price & Analyst Targets', 'Major Cycle'],
  Full: [
    'MajorCycle Verdict',
    'Price & Analyst Targets',
    'Major Cycle',
    'Valuation Ratios',
    'Profitability & Health',
    'Growth & Sentiment',
  ],
};

async function openResults(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/stocks');
  await page.evaluate(
    ([key, snap]) => sessionStorage.setItem(key as string, JSON.stringify(snap)),
    [SNAPSHOT_KEY, RUN_SNAPSHOT] as const,
  );
  await page.goto('/results');
  await expect(page.locator('.result-card')).toHaveCount(RUN_SNAPSHOT_ROWS, { timeout: 30_000 });
}

const firstColumn = (page: Page) =>
  page.locator('.result-card .result-card-ticker').allTextContents();

test.describe('the Results page on a phone', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!SERVICE_KEY || !SUPABASE_URL, 'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to run');

  let admin: SupabaseClient;
  let userId = '';
  let email = '';
  let password = '';

  test.beforeAll(async () => {
    const run = randomUUID().slice(0, 12);
    email = `phone-e2e-${run}@example.com`;
    password = `E2e!phone-${run}`;
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data?.user) throw new Error(`could not create user: ${error?.message}`);
    userId = data.user.id;
    const { error: upd } = await admin
      .from('profiles')
      .update({
        subscription_status: 'active',
        grace_until: null,
        billing_blocked: false,
        acknowledged_disclaimer_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (upd) throw new Error(`could not grant entitlement: ${upd.message}`);
  });

  test.afterAll(async () => {
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  test.beforeEach(async ({ page }) => {
    await signInAs(page, email, password);
  });

  test('each detail level shows its own groups on the card', async ({ page }) => {
    await openResults(page, 375);
    for (const [mode, groups] of Object.entries(GROUPS)) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      const shown = await page.locator('.result-card').first().locator('.result-card-band').allTextContents();
      expect(shown.map((s) => s.trim()), `${mode} view`).toEqual(groups);
    }
  });

  test('a card reads exactly as the desktop table does, cell for cell', async ({ page }) => {
    await openResults(page, 375);
    await page.getByRole('button', { name: 'Full', exact: true }).click();
    const mismatches = await page.evaluate(() => {
      const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
      const heads = [...document.querySelectorAll('.results-table thead tr:last-child th')].map((th) =>
        norm(th.childNodes[0]?.textContent),
      );
      const out: string[] = [];
      let compared = 0;
      for (const tr of document.querySelectorAll('.results-table tbody tr')) {
        const cells = [...tr.querySelectorAll('td')];
        // The symbol only: the cell also carries the market tag (US/AU/CA).
        const ticker = norm(cells[0]?.querySelector('.ticker-cell')?.childNodes[0]?.textContent);
        const card = [...document.querySelectorAll('.result-card')].find(
          (c) => norm(c.querySelector('.result-card-ticker')?.textContent) === ticker,
        );
        if (!card) { out.push(`${ticker}: no card`); continue; }
        for (const stat of card.querySelectorAll('.result-card-stat')) {
          const label = norm(stat.querySelector('.result-card-stat-label')?.textContent);
          const i = heads.indexOf(label);
          if (i < 0) { out.push(`${ticker}: card label "${label}" is not a table column`); continue; }
          const a = norm(stat.querySelector('.result-card-stat-val')?.textContent);
          const b = norm(cells[i]?.textContent);
          compared++;
          if (a !== b) out.push(`${ticker} ${label}: card "${a}" vs table "${b}"`);
        }
      }
      return { out, compared };
    });
    // CONTROL: the comparison really ran over every card's boxes.
    expect(mismatches.compared).toBeGreaterThan(RUN_SNAPSHOT_ROWS * 20);
    expect(mismatches.out).toEqual([]);
  });

  test('Sort by reorders the cards, and the arrow flips the order', async ({ page }) => {
    await openResults(page, 375);
    const tickers = RUN_SNAPSHOT.results.map((r) => r.ticker);
    await page.getByLabel('Sort by').selectOption('ticker');
    expect(await firstColumn(page)).toEqual([...tickers].sort());
    await page.locator('.rt-sort-dir').click();
    expect(await firstColumn(page)).toEqual([...tickers].sort().reverse());
    // CONTROL: the default order is by Overall, highest first, and differs from both.
    await page.getByLabel('Sort by').selectOption('overall');
    expect((await firstColumn(page))[0]).toBe('AAAA');
  });

  test('the Market filter narrows the cards and the map', async ({ page }) => {
    await openResults(page, 375);
    await page.getByLabel('Market').selectOption('au');
    await expect(page.locator('.result-card')).toHaveCount(0);
    await expect(page.getByText('No stocks match your filters')).toBeVisible();
    await page.getByLabel('Market').selectOption('us');
    await expect(page.locator('.result-card')).toHaveCount(RUN_SNAPSHOT_ROWS);
  });

  test('a finished screen opens in a NEW tab, and signing out removes it', async ({ page, context }) => {
    // Kept per account in localStorage (lib/analysis.tsx), so a second tab finds it.
    await page.goto('/stocks');
    const key = `mc:analysis-last-v1:${userId}`;
    await page.evaluate(
      ([k, snap, owner]) => localStorage.setItem(k as string, JSON.stringify({ ...(snap as object), owner })),
      [key, RUN_SNAPSHOT, userId] as const,
    );
    const tab = await context.newPage();
    await tab.goto('/results');
    await expect(tab.locator('.results-table tbody tr')).toHaveCount(RUN_SNAPSHOT_ROWS, { timeout: 30_000 });
    // CONTROL: a copy belonging to ANOTHER account is never shown.
    await tab.evaluate(([k]) => {
      const v = JSON.parse(localStorage.getItem(k as string) ?? '{}');
      localStorage.setItem(k as string, JSON.stringify({ ...v, owner: 'someone-else' }));
      sessionStorage.clear();
    }, [key] as const);
    await tab.reload();
    await expect(tab.getByText('No analysis run yet')).toBeVisible({ timeout: 30_000 });
    await tab.close();

    await page.evaluate(([k, snap, owner]) => localStorage.setItem(k as string, JSON.stringify({ ...(snap as object), owner })), [key, RUN_SNAPSHOT, userId] as const);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: email }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await page.waitForURL('**/login');
    const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mc:analysis')));
    expect(left).toEqual([]);
  });

  test('a run cut off by a reload is named on Run and Results, and the older run is not offered as it', async ({ page }) => {
    await page.goto('/stocks');
    // An earlier finished run in this tab, then a run that was still going when the page reloaded.
    await page.evaluate(
      ([snapKey, snap, runKey]) => {
        sessionStorage.setItem(snapKey as string, JSON.stringify(snap));
        sessionStorage.setItem(runKey as string, JSON.stringify({ tickerCount: 9, startedAt: new Date().toISOString() }));
      },
      [SNAPSHOT_KEY, RUN_SNAPSHOT, RUNNING_KEY] as const,
    );
    await page.goto('/run');
    await expect(page.getByText('Your last run did not finish.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('screening 9 stocks')).toBeVisible();
    // The OLDER run's "complete" summary and the re-run card stay away.
    await expect(page.getByRole('button', { name: 'View Full Results' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Re-run', exact: true })).toHaveCount(0);

    await page.goto('/results');
    await expect(page.getByText('The results below are from your previous, finished run.')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await page.reload();
    await expect(page.locator('.result-card')).toHaveCount(RUN_SNAPSHOT_ROWS, { timeout: 30_000 });
    // CONTROL: once dismissed it does not come back on the next load.
    await expect(page.getByText('Your last run did not finish.')).toHaveCount(0);
  });

  test('from 768px the table is back, with no phone Sort box', async ({ page }) => {
    await openResults(page, 768);
    await expect(page.locator('.results-table')).toBeVisible();
    await expect(page.locator('#rt-sort')).toBeHidden();
    // The Market filter is on every width.
    await expect(page.getByLabel('Market')).toBeVisible();
  });
});
