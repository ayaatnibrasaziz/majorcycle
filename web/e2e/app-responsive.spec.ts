import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { twoFrames } from './lib/frames';

import { RUN_SNAPSHOT, RUN_SNAPSHOT_ROWS, SNAPSHOT_KEY } from './fixtures/runSnapshot';
import { HAVE_E2E_CREDENTIALS, signIn } from './lib/session';
import { SCORECARD_STACK_PX, SHELL_DESKTOP_MIN_PX } from '../lib/shell';

/**
 * The signed-in pages must not scroll SIDEWAYS — non-negotiable #3.
 *
 * ── What this file used to be, and the three ways it was blind ─────────────
 * ⚠️ AUDIT 5A-116 built it: the Stock Detail page scrolled horizontally at every
 * viewport between ~601px and ~900px (263px at 644px, 135px at 772px, 0 at 921px),
 * because `.ownership-grid` computed `grid-template-columns: 200px 423.5px` inside a
 * 344px container — a grid item defaults to `min-width: auto`, so the `1fr` track took
 * the holders table's min-content width and refused to shrink. That fix stands.
 *
 * ⚠️ **CLAUDE.md 11bd — the guard signed in as the account with no subscription.** On
 * that account the paid sections do not render at all: `/run` is the upsell card, not
 * the screener. So every page it measured was narrower than the product, and it passed
 * for months while the entitled screener was **188px** over at 375px against the 46px
 * on record. A guard's scope is not only "which routes and which widths" but **"who is
 * it looking as?"** — the fourth scope claim that is invisible in a passing run, after
 * the tag list (11ap), the `experimental` flag (11ax) and the width list (11i-b).
 *
 * ⚠️ **It SAMPLED four widths** — 640 / 768 / 900 / 1280 — inside the very band it was
 * written to guard. Even on the free account the ticker page scrolled 10px at **720px**,
 * which is in nobody's list. A layout that changes at breakpoints breaks *at* the
 * breakpoint, which is the one width nobody picks (11i-b, and the five-pixel band of
 * 5A-159). It sweeps now.
 *
 * ⚠️ **And `/results` measured a clean 0 because it was EMPTY.** With no run history
 * that page renders nothing, and nothing is not wide. The real figure was 158px. It is
 * seeded here and the row count is asserted BEFORE anything is measured — a clean
 * number off a page with nothing on it is what a broken check also returns (14g).
 *
 * ── What it asserts now (Layer H · H1) ─────────────────────────────────────
 * Every signed-in route, **entitled and free**, swept in 4px steps from **320px** — 55px
 * below our stated 375px floor — up to a desktop width, in two bands so neither runs out
 * of budget. Positive controls throughout: the rail is still there at 1280px, the paid
 * session is really paid, and the scorecard's bars are still bars.
 *
 * ⚠️ And the last section asserts what an overflow sweep constitutionally cannot see —
 * that the phone layout is LEGIBLE rather than merely narrow (11bf).
 */

/** Try to scroll the window right, and report how far it actually went. */
async function sidewaysScroll(page: Page): Promise<number> {
  await page.evaluate(() => window.scrollTo(99999, window.scrollY));
  // Two frames: one for the scroll to apply, one for any layout it triggers — capped,
  // because headless Firefox can withhold a frame forever (see `lib/frames.ts`).
  await twoFrames(page);
  return page.evaluate(() => {
    const x = Math.round(window.scrollX);
    window.scrollTo(0, window.scrollY);
    return x;
  });
}

/**
 * ⚠️ WHY THIS ASSERTS A SCROLL RATHER THAN `scrollWidth`. On the broken page
 * `documentElement.scrollWidth` was 907 against a 644 client width, but every element
 * extending past the edge sat inside a scroll or clip container, so an "which element
 * overflows" probe returned **zero offenders** and read as clean. Actually scrolling the
 * window and reading `scrollX` back is the only measurement that matched what a person
 * experiences (11ab: when measurements disagree, run the experiment).
 */

/** Our committed floor. Non-negotiable #3. */
const FLOOR_PX = 375;

/**
 * How much room the narrowest phone must have left over.
 *
 * ⚠️ A BOUND OF `>= 0` SCORES AN ACCIDENT AS A PASS. 11i-b: the last defect of this
 * class cleared 375px by **1.1px** and overflowed at 360. So the margin is expressed as
 * a WIDTH rather than as arithmetic on a measurement — a page that fits at `375 - 20`
 * has 20px spare at the floor. `SWEEP_FROM` below now starts lower still, at 320, so
 * the real margin is 55px; this constant remains the minimum we would accept.
 */
const MARGIN_PX = 20;

/**
 * ⚠️ **320px, which is BELOW our own floor, and on purpose** — the same convention
 * `public-responsive.spec.ts` already follows for the same reason. A guard that starts
 * at the number we promise is the one width that cannot see a page passing by a hair:
 * the last defect of this class cleared 375px by **1.1px** and overflowed at 360.
 *
 * Layer H originally wrote 320px off as known-and-accepted, because the screener was
 * ~23px over there. The H1 visual pass found that the whole 23px was ONE native
 * `<select>`, sized to its longest option ("Diversified Telecommunication Services") at
 * a fixed 303px with no `max-width`. One clamp closed it, so the product is now clean
 * from 320px up and there is nothing left to excuse.
 *
 * That leaves **55px of margin** at the 375px floor rather than the 20 we set out to
 * buy — so `MARGIN_PX` stays as the statement of intent, and this is the stronger claim
 * the measurement turned out to support.
 */
const SWEEP_FROM = 320;
const SWEEP_TO = 1280;

/**
 * ⚠️ 4px, not 20px. The first plan for H1 recommended a 1024px breakpoint on the
 * strength of a 20px-step sweep, and the real threshold was 730 (CLAUDE.md 11be): a
 * sweep coarse enough to BRACKET a value cannot CHOOSE one. 4px also straddles
 * `SHELL_DESKTOP_MIN_PX` closely enough that the breakpoint itself is measured rather
 * than jumped over.
 */
