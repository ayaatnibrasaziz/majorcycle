import { expect, test, type Page } from '@playwright/test';

import { HAVE_E2E_CREDENTIALS, signIn } from './lib/session';
import { SHELL_DESKTOP_MIN_PX } from '../lib/shell';

/**
 * The signed-in navigation drawer, below 768px (Layer H · H1).
 *
 * ⚠️ **A drawer is easy to build and easy to build badly**, and the approved design
 * says as much: the six behaviours below are not polish, each is a way a reader gets
 * stuck. `app-responsive.spec.ts` proves the page FITS; nothing there would notice a
 * menu that traps a keyboard user, or one that stays open over the page it just
 * navigated to. A layout guard is not a behaviour guard.
 *
 * ⚠️ And the nav is the one control a phone reader cannot route around. On a desktop
 * the rail is always on screen; below 768px this is the ONLY way to reach Browse, Run,
 * Results or Request without typing a URL.
 *
 * The behaviours come from Radix's Dialog rather than from a hand-rolled panel, which
 * is why this file mostly asserts OUTCOMES (focus landed here, the panel closed) rather
 * than implementation: the point is that the reader is not stuck, whoever implements it
 * (11d — guard the artifact, not the source it came from).
 */

const PHONE = { width: 375, height: 812 };

const drawer = (page: Page) => page.getByRole('dialog', { name: /main navigation/i });

/**
 * ⚠️ Located by a DATA HOOK, not by its accessible name. The account button beside it
 * is labelled "<email> - account menu", so `getByRole('button', { name: /menu/i })`
 * matches both and every test in this file failed on a strict-mode violation the first
 * time it ran. That was the TEST being wrong, not the product (11aw) - two controls
 * whose names both end in "menu" is fine for a reader, who has their positions and
 * their full labels.
 */
const toggle = (page: Page) => page.locator('[data-shell-menu-toggle]');

async function openDrawer(page: Page) {
  await toggle(page).click();
  await expect(drawer(page)).toBeVisible();
}

async function phoneHome(page: Page) {
  await page.setViewportSize(PHONE);
  await signIn(page);
  await page.goto('/stocks');
  await expect(toggle(page)).toBeVisible({ timeout: 30_000 });
}

test.describe('the phone navigation drawer', () => {
  test.skip(!HAVE_E2E_CREDENTIALS, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test('it exists only below the breakpoint', async ({ page }) => {
    await phoneHome(page);
    await expect(toggle(page), 'no menu button on a phone — the nav is unreachable').toBeVisible();

    await page.setViewportSize({ width: SHELL_DESKTOP_MIN_PX, height: 900 });
    /* THE CONTROL. Without it, a build that shipped the menu button at EVERY width
       would satisfy every other test in this file while putting a redundant control
       next to a permanently visible sidebar. */
    await expect(
      toggle(page),
      `the menu button is still there at ${SHELL_DESKTOP_MIN_PX}px, beside the rail it duplicates`,
    ).toBeHidden();
  });

  test('Escape closes it AND returns focus to the button', async ({ page }) => {
    await phoneHome(page);
    /* Opened the way a KEYBOARD reader opens it — reach the button, press Enter —
       because that is whose focus this test is about (Layer H4). Clicking left focus
       on the button in Chromium and on the page in Safari, which never focuses a
       clicked button; the dialog restores whatever was focused before it opened, so
       a Safari mouse user correctly gets the page back and this failed on nothing. */
    await toggle(page).focus();
    await page.keyboard.press('Enter');
    await expect(drawer(page)).toBeVisible();

    /* Focus must be INSIDE the drawer once it opens, or "focus returns" is a claim
       about a journey that never started. */
    expect(
      await page.evaluate(() => {
        const d = document.querySelector('[data-shell-drawer]');
        return !!d && !!document.activeElement && d.contains(document.activeElement);
      }),
      'focus is not inside the drawer after opening it',
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(drawer(page)).toBeHidden();

    /* ⚠️ THE HALF THAT GOES WRONG SILENTLY. A keyboard reader who dismisses the menu
       and is dropped on <body> has to tab the whole header to get back — audit 5A-112
       found exactly that on the paywall dialog, where Radix had no trigger ref to
       restore to. Here the button IS a real `DialogTrigger`, and this asserts the
       outcome rather than the mechanism. */
    /* Polled, not sampled: the dialog hands focus back asynchronously, and WebKit
       takes a beat longer than Chromium — a single read went flaky there (Layer H4).
       `dialog-focus.spec.ts` polls for the same reason. */
    await expect
      .poll(
        () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
        { timeout: 5000, message: 'Escape left focus somewhere other than the menu button' },
      )
      .toMatch(/menu/i);
  });

  test('tapping the backdrop closes it', async ({ page }) => {
    await phoneHome(page);
    await openDrawer(page);
    // The drawer is 260px wide at most; 340px is over the scrim, on the page behind.
    await page.mouse.click(340, 400);
    await expect(drawer(page)).toBeHidden();
  });

  test('it closes on navigation, rather than covering the page it just opened', async ({ page }) => {
    await phoneHome(page);
    await openDrawer(page);

    await drawer(page).getByRole('link', { name: /request a ticker/i }).click();
    await expect(page).toHaveURL(/\/request/);
    /* The shell survives navigation, so without an explicit close the reader taps
       "Request a Ticker" and arrives at Request with the menu still over it. */
    await expect(drawer(page), 'the drawer is still open on the page it navigated to').toBeHidden();
  });

  test('focus stays inside while it is open', async ({ page }) => {
    await phoneHome(page);
    await openDrawer(page);

    /* Tab further than the drawer has stops, so an untrapped focus ring would have
       walked out into the page behind the scrim — where a reader cannot see where
       they are. */
    const escaped: string[] = [];
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const d = document.querySelector('[data-shell-drawer]');
        const a = document.activeElement;
        return {
          inside: !!d && !!a && d.contains(a),
          what: a ? `${a.tagName.toLowerCase()}.${(a.className || '').toString().slice(0, 30)}` : 'none',
        };
      });
      if (!inside.inside) escaped.push(`tab ${i + 1}: ${inside.what}`);
    }
    expect(escaped, `focus left the open drawer:\n  ${escaped.join('\n  ')}`).toEqual([]);
  });

  test('its rows are thumb-sized', async ({ page }) => {
    await phoneHome(page);
    await openDrawer(page);

    const rows = await drawer(page).locator('a, button').all();
    const short: string[] = [];
    let measured = 0;
    for (const row of rows) {
      const box = await row.boundingBox();
      const label = ((await row.textContent()) ?? '').trim() || (await row.getAttribute('aria-label')) || '?';
      if (!box) continue;
      measured += 1;
      if (box.height < 38) short.push(`"${label}" is ${Math.round(box.height)}px`);
    }
    /* THE CONTROL: "no row is too short" is satisfied perfectly by a drawer with no
       rows in it, which is exactly what a broken render produces. */
    expect(measured, 'no rows were measured — the drawer rendered empty').toBeGreaterThanOrEqual(5);
    expect(
      short,
      `these drawer controls are under the 38px this shell uses for touch targets:\n  ${short.join('\n  ')}`,
    ).toEqual([]);
  });

  test('the toggle says whether it is open', async ({ page }) => {
    await phoneHome(page);
    const button = toggle(page);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(drawer(page)).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
