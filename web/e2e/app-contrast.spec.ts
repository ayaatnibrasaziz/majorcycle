import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { measure, MIN_MEASURED, type Fail, type Probe } from './lib/contrastProbe';
import { RUN_SNAPSHOT, RUN_SNAPSHOT_ROWS, SNAPSHOT_KEY } from './fixtures/runSnapshot';

/**
 * WCAG contrast on the SIGNED-IN pages — the half of the site nothing had ever
 * measured.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * `contrast.spec.ts` walks public routes only, and `a11y.spec.ts` does the same.
 * So Browse, Stock Detail, Run, Results, Request and Account — the entire product
 * a customer pays for — had **no contrast evidence of any kind** for the life of
 * the site. Not a low score: no score.
 *
 * That is what let the rating palette ship broken. Three of the five tier colours
 * could not carry white text (Neutral at **2.38:1**), `.score-num` is white
 * numerals on a solid tier colour, and nothing looked. They only surfaced when the
 * landing page began drawing a real screener table on a PUBLIC url, where the
 * existing guard could see them — and even then they were parked behind a
 * `[data-legacy-contrast]` exemption rather than found on their own page.
 *
 * ⚠️ The general shape, worth keeping: **a guard scoped to one class of route is
 * silent about the rest, not clean about it** (CLAUDE.md 11l, 14g). "We have a
 * contrast test" was true and told you nothing about six of thirteen pages.
 *
 * ── This suite CAN skip, which is why it is not in contrast.spec.ts ─────────
 * It needs E2E_EMAIL / E2E_PASSWORD. The public suite is deliberately
 * credential-free so it runs on a fork PR and can never self-skip; putting a
 * skippable test in that file would quietly break the property. Same probe, same
 * floors, different file.
 *
 * ⚠️ Check the COUNT, not the colour. A skipped suite is also green.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

/**
 * ── The ONE exemption, and it is a WCAG carve-out rather than a debt ─────────
 *
 * `.verdict-watermark` is the faint "MajorCycle" brand stamp in the corner of the
 * Verdict card: --brand-deep at 18% opacity, measuring 1.37:1. WCAG 1.4.3 exempts
 * "text that is part of a logo or brand name" from the contrast requirement, and
 * this is exactly that — a stamp, not something a reader reads for information.
 * The owner confirmed on 2026-08-22 that it stays as designed; darkening it would
 * make the watermark more prominent than the design intends.
 *
 * ⚠️ Matched on the OPACITY as well as the colour, so it cannot spread. Ordinary
 * --brand-deep text at full strength is not excused by this, and a second faded
 * brand stamp would push the count past 1 and fail. It is excluded from pass/fail
 * but COUNTED, so it can neither grow nor quietly stop excusing anything
 * (CLAUDE.md 14g).
 *
 * ── What used to live here ───────────────────────────────────────────────────
 * A five-colour exemption covering 57 pieces of low-contrast TEXT painted in the
 * direction palette — "Why Attractive" at 4.39, "Key Risks" at 2.38, Current
 * Drawdown at 2.27. It was deferred because green-for-up is a convention the
 * owner had explicitly scoped out, and retired on 2026-08-22 when the owner
 * approved the ink layer: the lines, candles and dots keep their colours, and the
 * same colours used as words point at `--c-*-ink` / `lib/ink.ts` instead. The
 * debt is paid, so the excuse is deleted rather than left sitting here.
 */
const LOGOTYPE_COLOUR = 'rgb(26, 58, 110)'; // --brand-deep
const LOGOTYPE_MAX_OPACITY = 0.25;
const LOGOTYPE_MAX = 1;

const isLogotype = (f: Fail) =>
  f.color === LOGOTYPE_COLOUR && f.opacity > 0 && f.opacity <= LOGOTYPE_MAX_OPACITY;

const unexpected = (p: Probe): Fail[] => p.fails.filter((f) => !isLogotype(f));

async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', EMAIL!);
  await page.fill('input#password', PASSWORD!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/stocks/, { timeout: 30_000 });
}

/**
 * The signed-in pages a subscriber actually operates.
 *
 * ⚠️ `/results` holds its rows client-side, so a cold navigation shows the empty
 * state (or, unentitled, the locked panel). Both are real; neither is the table.
 * The seeded, entitled table is measured separately at the foot of this file.
 */
const APP_PAGES = [
  '/stocks',
  '/stocks/us/AAPL',
  // ⚠️ For the shared E2E account these two render the LOCKED panel, not the
  // screener — that account has no subscription. Measuring them here is real
  // coverage of a real state (it is what an expired subscriber sees), but it is
  // NOT coverage of the product. The entitled table gets its own describe at the
  // foot of this file, on a throwaway paid account, with a control that fails if
  // it ever silently measures the lock screen instead.
  '/run',
  '/results',
  '/request',
  '/account',
];