const STEP_PX = 4;

/**
 * ⚠️ SWEPT IN TWO BANDS, AND THAT IS A TIMEOUT DECISION RATHER THAN A STYLISTIC ONE.
 *
 * As one test per route this walked all 232 widths in a single budget. On the ticker
 * page — the heaviest in the product, where every resize forces a full relayout — that
 * took **186s alone and exceeded the 300s budget under full-suite load**, failing on
 * `page.setViewportSize` with nothing about the layout having changed. `pnpm gates` went
 * red on a test that had passed twice minutes earlier.
 *
 * That is 11i-b in the time dimension — a test that passes with no margin is a test that
 * fails on a slower day — and `public-responsive.spec.ts` has the identical note after
 * audit 5A-164 timed it out having changed nothing. **A flaky guard protects less than an
 * honest gap, because a gap is visible.**
 *
 * The split is at `SHELL_DESKTOP_MIN_PX` rather than at an arbitrary halfway point, so
 * each half is one SHELL — the drawer layout or the rail layout — and a failure names
 * which of the two broke rather than which arbitrary slice of pixels.
 */
const BANDS = [
  { name: 'the phone shell', from: SWEEP_FROM, to: SHELL_DESKTOP_MIN_PX - STEP_PX },
  { name: 'the desktop shell', from: SHELL_DESKTOP_MIN_PX, to: SWEEP_TO },
] as const;

function widthsIn(from: number, to: number): number[] {
  const out: number[] = [];
  for (let w = from; w <= to; w += STEP_PX) out.push(w);
  if (out[out.length - 1] !== to) out.push(to);
  return out;
}

/** Every width the two bands cover between them — used by the coverage control. */
const ALL_WIDTHS = BANDS.flatMap((b) => widthsIn(b.from, b.to));

/** Every signed-in route that renders a page of its own. */
const PATHS = [
  '/stocks',
  '/stocks/us/AAPL',
  '/run',
  '/results',
  '/request',
  '/account',
] as const;

/** Seed the ranked table so `/results` has something to be wide WITH. */
async function seedResults(page: Page): Promise<void> {
  await page.goto('/stocks');
  await page.evaluate(
    ([key, snap]) => sessionStorage.setItem(key as string, JSON.stringify(snap)),
    [SNAPSHOT_KEY, RUN_SNAPSHOT] as const,
  );
}

/**
 * How many elements a page must carry before it counts as rendered.
 *
 * ⚠️ ONE constant serving two jobs, and that is the point (11q): it is the floor the
 * test demands AND the precondition it waits for, so the wait cannot be satisfied by
 * less than the measurement needs.
 *
 * ⚠️ **TWO numbers, because a free `/run` is not a small screener — it is a different
 * page.** An unentitled viewer gets `PremiumLockPage`, which is one card: measured at
 * **97 elements**, against several hundred for the screener. A single floor of 120
 * failed both free paid-routes on the first run, and the tempting fix — lower the floor
 * to 60 everywhere — would have let the ENTITLED sweep start measuring a page that had
 * barely begun to paint. The floors are the pages' real sizes, not round guesses.
 */
const MIN_ELEMENTS = { full: 120, upsell: 60 } as const;

/**
 * Load a route and wait for it to stop being half-built.
 *
 * The ticker page streams its cards in, so an early read describes a page that has not
 * finished. `body *` crossing a floor is a POSITIVE signal the page rendered rather
 * than a plateau that a compile pause can satisfy (11q).
 */
async function ready(
  page: Page,
  path: string,
  floor: number = MIN_ELEMENTS.full,
): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('body *').length), {
      message: `${path} never rendered enough to measure`,
      /* ⚠️ 120s, matching `app-a11y.spec.ts`, and for the reason recorded there:
         `reuseExistingServer: false` gives every run a COLD Turbopack compile, and
         /stocks/us/AAPL is the heaviest route in the product — 34 components and
         ~1,400 elements. It exceeded 60s here on the first test to reach it after
         a fresh server, reporting "never rendered enough to measure" about a page
         that renders its skeleton in 389ms in production (11r).

         Raising a WAIT is not weakening an assertion: a page that genuinely never
         renders still fails, just later. The floor itself is untouched. */
      timeout: 120_000,
    })
    .toBeGreaterThan(floor);
  await page.waitForTimeout(600);
}

/** Routes a free account cannot see, so it meets the upsell card instead. */
const PAID_ONLY = new Set<string>(['/run', '/results']);

/**
 * Sweep one route and return every width that scrolled.
 *
 * Resizes rather than reloading: 232 widths x 6 routes x 2 accounts is 2,784 page loads
 * and about an hour, against 12 loads and the same 2,784 measurements in minutes. The
 * layout under test is CSS, and CSS does not care whether the width arrived by a
 * reload or a resize.
 */
async function sweepRoute(page: Page, widths: number[]): Promise<{ bad: string[]; checked: number }> {
  const bad: string[] = [];
  let checked = 0;
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const x = await sidewaysScroll(page);
    checked += 1;
    if (x > 0) bad.push(`${width}px scrolled ${x}px`);
  }
  return { bad, checked };
}

/**
 * THE CONTROL, and it is the one that matters most.
 *
 * Every assertion in this file is satisfied perfectly by a layout that hides the
 * sidebar at every width — which would destroy the product on a desktop while turning
 * the whole suite green. So: at 1280px the rail must be ON SCREEN.
 */
async function railIsPresentOnDesktop(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(
    page.locator('[data-shell-rail]'),
    'the sidebar is gone at 1280px — every overflow assertion here would pass on a layout with no navigation at all',
  ).toBeVisible();
  await expect(
    page.locator('[data-shell-rail]'),
    'the sidebar is not 220px wide at 1280px',
  ).toHaveCSS('width', '220px');
}

