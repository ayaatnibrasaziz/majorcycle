import { test, expect } from '@playwright/test';

/**
 * MAJORCYCLE-WEB-D: a Contact page opened BEFORE a deploy posts a server-action id the new
 * deployment does not know. Next answers 404 with `x-nextjs-action-not-found: 1`, the client
 * throws `UnrecognizedActionError`, and the form used to fall through to the error page with
 * the reader's message gone. Vercel's fix (Skew Protection) is a Pro feature, so the form
 * catches it instead. This makes the server answer exactly as a newer deployment does.
 */
test('a send from a page older than the deploy keeps the message and says what to do', async ({ page }) => {
  await page.goto('/contact');
  const form = page.locator('form').filter({ has: page.locator('#message') });
  // Wait until React owns the form; before that a press is a native POST (auth-early-input).
  await page.waitForFunction(() => {
    const f = document.querySelector('form textarea#message')?.closest('form');
    return !!f && Object.keys(f).some((k) => k.startsWith('__react'));
  });

  let intercepted = 0;
  await page.route('**/contact', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST' || !req.headers()['next-action']) return route.continue();
    intercepted++;
    await route.fulfill({ status: 404, headers: { 'x-nextjs-action-not-found': '1' }, body: 'Server action not found.' });
  });

  const message = 'Hello, this is a test message that must survive a stale deploy.';
  await form.locator('#name').fill('Stale Page');
  await form.locator('#email').fill('stale-page@example.com');
  await form.locator('#message').fill(message);
  await form.getByRole('button', { name: /send message/i }).click();

  await expect(form.getByRole('alert')).toContainText(/updated while this page was open/i);
  expect(intercepted, 'the send really went through the stale-deploy answer').toBe(1);
  // The whole point: nothing the reader typed is lost, and the page did not fall over.
  await expect(form.locator('#message')).toHaveValue(message);
  await expect(form.locator('#email')).toHaveValue('stale-page@example.com');
  await expect(page.getByRole('button', { name: /send message/i })).toBeEnabled();
});
