import { expect, test, type Page } from '@playwright/test';

/**
 * The signed-in pages must not scroll SIDEWAYS.
 *
 * ⚠️ AUDIT 5A-116. The Stock Detail page scrolled horizontally at every viewport between
 * ~601px and ~900px — measured on production: **263px at 644px, 135px at 772px, 0 at
 * 921px**. 772px is iPad portrait, so this was a real device band rather than a contrived
 * width, and non-negotiable #3 says no horizontal scroll.
 *
 * The cause was `.ownership-grid` ("Top Institutional Holders") computing
 * `grid-template-columns: 200px 423.5px` inside a 344px container: a grid item defaults to
 * `min-width: auto`, so the `1fr` track took the holders table's min-content width and
 * refused to shrink.
 *
 * ⚠️ The fix already existed and was scoped too narrowly — the three correct rules sat
 * inside `@media (max-width: 600px)` under a comment naming this exact failure, while the
 * layout needs ~900px to fit beside the 220px sidebar. Everything in between was
 * unprotected. Shrink protection is now unconditional, the way `.km-scroll` has always
 * done it for the Key Metrics table; the media query keeps only the genuine layout choice
 * (stacking to one column).
 *
 * ⚠️ WHY THIS ASSERTS A SCROLL RATHER THAN `scrollWidth`. On the broken page
 * `documentElement.scrollWidth` was 907 against a 644 client width, but every element
 * extending past the edge was inside a scroll or clip container, so an "which element
 * overflows" probe returned **zero offenders** and read as clean. Actually scrolling the
 * window and reading `scrollX` back is the only measurement that matched what a person
 * experiences (11ab: when measurements disagree, run the experiment).
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

/** The band the defect lived in, plus a desktop width as the control. */
const WIDTHS = [640, 768, 900, 1280];

/** Signed-in routes that render a full page for an account with no subscription. */
const PATHS = ['/stocks', '/stocks/us/AAPL', '/request', '/account'];

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

/** Try to scroll the window right, and report how far it actually went. */
async function sidewaysScroll(page: Page): Promise<number> {
  return page.evaluate(async () => {
    window.scrollTo(3000, window.scrollY);
    await new Promise((r) => setTimeout(r, 250));
    const x = window.scrollX;
    window.scrollTo(0, window.scrollY);
    return Math.round(x);
  });
}

test.describe('no signed-in page scrolls sideways', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test('across the tablet band and desktop', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);

    const failures: string[] = [];
    let checked = 0;

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PATHS) {
        await page.goto(path);
        await page.waitForLoadState('domcontentloaded');
        // The stock page streams its cards in; give layout a moment to settle before
        // measuring, or an early read describes a page that is still half-built.
        await page.waitForTimeout(1200);
        checked += 1;
        const x = await sidewaysScroll(page);
        if (x > 0) failures.push(`${path} at ${width}px scrolled ${x}px`);
      }
    }

    // ⚠️ The control. Without it a run that failed to sign in, or a viewport call that
    // silently did nothing, reports a clean sweep having measured nothing (14g).
    expect(checked, 'no page/width combination was measured').toBe(WIDTHS.length * PATHS.length);

    expect(
      failures,
      `these scrolled horizontally:\n  ${failures.join('\n  ')}\n` +
        'A grid item defaults to min-width:auto — give the shrinking track min-width:0 ' +
        'and put its wide content in an overflow-x:auto wrapper, unconditionally.',
    ).toEqual([]);
  });
});