/** And the mirror: below the breakpoint the rail must be OUT of the layout. */
async function railIsHiddenOnAPhone(page: Page): Promise<void> {
  await page.setViewportSize({ width: FLOOR_PX, height: 900 });
  await expect(
    page.locator('[data-shell-rail]'),
    `the rail is still rendered at ${FLOOR_PX}px — the page cannot have its full width`,
  ).toBeHidden();
}

function report(label: string, failures: string[]): void {
  expect(
    failures,
    `${label} scrolled sideways:\n  ${failures.join('\n  ')}\n\n` +
      `Swept ${SWEEP_FROM}-${SWEEP_TO}px in ${STEP_PX}px steps. ${SWEEP_FROM} is ${MARGIN_PX}px ` +
      `below the ${FLOOR_PX}px floor on purpose, so a page that only just fits still fails ` +
      '(11i-b). A grid item defaults to min-width:auto — give the shrinking track ' +
      'min-width:0 and put its wide content in an overflow-x:auto wrapper, unconditionally.',
  ).toEqual([]);
}

// ───────────────────────── the free account ─────────────────────────

test.describe('no signed-in page scrolls sideways — FREE account', () => {
  test.skip(!HAVE_E2E_CREDENTIALS, 'set E2E_EMAIL + E2E_PASSWORD to run');

  for (const path of PATHS) {
   for (const band of BANDS) {
    const widths = widthsIn(band.from, band.to);
    test(`${path} fits every width of ${band.name}`, async ({ page, browserName }) => {
      // Firefox and WebKit take ~1.7x Chromium's time per width on the ticker page
      // (measured, Layer H4: 0.86s vs 0.50s) — a sweep of 240 widths, not a reader.
      test.setTimeout(browserName === 'chromium' ? 300_000 : 600_000);
      await signIn(page);
      if (path === '/results') await seedResults(page);
      const paidOnly = PAID_ONLY.has(path);
      await ready(page, path, paidOnly ? MIN_ELEMENTS.upsell : MIN_ELEMENTS.full);

      /* The control for THIS describe: a free session must really be free, or it is
         silently measuring the same thing as the entitled one and the pair proves
         nothing. The padlocks on the SCREEN group render only for an account without
         a subscription, and they are in the DOM at every width. */
      expect(
        await page.locator('[aria-label="Requires a subscription"]').count(),
        'no padlocks in the nav — this session is entitled, so it is not the free case',
      ).toBeGreaterThan(0);

      /* And on the two paid routes, the SECOND half of that control: 97 elements is
         what the upsell card renders AND what a half-broken page renders. `role="note"`
         is `PremiumLockPage`'s own wrapper, so this says the low count is the product
         rather than a page that never finished (14g). */
      if (paidOnly) {
        await expect(
          page.getByRole('note'),
          `${path} has no upsell card — a free account should meet one, so this is not the page it looks like`,
        ).toBeVisible();
      }

      const { bad, checked } = await sweepRoute(page, widths);
      expect(checked, 'no width was measured').toBe(widths.length);

      /* Each band checks the shell it is actually about, so a failure names the layout
         that broke. Both still run for every route — the rail control is the one that
         stops a layout with NO navigation from passing every overflow assertion here. */
      if (band.from >= SHELL_DESKTOP_MIN_PX) await railIsPresentOnDesktop(page);
      else await railIsHiddenOnAPhone(page);

      report(`FREE ${path} · ${band.name}`, bad);
    });
   }
  }
});

// ─────────────────────── the entitled account ───────────────────────

/**
 * ⚠️ A THROWAWAY PAID USER, not a subscription flipped onto the shared row.
 * `app-contrast.spec.ts` and `app-a11y.spec.ts` both record why: writing
 * `subscription_status` on the one shared `profiles` row makes two suites second
 * writers to the same row, and that race surfaces as an unexplainable flake in
 * whichever one loses.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const PAID_RUN = Date.now();
const PAID_EMAIL = `resp-e2e-${PAID_RUN}@example.com`;
const PAID_PASSWORD = `E2e!resp-${PAID_RUN}`;

/** Signed in once per worker and replayed, for the reason `lib/session.ts` gives. */
type Cookies = Parameters<BrowserContext['addCookies']>[0];
let paidCookies: Cookies | null = null;

async function signInPaid(page: Page): Promise<void> {
  if (paidCookies) {
    await page.context().addCookies(paidCookies);
    await page.goto('/stocks');
    if (!page.url().includes('/login')) return;
    paidCookies = null;
  }
  await page.goto('/login');
  await page.fill('input#email', PAID_EMAIL);
  await page.fill('input#password', PAID_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/stocks/, { timeout: 45_000 });
  paidCookies = (await page.context().storageState()).cookies;
}

