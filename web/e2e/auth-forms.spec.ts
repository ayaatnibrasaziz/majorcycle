import { test, expect, type Page } from '@playwright/test';

/**
 * Auth FORMS — the edge cases, driven in a real browser.
 *
 * These nine behaviours were checked BY HAND during Layer G and passed. That is
 * exactly why they are written down here: a manual pass expires the moment the
 * next commit lands, and the plan they came from had claimed the suite already
 * covered them when it did not. Nothing in this file needs credentials, so it
 * runs on every PR including a fork's.
 *
 * ## What talks to the network, and why it differs per test
 *
 * - **Sign-in failures use the REAL Supabase.** Wrong credentials for an account
 *   that does not exist is deterministic (`Invalid login credentials`), costs no
 *   email, and is the one chain worth proving end to end: form → supabase-js →
 *   Auth → `friendlyAuthError` → the `role="alert"`. A stub here would test our
 *   mock's wording.
 * - **Anything that would SEND MAIL is stubbed.** Sign-up and password-reset hit
 *   endpoints governed by an hourly email quota shared with production. A test
 *   that consumes it would make the suite fail for a reason unrelated to the
 *   code, on a schedule nobody can predict — and the owner cannot debug that.
 *   The stub replaces only the network peer; the real form, the real client
 *   library and the real rendering all run.
 * - **Client-side blocks assert that NO request was made at all.** "It showed an
 *   error" is not the claim — the claim is that the browser never spoke to the
 *   auth server, which is the only version an intercept can prove.
 */

const AUTH_API = '**/auth/v1/**';

/** Count every call to Supabase Auth, so a client-side block can be proven. */
async function countAuthCalls(page: Page): Promise<() => number> {
  let calls = 0;
  await page.route(AUTH_API, async (route) => {
    calls += 1;
    await route.abort();
  });
  return () => calls;
}

/**
 * The form's own error banner.
 *
 * ⚠️ Scoped to `form` deliberately. A bare `[role="alert"]` also matches Next's
 * route announcer (`<p id="__next-route-announcer__" role="alert">`), which is
 * present on every page, in dev AND in production, and is normally empty. An
 * unscoped locator therefore reports "1 alert" on a pristine form and "2" after
 * a real error — so `toHaveCount(1)` would have been asserting the announcer,
 * not the message. Caught by this suite's own no-error control.
 */
const alert = (page: Page) => page.locator('form [role="alert"]');

