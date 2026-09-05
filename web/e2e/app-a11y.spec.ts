import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { RUN_SNAPSHOT, RUN_SNAPSHOT_ROWS, SNAPSHOT_KEY } from './fixtures/runSnapshot';
import { TAGS, RULE_OPTIONS, rulesThatDidNotRun } from './lib/axeRules';

/**
 * Automated accessibility scan of the SIGNED-IN product — axe-core, WCAG 2.1 A + AA.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * `a11y.spec.ts` opens with the sentence *"Layer G MEASURES accessibility; Layer H
 * FIXES it"*, and scoped itself to public pages on the reasoning that the signed-in
 * shell's contrast debt was a product-wide repaint G was not authorised to make.
 *
 * That reasoning was sound and its consequence was not: it left Browse, Stock
 * Detail, Run, Results, Request and Account with **no accessibility scan of any
 * kind**, and "we have an accessibility test" quietly came to mean something it did
 * not (CLAUDE.md 14g — a guard scoped to one class of route is silent about the
 * rest, not clean about it). The owner authorised the whole-site sweep on
 * 2026-08-22; the contrast half found 258 failing elements on Browse alone, all of
 * them one token nobody had ever measured.
 *
 * ⚠️ Separate file from `a11y.spec.ts` for the same reason `app-contrast.spec.ts` is
 * separate from `contrast.spec.ts`: the public suites are deliberately
 * credential-free so they run on a fork PR and can never self-skip. This one needs
 * a login and therefore CAN skip. Check the COUNT, not the colour.
 *
 * ── What this does NOT cover, said out loud ─────────────────────────────────
 * axe finds roughly a third of real accessibility problems, and never judges
 * whether alt text is accurate, a focus order sensible, or an error message useful.
 * It catches the machine-checkable third every time — which is the third a human
 * review skips.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

// ⚠️ AUDIT 5A-152 — `TAGS` moved to `lib/axeRules.ts`, alongside the five
// WCAG A/AA rules that axe marks `experimental` and therefore skips unless they
// are enabled by name. A tag filter alone never reached them, and a rule that
// never runs is indistinguishable from one that passes.

/**
 * The signed-in pages. `/run` and `/results` render the locked panel for this
 * account (it holds no subscription) — a real state, but not the screener. The
 * entitled table's CONTRAST is covered in `app-contrast.spec.ts`; extending this
 * scan to it is a follow-up, and saying so here is cheaper than letting the file
 * imply a coverage it does not have.
 */
const APP_PATHS = ['/stocks', '/stocks/us/AAPL', '/run', '/results', '/request', '/account'];

/**
 * How many DOM elements a page must carry before it counts as rendered.
 *
 * Only the pages big enough for the gap to matter are listed; everything else is
 * small and arrives with the shell. The stock detail page really does carry ~1400
 * elements, so 900 is a floor it clears easily while a half-built page cannot.
 */
const PAGE_ELEMENT_FLOOR: Record<string, number> = {
  '/stocks/us/AAPL': 900,
};


async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', EMAIL!);
  await page.fill('input#password', PASSWORD!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/stocks/, { timeout: 30_000 });
}

async function scan(page: Page, path: string) {
  /* ⚠️ `page.emulateMedia`, NOT `test.use({ reducedMotion })` — the latter
     typechecks, runs, and silently does nothing at this Playwright version, which
     is the worst combination available. The public suite learned this the hard way
     when axe reported 175 phantom contrast violations against faded-in blocks. */
  await page.emulateMedia({ reducedMotion: 'reduce' });

  /* ⚠️ NOT `networkidle`, and the argument is written out 20 lines below: quiet
     is not readiness. It waited here anyway until 2026-08-24, when this spec came
     back FLAKY on `/stocks/us/AAPL` — `page.goto` timing out at 45s waiting for a
     network that never went quiet, on the heaviest page in the product under full
     parallel load. The wait proved nothing the two POSITIVE signals below do not
     prove better, and it was the only thing in the function that could time out
     before either of them ran. Same shape as CLAUDE.md 11c-iv: the rule existed,
     in a comment, and the one line that needed it never received it. */
  await page.goto(path, { waitUntil: 'domcontentloaded' });

  // Prove we are on the page we think we are: a signed-in route that started
  // bouncing to /login would otherwise scan clean and mean nothing.
  expect(new URL(page.url()).pathname, `${path} did not stay put`).toBe(path);

  // The app shell's own proof-of-stylesheet, matching app-contrast's sentinel:
  // <main> is offset by the sidebar width, which is 0 on an unstyled page.
  await page.waitForFunction(
    () => {
      const m = document.querySelector('main#main-content');
      return !!m && parseFloat(getComputedStyle(m).marginLeft) > 0;
    },
    undefined,
    { timeout: 30_000 },
  );

  /* ⚠️ AND WAIT FOR THE PAGE, which the sentinel above does not prove. The sidebar
     offset is CHROME: it is satisfied the moment the app layout renders, while the
     page beneath it is still filling in. On the stock detail page — a dozen chart
     sections, an order of magnitude more DOM than anything else in the app — that
     gap was wide enough to make this spec and `app-contrast` both flaky, passing
     on retry. A retry-pass is the most ignorable result a suite can produce and it
     means the scan looked at an unfinished page.

     Waiting on a POSITIVE signal (enough elements exist) rather than on quiet:
     `networkidle` is satisfied by a page that has stopped fetching and not yet
     rendered, which is the same trap the public suite hit at 47 elements of 291. */
  const floor = PAGE_ELEMENT_FLOOR[path] ?? 0;
  if (floor > 0) {
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('body *').length), {
        message: `${path} never reached ${floor} elements — the scan would have run on a half-built page`,
        timeout: 45_000,
      })
      .toBeGreaterThanOrEqual(floor);
  }

  const results = await new AxeBuilder({ page }).withTags(TAGS).options(RULE_OPTIONS).analyze();
  // The control: a rule that never ran is indistinguishable from one that passed.
  const missing = rulesThatDidNotRun(results);
  expect(missing, `axe never evaluated ${missing.join(', ')} — the scan is blind to them`).toEqual([]);
  return results;
}

