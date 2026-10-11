import { expect, test } from '@playwright/test';

import { HAVE_SERVICE_ROLE, createThrowawayUser } from './lib/throwawayUser';
import { signInAs } from './lib/session';

/**
 * Signing up shows the documents it binds you to (beta review A-22 / F-13, D-10).
 * The Terms say they apply "by creating an account" and the Privacy Policy carries the
 * overseas-storage disclosure, yet neither was shown or linked on the way in.
 */

for (const path of ['/signup', '/login']) {
  test(`${path} names the Terms and the Privacy Policy, and links both`, async ({ page }) => {
    await page.goto(path);
    const line = page.getByText(/you agree to our/i);
    await expect(line).toBeVisible();
    await expect(line.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    await expect(line.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  });
}

test.describe('the first-login screen', () => {
  test.skip(!HAVE_SERVICE_ROLE, 'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to run');
  test.setTimeout(180_000);

  test('links the documents it asks you to accept, and lets you sign out instead', async ({ page }) => {
    const user = await createThrowawayUser('firstterms', { acknowledged_disclaimer_at: null });
    try {
      await signInAs(page, user.email, user.password);
      const gate = page.getByRole('dialog');
      await expect(gate).toBeVisible({ timeout: 60_000 });
      await expect(gate.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
      await expect(gate.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
      await gate.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    } finally {
      await user.remove();
    }
  });
});
