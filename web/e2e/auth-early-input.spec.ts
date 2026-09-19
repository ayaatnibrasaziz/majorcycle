import { expect, test, type Page } from '@playwright/test';
import { HAVE_E2E_CREDENTIALS, signIn } from './lib/session';

/**
 * Layer H4, 2026-09-19 — a reader on a slow connection must not lose what they typed.
 * Covers every form that takes typing (owner: all seven, one mechanism —
 * `lib/useHydrated.ts`); the set-new-password page is the one not driven here,
 * because it only renders inside a password-recovery session.
 *
 * Found by the cross-browser run: in WebKit every signed-in test failed at sign-in,
 * because WebKit's dev server hydrates slowly enough that Playwright typed into the
 * form before React owned it. Reproduced in all three engines with the scripts
 * delayed, so it was never an engine difference — WebKit just landed in a window
 * every engine has. Measured on the live `/login`: ~2.9s on slow 4G, ~6s on 3G.
 *
 * Two failures, both now asserted:
 *  1. press before the scripts arrive → native submit → the page RELOADS, typing gone;
 *  2. type early, press after → React wrote its empty state back over the boxes and
 *     sent an EMPTY email.
 *
 * ⚠️ The auth request is INTERCEPTED and answered here, never sent: this is about
 * what the form hands over, and a real sign-up would create an account per run.
 */

const TYPED = 'early-typist@example.com';
const SCRIPT_DELAY_MS = 3_000;

/** Every script arrives late — the slow phone connection, simulated. */
async function slowScripts(page: Page) {
  await page.route('**/_next/static/**/*.js', async (route) => {
    await new Promise((r) => setTimeout(r, SCRIPT_DELAY_MS));
    await route.continue();
  });
}

/** Capture what the form sends to Supabase, and answer with a refusal. */
function captureAuth(page: Page): { sent: string[] } {
  const box = { sent: [] as string[] };
  void page.route('**/auth/v1/**', async (route) => {
    const body = route.request().postData() ?? '';
    try {
      box.sent.push((JSON.parse(body) as { email?: string }).email ?? '');
    } catch {
      box.sent.push('');
    }
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 400, error_code: 'probe', msg: 'Invalid login credentials' }),
    });
  });
  return box;
}

for (const form of [
  { path: '/login', button: /^sign in$/i, password: 'not-a-real-password' as string | null },
  { path: '/signup', button: /^create free account$/i, password: 'not-a-real-password-1' },
  { path: '/reset-password', button: /^send reset link$/i, password: null },
]) {
  test.describe(`${form.path} on a slow connection`, () => {
    test('the button cannot be pressed before the page is ready', async ({ page }) => {
      await slowScripts(page);
      await page.goto(form.path, { waitUntil: 'domcontentloaded' });
      // The form is on screen, the scripts are not — the window a reader can land in.
      await expect(page.locator('input#email')).toBeVisible();
      await expect(
        page.getByRole('button', { name: form.button }),
        'the submit button is live before React owns the form — a press here reloads the page and wipes what was typed',
      ).toBeDisabled();
      // CONTROL: it does become pressable, or "disabled" would pass by breaking the form.
      await expect(page.getByRole('button', { name: form.button })).toBeEnabled({
        timeout: 30_000,
      });
    });

    test('what was typed before the page was ready is what gets sent', async ({ page }) => {
      await slowScripts(page);
      const auth = captureAuth(page);
      await page.goto(form.path, { waitUntil: 'domcontentloaded' });
      await page.fill('input#email', TYPED);
      if (form.password) await page.fill('input#password', form.password);

      const button = page.getByRole('button', { name: form.button });
      await expect(button).toBeEnabled({ timeout: 30_000 });
      await button.click();

      await expect.poll(() => auth.sent.length, { message: 'the form never sent anything' }).toBeGreaterThan(0);
      expect(auth.sent[0], 'the form sent something other than what the reader typed').toBe(TYPED);
      // And the boxes still show it — the old defect emptied them in front of the reader.
      await expect(page.locator('input#email')).toHaveValue(TYPED);
    });
  });
}

test.describe('/account on a slow connection', () => {
  test.skip(!HAVE_E2E_CREDENTIALS, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test('a name typed before the page is ready is kept, and the other buttons wait', async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    await slowScripts(page);
    await page.goto('/account', { waitUntil: 'domcontentloaded' });

    const name = page.locator('input#displayName');
    await expect(name).toBeVisible({ timeout: 30_000 });
    // Before React owns the page: the buttons that SEND must not be pressable.
    await expect(page.getByRole('button', { name: /^send invite$/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /update password|change password/i })).toBeDisabled();

    const typed = `Early ${Date.now() % 100000}`;
    await name.fill(typed);

    // Once ready, the form must KNOW about the typing: "Save changes" becomes
    // pressable only when React's state differs from what is saved — which is
    // exactly what was lost before (the box showed the name, the form did not).
    await expect(page.getByRole('button', { name: /^send invite$/i })).toBeEnabled({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: /^save changes$/i }),
      'the name typed before the page was ready never reached the form',
    ).toBeEnabled();
    await expect(name).toHaveValue(typed);
  });
});
