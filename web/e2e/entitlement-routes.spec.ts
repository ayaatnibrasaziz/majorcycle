import { test, expect, type BrowserContext } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Paywall (F3 Step 10) — BEHAVIOURAL matrix.
 *
 * The companion file `entitlement.spec.ts` pins the *decision* (`hasAccess`) with pure,
 * credential-free tests. This file proves the decision is actually ENFORCED: it drives
 * real routes and the real API against a real session, once per subscription state.
 *
 * It exists because everything else in the paywall's test net stops short of this.
 * `test_cycle_handler.py` proves the wire format of one Python function.
 * `check-entitlement-gates.mjs` proves the wiring is present in the source. Neither can
 * answer "does a cancelled account actually get bounced off /results?" — only driving it
 * can, and until now that question was answered solely by the owner clicking through.
 *
 * HOW IT ISOLATES. It creates its OWN throwaway auth user in `beforeAll` and deletes it
 * in `afterAll` (the profiles row follows via ON DELETE CASCADE), so it never touches the
 * shared E2E login account and can run beside the other suites. Because every test mutates
 * that one row, the describe is SERIAL.
 *
 * Billing columns are service-role-only by design, so the admin client below is the only
 * thing that can write them — which is itself asserted at the end.
 *
 * Self-skips cleanly without Supabase service credentials, exactly like the webhook and
 * account suites.
 */

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const INTERNAL_SECRET = process.env.CYCLE_INTERNAL_SECRET;

const RUN = Date.now();
const EMAIL = `entitlement-e2e-${RUN}@example.com`;
const PASSWORD = `E2e!entitlement-${RUN}`;

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

// A ticker with deep history, so the Major Cycle is computable at the default
// (medium) horizon and the premium sections genuinely render for an entitled viewer.
const TICKER = 'AAPL';
const DETAIL = `/stocks/us/${TICKER}`;

let admin: SupabaseClient;
let userId: string;
/**
 * The signed-in session's cookies, captured once in `beforeAll` and injected into each
 * test's context by `beforeEach`. Deliberately NOT `test.use({ storageState })`: that
 * resolves its file when the test's context is created, which happens BEFORE `beforeAll`
 * — so the file cannot yet exist. Passing the cookies in memory sidesteps the ordering
 * entirely and leaves no auth artifact on disk.
 */
let sessionCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];

/**
 * Reset the row to a known baseline, then apply the state under test. Explicitly
 * clearing every field each time means a test can never inherit a leftover from the
 * one before it — the failure mode that makes serial suites lie.
 */
async function setState(patch: Record<string, unknown>): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({
      subscription_status: null,
      grace_until: null,
      billing_blocked: false,
      deletion_scheduled_at: null,
      free_views_date: null,
      free_views_tickers: null,
      ...patch,
    })
    .eq('id', userId);
  if (error) throw new Error(`setState failed: ${error.message}`);
}

/** The premium PAGES — each must redirect an unentitled viewer, render for an entitled one. */
const PREMIUM_PAGES = ['/run', '/results', `${DETAIL}/report`];

interface StateCase {
  name: string;
  patch: Record<string, unknown>;
  entitled: boolean;
  /** Expected `?reason=` on /pricing when not entitled. */
  reason?: string;
}

const STATES: StateCase[] = [
  {
    name: 'no subscription (the free tier)',
    patch: { subscription_status: null },
    entitled: false,
    reason: 'no_subscription',
  },
  { name: 'trialing', patch: { subscription_status: 'trialing' }, entitled: true },
  { name: 'active', patch: { subscription_status: 'active' }, entitled: true },
  {
    name: 'past_due INSIDE the 3-day grace window',
    patch: { subscription_status: 'past_due', grace_until: iso(2 * DAY) },
    entitled: true,
  },
  {
    name: 'past_due PAST the grace window',
    patch: { subscription_status: 'past_due', grace_until: iso(-1 * DAY) },
    entitled: false,
    reason: 'payment_failed',
  },
  {
    name: 'canceled',
    patch: { subscription_status: 'canceled' },
    entitled: false,
    reason: 'canceled',
  },
  {
    // A dispute lock must beat an otherwise-perfect active subscription.
    name: 'billing_blocked (dispute lock) despite an active subscription',
    patch: { subscription_status: 'active', billing_blocked: true },
    entitled: false,
    reason: 'billing_blocked',
  },
];