test.describe('the signed-in product is accessible', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /**
   * Every signed-in page carries exactly one <h1>.
   *
   * ⚠️ AUDIT 5A-114. Browse, Run, Results and Stock Detail carried **no heading of any
   * level** — not one h1..h6, not one role="heading". Every visible heading on them
   * ("The Verdict", "Company Overview", "Technical Levels", the KPI captions) was a
   * styled `div`, so a screen-reader user was handed one flat run of text with no way to
   * navigate the page by structure. Found on the live site by counting, because there is
   * nothing to see: the pages look perfectly well organised.
   *
   * ⚠️ WHY THE EXISTING SCAN COULD NOT SEE IT, which is the reusable part. The axe run
   * above uses `TAGS = ['wcag2a','wcag2aa','wcag21a','wcag21aa']`, and axe tags
   * `page-has-heading-one`, `empty-heading` and `heading-order` as **best-practice**, not
   * WCAG. So the scan was green and had never had an opinion on headings at all. The tag
   * list is a claim about what the guard can see, written in four strings nobody re-reads
   * (14g). This test is deliberately NOT "add best-practice to TAGS": that would enable
   * dozens of unrelated rules at once and the honest scope here is the defect that was
   * found.
   *
   * Exactly one, not at least one: the fix moved the title into the shared `Header`, and
   * `/account` and `/request` had their own `sr-only` h1 removed in the same change. An
   * "at least one" assertion would pass on the duplicate state that fix had to avoid.
   */
  for (const path of APP_PATHS) {
    test(`${path} has exactly one h1`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      const h1 = page.locator('h1');
      await expect(h1.first()).toBeAttached({ timeout: 20_000 });

      const count = await h1.count();
      const texts = await h1.allTextContents();
      expect(count, `${path} has ${count} <h1> elements: ${JSON.stringify(texts)}`).toBe(1);

      // The heading must say something — an empty h1 satisfies a count and helps nobody.
      expect((texts[0] ?? '').trim().length, `${path}'s h1 is empty`).toBeGreaterThan(0);
    });
  }

  /**
   * Stock Detail's heading TREE, not just its h1.
   *
   * ⚠️ AUDIT 5A-114, option B (owner-approved 2026-09-04). One `h1` from the shared
   * header, one `h2` per sub-nav group, one `h3` per card — so a screen-reader user
   * gets the same five-part map the sticky sub-nav gives everyone else, instead of a
   * single entry for a 7,700px page.
   *
   * ⚠️ The five h2s are `sr-only`, which is the reason this test has to exist. An
   * invisible heading cannot be reviewed by looking: delete one and the page is
   * pixel-identical, every other test still passes, and the group below it silently
   * joins the group above. The same is true of the h3s — they render as they always
   * did, because `.card-title` sets its own size and weight and Tailwind's preflight
   * zeroes heading margins. **Measured, not assumed:** every card and title box was
   * compared before and after on a clean production build, and all 40 are identical
   * to the pixel, with `document.scrollHeight` 7700 in both arms.
   *
   * It asserts ORDER as well as presence: a tree that skips a level, or puts a card
   * before the group heading that owns it, is a worse tree than a flat list because
   * it asserts a structure that is wrong.
   */
  test('/stocks/us/AAPL has a full heading tree', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/stocks/us/AAPL');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeAttached({ timeout: 20_000 });
    // The cards stream in; wait for the last group's heading rather than a timeout.
    await expect(page.locator('h2', { hasText: /^Sentiment$/ })).toBeAttached({
      timeout: 30_000,
    });

    const tree = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({
        level: Number(h.tagName[1]),
        text: (h.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60),
      })),
    );

    // The control. A page that failed to render has a perfect (empty) tree, and a
    // selector typo returns [] just as convincingly (14g).
    expect(tree.length, 'no headings found at all — the page did not render').toBeGreaterThan(15);

    expect(tree.filter((h) => h.level === 1).length, 'expected exactly one h1').toBe(1);
    expect(tree[0]!.level, `the first heading is an h${tree[0]!.level}, not the h1`).toBe(1);

    // ⚠️ The h1 must name THIS stock. It read "Stock Detail" on all 863 tickers until
    // 2026-09-04 — a heading that says which KIND of page this is and never which one,
    // so a screen reader's page title was identical everywhere in the product. The
    // company name was already on screen; it just was not the heading.
    //
    // Matching on "Apple" rather than merely "not empty" is what makes this sensitive
    // to the value: a constant label satisfies a length check perfectly (14g).
    expect(
      tree[0]!.text,
      `the h1 is "${tree[0]!.text}" — it must name the company, not the route`,
    ).toMatch(/Apple/i);

    const groups = tree.filter((h) => h.level === 2).map((h) => h.text);
    expect(groups, 'the five sub-nav groups must each be a heading').toEqual([
      'Thesis',
      'Scorecard',
      'Cycle',
      'Fundamentals',
      'Sentiment',
    ]);

    // No skipped level, in either direction.
    const skips: string[] = [];
    for (let i = 1; i < tree.length; i += 1) {
      const jump = tree[i]!.level - tree[i - 1]!.level;
      if (jump > 1) skips.push(`"${tree[i - 1]!.text}" (h${tree[i - 1]!.level}) → "${tree[i]!.text}" (h${tree[i]!.level})`);
    }
    expect(skips, `heading levels skip here:\n  ${skips.join('\n  ')}`).toEqual([]);

    // Every card title is a heading — the defect was that none of them were.
    const orphans = await page.evaluate(() =>
      [...document.querySelectorAll('.card-title')]
        .filter((el) => !/^H[1-6]$/.test(el.tagName))
        .map((el) => `${el.tagName}: ${(el.textContent ?? '').trim().slice(0, 40)}`),
    );
    expect(
      orphans,
      `these card titles are still not headings:\n  ${orphans.join('\n  ')}`,
    ).toEqual([]);
  });

  for (const path of APP_PATHS) {
    test(`${path} has no axe violations`, async ({ page }) => {
      test.setTimeout(120_000);
      const results = await scan(page, path);

      // The control, first: a page that failed to render scores perfectly, so
      // prove the scan actually looked at something before believing it.
      expect(
        results.passes.length,
        `axe checked nothing on ${path} — the page did not render`,
      ).toBeGreaterThan(10);

      /* ⚠️ NO EXEMPTION HERE ANY MORE. This block used to wave through every
         `color-contrast` violation on the Stock Detail page — 45 of them at the
         ceiling — because the direction palette was painting text that the owner
         had scoped out of the rating fix. The owner approved the ink layer on
         2026-08-22: the lines and candles kept their colours, the same colours
         used as words got darker twins, and the debt is paid. An excuse that no
         longer excuses anything is deleted, not left standing (CLAUDE.md 14g).

         ⚠️ Note what this scan still does NOT cover: it signs in with the shared
         account, which holds no subscription, so the Verdict card and the
         scorecard radar are not on the page it looks at. `app-contrast.spec.ts`
         measures those on a throwaway paid account; extending THIS scan the same
         way is the obvious follow-up, and saying so is cheaper than letting the
         file imply a coverage it does not have. */
      const found = results.violations.map(
        (v) => `[${v.impact}] ${v.id} — ${v.nodes.length} node(s): ${v.help}`,
      );
      expect(found, `${path}:\n${found.join('\n')}`).toEqual([]);
    });
  }
});