test.describe('the signed-in product is legible', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const path of APP_PAGES) {
    test(`${path} — every readable element clears the WCAG floor`, async ({ page }) => {
      test.setTimeout(120_000);
      // The heaviest page in the product gets its own floor — see MIN_MEASURED.detail.
      const floor = path.startsWith('/stocks/') && path !== '/stocks'
        ? MIN_MEASURED.detail
        : MIN_MEASURED.app;
      const probe = await measure(page, path, 'app', floor);
      const fails = unexpected(probe);
      expect(
        fails,
        `${path} — ${fails.length} element(s) under the floor:\n${JSON.stringify(fails, null, 2)}`,
      ).toEqual([]);

      /* The watermark lives on the Verdict card, which this account cannot see —
         so nothing here should be excused at all. Saying so keeps the carve-out
         from silently widening onto a free page. */
      expect(
        probe.fails.filter(isLogotype),
        `${path} excused something as a logotype — the brand stamp is not on this page`,
      ).toEqual([]);
    });
  }

  test('the logotype carve-out cannot widen', () => {
    /* An exemption grows one entry at a time, each reasonable on its own, until it
       is excusing the page. This one is two constants and a count, so widening it
       is a visible decision in a diff rather than a quiet edit to an array. */
    expect(LOGOTYPE_MAX, 'one brand stamp, not a category').toBe(1);
    expect(LOGOTYPE_MAX_OPACITY, 'only a deliberately faded stamp qualifies').toBeLessThanOrEqual(0.25);
    // Matched on the exact COMPUTED colour, never on text: a text match would drift
    // onto any element that happened to contain the same word.
    expect(/^rgb\(\d+, \d+, \d+\)$/.test(LOGOTYPE_COLOUR)).toBe(true);
  });
});

