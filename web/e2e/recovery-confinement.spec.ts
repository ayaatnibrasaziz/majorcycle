import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { PW_RECOVERY_COOKIE } from '@/lib/authRecovery';

/**
 * Password-recovery confinement, driven against a LIVE session — the half that
 * had never been tested.
 *
 * ## What this control is for
 *
 * A Supabase recovery link mints a FULL session. Left alone, anyone holding that
 * link — the account owner, but equally whoever the email was forwarded to, or
 * whoever reads it off a shared screen — is simply logged in, and can browse the
 * product without ever proving they know a password or setting a new one. The
 * confinement in `proxy.ts` is what makes a reset link a reset link rather than
 * a bearer token for the account.
 *
 * ## Why this file exists
 *
 * `auth.spec.ts` covered exactly one leg of it: a stale marker with NO session
 * must not trap a logged-out visitor (the F0.6 fix). That is the *failure* leg.
 * Nothing anywhere asserted the leg the control is actually for — that a session
 * carrying a MATCHING marker is genuinely pinned to the password-set page. The
 * rule is `recoveryMarker?.value === userId`, and every one of its three
 * outcomes needs its own evidence, because they fail in different directions:
 *
 * | marker | session | must happen | how it fails if wrong |
 * |---|---|---|---|
 * | matches the user | live | confined to /account/update-password | a forwarded reset link becomes a full login |
 * | belongs to someone else | live | NOT confined | a stale cookie cages an innocent sign-in |
 * | present | none | NOT confined (login wins) | covered in auth.spec.ts (F0.6) |
 *
 * Only the third was covered, and it is the one with the mildest consequence.
 *
 * ## How it isolates
 *
 * Its own throwaway auth user, created and destroyed here — the pattern from
 * `deletion-notice.spec.ts` and `entitlement-routes.spec.ts`. It never touches
 * the shared E2E login account, and it never actually changes a password, so
 * there is nothing to restore afterwards. `@example.com` is reserved and
 * non-deliverable.
 *
 * The marker is injected with `context.addCookies` rather than by clicking a
 * real emailed link: httpOnly stops PAGE SCRIPT reading it, not the browser
 * automation that owns the jar, and the alternative would need a live inbox. The
 * SETTER — `auth/confirm` writing the marker on a genuine recovery token — is a
 * different mechanism and is asserted separately in `auth-forms.spec.ts` (a
 * forged token must mint no marker at all).
 */

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const RUN = Date.now();
const EMAIL = `recovery-e2e-${RUN}@example.com`;
const PASSWORD = `E2e!recovery-${RUN}`;
/** A well-formed uuid that is definitely not our user — the "someone else" case. */
const OTHER_USER = '11111111-2222-3333-4444-555555555555';

let admin: SupabaseClient;
let userId: string;

/**
 * Deliberately NOT `mode: 'serial'`, unlike the other throwaway-account specs.
 *
 * Each test here signs in fresh and shares nothing but the fixture user, so
 * there is no ordering to protect — and serial mode SKIPS every remaining test
 * after the first failure. When this file goes red the owner needs to see which
 * of the three outcomes broke, because "confined when it shouldn't be" and "not
 * confined when it should be" are opposite bugs with opposite fixes. Proven
 * while breaking the confinement on purpose: serial mode reported 1 failure and
 * hid the two controls that would have said which direction it broke in.
 */

