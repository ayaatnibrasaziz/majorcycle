import { expect, test, type Page } from '@playwright/test';

/**
 * What a page FETCHES on load — the behaviour, not the byte count.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * On 2026-08-22 Lighthouse found every ticker page pulling **588 KB** of
 * offline-report bundle on load, for every viewer, including free accounts that
 * cannot use it — because the prefetch fired unconditionally while the sibling
 * call one line away checked `entitled` (CLAUDE.md 11c-iv: the rule reached one of
 * its two consumers). It had been there for weeks.
 *
 * ⚠️ **Nothing we own could have caught it.** typecheck, lint, the entitlement
 * gates, the render-mode check and 500 Playwright tests were all green, because the
 * page rendered correctly and behaved correctly — it was just heavy. A defect with
 * no wrong output has to be measured or it stays invisible.
 *
 * ── Why there are no KB budgets in THIS file ────────────────────────────────
 * Playwright boots `next dev`. Dev bundles are unminified, split differently and
 * recompile per route, so a byte budget written here would be a number about the
 * development server — several times production, and drifting with the compiler
 * cache. It would pass or fail for reasons that have nothing to do with what a
 * customer downloads, which is worse than no budget at all: it would be
 * *believed*. The real byte budgets live in `pnpm check:page-weight`, which drives
 * the production build on :3200 alongside Lighthouse.
 *
 * What belongs here is the part that is TRUE IN BOTH BUILDS: whether a request is
 * made at all. That is the defect that actually happened, and it is invariant to
 * bundling.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', EMAIL!);
  await page.fill('input#password', PASSWORD!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/stocks/, { timeout: 30_000 });
}

test.describe('nothing heavy is fetched that the reader is not waiting for', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  /* ⚠️ THERE IS NO REQUEST-COUNT CEILING HERE, and the reason is worth keeping.
     I wrote one, on the reasoning that "a count survives the dev/production split
     even when a byte budget does not". That was simply wrong, and the suite said
     so: the ticker page makes **32** requests in production and **128** under
     `next dev`, because dev serves unbundled modules — and it drifts run to run
     with the compiler cache (127 on the next attempt).

     So a ceiling here would have been a number about the development server,
     tuned until it stopped going red — which is the exact failure this file's
     header warns about, committed in the same file that warns about it. Counts
     and bytes both belong in `pnpm check:page-weight`, which drives the real
     build. What is left below is the part that genuinely does not care how the
     code was bundled: whether the request happens at all. */

  test('the report bundle is not pulled before the ticker page has loaded', async ({ page }) => {
    test.setTimeout(120_000);

    const early: string[] = [];
    let loaded = false;
    page.on('request', (r) => {
      if (!loaded && /report-bundle|report\.bundle/i.test(r.url())) early.push(r.url());
    });

    await signIn(page);
    await page.goto('/stocks/us/AAPL', { waitUntil: 'load' });
    loaded = true;

    expect(
      early,
      `the offline report bundle was fetched before load:\n  ${early.join('\n  ')}\n\n` +
        `It must wait for requestIdleCallback and fire only for an entitled viewer, so it ` +
        `never competes with the page the reader is actually waiting for.`,
    ).toEqual([]);

    /* THE CONTROL, and this test is worth nothing without it. If the page failed to
       render, or the selector below stopped matching, "no bundle was fetched" would
       be trivially true — the same unmeasurable-counts-as-clean shape that has bitten
       this repo repeatedly (CLAUDE.md 14g). Prove the ticker page really rendered. */
    await expect(page.locator('#sec-scorecard, .detail-kpi-grid').first()).toBeVisible({
      timeout: 30_000,
    });
  });


});