/**
 * ── The paid table itself, on a throwaway ENTITLED account ──────────────────
 *
 * `/run` and `/results` above are measured as the shared E2E account sees them,
 * which is UNENTITLED — so they render the locked panel. That is a real state a
 * real reader meets and worth measuring, but it is emphatically not the screener:
 * no score chips, no tier badges, no composition bars, no Opportunity Map. Leaving
 * it there would have let "we measure /results" stand for something it never did
 * (CLAUDE.md 14g).
 *
 * ⚠️ Its own throwaway user, created and deleted here, rather than flipping the
 * shared account's subscription. Mutating one shared profiles row is what forces
 * `entitlement-routes.spec.ts` to run serially, and a second suite doing the same
 * thing concurrently is a race that would surface as an unexplainable flake in
 * whichever file lost. Deleting the auth user cascades the profile away, so this
 * leaves no residue.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const PAID_RUN = Date.now();
const PAID_EMAIL = `contrast-e2e-${PAID_RUN}@example.com`;
const PAID_PASSWORD = `E2e!contrast-${PAID_RUN}`;

test.describe('the paid screener output is legible', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(
    !SERVICE_KEY || !SUPABASE_URL,
    'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to run',
  );

  let admin: SupabaseClient;
  let paidUserId = '';

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // @example.com is reserved and non-deliverable; email_confirm skips the
    // verification mail — so this account has no outside side-effects.
    const { data: created, error } = await admin.auth.admin.createUser({
      email: PAID_EMAIL,
      email_confirm: true,
      password: PAID_PASSWORD,
    });
    if (error || !created?.user) throw new Error(`could not create user: ${error?.message}`);
    paidUserId = created.user.id;

    /* `acknowledged_disclaimer_at` is set for the same reason `entitlement-routes`
       sets it: the first-login modal must never overlay the pages we assert on.

       ⚠️ This is a FIX, and the bug it closes is worth keeping. This test used to
       dismiss the modal through the UI, guarded by `if (await ack.isVisible())`.
       `isVisible()` does not wait — it samples once, right after `waitForURL`
       resolves on the navigation commit, which can be before the modal has
       painted. Sample too early, read false, skip the dismissal.

       And the consequence is total rather than partial: `app/(app)/layout.tsx`
       returns the modal ALONE when the disclaimer is unacknowledged — no sidebar,
       no page — so every later navigation renders nothing but the dialog, and the
       "app" sentinel (a sidebar-offset <main>) can never become true. It surfaced
       on CI as one flaky run whose diagnostic dump read "Welcome to … please read
       and acknowledge", which is the only reason it took one run to find rather
       than an afternoon (CLAUDE.md 11i — a flaky test in code you wrote this
       session is your defect, not the harness's).

       Setting the column removes the race instead of timing it: the modal is a
       SERVER decision from this one field, so it is not rendered at all. */
    const { error: upd } = await admin
      .from('profiles')
      .update({
        subscription_status: 'active',
        grace_until: null,
        billing_blocked: false,
        acknowledged_disclaimer_at: new Date().toISOString(),
      })
      .eq('id', paidUserId);
    if (upd) throw new Error(`could not grant entitlement: ${upd.message}`);
  });

  test.afterAll(async () => {
    if (admin && paidUserId) await admin.auth.admin.deleteUser(paidUserId);
  });

  test('/results draws every tier, and every one of them is readable', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/login');
    await page.fill('input#email', PAID_EMAIL);
    await page.fill('input#password', PAID_PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/stocks/, { timeout: 30_000 });

    /* ⚠️ THE ONBOARDING MODAL IS HANDLED IN `beforeAll`, NOT HERE — see the note
       there. A brand-new account meets the first-login modal (decision #23) before
       it can reach anything, and the shared E2E account cleared it long ago, so
       this trap exists only for a throwaway user. Dismissing it through the UI is
       what made this test flaky; the acknowledgement is now set on the profile so
       the modal is never rendered.

       Asserting it is absent, because "I set a column" and "the page is clear" are
       different claims, and the failure mode is silent: the modal renders INSTEAD
       of the app, so everything below would measure a dialog. */
    await expect(page.getByLabel(/I understand and acknowledge/i)).toHaveCount(0);

    await page.evaluate(
      ([key, snap]) => sessionStorage.setItem(key as string, JSON.stringify(snap)),
      [SNAPSHOT_KEY, RUN_SNAPSHOT] as const,
    );

    const probe = await measure(page, '/results', 'app', MIN_MEASURED.results);

    /* THE CONTROL. Without it this test passes just as happily on the locked
       panel, the empty state, or a page that failed to render — none of which
       contain a single score chip. */
    expect(
      await page.locator('.score-num').count(),
      'no score chips on /results — this measured the lock screen or the empty state, not the table',
    ).toBeGreaterThanOrEqual(RUN_SNAPSHOT_ROWS);

    const fails = unexpected(probe);
    expect(
      fails,
      `/results — ${fails.length} element(s) under the floor:\n${JSON.stringify(fails, null, 2)}`,
    ).toEqual([]);
  });

  /**
   * ── The Stock Detail page AS A SUBSCRIBER SEES IT ───────────────────────────
   *
   * The describe above measures `/stocks/us/AAPL` too — with the shared account,
   * which holds no subscription. That is a real state and it is not the product:
   * the Verdict card, the scorecard radar and the rating badges are all withheld,
   * so the busiest premium surface in the app had **no contrast evidence of any
   * kind** while a spec named after it passed on every run.
   *
   * ⚠️ Measuring it entitled for the first time on 2026-08-22 found something no
   * previous run could have: `.verdict-thesis-num` drew white numerals at 85%
   * opacity on Constructive green, which took 5.31 down to **4.31**. The opacity
   * was the whole defect (CLAUDE.md 11q — recede with a colour, never with
   * transparency), and it had been there since the card was built.
   *
   * Same throwaway account as `/results` above, deliberately: a second concurrent
   * paid user is a second writer to `profiles`, which is the race that forces
   * `entitlement-routes.spec.ts` to run serially.
   */
  test('the Verdict, the radar and the badges are readable too', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/login');
    await page.fill('input#email', PAID_EMAIL);
    await page.fill('input#password', PAID_PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/stocks/, { timeout: 30_000 });
    await expect(page.getByLabel(/I understand and acknowledge/i)).toHaveCount(0);

    const probe = await measure(page, '/stocks/us/AAPL', 'app', MIN_MEASURED.detail);

    /* THE CONTROL, and it is the whole point of this test: without it this passes
       just as happily on the page the FREE account sees, which is the coverage
       that already existed. `.verdict-headline` and `.score-tag` exist only for an
       entitled viewer. */
    expect(
      await page.locator('.card--verdict').count(),
      'no Verdict card — this measured the free viewer\'s page, not the subscriber\'s',
    ).toBeGreaterThan(0);

    const fails = unexpected(probe);
    expect(
      fails,
      `/stocks/us/AAPL entitled — ${fails.length} element(s) under the floor:\n${JSON.stringify(fails, null, 2)}`,
    ).toEqual([]);

    /* The brand stamp is the one thing excused, and it is bounded both ways: if it
       ever measures zero the carve-out has outlived its subject and must come out
       rather than sit here excusing nothing (CLAUDE.md 14g). */
    const excused = probe.fails.filter(isLogotype);
    expect(
      excused.length,
      'no faded brand stamp found — delete the logotype carve-out',
    ).toBeGreaterThan(0);
    expect(
      excused.length,
      `${excused.length} elements excused as a logotype; there is one watermark`,
    ).toBeLessThanOrEqual(LOGOTYPE_MAX);
  });
});
