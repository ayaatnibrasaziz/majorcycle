import type { Page } from '@playwright/test';

/**
 * Let a test submit a real auth form once Supabase enforces the human check.
 *
 * ── The problem ──────────────────────────────────────────────────────────────
 * Supabase verifies every Turnstile token against the PRODUCTION secret, and the
 * test suite shares the production Supabase project. Tests run the real widget
 * with Cloudflare's always-pass TEST site key (lib/turnstile.ts), whose dummy
 * token the real secret rightly rejects. So a form that is correct would be
 * refused in every test run.
 *
 * ── The way through, and why it is safe ──────────────────────────────────────
 * The auth server skips the check for a request carrying ADMIN credentials
 * (`verifyCaptcha` → `requireAdminCredentials`, read from its source). This
 * rewrites ONLY the browser's requests to Supabase's auth endpoints that are
 * captcha-checked, replacing the anon bearer with the service-role key:
 *
 * - it runs in the test runner's network layer — the page's own JavaScript never
 *   sees the key, and nothing in the product ships it;
 * - it touches nothing else: not our own server, not Google, not the data API;
 * - the sign-up handler behaves identically for admin requests (confirmation
 *   email, no auto-confirm — read from `signup.go`), so the flow under test is the
 *   real one.
 *
 * What it therefore CANNOT prove: that production accepts a real token. That is
 * checked by hand on the live site when the key is switched on, and recorded in
 * docs/architecture.md.
 *
 * No service key (a fork PR) ⇒ does nothing, and such runs have no sign-in
 * credentials anyway.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** The auth routes `verifyCaptcha` guards. `/token` only for the password grant. */
const GUARDED = /\/auth\/v1\/(signup|recover|otp|magiclink|resend|token)(\?|$)/;

export async function passCaptchaForTests(page: Page): Promise<void> {
  if (!SERVICE_KEY || !SUPABASE_URL) return;
  const origin = new URL(SUPABASE_URL).origin;
  await page.route(
    (url) => url.origin === origin && GUARDED.test(url.pathname + url.search),
    async (route) => {
      const req = route.request();
      // Leave the preflight and every other token grant (refresh, PKCE) alone.
      const isPasswordGrant = !req.url().includes('/token') || req.url().includes('grant_type=password');
      if (req.method() !== 'POST' || !isPasswordGrant) return route.continue();
      await route.continue({
        headers: { ...req.headers(), authorization: `Bearer ${SERVICE_KEY}` },
      });
    },
  );
}
