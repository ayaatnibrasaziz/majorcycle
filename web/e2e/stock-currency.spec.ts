import { test, expect, type Page } from '@playwright/test';

/**
 * Money on the Stock Detail page is shown in the stock's OWN currency (audit
 * F-029, non-negotiable #13).
 *
 * ── Why this suite exists ───────────────────────────────────────────────────
 * `fmtValue` in `SmartMoneyActivity.tsx` hard-coded `$` and took no currency
 * argument at all, so it could not have printed the right symbol. Every Australian
 * and Canadian stock rendered its insider trades as "64 shares · $1K" three
 * screens below a price of "A$67.67" — and a bare `$` reads as US dollars by
 * convention, so it was wrong on every one of those pages.
 *
 * ⚠️ **The third time this exact defect has been found here.** `fmtPerShare` in
 * `lib/format.ts` says in its own docstring that it exists "mainly to fix the
 * hardcoded '$' in EarningsHistory/DividendHistory so AUD/CAD render A$/CA$". The
 * fix reached those two components and not this one — one rule, one place, and
 * this was the consumer that never received it (CLAUDE.md 11c-iv). Nothing caught
 * it because a wrong currency symbol is a perfectly plausible-looking number.
 *
 * ⚠️ The US control at the bottom is the assertion that gives this file its value.
 * Every AU expectation here is also satisfied by a component that prints "A$" on
 * *every* stock in the world, which is a different bug of the same size. Only a
 * page that must NOT say "A$" can tell a currency-aware formatter from a
 * differently-hard-coded one.
 *
 * Needs a signed-in session, but NOT a subscription: Smart Money Activity is a
 * free section (CLAUDE.md free-vs-premium — the data is free, our analysis is paid).
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

/** An ASX stock (prices in AUD) and a US one, both large enough to be durable. */
const AU = { path: '/stocks/au/BHP', symbol: 'A$', label: 'BHP Group' };
const US = { path: '/stocks/us/AAPL', symbol: '$', label: 'Apple' };

async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', EMAIL!);
  await page.fill('input#password', PASSWORD!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/stocks/, { timeout: 30_000 });
}

/**
 * The insider rows, as text. Waits on a POSITIVE signal — the section's own
 * heading — rather than a timeout, because the page streams and a body read taken
 * too early is empty and would pass every "does not contain A$" assertion for
 * entirely the wrong reason (CLAUDE.md 11q).
 */
async function insiderText(page: Page, path: string): Promise<string> {
  await page.goto(path, { waitUntil: 'load', timeout: 90_000 });
  await expect(
    page.getByText(/insider transactions/i).first(),
    'the Smart Money section never rendered — nothing below this can mean anything',
  ).toBeVisible({ timeout: 45_000 });

  const rows = await page
    .locator('.smart-event-meta')
    .allInnerTexts();

  // ⚠️ PRECONDITION, not decoration. If the stock has no insider transactions
  // stored, there are no money figures on screen and every assertion below passes
  // having measured nothing — the "unmeasurable counted as clean" failure this
  // project keeps meeting (CLAUDE.md 14g).
  expect(
    rows.length,
    `${path} rendered no insider rows at all. This suite needs a stock with ` +
      'stored insider transactions; if the data has moved, point it at another one ' +
      'rather than deleting the assertion.',
  ).toBeGreaterThan(0);

  const withValue = rows.filter((r) => /·/.test(r));
  expect(
    withValue.length,
    `${path} has insider rows but none carries a dollar value (they read like ` +
      '"64 shares" with no "· $1K" part), so the formatter under test never ran.',
  ).toBeGreaterThan(0);

  return withValue.join('\n');
}

test.describe('insider trade values carry the stock’s own currency', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test('an ASX stock shows A$, never a bare $', async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page);
    const text = await insiderText(page, AU.path);

    expect(
      text,
      `${AU.label} prices in AUD, so its insider values must read "A$…". Before ` +
        'F-029 they read "$1K" on the same page as a price of "A$67.67".',
    ).toContain('A$');

    // A bare `$` NOT preceded by an A — i.e. the pre-fix output surviving anywhere.
    expect(
      text,
      'an insider value on an ASX page is showing a bare "$", which every reader ' +
        'takes to mean US dollars',
    ).not.toMatch(/(^|[^A-Z])\$/m);
  });

  test('CONTROL — a US stock shows a bare $, never A$', async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page);
    const text = await insiderText(page, US.path);

    expect(
      text,
      'the US page must NOT say A$ — without this, a formatter hard-coded to "A$" ' +
        'would satisfy the Australian test above and this suite would prove nothing',
    ).not.toContain('A$');
    expect(text, `${US.label} prices in USD`).toMatch(/\$/);
  });
});
