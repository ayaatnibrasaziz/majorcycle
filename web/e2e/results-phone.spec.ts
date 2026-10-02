import { randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

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
        const ticker = norm(cells[0]?.textContent);
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

  test('from 768px the table is back, with no phone Sort box', async ({ page }) => {
    await openResults(page, 768);
    await expect(page.locator('.results-table')).toBeVisible();
    await expect(page.locator('#rt-sort')).toBeHidden();
    // The Market filter is on every width.
    await expect(page.getByLabel('Market')).toBeVisible();
  });
});