test.describe.configure({ mode: 'serial' });

test.describe('entitlement enforcement across subscription states', () => {
  test.skip(
    !SERVICE_KEY || !SUPABASE_URL || !ANON_KEY,
    'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_{URL,ANON_KEY} to run',
  );

  test.beforeAll(async ({ browser }) => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // @example.com is reserved and non-deliverable, and email_confirm skips the
    // verification mail — so this account has no outside side-effects.
    const { data: created, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      email_confirm: true,
      password: PASSWORD,
    });
    if (error || !created?.user) {
      throw new Error(`could not create entitlement test user: ${error?.message}`);
    }
    userId = created.user.id;

    // The on_auth_user_created trigger writes the profiles row; upsert defensively so
    // it is present regardless of trigger timing. acknowledged_disclaimer_at is set so
    // the first-login modal never overlays the pages we are asserting on.
    await admin.from('profiles').upsert(
      { id: userId, email: EMAIL, acknowledged_disclaimer_at: new Date().toISOString() },
      { onConflict: 'id' },
    );

    // Sign in once and persist the session for every test in this file.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await page.fill('input#email', EMAIL);
    await page.fill('input#password', PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/stocks/, { timeout: 30_000 });
    sessionCookies = await context.cookies();
    await context.close();
  });

  // Every test starts already signed in as the throwaway account.
  test.beforeEach(async ({ context }) => {
    await context.addCookies(sessionCookies);
  });

  test.afterAll(async () => {
    // Deleting the auth user cascades the profiles row away — zero residue.
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  // ── The matrix ──────────────────────────────────────────────────────────────
  for (const state of STATES) {
    test(`${state.name} → premium pages ${state.entitled ? 'render' : 'redirect'}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await setState(state.patch);

      for (const route of PREMIUM_PAGES) {
        await page.goto(route);
        if (state.entitled) {
          // Must stay put — never bounced to /pricing or /login.
          await expect(page, `${route} should render for ${state.name}`).not.toHaveURL(
            /\/pricing/,
          );
          await expect(page).not.toHaveURL(/\/login/);
        } else {
          await expect(page, `${route} should be gated for ${state.name}`).toHaveURL(
            new RegExp(`/pricing\\?reason=${state.reason}`),
          );
        }
      }
    });

    test(`${state.name} → POST /api/analyze ${state.entitled ? "passes the gate" : "answers 402"}`, async ({
      page,
    }) => {
      await setState(state.patch);
      // page.request shares the browser context's cookies, so this carries the session.
      // Under `next dev` the screener is the /api/analyze-dev shim (Vercel Python
      // functions don't run locally) — the proxy gates BOTH paths identically, which is
      // the point: dev must not be quietly more permissive than production.
      const res = await page.request.post('/api/analyze-dev', {
        headers: { 'content-type': 'application/json' },
        data: 'deliberately-not-json',
      });

      if (state.entitled) {
        // The payload is deliberately junk, so the route will reject it — with what
        // status is the route's business, not the gate's. What this asserts is that the
        // refusal did NOT come from the proxy: anything other than 402 means the
        // entitlement check passed and the request reached the handler.
        expect(res.status(), `${state.name} must not be refused by the gate`).not.toBe(402);
      } else {
        expect(res.status(), `${state.name} must be refused`).toBe(402);
        const body = await res.json();
        expect(body.reason).toBe(state.reason);
      }
    });
  }

  // ── The end-to-end proof: premium data is absent from the free page ─────────
  test('a FREE viewer\'s Stock Detail HTML contains no scored value anywhere', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await setState({ subscription_status: null });
    await page.goto(DETAIL);

    // The free half is present — this is a real page, not a wall.
    await expect(page.getByText('Current Drawdown').first()).toBeVisible({ timeout: 60_000 });

    // The two scored KPI tiles are locks, not values. They are BUTTONS, not links:
    // a lock opens the upgrade dialog in place rather than navigating away from the
    // stock the reader is deciding about.
    const ratingLock = page.getByRole('button', {
      name: /Overall Rating — included with a subscription/i,
    });
    await expect(ratingLock).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Health Score — included with a subscription/i }),
    ).toBeVisible();

    // Verdict + Scorecard are upgrade prompts.
    await expect(page.getByText(/included with a subscription/i).first()).toBeVisible();

    // Clicking a lock explains itself WITHOUT leaving the page — the regression this
    // guards is a lock silently turning back into a navigation.
    await ratingLock.click();
    await expect(page.getByRole('dialog')).toContainText(/A subscription also includes/i);
    expect(new URL(page.url()).pathname).toBe(new URL(DETAIL, page.url()).pathname);
    await page.keyboard.press('Escape');

    // The decisive assertion: the scored numbers are not merely hidden, they were never
    // sent. `NN/100` is the only rendering of a rating or health score anywhere on the
    // page, so its absence from the raw HTML means the bytes never left the server.
    const html = await page.content();
    expect(html, 'a rating value must not appear in the free page markup').not.toMatch(
      /\d{1,3}\/100/,
    );
  });

  test('an ACTIVE subscriber sees the scored values on the same page', async ({ page }) => {
    test.setTimeout(180_000);
    await setState({ subscription_status: 'active' });
    await page.goto(DETAIL);

    await expect(page.getByText('Current Drawdown').first()).toBeVisible({ timeout: 60_000 });
    // The counterpart of the assertion above — proves the free render was a real gate
    // and not simply a page that never had this content to begin with.
    await expect(page.locator('.kpi-value').first()).toContainText('/100', {
      timeout: 60_000,
    });
    await expect(
      page.getByRole('button', { name: /Overall Rating — included with a subscription/i }),
    ).toHaveCount(0);
  });

  // ── /api/cycle is internal-only ─────────────────────────────────────────────
  test('/api/cycle refuses a request without the internal secret — 401, never a redirect', async ({
    page,
  }) => {
    // Even WITH a valid signed-in session: this endpoint is not session-gated, because
    // our own server-side render calls it over the public URL carrying no cookies.
    const res = await page.request.get(`/api/cycle?ticker=${TICKER}&preset=medium&entitled=1`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(401);
    // A 302 here would be the old bug: our SSR fetch would parse the /login HTML as
    // JSON and every cycle section would silently render blank.
    expect([301, 302, 303, 307, 308]).not.toContain(res.status());
  });

  test('/api/cycle lets the internal secret through the edge gate', async ({ page }) => {
    test.skip(!INTERNAL_SECRET, 'set CYCLE_INTERNAL_SECRET (any throwaway value) to run');
    const res = await page.request.get(`/api/cycle?ticker=${TICKER}&preset=medium&entitled=0`, {
      headers: { 'x-mc-internal': INTERNAL_SECRET! },
      maxRedirects: 0,
    });
    // Under `next dev` there is no /api/cycle route (it's a Vercel Python function), so
    // a 404 is the correct and expected outcome — what matters is that it is NOT the
    // proxy's 401, i.e. the secret was accepted at the edge.
    expect(res.status()).not.toBe(401);
  });

  // ── Mid-deletion accounts belong at /reactivate, not /pricing ───────────────
  test('a deletion-scheduled account is sent to /reactivate, not /pricing', async ({ page }) => {
    // Ordering matters: if entitlement were evaluated first, a cancelled-and-deleting
    // account would be told to buy a plan instead of being offered its account back.
    await setState({ subscription_status: 'canceled', deletion_scheduled_at: iso(20 * DAY) });
    await page.goto('/results');
    await expect(page).toHaveURL(/\/reactivate/);
  });

  // ── Free-tier daily fence ───────────────────────────────────────────────────
  test('a free viewer at the daily cap is stopped on a NEW stock but not a seen one', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const today = new Date().toISOString().slice(0, 10);
    const full = Array.from({ length: 25 }, (_, i) => `FILLER${i}`);

    // At the cap, with this ticker NOT among the ones already seen.
    await setState({
      subscription_status: null,
      free_views_date: today,
      free_views_tickers: full,
    });
    await page.goto(DETAIL);
    await expect(page.getByText(/daily browsing limit reached/i)).toBeVisible();

    // The same ticker, now already in today's set → still opens. This is what makes
    // the fence a distinct-ticker cap rather than a hard daily wall.
    await setState({
      subscription_status: null,
      free_views_date: today,
      free_views_tickers: [...full, TICKER],
    });
    await page.goto(DETAIL);
    await expect(page.getByText(/daily browsing limit reached/i)).toHaveCount(0);
    await expect(page.getByText('Current Drawdown').first()).toBeVisible({ timeout: 60_000 });
  });

  test('a SUBSCRIBER is never counted, even with a full counter on the row', async ({ page }) => {
    test.setTimeout(180_000);
    // Locked decision #18 promises subscribers no usage limits. A stale counter left
    // over from their free days must not follow them into a paid plan.
    await setState({
      subscription_status: 'active',
      free_views_date: new Date().toISOString().slice(0, 10),
      free_views_tickers: Array.from({ length: 99 }, (_, i) => `FILLER${i}`),
    });
    await page.goto(DETAIL);
    await expect(page.getByText(/daily browsing limit reached/i)).toHaveCount(0);
    await expect(page.getByText('Current Drawdown').first()).toBeVisible({ timeout: 60_000 });
  });

  // ── The counter must not be resettable by its own user (audit finding B4) ───
  test('a signed-in user cannot write their own counter or billing columns', async () => {
    const userClient = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInErr } = await userClient.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    expect(signInErr, 'the test user should be able to sign in').toBeNull();
    expect(signIn.session).not.toBeNull();

    const today = new Date().toISOString().slice(0, 10);
    await setState({
      subscription_status: null,
      free_views_date: today,
      free_views_tickers: Array.from({ length: 25 }, (_, i) => `FILLER${i}`),
    });

    // Attempt the reset a scraper would want. `authenticated` holds no UPDATE grant on
    // these columns, so PostgREST refuses outright.
    const { error: counterErr } = await userClient
      .from('profiles')
      .update({ free_views_date: null, free_views_tickers: [] })
      .eq('id', userId);
    expect(counterErr, 'resetting the free-view counter must be refused').not.toBeNull();

    // Same for buying yourself a subscription.
    const { error: billingErr } = await userClient
      .from('profiles')
      .update({ subscription_status: 'active' })
      .eq('id', userId);
    expect(billingErr, 'self-granting a subscription must be refused').not.toBeNull();

    // And the row is genuinely unchanged — a refusal that silently no-ops would look
    // identical from the client but leave the door open.
    const { data: after } = await admin
      .from('profiles')
      .select('subscription_status, free_views_date, free_views_tickers')
      .eq('id', userId)
      .single();
    expect(after?.subscription_status).toBeNull();
    expect(after?.free_views_date).toBe(today);
    expect(after?.free_views_tickers).toHaveLength(25);

    await userClient.auth.signOut();
  });

  // ── What a user IS allowed to change ────────────────────────────────────────
  test('a signed-in user CAN update display name and country, and nothing else', async () => {
    const userClient = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await userClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });

    const { error } = await userClient
      .from('profiles')
      .update({ display_name: 'E2E Name', country: 'AU' })
      .eq('id', userId);
    expect(error, 'the writable columns must remain writable').toBeNull();

    const { data: after } = await admin
      .from('profiles')
      .select('display_name, country')
      .eq('id', userId)
      .single();
    expect(after?.display_name).toBe('E2E Name');
    expect(after?.country).toBe('AU');

    // A column that is neither billing nor writable-by-design.
    const { error: emailErr } = await userClient
      .from('profiles')
      .update({ email: 'attacker@example.com' })
      .eq('id', userId);
    expect(emailErr, 'email is not user-writable').not.toBeNull();

    await userClient.auth.signOut();
  });
});