test.describe('no signed-in page scrolls sideways — ENTITLED account', () => {
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
    // @example.com is reserved and non-deliverable; `email_confirm` skips the
    // verification mail, so this account has no outside side-effects.
    const { data: created, error } = await admin.auth.admin.createUser({
      email: PAID_EMAIL,
      email_confirm: true,
      password: PAID_PASSWORD,
    });
    if (error || !created?.user) throw new Error(`could not create user: ${error?.message}`);
    paidUserId = created.user.id;

    /* The acknowledgement is set here rather than dismissed through the UI: the
       first-login modal is a SERVER decision from this one field, and the app layout
       returns the modal ALONE when it is null — so a UI dismissal that samples too
       early leaves every later navigation rendering a dialog, and the sweep measures
       that instead of the product. */
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

  for (const path of PATHS) {
   for (const band of BANDS) {
    const widths = widthsIn(band.from, band.to);
    test(`${path} fits every width of ${band.name}`, async ({ page, browserName }) => {
      // Firefox and WebKit take ~1.7x Chromium's time per width on the ticker page
      // (measured, Layer H4: 0.86s vs 0.50s) — a sweep of 240 widths, not a reader.
      test.setTimeout(browserName === 'chromium' ? 300_000 : 600_000);
      await signInPaid(page);

      // "I set a column" and "the page is clear" are different claims, and the
      // failure is silent: the modal renders INSTEAD of the app.
      await expect(page.getByLabel(/I understand and acknowledge/i)).toHaveCount(0);

      if (path === '/results') await seedResults(page);
      await ready(page, path);

      /* THE POSITIVE CONTROL, and it is the whole reason this describe exists. An
         unentitled session renders the upsell on the paid routes, and an upsell card
         fits a phone beautifully — so without this the entitled sweep would pass by
         measuring exactly the pages the FREE sweep already measured (11v). The
         padlocks are the same signal the free case asserts the presence of, read the
         other way, so the two cannot both be true of one session. */
      expect(
        await page.locator('[aria-label="Requires a subscription"]').count(),
        'the nav still shows padlocks — this session is NOT entitled, so this sweep proves nothing about the paid product',
      ).toBe(0);

      if (path === '/results') {
        /* Polls, because 0 rows is what the lock screen, the empty state AND a table
           that has not painted yet all report — a bare count cannot tell them apart
           (11q). This is the assertion that stops `/results` being measured empty
           again. */
        await expect
          .poll(() => page.locator('.score-num').count(), {
            message: 'no score chips on /results — measuring an empty page, which is what gave the false 0',
            timeout: 45_000,
          })
          .toBeGreaterThanOrEqual(RUN_SNAPSHOT_ROWS);
      }

      const { bad, checked } = await sweepRoute(page, widths);
      expect(checked, 'no width was measured').toBe(widths.length);

      const desktopBand = band.from >= SHELL_DESKTOP_MIN_PX;
      if (desktopBand) await railIsPresentOnDesktop(page);
      else await railIsHiddenOnAPhone(page);

      /* The scorecard checks set their own viewports and straddle the stack threshold,
         so they belong to ONE band rather than both — running them twice would double
         the slowest test's work for no extra coverage, which is what put this file over
         its budget in the first place. */
      if (path === '/stocks/us/AAPL' && desktopBand) {
        await scorecardIsUnchangedOnDesktop(page);
        await scorecardBarsAreRealBars(page);
      }

      report(`ENTITLED ${path} · ${band.name}`, bad);
    });
   }
  }

  /**
   * ── LEGIBLE, NOT MERELY NARROW ──────────────────────────────────────────
   *
   * Everything above asks one question: does the page fit? The owner reviewed the
   * phone layout by LOOKING at it and found two defects that fit perfectly — the
   * scorecard's 1px bars were the first, and these two were the next. All three are
   * invisible to an overflow sweep because all three measure `scrollX === 0`.
   *
   * So these assert what the pictures showed, and each has a control that fails if the
   * thing being checked stopped rendering at all.
   */
  test('the Verdict watermark never sits on top of the heading', async ({ page }) => {
    test.setTimeout(180_000);
    await signInPaid(page);
    await ready(page, '/stocks/us/AAPL');

    const overlaps: string[] = [];
    let sawWatermark = 0;

    for (const width of [FLOOR_PX, 414, 600, SHELL_DESKTOP_MIN_PX, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      const hit = await page.evaluate(() => {
        const mark = document.querySelector('.verdict-watermark');
        const brow = document.querySelector('.verdict-eyebrow');
        if (!brow) return null;
        const shown = !!mark && getComputedStyle(mark).display !== 'none';
        if (!shown || !mark) return { shown: false, overlap: 0 };

        /* ⚠️ THE EYEBROW'S BOX IS NOT THE EYEBROW'S TEXT. `.verdict-eyebrow` is a flex
           row inside `.verdict-headline`, which takes the `1fr` track of `.verdict-top`
           — so its bounding rect spans the whole column whatever the words are. Reading
           that rect, the first version of this guard reported a 95px "overlap" at 600px
           where the ink is nowhere near the watermark. Measure the INK: the union of the
           rects of the eyebrow's own text and its info button. */
        const inkRight = (el: Element): number => {
          let right = -Infinity;
          for (const node of Array.from(el.childNodes)) {
            if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim()) {
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const r of Array.from(range.getClientRects())) right = Math.max(right, r.right);
            } else if (node instanceof Element) {
              const r = node.getBoundingClientRect();
              if (r.width > 0) right = Math.max(right, r.right);
            }
          }
          return right;
        };

        const a = mark.getBoundingClientRect();
        const b = brow.getBoundingClientRect();
        const textRight = inkRight(brow);
        if (!Number.isFinite(textRight)) return { shown: true, overlap: 0 };
        const x = Math.min(a.right, textRight) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return { shown: true, overlap: x > 0 && y > 0 ? Math.round(x) : 0 };
      });
      if (hit === null) continue;
      if (hit.shown) sawWatermark += 1;
      if (hit.overlap > 0) overlaps.push(`${width}px: the watermark covers ${hit.overlap}px of the heading`);
    }

    /* THE CONTROL. "They never overlap" is satisfied perfectly by deleting the
       watermark from every width, which would quietly strip the brand stamp off the
       paid card. It must still be drawn where there is room for it. */
    expect(
      sawWatermark,
      'the Verdict watermark is hidden at EVERY width — the overlap fix has removed it rather than stood it down',
    ).toBeGreaterThan(0);

    /* ⚠️ AND THE PROBE MUST BE SHOWN FAILING, or a pass from it carries no information
       (11p). Force the watermark back on at the width where it genuinely collided and
       assert this measurement SEES it — the same defect, reintroduced for one frame.
       Without this, a probe that quietly measured nothing would report the page clean
       for ever. It also guards the correction made above: reading the eyebrow's BOX
       instead of its ink gave a phantom 95px "overlap" at 600px. */
    await page.setViewportSize({ width: FLOOR_PX, height: 900 });
    await page.waitForTimeout(300);
    const sabotage = await page.evaluate(() => {
      const mark = document.querySelector('.verdict-watermark') as HTMLElement | null;
      const brow = document.querySelector('.verdict-eyebrow');
      if (!mark || !brow) return null;
      mark.style.display = 'flex';
      const a = mark.getBoundingClientRect();
      const b = brow.getBoundingClientRect();
      let right = -Infinity;
      for (const node of Array.from(brow.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of Array.from(range.getClientRects())) right = Math.max(right, r.right);
        } else if (node instanceof Element) {
          const r = node.getBoundingClientRect();
          if (r.width > 0) right = Math.max(right, r.right);
        }
      }
      mark.style.display = '';
      const x = Math.min(a.right, right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return x > 0 && y > 0 ? Math.round(x) : 0;
    });
    expect(
      sabotage,
      `forcing the watermark back on at ${FLOOR_PX}px produced no overlap — this probe cannot see the defect it exists for`,
    ).toBeGreaterThan(0);

    expect(
      overlaps,
      `the Verdict card draws two strings of text on top of each other:\n  ${overlaps.join('\n  ')}\n\n` +
        'globals.css hides `.verdict-watermark` under a 420px CONTAINER. Keep that block ' +
        'BELOW the `.verdict-watermark` rule — specificity ties, so source order decides, ' +
        'and the base rule ends in `display: flex` (11bc).',
    ).toEqual([]);
  });

  test('no dense grid demands more width than its card gives it', async ({ page }) => {
    test.setTimeout(180_000);
    await signInPaid(page);
    await ready(page, '/stocks/us/AAPL');

    /* ⚠️ THE CLIPPING CLASS, which is the third thing an overflow sweep cannot see.
       `1fr` is `minmax(auto, 1fr)` and `auto` will not go below MIN-CONTENT, so a grid
       whose tracks have a floor simply overflows its card — and if the card clips, the
       content is CUT OFF with no scroll anywhere to betray it. The Technical Levels
       pills did exactly that: at 360px the third pill lost 15px and the page measured
       clean; only by 320px did it escape far enough to scroll.

       Measured on the grids that pack several values into a row, across the phone band.
       `scrollWidth > clientWidth` on a grid means its tracks did not fit, whatever the
       page-level sweep says. */
    const GRIDS = ['.tech-pill-grid', '.radar-grid', '.ownership-stats', '.km-cat-row'];
    const failures: string[] = [];
    let measured = 0;

    for (const width of [320, 340, 360, 375, 414, 560]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(350);
      const rows = await page.evaluate((sels) => {
        const out: { sel: string; over: number }[] = [];
        for (const sel of sels) {
          for (const el of Array.from(document.querySelectorAll(sel))) {
            const r = el.getBoundingClientRect();
            if (!r.width) continue;
            out.push({ sel, over: el.scrollWidth - el.clientWidth });
          }
        }
        return out;
      }, GRIDS);
      for (const r of rows) {
        measured += 1;
        if (r.over > 2) failures.push(`${width}px: ${r.sel} needs ${r.over}px more than it has`);
      }
    }

    /* THE CONTROL. Four selectors that match nothing would report a clean sweep having
       looked at no grid at all — the vacuous needle of 11aw. */
    expect(
      measured,
      `none of ${GRIDS.join(', ')} matched anything — this guard measured no grid, so it proves nothing`,
    ).toBeGreaterThan(6);

    expect(
      failures,
      `these grids overflow their own card, so their last column is cut off: ${failures.join('; ')}. ` +
        'A `1fr` track cannot shrink below min-content. Drop the COLUMN COUNT at that ' +
        'width rather than letting the tracks shrink — a squeezed track holds a price ' +
        'like "$317.83" in 75px and is the scorecard bar again (11bf).',
    ).toEqual([]);
  });

  test('the scorecard radar is either fully labelled or full size — never small AND labelled', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await signInPaid(page);
    await ready(page, '/stocks/us/AAPL');

    /**
     * ⚠️ Recharts reserves NO room for radar axis labels — each is pushed outward
     * along its spoke — and the ring is sized as a fraction of the box while the
     * words are fixed pixels. So the room between them shrinks with the box while
     * "Balance Sheet" stays ~77px: at 320px the scorecard read "Balance S".
     *
     * ⚠️ THREE FIXES WERE REJECTED BY THE OWNER, each of which passed every other
     * guard, and the third rejection is the one this test is shaped around.
     *   1. letting the labels use the card's padding — "Balance Sheet" ended 5px
     *      OUTSIDE the card;
     *   2. breaking it onto two lines — changed the card's typography at one width;
     *   3. shrinking the ring until the words fit at EVERY width — arithmetically
     *      correct and visually wrong: at 320px a 65px ring sat beside 10.5px
     *      labels and *"the radar chart is very small compared to the text"*.
     *
     * So there are exactly two acceptable states, and the third — a shrunken ring
     * that is ALSO labelled — is the one that has to be impossible:
     *   · labelled, with every label whole, on one line, inside the chart box, and
     *     a ring still big enough to be worth reading; or
     *   · bare, with the ring at FULL size and the five score bars beneath naming
     *     every pillar with its number.
     */
    const radarReady = async () =>
      page
        .waitForFunction(
          () => {
            const wrap = document.querySelector('.chart-h-radar');
            const svg = wrap?.querySelector('svg');
            if (!wrap || !svg) return false;
            if (Math.abs(svg.getBoundingClientRect().width - wrap.clientWidth) > 2) return false;
            return svg.querySelectorAll('.recharts-polygon, polygon').length > 0;
          },
          null,
          { timeout: 45_000 },
        )
        .catch(() => {});

    /** Below this a ring is too small to be worth labelling — mirrors the
     *  component's own `MIN_LABELLED_RADIUS_PX`, expressed as the width a reader
     *  sees. Asserted rather than assumed: it is the owner's judgement call. */
    const MIN_LABELLED_RING_PX = 85;

    const problems: string[] = [];
    let sawLabelled = 0;
    let sawBare = 0;

    for (const width of [320, 340, 360, FLOOR_PX, 414, 640, 900, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await radarReady();
      await page.waitForTimeout(250);

      const seen = await page.evaluate(() => {
        const wrap = document.querySelector('.chart-h-radar');
        const svg = wrap?.querySelector('svg');
        if (!wrap || !svg) return null;
        const box = svg.getBoundingClientRect();
        // ⚠️ INK, via a Range — a `<text>`'s box carries side bearing the reader
        // never sees, and the difference decided a 1px call here once.
        const labels = [...svg.querySelectorAll('text')]
          .filter((t) => (t.textContent ?? '').trim().length > 2)
          .map((t) => {
            let left = Infinity;
            let right = -Infinity;
            for (const n of t.childNodes) {
              if (n.nodeType !== 3 || !n.nodeValue?.trim()) continue;
              const r = document.createRange();
              r.selectNodeContents(n);
              const rect = r.getBoundingClientRect();
              left = Math.min(left, rect.left);
              right = Math.max(right, rect.right);
            }
            return {
              text: (t.textContent ?? '').trim(),
              lines: t.querySelectorAll('tspan').length,
              outLeft: Math.round(box.left - left),
              outRight: Math.round(right - box.right),
            };
          });
        const ring = [...svg.querySelectorAll('.recharts-polygon, polygon')]
          .map((e) => e.getBoundingClientRect().width)
          .sort((a, b) => b - a)[0] ?? 0;
        const bars = document.querySelectorAll('.radar-axis-bar-track').length;
        return { labels, ring: Math.round(ring), bars };
      });

      expect(seen, `no scorecard radar rendered at ${width}px`).not.toBeNull();
      const { labels, ring, bars } = seen!;

      // THE CONTROL that outranks the rest: a chart with no ring at all passes
      // every "nothing is cut" test ever written.
      expect(ring, `the radar ring collapsed to ${ring}px at ${width}px`).toBeGreaterThan(50);

      if (labels.length === 0) {
        sawBare += 1;
        // Bare is only acceptable when it buys a FULL-SIZE chart — a small ring
        // with no labels is the worst of both and was never a candidate.
        if (ring < MIN_LABELLED_RING_PX) {
          problems.push(
            `${width}px: the ring is only ${ring}px AND unlabelled — standing the labels down ` +
              'is supposed to buy the chart its full size back',
          );
        }
        expect(
          bars,
          `at ${width}px the radar has no labels AND no score bars — nothing names the pillars`,
        ).toBeGreaterThan(0);
        continue;
      }

      sawLabelled += 1;
      expect(
        labels.length,
        `${labels.length} radar labels at ${width}px — it is all five or none, never a partial set`,
      ).toBe(5);
      if (ring < MIN_LABELLED_RING_PX) {
        problems.push(
          `${width}px: labelled with a ${ring}px ring — below ${MIN_LABELLED_RING_PX}px the chart ` +
            'reads as small beside its own labels, which is the state the owner rejected',
        );
      }
      for (const l of labels) {
        if (l.lines > 1) problems.push(`${width}px: "${l.text}" was broken onto ${l.lines} lines`);
        if (l.outLeft > 0 || l.outRight > 0) {
          problems.push(
            `${width}px: "${l.text}" is ${Math.max(l.outLeft, l.outRight)}px outside the chart box`,
          );
        }
      }
    }

    // Both arms must actually occur, or a green run has tested half the rule.
    expect(sawLabelled, 'the radar never drew its labels at ANY width').toBeGreaterThan(0);
    expect(sawBare, 'the radar drew labels at every width — the stand-down never ran').toBeGreaterThan(0);

    expect(
      problems,
      `the scorecard radar is in a state the owner rejected: ${problems.join('; ')}.`,
    ).toEqual([]);
  });

  test("the valuation chart's two reference labels never print on each other", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await signInPaid(page);

    /**
     * ⚠️ NOT A WIDTH DEFECT, which is why it belongs with the legibility guards
     * and not with the sweeps above. "Avg 32.1x" and "Current 38.2x" printed on
     * top of each other at EVERY width including 1280 — measured on AAPL: the Avg
     * line at y=82, the Current line at y=65, both labels occupying y=68..80.
     *
     * The two labels carried fixed positions, and `insideTop*` renders BELOW a
     * horizontal reference line while `insideBottom*` renders ABOVE it — the
     * reverse of how they read. So the lower line's label pointed up and the
     * upper line's pointed down, both into the gap between them, and whether they
     * collided was decided by how far apart the data put the two lines.
     *
     * ⚠️ SO THE TICKERS ARE THE TEST. One stock proves nothing: reverting the fix
     * measures −12px on AAPL and −3px on ENB and stays CLEAR on T, because T
     * trades below its own average and the orientation flips. The list therefore
     * has to contain both orientations, and the control below fails the run if it
     * ever stops doing so — a green result over four stocks that all lean the same
     * way is half a test (CLAUDE.md 11k).
     */
    const seen = { avgAbove: 0, avgBelow: 0 };
    const collisions: string[] = [];

    for (const ticker of ['us/AAPL', 'ca/ENB', 'us/T', 'us/GILD']) {
      await ready(page, `/stocks/${ticker}`);
      // ⚠️ Wait for the thing being measured, not for the page. Recharts renders
      // its reference labels after its own async measure pass, and a run that
      // sampled too early reported "no valuation chart rendered on any of the
      // four tickers" — the control firing correctly on a measurement that had
      // not happened yet. Poll for a POSITIVE signal (11q).
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll('text')].filter((t) =>
              /^(Avg|Current) /.test((t.textContent ?? '').trim()),
            ).length >= 2,
          null,
          { timeout: 30_000 },
        )
        .catch(() => {});

      const found = await page.evaluate(() => {
        const texts = [...document.querySelectorAll('text')].filter((t) =>
          /^(Avg|Current) /.test((t.textContent ?? '').trim()),
        );
        if (texts.length < 2) return null;
        const box = (e: Element) => {
          const r = e.getBoundingClientRect();
          return { t: (e.textContent ?? '').trim(), x: r.left, y: r.top, r: r.right, b: r.bottom };
        };
        const a = box(texts.find((t) => (t.textContent ?? '').startsWith('Avg'))!);
        const c = box(texts.find((t) => (t.textContent ?? '').startsWith('Current'))!);
        const ox = Math.min(a.r, c.r) - Math.max(a.x, c.x);
        const oy = Math.min(a.b, c.b) - Math.max(a.y, c.y);
        return {
          avg: a.t,
          cur: c.t,
          gap: Math.round(Math.max(a.y - c.b, c.y - a.b)),
          overlapping: ox > 1 && oy > 1,
        };
      });

      if (!found) continue; // no P/E history for this stock today — not a failure
      const avgValue = Number(found.avg.replace(/[^0-9.]/g, ''));
      const curValue = Number(found.cur.replace(/[^0-9.]/g, ''));
      if (avgValue > curValue) seen.avgAbove += 1;
      else seen.avgBelow += 1;

      if (found.overlapping || found.gap < 2) {
        collisions.push(`${ticker}: "${found.avg}" and "${found.cur}" clear by ${found.gap}px`);
      }
    }

    // THE CONTROLS. Without these, a day on which no stock has a P/E history, or on
    // which every stock leans the same way, passes having tested nothing.
    expect(
      seen.avgAbove + seen.avgBelow,
      'no valuation chart rendered on any of the four tickers — this test measured nothing',
    ).toBeGreaterThan(1);
    expect(
      Math.min(seen.avgAbove, seen.avgBelow),
      `only one orientation occurred (avg above current: ${seen.avgAbove}, below: ${seen.avgBelow}) — ` +
        'half the rule is untested. Swap in a stock trading on the other side of its own average.',
    ).toBeGreaterThan(0);

    expect(
      collisions,
      `the Avg and Current reference labels overlap: ${collisions.join('; ')}. Each must sit on ` +
        'the FAR side of its own line — remember `insideTop*` draws below the line and ' +
        '`insideBottom*` above it.',
    ).toEqual([]);
  });

  test('the company name keeps its separator attached to the sector', async ({ page }) => {
    await signInPaid(page);
    await page.setViewportSize({ width: FLOOR_PX, height: 900 });
    await ready(page, '/stocks/us/AAPL');

    const line = await page.evaluate(() => {
      const h1 = document.querySelector('main#main-content h1');
      const wrap = h1?.parentElement;
      const span = wrap?.querySelector('span');
      return span ? span.textContent : null;
    });

    /* THE CONTROL: a page with no sector renders no span at all, and "the separator is
       fine" would then be vacuously true of nothing. */
    expect(line, 'no sector line on the ticker page — this control measured nothing').not.toBeNull();

    /* ⚠️ The separator used to be `<span> · {sector}</span>`, which gives the browser a
       break opportunity on BOTH sides of the dot. At 375px it orphaned one, so the phone
       showed a line containing a single "·" between the company name and its sector.
       The non-breaking space is the fix and this is the outcome of it (11d — guard the
       artifact, not the source). */
    expect(
      line,
      `the sector line is "${line}" — the separator must be followed by a NON-BREAKING space, ` +
        'or it wraps onto a line of its own on a phone',
    ).toMatch(/\u00B7\u00A0\S/);
  });
});

