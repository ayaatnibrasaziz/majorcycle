import { expect, test } from '@playwright/test';

import { HAVE_E2E_CREDENTIALS, signIn } from './lib/session';

/**
 * Four small fixes from the beta review (owner-approved, 2026-10-03), each driven on
 * the real page: the sign-in link keeps the whole address, the contact form keeps a
 * rejected message, a failed ticker request reads as a failure, and a keyboard reader
 * can skip the menu.
 */

test.describe('signing in comes back to the WHOLE link', () => {
  test('a signed-out visitor is sent to sign in with the query kept', async ({ page }) => {
    await page.goto('/stocks/us/AAPL?preset=long');
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).searchParams.get('next')).toBe('/stocks/us/AAPL?preset=long');
  });

  test('someone already signed in follows a sign-in link to where it was going', async ({ page }) => {
    test.skip(!HAVE_E2E_CREDENTIALS, 'needs the E2E account');
    await signIn(page);
    await page.goto(`/login?next=${encodeURIComponent('/stocks/us/AAPL?preset=long')}`);
    await expect(page).toHaveURL(/\/stocks\/us\/AAPL\?preset=long$/);
    // CONTROL: a hostile destination is refused, exactly as before — Browse.
    for (const bad of ['//evil.com/x', '/\t/evil.com', 'https://evil.com']) {
      await page.goto(`/login?next=${encodeURIComponent(bad)}`);
      await expect(page, bad).toHaveURL(/\/stocks$/);
    }
  });
});

test('the contact form keeps what was typed when the server refuses it', async ({ page }) => {
  await page.goto('/contact');
  // A name the browser accepts ("a " is two characters) and the server does not
  // (one letter once trimmed) — so the message never sends, and nothing is emailed.
  await page.getByLabel('Name').fill('a ');
  await page.getByLabel('Email').fill('reader@example.com');
  const message = 'The BHP chart on my phone stops at 2024. Is that expected?';
  await page.getByLabel('Message').fill(message);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Message')).toHaveValue(message);
  await expect(page.getByLabel('Email')).toHaveValue('reader@example.com');
});

test('a failed ticker request reads as a failure, not a success', async ({ page }) => {
  test.skip(!HAVE_E2E_CREDENTIALS, 'needs the E2E account');
  await signIn(page);
  await page.goto('/request');
  await page.route('**/api/request-ticker', (r) =>
    r.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'We could not check that listing just now. Please try again in a minute.' }),
    }),
  );
  await page.getByPlaceholder(/ticker|company/i).first().fill('PLSE');
  const request = page.getByRole('button', { name: /^Request/ }).first();
  await request.waitFor({ timeout: 30_000 });
  await request.click();
  const note = page.locator('.req-notice');
  await expect(note).toHaveClass(/req-notice--error/);
  await expect(note).toHaveAttribute('role', 'alert');
  await expect(note).toContainText('could not check that listing');
});

test('the first Tab on a page reaches "Skip to main content", and it works', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.locator('main')).toBeVisible();
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  // CONTROL: until it is focused it is off screen, so a mouse reader never sees it.
  const hidden = await skip.boundingBox();
  expect(hidden && hidden.y + hidden.height <= 0, 'off screen until focused').toBe(true);
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  // It slides in over 0.12s, so wait for it to arrive rather than reading mid-slide.
  await expect
    .poll(async () => ((await skip.boundingBox())?.y ?? -1) >= 0, { message: 'the focused link is on screen' })
    .toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
});
