/**
 * An ⓘ opens on ONE tap on a phone — and still closes the ways it always did.
 *
 * THE DEFECT (2026-09-28, found adding the two Smart Money line tooltips): on Android
 * Chrome a tap fires mouseenter, focus and click in one burst. The first two opened
 * the bubble and the click toggled it shut, so the first tap did nothing and a second
 * tap opened it — on every InfoTip in the product. iPhone Safari was fine, which is
 * why the H4 cross-browser pass could not have told the two apart without a tap.
 * Measured before the fix in Playwright's touch emulation: Chromium open=0, WebKit
 * open=1.
 *
 * ⚠️ The controls matter as much as the finding. "Never close on a click" passes the
 * first test and leaves a bubble nobody can dismiss, so a second tap on the same icon
 * and a tap elsewhere must both still close it, and a desktop click after hovering
 * must still toggle.
 */

import { expect, test, type Page } from '@playwright/test';

import { HAVE_E2E_CREDENTIALS, signIn } from './lib/session';

const PAGE = '/stocks/us/AAPL';

async function lineTips(page: Page) {
  await page.goto(PAGE);
  const grid = page.locator('.smart-money-grid');
  await grid.scrollIntoViewIfNeeded();
  const tips = grid.locator('.smart-section-basis button');
  // Both lines render only once the section has data; AAPL always has insider
  // filings and analyst events. Precondition, so an empty section cannot pass.
  await expect(tips).toHaveCount(2, { timeout: 60_000 });
  await settled(tips.first());
  return tips;
}

/* ⚠️ Wait until the icon has STOPPED MOVING. Sections above the card keep loading
   and push it down; an icon that moves out from under a resting pointer gets a
   mouseleave and, when the pointer returns, a fresh open — so the desktop control
   below failed 1 run in 4 on a layout shift, not on the component. */
async function settled(loc: ReturnType<Page['locator']>) {
  let last = '';
  let same = 0;
  for (let i = 0; i < 60 && same < 3; i++) {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    const now = b ? `${Math.round(b.x)},${Math.round(b.y)}` : '';
    same = now && now === last ? same + 1 : 0;
    last = now;
    await loc.page().waitForTimeout(300);
  }
  expect(same, 'the Smart Money card never stopped moving').toBeGreaterThanOrEqual(3);
}

const bubble = (page: Page) => page.getByRole('tooltip');

test.describe('on a phone', () => {
  test.skip(!HAVE_E2E_CREDENTIALS, 'set E2E_EMAIL + E2E_PASSWORD to run');
  test.skip(({ browserName }) => browserName === 'firefox', 'Firefox has no touch emulation (isMobile)');
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('one tap opens each Smart Money ⓘ; a second tap and a tap elsewhere close it', async ({ page }) => {
    await signIn(page);
    const tips = await lineTips(page);
    const want = [/Award, Gift and Other filings are listed but not counted/, /Each firm is counted once/];
    for (let i = 0; i < 2; i++) {
      const tip = tips.nth(i);
      await tip.scrollIntoViewIfNeeded();

      await tip.tap();
      await expect(bubble(page)).toHaveCount(1);
      await expect(bubble(page)).toHaveText(want[i]!);

      await page.waitForTimeout(600); // a separate gesture, past the same-tap window
      await tip.tap();
      await expect(bubble(page)).toHaveCount(0);

      await tip.tap();
      await expect(bubble(page)).toHaveCount(1);
      await page.touchscreen.tap(5, 700);
      await expect(bubble(page)).toHaveCount(0);
    }
  });
});

test.describe('on a desktop', () => {
  test.skip(!HAVE_E2E_CREDENTIALS, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test('CONTROL: hover opens, a later click still closes it', async ({ page }) => {
    await signIn(page);
    const tip = (await lineTips(page)).first();
    await tip.hover();
    await expect(bubble(page)).toHaveCount(1);
    await page.waitForTimeout(600);
    await tip.click();
    await expect(bubble(page)).toHaveCount(0);
  });
});