test.describe('sign-in — the edge cases a real person hits', () => {
  test('an empty submit is refused by the browser and never reaches the network', async ({
    page,
  }) => {
    await page.goto('/login');
    const calls = await countAuthCalls(page);

    await page.getByRole('button', { name: /^sign in$/i }).click();

    // Native constraint validation (`required`) — the form does not submit, so
    // React's handler never runs and no session is ever attempted.
    await expect(page).toHaveURL(/\/login/);
    expect(await page.locator('input#email').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    expect(calls(), 'an empty form must not call the auth server').toBe(0);
    await expect(alert(page)).toHaveCount(0);
  });

  test('a malformed email is refused before submit', async ({ page }) => {
    await page.goto('/login');
    const calls = await countAuthCalls(page);

    await page.fill('input#email', 'not-an-email');
    await page.fill('input#password', 'whatever123');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    const email = page.locator('input#email');
    expect(await email.evaluate((el: HTMLInputElement) => el.validity.typeMismatch)).toBe(true);
    expect(await email.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
    expect(calls(), 'a malformed email must not call the auth server').toBe(0);
  });

  test('wrong credentials render one legible alert and leave you on /login', async ({ page }) => {
    await page.goto('/login');

    // A deliberately non-existent account. Supabase answers wrong-password and
    // unknown-email identically, which is the property auth-contracts.spec.ts
    // pins on the mapping function; this proves the real server agrees.
    await page.fill('input#email', `no-such-user-${Date.now()}@example.com`);
    await page.fill('input#password', 'definitely-not-the-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    const err = alert(page);
    await expect(err).toBeVisible();
    await expect(err).toHaveText(/doesn't match our records/);
    // Exactly one. A second submit appending rather than replacing would stack
    // alerts down the card, and the reader would not know which one is current.
    await expect(err).toHaveCount(1);
    await expect(page).toHaveURL(/\/login/);

    // The button must come back — an error that leaves the form permanently
    // disabled is indistinguishable from a hang for someone who mistyped.
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeEnabled();

    // Nothing was signed in. Asserting the outcome, not the message.
    await page.goto('/results');
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('the alert is readable and does not overflow its card at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.fill('input#email', `no-such-user-${Date.now()}@example.com`);
    await page.fill('input#password', 'definitely-not-the-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    const err = alert(page);
    await expect(err).toBeVisible();
    // The message must WRAP, not clip or push the page sideways. Mobile-first is
    // non-negotiable #3, and an error nobody can read is the worst place to break it.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows, 'the error must not cause horizontal page scroll').toBe(false);
    const box = await err.boundingBox();
    expect(box!.height, 'the message wrapped onto more than one line').toBeGreaterThan(20);
  });

  test('the button disables and says "Signing in…" while the request is in flight', async ({
    page,
  }) => {
    await page.goto('/login');

    // Hold the auth response open so the in-flight state can actually be seen.
    // This IS the double-submit protection: a disabled submit button is also
    // skipped by the browser's implicit (Enter-key) submission.
    await page.route(AUTH_API, async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      });
    });

    await page.fill('input#email', 'someone@example.com');
    await page.fill('input#password', 'whatever123');
    const button = page.getByRole('button', { name: /^sign in$/i });
    await button.click();

    const pending = page.getByRole('button', { name: /signing in…/i });
    await expect(pending).toBeVisible();
    await expect(pending).toBeDisabled();

    // …and it recovers once the answer arrives.
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeEnabled({ timeout: 20_000 });
  });

  test('a very long email stays inside the field and never widens the page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');

    const long = `${'a'.repeat(88)}@example.com`; // 100 characters
    await page.fill('input#email', long);

    const input = page.locator('input#email');
    const box = await input.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
    // The value is intact — it is clipped by the input's own scroll, not truncated.
    expect(await input.inputValue()).toBe(long);
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows, 'a long email must not push the page sideways').toBe(false);
  });

  test('the sign-in card has no dead ends — both exits work', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/reset-password/);
    await page.goBack();
    await page.getByRole('link', { name: /create a free account/i }).click();
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe('sign-up — the edge cases', () => {
  /**
   * ⚠️ NOT covered here, stated rather than left silent: signing up with an
   * ALREADY-REGISTERED email. With email confirmation enabled, Supabase
   * deliberately answers that with a fake success rather than an error — its own
   * anti-enumeration measure — so there is no live case to drive, and a test that
   * asserted the "already exists" copy would be asserting a stub. The mapping
   * itself is pinned in auth-contracts.spec.ts, which is where it lives.
   */

  test('a password under 8 characters is blocked before any network call', async ({ page }) => {
    await page.goto('/signup');
    const calls = await countAuthCalls(page);

    await page.fill('input#email', 'someone@example.com');
    // 7 characters clears the native minLength check only if we bypass it, so
    // this asserts the browser's guard first…
    await page.fill('input#password', 'short12');
    await page.getByRole('button', { name: /create free account/i }).click();

    const password = page.locator('input#password');
    expect(await password.evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true);
    expect(calls(), 'a short password must not create an account attempt').toBe(0);
  });

  test('the JS guard also holds when the native one is bypassed', async ({ page }) => {
    await page.goto('/signup');
    const calls = await countAuthCalls(page);

    // Turn the browser's constraint validation OFF, the way a devtools user or a
    // client that ignores it would. The handler's own `password.length < 8` check
    // is the real gate — two independent controls, per the reasoning in 11b.
    //
    // `noValidate` is set as a PROPERTY rather than by stripping the minlength
    // attribute: React owns that attribute, and removing it makes the DOM
    // disagree with React's tree, which logs a hydration mismatch and leaves the
    // next render free to put it back. This changes nothing React is watching.
    await page.locator('form').first().evaluate((f: HTMLFormElement) => {
      f.noValidate = true;
    });
    await page.fill('input#email', 'someone@example.com');
    await page.fill('input#password', 'short12');
    await page.getByRole('button', { name: /create free account/i }).click();

    expect(calls(), 'the JS guard must stop the request too').toBe(0);
    await expect(alert(page)).toHaveText(/at least 8 characters/i);
  });

  test('a successful sign-up names the address the link went to', async ({ page }) => {
    const email = `new-user-${Date.now()}@example.com`;
    // Stubbed: the real endpoint sends mail. Shape matches Supabase's
    // confirmation-required response — a User object with no session.
    await page.route('**/auth/v1/signup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000000',
          aud: 'authenticated',
          role: '',
          email,
          confirmation_sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          identities: [],
        }),
      });
    });

    await page.goto('/signup');
    await page.fill('input#email', email);
    await page.fill('input#password', 'a-long-enough-password');
    await page.getByRole('button', { name: /create free account/i }).click();

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
    // Naming the address is what lets someone spot the typo they just made.
    await expect(page.getByText(email, { exact: false })).toBeVisible();
  });

  test('arriving from "Start 7-day free trial" says so, and the card is still named honestly', async ({
    page,
  }) => {
    // /pricing sends a signed-out reader here with ?next=/account. Landing on a
    // page headed "Create your free account" reads as the button having failed,
    // so the heading changes — but the card must still never promise a trial
    // without naming the card requirement (decision #19).
    await page.goto('/signup?next=/account');
    await expect(page.getByRole('heading', { name: /first, create your account/i })).toBeVisible();
    await expect(page.getByText(/step 1 of 2/i)).toBeVisible();
    await expect(page.getByText(/that step does ask for a card/i)).toBeVisible();
  });

  test('a hostile ?next= becomes no link, form action or redirect', async ({ page }) => {
    // safeNextPath's table is pinned in auth-contracts.spec.ts; this is the
    // browser-side control that the rejected value never becomes NAVIGABLE.
    //
    // ⚠️ Asserting on page.content() would be wrong and was: the current URL is
    // echoed into Next's RSC flight payload on every page, so the raw string is
    // in the HTML no matter what the guard does. That is inert text. What must
    // not exist is a URL ATTRIBUTE carrying it — which is what is checked here.
    await page.goto('/signup?next=https://evil.example');
    await expect(page.getByRole('heading', { name: /create your free account/i })).toBeVisible();

    const hostile = await page.evaluate(() =>
      [...document.querySelectorAll('[href],[src],[action],[formaction]')]
        .flatMap((el) =>
          ['href', 'src', 'action', 'formaction'].map((a) => el.getAttribute(a) ?? ''),
        )
        .filter((v) => v.includes('evil.example')),
    );
    expect(hostile, 'the rejected destination must not be navigable').toEqual([]);

    // And the reader is still here, not bounced anywhere.
    expect(page.url()).toMatch(/\/signup/);
  });
});