/**
 * ── The product AS A SUBSCRIBER SEES IT ─────────────────────────────────────
 *
 * ⚠️ **AUDIT 5A-151. Added because the scan above is structurally unable to see
 * half the product, and its own comment said so for two weeks without anyone
 * acting on it.** The shared E2E account holds no subscription, so `/run` and
 * `/results` render the upsell panel and Stock Detail withholds the Verdict, the
 * scorecard radar and every rating badge. A spec named after those pages passed
 * on every run while never once loading them.
 *
 * The gap was not theoretical. `CsvImport`'s upload zone — reachable only on an
 * entitled `/run` — carried an `aria-label` that was a drifted second copy of the
 * sentence printed inside it, so the words on screen were not the accessible
 * name and a voice-control user could read the control aloud and never reach it
 * (WCAG 2.5.3). Three instances of that defect were found across the product on
 * 2026-09-05; **only this one needed a paid session to see.**
 *
 * ⚠️ Its own throwaway user, created and deleted here, for the reason
 * `app-contrast.spec.ts` records: flipping the shared account's subscription is a
 * second writer to one `profiles` row, and that race surfaces as an unexplainable
 * flake in whichever suite loses.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const PAID_RUN = Date.now();
const PAID_EMAIL = `a11y-e2e-${PAID_RUN}@example.com`;
const PAID_PASSWORD = `E2e!a11y-${PAID_RUN}`;

test.describe('the PAID product is accessible', () => {
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

    /* The acknowledgement is set here rather than dismissed through the UI, for
       the reason `app-contrast.spec.ts` records at length: the first-login modal
       is a SERVER decision from this one field, and `app/(app)/layout.tsx` returns
       the modal ALONE when it is null — so a UI dismissal that samples too early
       leaves every later navigation rendering nothing but a dialog, and the scan
       measures that instead. Setting the column removes the race rather than
       timing it. */
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

  test('the entitled screener and Stock Detail have no axe violations', async ({ page }) => {
    test.setTimeout(240_000);

    await page.goto('/login');
    await page.fill('input#email', PAID_EMAIL);
    await page.fill('input#password', PAID_PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/stocks/, { timeout: 30_000 });

    // "I set a column" and "the page is clear" are different claims, and the
    // failure is silent: the modal renders INSTEAD of the app.
    await expect(page.getByLabel(/I understand and acknowledge/i)).toHaveCount(0);

    /** One scan, with the control that the rules were evaluated at all. */
    const sweep = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(TAGS).options(RULE_OPTIONS).analyze();
      const missing = rulesThatDidNotRun(results);
      expect(missing, `axe never evaluated ${missing.join(', ')} on ${label}`).toEqual([]);
      expect(
        results.passes.length,
        `axe checked nothing on ${label} — the page did not render`,
      ).toBeGreaterThan(10);
      const found = results.violations.map(
        (v) => `[${v.impact}] ${v.id} — ${v.nodes.length} node(s): ${v.help}`,
      );
      expect(found, `${label}:\n${found.join('\n')}`).toEqual([]);
    };

    // ── Stock Detail, with the premium cards actually on the page ────────────
    await page.goto('/stocks/us/AAPL');
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('body *').length), {
        timeout: 45_000,
      })
      .toBeGreaterThanOrEqual(900);
    /* THE CONTROL, and it is POSITIVE on purpose. Without it this test passes
       just as happily on the unentitled page — which is the exact state this
       whole describe exists to stop standing in for the product.

       ⚠️ My first attempt asserted the ABSENCE of a `.premium-lock` class. There
       is no such class anywhere in this codebase, so it would have matched
       nothing, passed always, and proved nothing in either direction — a needle
       that matches nothing is the vacuous control CLAUDE.md 11aw was written
       about. `.verdict-thesis-num` is the Verdict card's numbered thesis, which
       `stripPremium()` withholds from a free viewer entirely (11b), so its
       PRESENCE is evidence the session really is entitled. */
    expect(
      await page.locator('.verdict-thesis-num').count(),
      '/stocks/us/AAPL has no Verdict thesis — this account is not entitled, so the scan proves nothing',
    ).toBeGreaterThan(0);
    await sweep('/stocks/us/AAPL (entitled)');

    // ── The screener's own controls, which a free account never renders ──────
    await page.goto('/run');
    await expect(page.locator('.upload-zone')).toBeVisible({ timeout: 30_000 });
    await sweep('/run (entitled)');

    // ── The ranked table, seeded rather than run ─────────────────────────────
    await page.evaluate(
      ([key, snap]) => sessionStorage.setItem(key as string, JSON.stringify(snap)),
      [SNAPSHOT_KEY, RUN_SNAPSHOT] as const,
    );
    await page.goto('/results');
    /* THE CONTROL, and it POLLS. Without the wait this reads the table before it
       has rendered and reports 0 chips — which is the same number the lock screen
       and the empty state give, so a bare count cannot tell "not entitled" from
       "not yet painted". Waiting on the positive signal the assertion itself
       demands is the fix (CLAUDE.md 11q). */
    await expect
      .poll(() => page.locator('.score-num').count(), {
        message: 'no score chips on /results — this measured the lock screen or the empty state, not the table',
        timeout: 45_000,
      })
      .toBeGreaterThanOrEqual(RUN_SNAPSHOT_ROWS);
    await sweep('/results (entitled)');
  });
});
