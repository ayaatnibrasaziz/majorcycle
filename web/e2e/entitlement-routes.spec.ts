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

/**
 * The premium PAGES — each renders for an entitled viewer, and for an unentitled one
 * shows the in-app locked panel WITHOUT leaving the route. They used to redirect to the
 * public /pricing page, which threw a signed-in reader out of the app shell entirely.
 *
 * The report is not among them: it has no page, only the gated /report route that
 * the one-click download reads (covered by its own test below).
 */
const PREMIUM_PAGES = ['/run', '/results'];

/** The report's only surface — a route handler, so it gates itself. */
const REPORT = `${DETAIL}/report`;

/** The panel's CTA — "Contact support" for a hold, "See what's included" otherwise. */
const LOCK_CTA = /see what’s included|see what's included|contact support/i;

interface StateCase {
  name: string;
  patch: Record<string, unknown>;
  entitled: boolean;
  /** Denial reason: the 402 body's `reason`, and what the locked panel explains. */
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
  {
    // Losing a chargeback cancels the subscription, so this — not `active` — is where a
    // lost dispute actually lands. `canceled` is the one status allowed to re-subscribe,
    // which is exactly why the block has to be checked independently of it.
    name: 'billing_blocked after a LOST dispute (subscription cancelled)',
    patch: { subscription_status: 'canceled', billing_blocked: true },
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
    test(`${state.name} → premium pages ${state.entitled ? 'render' : 'show the locked panel in place'}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await setState(state.patch);

      for (const route of PREMIUM_PAGES) {
        await page.goto(route);
        // Nobody is ever bounced to /pricing or /login from here any more — an
        // entitled viewer gets the page, an unentitled one gets the panel, and BOTH
        // keep the route and the app shell.
        await expect(page, `${route} should not navigate away for ${state.name}`).not.toHaveURL(
          /\/pricing/,
        );
        await expect(page).not.toHaveURL(/\/login/);
        expect(new URL(page.url()).pathname, `${route} should stay put`).toBe(
          new URL(route, page.url()).pathname,
        );

        if (state.entitled) {
          await expect(
            page.getByRole('button', { name: LOCK_CTA }),
            `${route} should not be locked for ${state.name}`,
          ).toHaveCount(0);
        } else {
          await expect(
            page.getByRole('button', { name: LOCK_CTA }),
            `${route} should be locked for ${state.name}`,
          ).toBeVisible();
          // The panel must name what happened, not just that something is locked.
          if (state.reason === 'billing_blocked') {
            await expect(page.getByText(/your account is on hold/i).first()).toBeVisible();
          }
          // The decisive half: locked means the scores were never built, not merely
          // covered up. `NN/100` is the only rendering of a rating anywhere.
          expect(
            await page.content(),
            `${route} must ship no scored value for ${state.name}`,
          ).not.toMatch(/\d{1,3}\/100/);
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

  // ── A dispute hold must stop the SALE, not just the product ────────────────
  // Losing a chargeback cancels the subscription, and `canceled` is precisely the
  // state allowed to re-subscribe. Without an independent billing_blocked check the
  // blocked user could pay again and still be denied by hasAccess() — money taken for
  // access we then refuse. Both shapes of a hold are covered.
  for (const status of ['active', 'canceled'] as const) {
    test(`billing_blocked (${status}) → POST /api/checkout is refused, not charged`, async ({
      page,
    }) => {
      await setState({ subscription_status: status, billing_blocked: true });
      const res = await page.request.post('/api/checkout', {
        headers: { 'content-type': 'application/json' },
        data: { plan: 'monthly' },
      });
      expect(res.status(), 'a held account must never reach Stripe Checkout').toBe(403);
      expect((await res.json()).error).toMatch(/on hold/i);
    });
  }

  test('billing_context tells the UI it is blocked, so the lock can explain itself', async ({
    page,
  }) => {
    await setState({ subscription_status: 'active', billing_blocked: true });
    const res = await page.request.get('/api/billing-context');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.billingBlocked, 'the upgrade dialog keys its whole copy off this').toBe(
      true,
    );
    // Per-viewer billing state must never touch a shared cache (CLAUDE.md 11a).
    expect(res.headers()['cache-control']).toContain('no-store');
  });

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

  // ── The report is a download, not a page ───────────────────────────────────
  // Its on-screen preview page was deleted on 2026-07-29 (nothing linked to it), so
  // /report is the whole attack surface: it is a route handler, which the (app)
  // layout does not wrap, so it must gate itself. Its payload is the full scorecard.
  test('GET /report refuses an unentitled viewer and serves an entitled one', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await setState({ subscription_status: null });
    const denied = await page.request.get(REPORT, { maxRedirects: 0 });
    expect(denied.status(), 'a free viewer must not be able to fetch the report').toBe(402);
    expect(await denied.text()).not.toMatch(/\d{1,3}\/100/);

    await setState({ subscription_status: 'active' });
    const allowed = await page.request.get(REPORT);
    expect(allowed.status(), 'a subscriber must still get their report').toBe(200);
    // Per-viewer payload — must never be shared-cacheable (CLAUDE.md 11a).
    expect(allowed.headers()['cache-control']).toContain('no-store');
  });

  // ── The checkout reconciler must not be a way to grant yourself a plan ─────
  // /account?checkout=success&session_id=… closes the gap between paying and the webhook
  // landing. `session_id` arrives in the URL bar, so it is never treated as proof: the
  // session is retrieved from Stripe and refused unless ITS OWN client_reference_id (set
  // by /api/checkout) matches the caller. A forged or foreign id must change nothing.
  for (const forged of ['cs_test_forged_not_a_real_session', 'not-a-session-id']) {
    test(`a forged session_id (${forged.slice(0, 12)}…) grants nothing`, async ({ page }) => {
      await setState({ subscription_status: null });
      await page.goto(`/account?checkout=success&session_id=${forged}`);

      const { data: after } = await admin
        .from('profiles')
        .select('subscription_status, stripe_customer_id, stripe_subscription_id')
        .eq('id', userId)
        .single();
      expect(after?.subscription_status, 'no plan may be granted from a URL').toBeNull();
      expect(after?.stripe_customer_id).toBeNull();
      expect(after?.stripe_subscription_id).toBeNull();

      // And the page still renders — a bad id is ignored, never an error page.
      await expect(page.getByRole('heading', { name: /subscription/i })).toBeVisible();
    });
  }

  // ── /pricing is the signed-out shop window and nothing else ────────────────
  // It used to branch on ?reason=, billing_blocked, hasSubscription and trialUsed, all
  // to serve signed-in readers the paywall had thrown out here. None of them can arrive
  // any more, and an unreachable branch about someone's money is one that can quietly
  // become wrong. The redirect is what keeps the public page unconditional.
  for (const status of [null, 'active', 'canceled'] as const) {
    test(`a signed-in visitor (${status ?? 'free'}) is sent from /pricing to /account`, async ({
      page,
    }) => {
      await setState({ subscription_status: status });
      await page.goto('/pricing');
      await expect(page).toHaveURL(/\/account/);
    });
  }

  test('a held account reaching /pricing is not offered a buy button', async ({ page }) => {
    // The public page can no longer warn anyone, so it must not be reachable by someone
    // /api/checkout would refuse. This is the assertion that keeps those two facts tied.
    await setState({ subscription_status: 'canceled', billing_blocked: true });
    await page.goto('/pricing');
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole('button', { name: /start free trial|subscribe/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole('button', { name: /contact support/i })).toBeVisible();
  });

  // ── Mid-deletion accounts belong at /reactivate, not /pricing ───────────────
  test('a deletion-scheduled account is sent to /reactivate, not /pricing', async ({ page }) => {
    // Ordering matters: if entitlement were evaluated first, a cancelled-and-deleting
    // account would be told to buy a plan instead of being offered its account back.
    await setState({ subscription_status: 'canceled', deletion_scheduled_at: iso(20 * DAY) });
    await page.goto('/results');
    await expect(page).toHaveURL(/\/reactivate/);
  });

  // ── Deletion confinement must reach the ROUTE HANDLERS, not just the pages ──
  // Live-check Session 3: every page redirected correctly while `/report` returned the
  // full 3.2 MB paid report, `/api/analyze*` the full premium payload, and `/api/portal`
  // a 303 into a live Customer Portal session — for an account signed out globally and
  // told everywhere else that it was deactivated. The pages were never in doubt because
  // requirePremiumPage() evaluates deletion BEFORE entitlement; these four surfaces gate
  // themselves and simply never asked.
  //
  // The account here is deliberately `active` — an entitled subscriber mid-deletion. An
  // unentitled one would be refused by the paywall anyway, which would mask whether the
  // deletion check exists at all.
  test('a deletion-scheduled SUBSCRIBER is refused by report, analyze, portal and checkout', async ({
    page,
  }) => {
    await setState({ subscription_status: 'active', deletion_scheduled_at: iso(20 * DAY) });

    const report = await page.request.get(REPORT, { maxRedirects: 0 });
    expect(report.status(), 'the full paid report must not be downloadable').toBe(403);
    expect((await report.json()).reason).toBe('account_deleting');
    expect(report.headers()['cache-control']).toContain('no-store');

    const analyze = await page.request.post('/api/analyze-dev', {
      data: { tickers: [TICKER], preset: 'medium' },
      maxRedirects: 0,
    });
    expect(analyze.status(), 'the screener payload must not be served').toBe(403);
    expect((await analyze.json()).reason).toBe('account_deleting');

    // The portal is the sharp one: its configuration allows price switches (which
    // charge a proration) and resuming a subscription scheduled to cancel, so a
    // to-be-purged account could spend money and un-cancel the very subscription the
    // delete flow just set to stop. It must land on /reactivate, never on Stripe.
    const portal = await page.request.post('/api/portal', { maxRedirects: 0 });
    expect(portal.status()).toBe(303);
    expect(portal.headers()['location']).toContain('/reactivate');
    expect(portal.headers()['location'], 'must never reach Stripe').not.toContain('stripe.com');

    const checkout = await page.request.post('/api/checkout', {
      data: { plan: 'monthly' },
      maxRedirects: 0,
    });
    expect(checkout.status(), 'must not sell to an account being deleted').toBe(403);
    expect((await checkout.json()).reason).toBe('account_deleting');
  });

  // The other half: an over-correction that locked out paying customers would be just
  // as wrong. Same account, deletion cleared — everything must come straight back.
  test('clearing the deletion restores the report and the screener', async ({ page }) => {
    test.setTimeout(120_000);
    await setState({ subscription_status: 'active', deletion_scheduled_at: null });

    expect(
      (await page.request.get(REPORT)).status(),
      'a subscriber who cancelled their deletion must get their report back',
    ).toBe(200);
    expect(
      (
        await page.request.post('/api/analyze-dev', {
          data: { tickers: [TICKER], preset: 'medium' },
        })
      ).status(),
    ).toBe(200);

    // The portal isn't asserted here: with no stripe_customer_id this account takes the
    // `?billing=none` branch, which would pass whether or not the deletion check exists.
    // A test that cannot fail is worse than no test.
  });

  // ── /account must tell the truth about WHICH side of grace you're on ────────
  // `past_due` spans both sides of the 3-day window (decision #20) and the account
  // surfaces used to read the status alone, so a reader whose grace had closed — who
  // had already lost access — was told to "update your card to keep access". Same
  // shape as the dispute badge that once announced "ACTIVE" to a locked-out account:
  // one dimension short of the truth. Both halves are asserted, because a fix that
  // only ever says "paused" would be just as wrong in the other direction.
  test('past_due INSIDE grace still promises continued access', async ({ page }) => {
    await setState({ subscription_status: 'past_due', grace_until: iso(2 * DAY) });
    await page.goto('/account');
    await expect(page.getByText(/update your card to keep access/i)).toBeVisible();
    await expect(page.getByText(/access is paused/i)).toHaveCount(0);
  });

  test('past_due PAST grace says access is paused, never "keep access"', async ({ page }) => {
    await setState({ subscription_status: 'past_due', grace_until: iso(-1 * DAY) });
    await page.goto('/account');
    await expect(page.getByText(/access is paused/i)).toBeVisible();
    await expect(page.getByText(/keep access/i)).toHaveCount(0);
  });

  // ── Never claim a plan is set up when none is showing ───────────────────────
  // The success banner used to come from the URL alone, so it asserted "your plan is
  // set up below" directly above a card reading "No plan" — and did so precisely in
  // the case the reconciler exists for (Stripe slow AND the webhook not yet landed).
  test('checkout=success with nothing provisioned says setup is still in flight', async ({
    page,
  }) => {
    await setState({ subscription_status: null });
    await page.goto('/account?checkout=success');
    await expect(page.getByText(/still setting your plan up/i)).toBeVisible();
    await expect(page.getByText(/plan is set up below/i)).toHaveCount(0);
  });

  test('checkout=success with a live plan keeps the confident confirmation', async ({ page }) => {
    await setState({ subscription_status: 'trialing' });
    await page.goto('/account?checkout=success');
    await expect(page.getByText(/plan is set up below/i)).toBeVisible();
    await expect(page.getByText(/still setting your plan up/i)).toHaveCount(0);
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
