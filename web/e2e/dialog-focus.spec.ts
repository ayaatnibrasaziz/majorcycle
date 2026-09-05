import { expect, test, type Page } from '@playwright/test';

/**
 * Closing a dialog returns focus to whatever opened it.
 *
 * ⚠️ AUDIT 5A-112. Radix restores focus on close to `context.triggerRef.current`, which is
 * set by `<DialogTrigger>`. **Not one dialog in this app uses `DialogTrigger`** — all eight
 * consumers drive it with external state (`open` / `onOpenChange`) from an ordinary button
 * elsewhere in the tree. So that ref is null everywhere, Radix has nothing to focus, and
 * focus falls to `<body>`.
 *
 * Measured on production: open the upgrade dialog from "Download Report", dismiss with
 * Escape or with "Not now", and `document.activeElement` is BODY three seconds later —
 * with the trigger still in the DOM as the same node, so it was not an unmount. A keyboard
 * user is dropped at the top of the document and has to tab the whole sidebar and header
 * to get back, on the paywall-conversion surface.
 *
 * ⚠️ What this file does NOT assert, because it turned out not to be a defect: the absence
 * of `aria-modal`. Radix marks every sibling of the content `aria-hidden="true"` instead —
 * verified on the live page, where the app root carries it while the dialog is open. That
 * is the stronger of the two mechanisms and reading it as a second finding was wrong. Said
 * out loud so nobody "fixes" it later.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

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

/** The locked "Download Report" button on a stock page — this account holds no plan. */
const OPENER = 'button[title="The downloadable report is included with a subscription"]';

test.describe('a dialog gives focus back', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  for (const how of ['Escape', 'Not now'] as const) {
    test(`closing with ${how} returns focus to the opener`, async ({ page }) => {
      test.setTimeout(120_000);
      await signIn(page);
      await page.goto('/stocks/us/AAPL');
      await page.waitForLoadState('domcontentloaded');

      const opener = page.locator(OPENER);
      await expect(opener).toBeVisible({ timeout: 30_000 });
      await opener.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // ⚠️ The control: prove the dialog actually took focus first. Without it a dialog
      // that never opened would "return" focus to the opener trivially and pass (14g).
      const focusInside = await page.evaluate(
        () => !!document.querySelector('[role=dialog]')?.contains(document.activeElement),
      );
      expect(focusInside, 'the dialog did not take focus, so this proves nothing').toBe(true);

      if (how === 'Escape') {
        await page.keyboard.press('Escape');
      } else {
        await dialog.getByRole('button', { name: /not now/i }).click();
      }
      await expect(dialog).toBeHidden({ timeout: 10_000 });

      // Radix restores focus asynchronously; poll rather than sampling once.
      await expect
        .poll(
          () =>
            page.evaluate(
              (sel) => document.activeElement === document.querySelector(sel),
              OPENER,
            ),
          { timeout: 5000, message: `focus did not return to the opener after ${how}` },
        )
        .toBe(true);
    });
  }
});