/**
 * The scorecard radar still draws its chart at the full 340px on a desktop.
 *
 * ⚠️ THE CONTROL FOR THE FIX, NOT FOR THE DEFECT. H1's sweep found the two-column
 * radar demanding 534px inside a card that offers 471px at a 771px window — so the
 * ticker page scrolled sideways by up to 26px across **768-793px**, a 26-pixel band
 * that every previous measurement sampled around (the old guard took 768 and 900; the
 * tablet survey took 744, 768, 810). It was invisible for a second reason too: the
 * scorecard is premium, so a guard signed in as the free account never rendered it
 * (11bd).
 *
 * The fix lets the chart column shrink (`minmax(0, 340px)`) instead of forcing 340px.
 * "No horizontal scroll" is satisfied perfectly by a fix that shrinks the chart
 * EVERYWHERE — including the desktop, where nothing was wrong — so this asserts the
 * thing the fix must not have done.
 */
async function scorecardIsUnchangedOnDesktop(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  const cols = await page.evaluate(() => {
    const grid = document.querySelector('.radar-grid');
    return grid ? getComputedStyle(grid).gridTemplateColumns : null;
  });
  expect(cols, 'no .radar-grid on the entitled ticker page — this control measured nothing').not.toBeNull();
  expect(
    cols,
    'the scorecard chart is no longer 340px wide at 1280px — the overflow fix has changed the desktop layout it was not meant to touch',
  ).toMatch(/^340px /);
}