test.describe('password reset — the edge cases', () => {
  test('an empty or malformed email never reaches the network', async ({ page }) => {
    await page.goto('/reset-password');
    const calls = await countAuthCalls(page);

    await page.getByRole('button', { name: /send reset link/i }).click();
    expect(await page.locator('input#email').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);

    await page.fill('input#email', 'not-an-email');
    await page.getByRole('button', { name: /send reset link/i }).click();
    expect(await page.locator('input#email').evaluate((el: HTMLInputElement) => el.validity.typeMismatch)).toBe(true);

    expect(calls()).toBe(0);
  });

  test('an unknown email gets the SAME confirmation as a real one', async ({ page }) => {
    // The non-leak guarantee. Our code must not branch on the answer — Supabase
    // returns an empty 200 whether or not the account exists, and any wording
    // that distinguished them would be an enumeration oracle on a public page.
    await page.route('**/auth/v1/recover*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/reset-password');
    await page.fill('input#email', 'definitely-not-a-user@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).not.toContain('no account');
    expect(body.toLowerCase()).not.toContain('not found');
    expect(body.toLowerCase()).not.toContain('does not exist');
    // …and the way back is offered rather than assumed.
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible();
  });
});

test.describe('the auth exchange routes fail closed', () => {
  /**
   * `/auth/callback` (OAuth PKCE) and `/auth/confirm` (email token) are the only
   * two auth endpoints open to a signed-out stranger. Both mint a session on
   * success, so what they do on FAILURE is the security-relevant half — and it
   * had never been asserted.
   */
  test('/auth/callback with no code lands on /login, not on a session', async ({ page }) => {
    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/login\?error=auth_callback_failed/);
  });

  test('/auth/callback with a forged code lands on /login', async ({ page }) => {
    await page.goto('/auth/callback?code=not-a-real-authorisation-code');
    await expect(page).toHaveURL(/\/login\?error=auth_callback_failed/);
  });

  test('a forged code cannot carry an off-site destination', async ({ page }) => {
    // The failure path must not honour `next` at all — the redirect target is a
    // literal. Belt and braces over safeNextPath, which handles the success path.
    await page.goto('/auth/callback?code=bogus&next=https://evil.example');
    await expect(page).toHaveURL(/\/login\?error=auth_callback_failed/);
    expect(page.url()).not.toContain('evil.example');
  });

  test('/auth/confirm with no token lands on /login', async ({ page }) => {
    await page.goto('/auth/confirm');
    await expect(page).toHaveURL(/\/login\?error=auth_confirm_failed/);
  });

  test('/auth/confirm with a forged recovery token mints no confinement marker', async ({
    page,
    context,
  }) => {
    // The marker is what confines a recovery session. If a forged token could set
    // one, a stranger could park any visitor on the password-set page.
    await page.goto('/auth/confirm?token_hash=forged&type=recovery&next=/stocks');
    await expect(page).toHaveURL(/\/login\?error=auth_confirm_failed/);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'mc_pw_recovery')).toBeUndefined();
  });

  test('signing out is not something a link or a prefetch can do', async ({ page }) => {
    // /auth/signout is POST-only and is NOT a public path, so a stray GET is
    // stopped twice over. Signed out, the proxy answers first. The signed-in
    // half — the handler itself refusing GET — is in auth.spec.ts, where there
    // is a session to preserve.
    await page.goto('/auth/signout');
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
