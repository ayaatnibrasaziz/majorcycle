import { test, expect } from '@playwright/test';

/**
 * Auth + routing regression suite.
 *
 * Encodes the security guarantees hardened in F0.5/F0.6 so they can't silently
 * regress: middleware gating of protected routes, public-path access, security
 * headers, the auth-aware 404, and the recovery-confinement invariants (incl. the
 * F0.6 fix — a stale recovery marker must NOT be able to trap a session).
 *
 * The credential-free tests always run. The authenticated matrix (bottom) runs
 * only when E2E_EMAIL + E2E_PASSWORD are set, so CI can exercise the full flow
 * with a dedicated test account without hard-coding secrets.
 */

const PROTECTED_ROUTES = ['/results', '/run', '/stocks', '/request'];
const BUILT_PUBLIC_PAGES = [
  '/login',
  '/signup',
  '/reset-password',
  '/disclaimer',
  '/terms',
  '/privacy',
  '/methodology',
  '/contact',
];

test.describe('unauthenticated gating', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`redirects ${route} to /login with next param`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login\?next=/);
    });
  }

  test('gates /account/update-password (not a public path)', async ({ page }) => {
    await page.goto('/account/update-password');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('public pages render', () => {
  for (const route of BUILT_PUBLIC_PAGES) {
    test(`${route} returns 200`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res?.status(), `${route} status`).toBe(200);
    });
  }

  test('login page has the expected controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /start your free trial/i })).toBeVisible();
  });
});

test.describe('security headers', () => {
  test('/login carries the hardening headers', async ({ page }) => {
    const res = await page.goto('/login');
    const h = res!.headers();
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toBeTruthy();
    // CSP ships report-only until the enforcing flip (F4).
    expect(h['content-security-policy-report-only']).toContain("default-src 'self'");
  });
});

test.describe('security.txt (RFC 9116)', () => {
  test('is publicly reachable as text/plain', async ({ request }) => {
    const res = await request.get('/.well-known/security.txt');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/plain');
    expect(await res.text()).toContain('Contact:');
  });
});

test.describe('auth-aware 404', () => {
  test('an arbitrary unknown (non-public) path redirects a logged-out user to /login', async ({
    page,
  }) => {
    // The auth gate runs before rendering, so unknown gated paths never reach the
    // 404 page for a logged-out visitor — they are sent to sign-in.
    await page.goto('/this-route-does-not-exist-xyz');
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('a bad URL under a PUBLIC prefix renders the auth-aware 404 with "Back to sign in"', async ({
    page,
  }) => {
    // `/login/...` is treated as public, so middleware lets it through and Next
    // renders the auth-aware not-found — which, logged-out, must offer sign-in.
    await page.goto('/login/__no_such_page__');
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to sign in/i })).toHaveAttribute(
      'href',
      '/login'
    );
  });
});

test.describe('recovery-confinement invariants (F0.6)', () => {
  test('a stale recovery marker WITHOUT a session cannot confine — logged-out user still goes to /login, not update-password', async ({
    context,
    page,
  }) => {
    // Simulate a leftover marker in the browser with no Supabase session.
    await context.addCookies([
      {
        name: 'mc_pw_recovery',
        value: '00000000-0000-0000-0000-000000000000',
        domain: 'localhost',
        path: '/',
      },
    ]);
    await page.goto('/results');
    // No session → the auth gate wins; the confinement redirect must NOT fire.
    await expect(page).toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/update-password/);
  });
});

// ── Authenticated matrix — only with a dedicated test account ────────────────
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('authenticated flows', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test('email login → /results, sign-out → /login, re-gate works', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#email', EMAIL!);
    await page.fill('input#password', PASSWORD!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/results/);

    // A fresh login must have cleared any recovery marker (F0.6 self-heal).
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'mc_pw_recovery')).toBeUndefined();

    // First-login onboarding/disclaimer modal (decision #23) may overlay the app
    // for a brand-new test account — acknowledge it so the sidebar is clickable.
    const ack = page.locator('#ack');
    if (await ack.isVisible().catch(() => false)) {
      await ack.click();
      await page.getByRole('button', { name: /continue to majorcycle/i }).click();
    }

    // Sign out via the sidebar control.
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // Session gone → protected route re-gates.
    await page.goto('/results');
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
