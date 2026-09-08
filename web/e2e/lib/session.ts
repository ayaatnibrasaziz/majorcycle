import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * The ONE sign-in for the whole suite.
 *
 * ── Why this file exists (2026-09-08, CI red on `main`) ─────────────────────
 * `signIn` was hand-written **eleven times** — once in each spec that needed a
 * session — and the copies had drifted into two groups:
 *
 *     4 copies:  await page.waitForURL(/\/stocks/, { timeout: 30_000 })
 *     6 copies:  await expect(page).toHaveURL(/\/stocks/)      <- inherits 15_000
 *
 * `expect.timeout` is 15 s and is meant for a DOM assertion; a sign-in ends in
 * `window.location.assign` (LoginForm.tsx), which is a **navigation**, and this
 * config budgets a navigation at `navigationTimeout: 45_000`. So six consumers
 * were waiting for a navigation on a third of the budget the config gives one.
 *
 * That is CLAUDE.md **11c-iv** precisely — the rule existed and four of eleven
 * consumers received it — and it is what turned CI red: the two hard failures
 * (`stock-not-found`, `universe-api`) are both in the 15 s group, and the four
 * in the 30 s group did not fail.
 *
 * ⚠️ THE BUDGET WAS THE TRIGGER, NOT THE CAUSE. Measured on the live project's
 * auth logs for the failing run (17:31–17:53 UTC, 34148053260):
 *
 *     POST /auth/v1/token?grant_type=password   336 calls
 *                                   avg 1,295 ms      max 14,719 ms
 *
 * Zero 429s — nothing was rate-limited, and every sign-in SUCCEEDED. The tail
 * simply grew into the assertion's budget: 14.7 s of sign-in leaves 0.3 s of a
 * 15 s budget for a full page load of the heaviest route in the product. Raising
 * the number alone would be treating the symptom, because 336 password grants —
 * each one a bcrypt verification on a shared Micro instance — is the thing that
 * produced a 14.7 s tail in the first place.
 *
 * ── So the session is signed in ONCE PER WORKER and replayed ────────────────
 * `cachedCookies` is module scope, and a Playwright worker is its own process,
 * so a 2-worker run performs ~2 password grants where it used to perform one per
 * test. Every test still gets a fresh BrowserContext; only the cookies are
 * reused. `@supabase/ssr`'s `createBrowserClient` stores the session in COOKIES
 * (see lib/supabase/client.ts), so cookies are the whole session — there is no
 * localStorage half to miss.
 *
 * ⚠️ THE POSITIVE CONTROL IS THE `/stocks` LANDING, AND IT IS LOAD-BEARING.
 * If cookie replay silently did nothing, every test here would run SIGNED OUT —
 * and many would still pass, because a signed-out page renders perfectly well
 * (CLAUDE.md 11v: a sweep that cannot see the defect reports what a clean system
 * reports). So `signIn` navigates to `/stocks` and asserts it STAYED there:
 * `proxy.ts` bounces a sessionless visitor from `/stocks` to `/login`, so
 * landing on `/stocks` is proof of a live session rather than a hope of one.
 * That the gate really bounces is not assumed here — `auth.spec.ts` asserts it
 * independently, which is what stops this control from resting on itself.
 */

const EMAIL = process.env['E2E_EMAIL'];
const PASSWORD = process.env['E2E_PASSWORD'];

/** Specs gate themselves on this rather than each re-reading the env. */
export const HAVE_E2E_CREDENTIALS = Boolean(EMAIL && PASSWORD);

/**
 * A sign-in is a NAVIGATION, so it takes the navigation budget, not the
 * DOM-assertion budget. Stated once, here, so it cannot drift into eleven
 * different numbers again.
 */
export const SIGN_IN_BUDGET_MS = 45_000;

/** Post-auth home is Browse, not Results (F3 Step 10) — see POST_AUTH_HOME. */
const POST_AUTH_HOME = /\/stocks/;

type Cookies = Parameters<BrowserContext['addCookies']>[0];

let cachedCookies: Cookies | null = null;

/**
 * Clear the first-login disclaimer gate if it is showing.
 *
 * The shared account acknowledged long ago and the acknowledgement is
 * WRITE-ONCE in Postgres (migration 20260831000000), so in practice this never
 * fires. It is kept because a throwaway account routed through here would meet
 * it, and because a modal left open blocks every subsequent click with no error.
 */
async function dismissOnboarding(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: /welcome to majorcycle/i });
  await dialog.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
  if (!(await dialog.isVisible().catch(() => false))) return;

  const ack = page.getByRole('checkbox', { name: /i understand and acknowledge/i });
  const proceed = page.getByRole('button', { name: /continue to majorcycle/i });
  await expect(async () => {
    await ack.check();
    await expect(proceed).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await proceed.click();
  await expect(dialog).toBeHidden();
}

/**
 * Drive the REAL sign-in form, every time — no cache.
 *
 * For the specs where signing in is the SUBJECT (`auth.spec.ts`,
 * `recovery-confinement.spec.ts`): those must exercise the form, the `?next=`
 * handling and the cookie write, so replaying a cached jar would prove nothing.
 * Everywhere else signing in is plumbing and `signIn` below is the right call.
 *
 * ⚠️ `email`/`password` ARE PARAMETERS, and that is not generality for its own
 * sake — it is a defect this file already caused. Collapsing the eleven copies
 * assumed they were the same operation. Ten were; `recovery-confinement.spec.ts`
 * was not. It creates a THROWAWAY account per run (`recovery-e2e-<run>@…`) and
 * its whole subject is that the marker's value must equal THAT user's id, so
 * signing in as the shared account made the confinement correctly not apply.
 *
 * Note what the failure looked like, because it is the reason the tests are
 * worth more than a green run: two tests went red and THREE others in the same
 * file passed — while asserting things about the wrong session entirely. A
 * consolidation is a claim that the copies were identical; where one of them
 * takes different INPUTS, that claim is false in a way no type checker can see.
 */
export async function signInThroughTheForm(
  page: Page,
  opts: { next?: string; email?: string; password?: string } = {},
): Promise<void> {
  const { next, email = EMAIL, password = PASSWORD } = opts;
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.fill('input#email', email!);
  await page.fill('input#password', password!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  // LoginForm ends in a hard `window.location.assign`. Wait for it to land, or a
  // following goto races it and silently measures the wrong page.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: SIGN_IN_BUDGET_MS,
  });
}

/**
 * Get this page a signed-in session, reusing the worker's if it still works.
 *
 * Lands on `/stocks` either way, so callers can rely on the same starting point
 * the eleven hand-written copies gave them.
 */
export async function signIn(page: Page): Promise<void> {
  if (cachedCookies) {
    await page.context().addCookies(cachedCookies);
    await page.goto('/stocks');
    // Bounced to /login => the replayed session is dead (expired, or the account
    // was signed out elsewhere). Fall through and sign in for real.
    if (!page.url().includes('/login')) {
      await dismissOnboarding(page);
      return;
    }
    cachedCookies = null;
  }

  await signInThroughTheForm(page);
  await dismissOnboarding(page);

  // THE CONTROL. Not decoration: without it, a replay that quietly stopped
  // working would leave every caller signed out and most of their assertions
  // still passing.
  await expect(page, 'sign-in must land on the post-auth home').toHaveURL(
    POST_AUTH_HOME,
    { timeout: SIGN_IN_BUDGET_MS },
  );

  cachedCookies = (await page.context().storageState()).cookies;
  expect(
    cachedCookies.length,
    'a signed-in context must carry cookies to replay',
  ).toBeGreaterThan(0);
}
