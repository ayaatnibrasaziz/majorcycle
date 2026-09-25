/**
 * How everything we drive gets past Supabase's human check — in ONE place.
 *
 * Plain JavaScript on purpose: the Playwright specs are TypeScript and the four
 * gate scripts (`check-page-weight`, `check-csp`, `lighthouse`, `audit-wire-sweep`)
 * are `.mjs` run straight by node, and both have to obey the same rule. A second
 * copy of it is exactly the drift CLAUDE.md 11c is about — and this rule has the
 * nastiest shape for drift, because getting it wrong does not error: the sign-in
 * simply fails and whatever depended on a session reports something else.
 *
 * ── Why anything is needed ───────────────────────────────────────────────────
 * Supabase verifies every Turnstile token against the PRODUCTION secret (live
 * since 2026-09-23) and the test suite shares the production project. Tests run
 * the real widget with Cloudflare's always-pass TEST site key, whose dummy token
 * the real secret rightly rejects.
 *
 * ── The way through, and why it is safe ──────────────────────────────────────
 * The auth server skips the check for a request carrying ADMIN credentials
 * (`verifyCaptcha` → `requireAdminCredentials`, read from its source). Both paths
 * below use that and nothing else:
 *
 * - `passCaptchaForTests(page)` takes over ONLY the browser's requests to the
 *   captcha-checked auth endpoints and sends them from the TEST RUNNER with the
 *   key attached — the browser, its network log and any trace never hold the
 *   key, and nothing in the product ships it;
 * - `userSessionForTests()` is for code that calls Supabase from NODE, where
 *   there is no page to intercept.
 *
 * What neither can prove: that production accepts a REAL token. That was checked
 * by hand on the live site on 2026-09-23 (a tokenless POST to /auth/v1/signup and
 * /auth/v1/recover both answer "captcha protection: request disallowed", and a
 * junk token answers Cloudflare's own `invalid-input-response`).
 *
 * No service key (a fork PR) ⇒ both do nothing, and such runs have no sign-in
 * credentials anyway.
 */

// ⚠️ READ AT CALL TIME, never at import time. An ES import is evaluated BEFORE the
// importing module's body, so a script that loads `.env.local` into process.env on
// its first line still imports this file first — and top-level `const`s here would
// capture undefined and leave the bypass permanently unarmed. That is exactly how
// `check-page-weight` failed on 2026-09-23, with the loader already widened.
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL;

/** The auth routes `verifyCaptcha` guards. `/token` only for the password grant. */
export const GUARDED = /\/auth\/v1\/(signup|recover|otp|magiclink|resend|token)(\?|$)/;

/**
 * Let a real auth FORM in a browser through the check.
 *
 * ⚠️ RETURNS whether it is armed, and the callers that mean to sign in must check.
 * It used to return silently when the service key was absent, and on 2026-09-23
 * that cost a red CI gate that looked like something else entirely:
 * `check-page-weight` loads only E2E_EMAIL and E2E_PASSWORD out of `.env.local`,
 * so the bypass was unarmed, the sign-in was refused, and the only symptom was
 * `page.waitForURL: Timeout 30000ms exceeded` thirty lines later. A harness that
 * cannot do its job must say so, not fail somewhere else (14g).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>} true when the rewrite is in place
 */
export async function passCaptchaForTests(page) {
  const key = serviceKey();
  const url = supabaseUrl();
  if (!key || !url) return false;
  const origin = new URL(url).origin;
  await page.route(
    (url) => url.origin === origin && GUARDED.test(url.pathname + url.search),
    async (route) => {
      const req = route.request();
      // Leave the preflight and every other token grant (refresh, PKCE) alone.
      const isPasswordGrant =
        !req.url().includes('/token') || req.url().includes('grant_type=password');
      if (req.method() !== 'POST' || !isPasswordGrant) return route.continue();
      // ⚠️ The key NEVER enters the browser (2026-09-25). This used to be
      // `route.continue({ headers })`, which hands the header to Chromium: it then
      // sat in the page's network log and in every trace, and ten PUBLIC CI
      // artifacts carried the service-role key that way. `route.fetch` sends the
      // request from the test runner instead and gives the browser only the
      // response. Two more reasons it has to be this way:
      // - Supabase's new `sb_secret_…` keys answer 401 to anything whose
      //   User-Agent looks like a browser, so the header rewrite would stop
      //   working the day the legacy key is replaced;
      // - with a secret key, `apikey` and `authorization` must carry the SAME
      //   key (the gateway swaps it for an admin token only then). Setting both
      //   works for the legacy JWT key as well.
      let response;
      try {
        response = await route.fetch({
          headers: {
            ...req.headers(),
            apikey: key,
            authorization: `Bearer ${key}`,
            'user-agent': 'majorcycle-e2e (captcha bypass)',
          },
        });
        await route.fulfill({ response });
      } catch (err) {
        // A test that ends while its last sign-in is still in flight (a retry press,
        // a navigation) closes the page under this fetch. That is not a failure of
        // the test that ended — and left uncaught, Playwright pins it on the NEXT
        // test in the worker and prints this request's call log, key and all. Seen
        // 2 runs in 2 on 2026-09-25. Anything else is a real error and still throws.
        if (page.isClosed() || /Test ended|has been closed/i.test(String(err))) return;
        throw err;
      }
    },
  );
  return true;
}

/**
 * A real user's session, for a test that talks to Supabase from NODE rather than
 * through a page — `page.route` cannot see those calls, so they need the admin
 * path directly.
 *
 * ⚠️ Returns the USER's token, never the service key. The callers exist to prove
 * what an ordinary signed-in reader may and may not write, and handing them admin
 * credentials would let them write everything — so the token here must carry the
 * `authenticated` role. Each caller's file keeps a control test that a real
 * session CAN still save a display name, which is what stops this degrading into
 * an anonymous client that gets refused for the wrong reason (11y).
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ access_token: string, user: { id: string, email: string } }>}
 */
export async function userSessionForTests(email, password) {
  const key = serviceKey();
  const url = supabaseUrl();
  if (!key || !url) throw new Error('no service key — cannot mint a test session');
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok || !body?.access_token) {
    throw new Error(`could not sign in as ${email}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

/**
 * A Supabase client that acts AS that user: the public anon key, plus the user's
 * own bearer token, which is what makes PostgREST see the `authenticated` role.
 *
 * ⚠️ The anon key stays as `apikey` on purpose. Putting the service key there
 * would silently turn every "a user may not write this" assertion into a test of
 * nothing — it would be allowed, and the file's control test is what would go red.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ client: import('@supabase/supabase-js').SupabaseClient, userId: string }>}
 */
export async function userClientForTests(email, password) {
  const { createClient } = await import('@supabase/supabase-js');
  const session = await userSessionForTests(email, password);
  const client = createClient(supabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  return { client, userId: session.user.id };
}