/**
 * A LAYOUT THAT FITS IS NOT A LAYOUT THAT WORKS.
 *
 * ⚠️ This assertion exists because the first fix for the 768–793px overflow passed every
 * other check in this file and was still wrong. Letting the chart column shrink removed
 * the horizontal scroll — and squeezed the score bars down to a **1px sliver**, so the
 * one thing those five rows exist to show was gone, while the chart clipped its own
 * axis label to "Balance Shee". **Both states measure `scrollX === 0`.** No overflow
 * guard, however fine its steps or however entitled its session, could tell them apart.
 * The owner caught it by looking at a screenshot.
 *
 * So the scorecard is asserted on its own terms: either it has STACKED, or it is
 * side-by-side with a bar wide enough to read. The widths straddle
 * `SCORECARD_STACK_PX`, because the container query's boundary is exactly where a
 * threshold set one notch too low would show up (11i-b).
 */
async function scorecardBarsAreRealBars(page: Page): Promise<void> {
  /** The bar below which a "bar" is a decoration. `SCORECARD_STACK_PX` buys 112px. */
  const MIN_BAR_PX = 100;

  const failures: string[] = [];
  let measured = 0;

  for (const width of [769, 900, 943, 945, 1000, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(350);
    const s = await page.evaluate(() => {
      const grid = document.querySelector('.radar-grid');
      const track = document.querySelector('.radar-axis-bar-track');
      if (!grid || !track) return null;
      const cols = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/);
      return { stacked: cols.length === 1, bar: Math.round(track.getBoundingClientRect().width) };
    });
    if (!s) continue;
    measured += 1;
    if (!s.stacked && s.bar < MIN_BAR_PX) {
      failures.push(`${width}px: side-by-side with a ${s.bar}px bar`);
    }
    // And stacked must be genuinely roomier, or "stack it" fixed nothing.
    if (s.stacked && s.bar < MIN_BAR_PX) {
      failures.push(`${width}px: stacked and STILL only a ${s.bar}px bar`);
    }
  }

  /* THE CONTROL. `.radar-axis-bar-track` is premium and only exists on an entitled
     page; if the selector ever stops matching, every check above skips and this test
     reports a clean sweep having measured nothing (11aw — a needle that matches
     nothing is a vacuous control). */
  expect(
    measured,
    'no scorecard bar was measured at any width — the selector matched nothing, so this proved nothing',
  ).toBe(6);

  expect(
    failures,
    `the scorecard's score bars are too thin to read:\n  ${failures.join('\n  ')}\n\n` +
      `Below a ${SCORECARD_STACK_PX}px container the grid must STACK (globals.css, ` +
      '@container). A bar squeezed to a sliver still measures zero horizontal scroll, ' +
      'which is why this assertion is separate from the sweep.',
  ).toEqual([]);
}