test.describe('a recovery session is pinned to the password-set page', () => {
  test.skip(
    !SERVICE_KEY || !SUPABASE_URL || !ANON_KEY,
    'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_{URL,ANON_KEY} to run',
  );

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: created, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      email_confirm: true,
      password: PASSWORD,
    });
    if (error || !created?.user) {
      throw new Error(`could not create recovery test user: ${error?.message}`);
    }
    userId = created.user.id;
    // Keeps the first-login disclaimer modal from overlaying the pages below.
    await admin.from('profiles').upsert(
      { id: userId, email: EMAIL, acknowledged_disclaimer_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
  });

  test.afterAll(async () => {
    // Deleting the auth user cascades the profiles row away — zero residue, and
    // it runs even if a test failed part-way through.
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  /** Sign in as the throwaway account and settle on the post-auth landing. */
  async function signIn(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.fill('input#email', EMAIL);
    await page.fill('input#password', PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    // LoginForm ends in a hard window.location.assign — wait for it to land or a
    // following goto races it and silently measures the wrong page.
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  }

  const marker = (value: string) => ({
    name: PW_RECOVERY_COOKIE,
    value,
    domain: 'localhost',
    // Path '/' deliberately: unlike the deletion marker, this one CONFINES, so
    // the middleware must see it on every route. A narrower path here would make
    // the confinement silently stop working outside that subtree.
    path: '/',
  });

  test('THE SETTER: a genuine recovery link mints the marker and confines for real', async ({
    context,
    page,
  }) => {
    test.setTimeout(120_000);
    /**
     * Every other test in this file injects the marker and drives the GATE. That
     * is half the control, and — per the deletion-notice lesson (CLAUDE.md 11f) —
     * the half that fails loudly. If `auth/confirm` ever stopped SETTING the
     * marker, a real reset link would silently become an unconfined full session:
     * exactly the F0.5 HIGH-severity hole, with every gate test still green.
     *
     * `generateLink` mints a real, verifiable token server-side and returns it
     * WITHOUT sending any email — so the whole chain (real token → verifyOtp →
     * marker → confinement) runs with no inbox and no mail quota spent.
     */
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: EMAIL,
    });
    if (error || !data?.properties?.hashed_token) {
      throw new Error(`could not mint a recovery token: ${error?.message}`);
    }

    // `next` is deliberately hostile-ish: a recovery link must ignore it and go
    // to the password-set page regardless. Honouring it would let a crafted
    // reset link land a recovering session anywhere in the app.
    await page.goto(
      `/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/stocks`,
    );
    await expect(page).toHaveURL(/\/account\/update-password/);

    const marker = (await context.cookies()).find((c) => c.name === PW_RECOVERY_COOKIE);
    expect(marker, 'auth/confirm did not set the recovery marker').toBeTruthy();
    expect(marker!.httpOnly, 'the marker must be httpOnly').toBe(true);
    // Bound to THIS user, which is what stops a stale marker caging someone else.
    expect(marker!.value, 'the marker must carry the recovering user id').toBe(userId);

    // And the session it minted really is confined — asserted as an outcome
    // rather than inferred from the cookie being present.
    await page.goto('/stocks');
    await expect(page, 'a real recovery session must not reach the app').toHaveURL(
      /\/account\/update-password/,
    );
  });

  test('a MATCHING marker confines the session to the password-set page', async ({
    context,
    page,
  }) => {
    test.setTimeout(120_000);
    await signIn(page);

    // The control, taken BEFORE the marker exists. Without it, a test that
    // asserts "these routes are unreachable" proves nothing — they might have
    // been unreachable for some entirely different reason.
    await page.goto('/stocks');
    await expect(page, 'the account must be able to reach the app first').toHaveURL(/\/stocks/);

    await context.addCookies([marker(userId)]);

    for (const route of ['/stocks', '/results', '/account', '/run', '/request']) {
      await page.goto(route);
      await expect(
        page,
        `${route} must be unreachable while a recovery session is confined`,
      ).toHaveURL(/\/account\/update-password/);
    }
  });

  test('the page it is confined TO still renders, and is not a redirect loop', async ({
    context,
    page,
  }) => {
    await signIn(page);
    await context.addCookies([marker(userId)]);

    await page.goto('/account/update-password');
    await expect(page).toHaveURL(/\/account\/update-password/);
    await expect(page.getByRole('heading', { name: /set a new password/i })).toBeVisible();
  });

  test('the escape hatch works from inside confinement', async ({ context, page }) => {
    // A Google-only account reaching this page has no password to set, so the
    // ONLY way out is to end the session. If /auth/signout were not on the
    // allow-list, pressing it would bounce straight back here — an inescapable
    // page, which is worse than the hole the confinement closes.
    await signIn(page);
    await context.addCookies([marker(userId)]);
    await page.goto('/account/update-password');

    await page.getByRole('button', { name: /cancel and return to sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // Signed out AND released: the marker must not survive to cage the next login.
    expect(
      (await context.cookies()).find((c) => c.name === PW_RECOVERY_COOKIE)?.value,
    ).toBeFalsy();
  });

  test("a marker belonging to SOMEONE ELSE does not cage this login", async ({
    context,
    page,
  }) => {
    // The reason the marker's value is a user id rather than a bare "1". A
    // leftover cookie from a different person (or a previous account on a shared
    // computer) must not confine an unrelated sign-in — the visible symptom
    // would be a normal user unable to leave the password-set page, with no
    // explanation and nothing they can do about it.
    await signIn(page);
    await context.addCookies([marker(OTHER_USER)]);

    for (const route of ['/stocks', '/account']) {
      await page.goto(route);
      await expect(page, `${route} must stay reachable`).toHaveURL(new RegExp(route));
    }
  });

  test('a fresh login self-heals a stale marker', async ({ context, page }) => {
    // Both login forms POST /auth/recovery-done on success precisely so a marker
    // left behind by an abandoned reset cannot confine the next real sign-in.
    // Asserted end to end rather than by reading the fetch call.
    await context.addCookies([marker(userId)]);
    await signIn(page);

    expect(
      (await context.cookies()).find((c) => c.name === PW_RECOVERY_COOKIE)?.value,
      'signing in must have cleared the recovery marker',
    ).toBeFalsy();

    await page.goto('/stocks');
    await expect(page).toHaveURL(/\/stocks/);
  });

  test('clearing the marker releases the confinement immediately', async ({ context, page }) => {
    // /auth/recovery-done is what UpdatePasswordForm calls after the password is
    // actually changed. Driving the endpoint directly isolates the release from
    // the password change, which cannot be performed here without leaving the
    // throwaway account in a different state than the one it was created in.
    await signIn(page);
    await context.addCookies([marker(userId)]);

    await page.goto('/stocks');
    await expect(page, 'confined first — otherwise the release proves nothing').toHaveURL(
      /\/account\/update-password/,
    );

    const res = await page.request.post('/auth/recovery-done');
    expect(res.status()).toBe(200);

    await page.goto('/stocks');
    await expect(page).toHaveURL(/\/stocks/);
  });
});