// ──────────────────── the breakpoint itself ────────────────────

test.describe('the sweep covers the whole range', () => {
  /**
   * ⚠️ SPLITTING A SWEEP INTO BANDS CREATES A NEW WAY TO BE BLIND: a gap between them
   * is invisible, because both halves pass. This asserts the two bands are contiguous,
   * start at the floor minus its margin, and end at the desktop width — so the split
   * cannot quietly stop covering the breakpoint it was split at.
   */
  test('the two bands meet, with no width between them', () => {
    expect(ALL_WIDTHS[0], 'the sweep no longer starts below the 375px floor').toBe(SWEEP_FROM);
    expect(ALL_WIDTHS[ALL_WIDTHS.length - 1], 'the sweep no longer reaches a desktop width').toBe(SWEEP_TO);
    expect(
      new Set(ALL_WIDTHS).size,
      'the bands overlap — a width is swept twice, so the count is not the coverage',
    ).toBe(ALL_WIDTHS.length);
    const holes: string[] = [];
    for (let i = 1; i < ALL_WIDTHS.length; i += 1) {
      const prev = ALL_WIDTHS[i - 1]!;
      const here = ALL_WIDTHS[i]!;
      if (here - prev > STEP_PX) holes.push(`${here - prev}px between ${prev} and ${here}`);
    }
    expect(holes, `the sweep has gaps: ${holes.join('; ')}`).toEqual([]);
    // And the shell's own breakpoint is a width that actually gets measured.
    expect(ALL_WIDTHS, 'the breakpoint itself is not swept').toContain(SHELL_DESKTOP_MIN_PX);
  });
});

test.describe('the shell changes at exactly one width', () => {
  test.skip(!HAVE_E2E_CREDENTIALS, 'set E2E_EMAIL + E2E_PASSWORD to run');

  /**
   * ⚠️ Tailwind's scanner needs the class present in the source, so
   * `SHELL_DESKTOP_MIN_PX` cannot be interpolated into `min-[768px]:` — the shell
   * carries three literals (the rail, the header, `<main>`) and this constant carries
   * the number the rest of the code reasons with. That is a copy (11c-v), so it is
   * ASSERTED rather than trusted: all three must flip at this exact width, and one
   * pixel below it none of them may have.
   */
  test('the rail, the header and the page all switch at the same pixel', async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    await ready(page, '/stocks');

    const read = async () =>
      page.evaluate(() => {
        const rail = document.querySelector('[data-shell-rail]');
        const header = document.querySelector('header[role="banner"]');
        const main = document.querySelector('main#main-content');
        return {
          railShown: rail ? getComputedStyle(rail).display !== 'none' : false,
          headerLeft: header ? getComputedStyle(header).left : '',
          mainLeft: main ? getComputedStyle(main).marginLeft : '',
        };
      });

    await page.setViewportSize({ width: SHELL_DESKTOP_MIN_PX, height: 900 });
    const at = await read();
    await page.setViewportSize({ width: SHELL_DESKTOP_MIN_PX - 1, height: 900 });
    const below = await read();

    expect(at, `at ${SHELL_DESKTOP_MIN_PX}px the desktop shell must be whole`).toEqual({
      railShown: true,
      headerLeft: '220px',
      mainLeft: '220px',
    });
    expect(below, `at ${SHELL_DESKTOP_MIN_PX - 1}px the page must have the full width`).toEqual({
      railShown: false,
      headerLeft: '0px',
      mainLeft: '0px',
    });
  });
});
