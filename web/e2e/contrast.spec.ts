import { expect, test } from '@playwright/test';

import { LEARN_ARTICLES, learnPath } from '../lib/learn';
// ⚠️ The probe, the sentinels and `measure()` live in ONE module, shared with
// `app-contrast.spec.ts` (the signed-in pages). They were inlined here until
// 2026-08-22; copying them into the second suite would have repeated the exact
// mistake this file documents below — a second copy of the preamble that stopped
// keeping up with the first.
import { measure, MIN_MEASURED, type Fail, type Probe } from './lib/contrastProbe';

/**
 * ── How the landing nearly became unmeasurable, and what fixed it ─────────────
 *
 * Worth reading before touching `measure()`, because two of the waits in it look
 * removable and are not.
 *
 * The landing's sections are revealed by an IntersectionObserver, so anything
 * below the fold rests at `opacity: 0`. Once the probe learned to composite
 * `opacity` (see `effOpacity`), an unrevealed section became — correctly —
 * invisible text, and was skipped: 244 elements skipped as transparent, 47
 * survivors on a page of 291. The header, the footer, and none of the argument
 * in between. A guard reporting a clean page it had never looked at.
 *
 * ⚠️ **Three diagnoses were wrong first**, and each produced a plausible fix for
 * a problem that did not exist: a wait for the loading fallback, a wait for the
 * element count to stop climbing, a wait for the animations to finish. What
 * settled it was one number contradicting another — `bodyEls=581` beside
 * `measured=47`. The DOM was **full**, so every "the page has not rendered yet"
 * theory was answering a question nobody had asked.
 *
 * ⚠️ **`reducedMotion` looked like the answer and was not.** `LandingMotion`
 * honours the preference, so asking Playwright for it made four runs pass — and
 * then the flake returned, because the arming happens in a mount effect and the
 * test can win or lose that race either way. It is not in this file: it does not
 * typecheck as a `test.use` option at this Playwright version, and having
 * documented that it fixes nothing, adding it back would only give a future
 * reader false confidence. The determinism comes from the `data-motion` disarm.
 *
 * The lesson worth keeping: **when a measurement is wrong, instrument the
 * MEASURING, not the thing measured.** Counting *why* elements were skipped gave
 * the answer in one run, after three rounds of guessing at timing. That tally is
 * now part of `Probe` and is printed in the floor's failure message, so the next
 * person gets the answer instead of the search.
 */

/**
 * WCAG contrast, measured in the real page.
 *
 * Layer G's design work fixed two ratios that had been wrong for the life of the
 * site: the rating tier badges at **2.38:1** — the product's entire vocabulary
 * set in the least readable text on the page — and the "Full disclaimer" link at
 * **2.69:1**, which CLAUDE.md #4/#12 make legally material. Neither was visible
 * to review. Both looked completely fine.
 *
 * A ratio nobody measures goes back to being wrong the first time somebody
 * reaches for `--text-muted` because it "looks lighter". So the measurement is
 * the guard, not a note in a document. Same doctrine as CLAUDE.md 11a: say it
 * AND guard it.
 *
 * Credential-free — no login, no network beyond the dev server — so it runs on a
 * fork PR and cannot self-skip.
 *
 * ⚠️ Measured on the RENDERED page, never computed from the token values. The
 * bug that produced the worst finding here was a specificity accident:
 * `.reading a { color }` outranked Tailwind's `.text-white` and painted the
 * call-to-action brand-blue on a brand-blue button (1.0:1, invisible). Every
 * token involved was correct. Only the composite was wrong.
 */

/** Pages whose text a reader is expected to actually read. */
/**
 * ⚠️ **The articles are DERIVED from the registry, not listed here — and that is a
 * finding, not a tidy-up.** This was a hand-written list ending in
 * `'/learn/what-is-a-drawdown'`, and it stayed that way while two more articles
 * were published: on 2026-08-19 an audit found **1 of 3 articles measured**, with
 * the comment below still asserting the list "covers every entry in PUBLIC_PAGES".
 * Both new pages rendered perfectly and neither had ever been in front of the
 * contrast probe.
 *
 * That is CLAUDE.md 11c-iv — a rule that existed and that a new consumer simply
 * never received — wearing 14g's clothes: unmeasured is indistinguishable from
 * clean, and the comment claiming completeness is what made it invisible. A list
 * that has to be edited whenever content is added will eventually not be.
 *
 * Deriving it means the NEXT article is covered before anyone remembers to think
 * about it, which is the only version of this that keeps working.
 */
const READING_PAGES = [
  '/disclaimer',
  '/terms',
  '/privacy',
  '/learn',
  ...LEARN_ARTICLES.map((a) => learnPath(a.slug)),
];

/**
 * The landing page, measured to the same bar but on its own sentinel.
 *
 * It left READING_PAGES when it was rebuilt to the approved storyboard: that
 * design is a laid-out page rather than a column of prose, so it carries its own
 * 15px scale (app/(public)/landing.css) and never gets `.reading`. Leaving it in
 * the list would not have measured it — `measure()` waits for `.reading` to
 * compute to 17px, so it hung for ten seconds and failed for a reason that had
 * nothing to do with contrast, which is worse than either outcome.
 *
 * Same probe, same floor, same KNOWN_DEFERRED. Only the proof-the-stylesheet-is-
 * live sentinel differs, and the sticky header is a stronger one here anyway.
 */
const LAID_OUT_PAGES = ['/'];

/**
 * The other six public pages — the ones a reader OPERATES rather than reads.
 *
 * They need their own list because they need their own sentinel, not because they
 * deserve a lower bar: `measure()` waits for `.reading` to compute to 17px, and
 * these pages never get `.reading` at all (AuthCard uses `PageFrame width="narrow"`,
 * where `reading` defaults to false — the terminal type scale is deliberate for a
 * form). Adding them to READING_PAGES would not have measured them; it would have
 * hung for ten seconds and then failed for the wrong reason.
 *
 * Together with READING_PAGES (which now derives its articles from the registry,
 * so it cannot fall behind again) this covers every entry in PUBLIC_PAGES. Adding the
 * list found six real failures on the sign-in and payment path, all `--text-muted`
 * at 2.97:1 and all now fixed: the four form field labels, "or continue with", and
 * every term on /pricing including "No refunds". They had been there since the
 * pages were built and nothing was measuring them.
 */
const FORM_PAGES = [
  '/login',
  '/signup',
  '/reset-password',
  '/contact',
  '/pricing',
  '/deletion-requested',
  // ⚠️ The error banner on the auth forms had NEVER been measured, by any of the
  // six entries above, because it does not exist in the DOM until something
  // fails — and a page is only measured in the state it is loaded in. So the one
  // element a reader is guaranteed to be squinting at, in the moment they are
  // most stuck, was the one element with no contrast evidence. Its colours
  // (--c-tier-5-ink on --tint-tier-5) are shared by all four auth forms plus
  // /contact, so measuring it once here covers every one of them.
  //
  // This URL exists only because the link-failure notice renders on load. Before
  // it, there was no way to put the banner on screen without driving a failed
  // submission, which `measure()` cannot do. Worth remembering as a general
  // move: if a state cannot be reached by navigation, it cannot be measured by
  // anything that measures pages.
  '/login?error=auth_confirm_failed',
];

/**
 * ⚠️ EMPTY, and that is the finding — the public site now carries NO contrast
 * exemption at all.
 *
 * It held one for the life of Layer G: the 9px "Financial Terminal" wordmark in
 * the shared public header, at 2.69:1, deferred to Layer H with the rest of the
 * sweep. It was never really a header problem. It was `--text-muted` at #8A97A8
 * (2.97 on white), the same token that turned out to be failing 258 times on one
 * signed-in page — so fixing the token on 2026-08-22 fixed the wordmark too, and
 * the staleness test at the foot of this file went red to say so. Exactly what it
 * was written for.
 *
 * Kept as an empty list rather than deleted, so that adding the first entry back
 * is a visible decision in a diff instead of a quiet edit to a filter.
 */
const KNOWN_DEFERRED: string[] = [];


/**
 * ⚠️ ONE kind of exemption now, and it names a single element by its text.
 *
 * There used to be a second: a `legacy` flag excluding the whole marked subtree of
 * the landing's worked results table, because three of the five tier colours could
 * not carry white text (Neutral at **2.38:1**) and the owner had asked that the
 * landing match the live product exactly — so correcting it here would have put two
 * different colours on one score.
 *
 * That debt was PAID on 2026-08-22, with the owner's authorisation, at its source:
 * the tier tokens were darkened to clear 4.8 on the darkest ground they sit on, and
 * every rating surface — chips, badges, radar, verdict card, the .xlsx workbook —
 * now derives from the one palette. The subtree exclusion is gone rather than
 * loosened, and the test at the foot of this file asserts the marker cannot return.
 *
 * The remaining `KNOWN_DEFERRED` is still asserted to be real, for the same reason
 * the other one had to go: an exemption nobody re-checks is a blindfold.
 */
const unexpected = (p: Probe): Fail[] =>
  p.fails.filter((f) => !KNOWN_DEFERRED.some((k) => f.text.includes(k)));

for (const path of READING_PAGES) {
  test(`${path} — every readable element clears the WCAG floor`, async ({ page }) => {
    const probe = await measure(page, path, 'reading', MIN_MEASURED.reading);

    // The control. Negative assertions are vacuously true against an empty page,
    // so a blank render must not read as a perfect score. Same constant the wait
    // above uses, so the two can never drift apart.
    expect(
      probe.measured,
      `${path} rendered too little to measure — skipped ${JSON.stringify(probe.skipped)}. ` +
        'A high `transparent` count means the text is there but dimmed to nothing ' +
        '(an un-fired reveal), NOT that the page failed to render.',
    ).toBeGreaterThanOrEqual(MIN_MEASURED.reading);

    expect(
      unexpected(probe),
      `Contrast failures on ${path}:\n${JSON.stringify(unexpected(probe), null, 2)}`,
    ).toEqual([]);
  });
}

for (const path of LAID_OUT_PAGES) {
  test(`${path} — every readable element clears the WCAG floor`, async ({ page }) => {
    const probe = await measure(page, path, 'chrome', MIN_MEASURED.landing);

    // The control, at the landing page's own scale: it carries far MORE text than
    // an article, so a low floor here would be meaningless. Eight sections, a
    // ten-column table and two rulers put this well over 200 elements.
    expect(
      probe.measured,
      `${path} rendered too little to measure — skipped ${JSON.stringify(probe.skipped)}. ` +
        'A high `transparent` count means the text is there but dimmed to nothing ' +
        '(an un-fired reveal), NOT that the page failed to render.',
    ).toBeGreaterThanOrEqual(MIN_MEASURED.landing);

    expect(
      unexpected(probe),
      `Contrast failures on ${path}:\n${JSON.stringify(unexpected(probe), null, 2)}`,
    ).toEqual([]);
  });
}

for (const path of FORM_PAGES) {
  test(`${path} — every readable element clears the WCAG floor`, async ({ context, page }) => {
    // /deletion-requested is gated on the marker the deletion flow sets (see
    // lib/account.ts). Without it the page redirects to /login and `measure()`
    // fails its "did not stay put" assertion — correctly, but for the wrong
    // reason. Hand it the marker so it measures the page it is named after.
    if (path === '/deletion-requested') {
      await context.addCookies([
        { name: 'mc_deletion_notice', value: '1', domain: 'localhost', path },
      ]);
    }
    const probe = await measure(page, path, 'chrome', MIN_MEASURED.form);

    // Same control as above, at a lower floor: these cards carry less text than an
    // article, and /reset-password is the smallest at 21 measured elements.
    expect(
      probe.measured,
      `${path} rendered too little to measure — skipped ${JSON.stringify(probe.skipped)}. ` +
        'A high `transparent` count means the text is there but dimmed to nothing ' +
        '(an un-fired reveal), NOT that the page failed to render.',
    ).toBeGreaterThanOrEqual(MIN_MEASURED.form);

    expect(
      unexpected(probe),
      `Contrast failures on ${path}:\n${JSON.stringify(unexpected(probe), null, 2)}`,
    ).toEqual([]);
  });
}

// ⚠️ The three tests below used to run against `/methodology`. That page is gone —
// its content is the `#how-it-works` section of the landing page — so they FOLLOWED
// THE CONTENT rather than being deleted with the route. Deleting a test along with
// the page it happened to be written against is how a suite quietly loses the
// coverage it was built for: the tier badges are still the product's whole
// vocabulary, and they are still the thing that measured 2.38:1.
//
// The two destinations are different on purpose. The legend moved to `/`, because
// that is where it now renders. The 12px floor moved to `/terms`, because it
// measures `<article>` and the landing page has no article element — pointing it at
// `/` would have made it pass vacuously against `null`, which is worse than
// deleting it.

test('/ — the five tier labels are legible', async ({ page }) => {
  // The specific regression this exists for. Asserting the page has no failures
  // would pass if the legend disappeared entirely, so name the five and count them.
  //
  // ⚠️ The MARKUP changed with the storyboard rebuild — the legend is now an inline
  // row of badges rather than the bordered `.tier-legend` stack `/methodology`
  // used, and each badge carries its score band. The badge COMPONENT is the same
  // one the product renders, which is the whole point: G2 fixed this contrast from
  // 2.38:1 to 4.73:1 by rendering the real badge instead of a re-coloured copy, and
  // a guard pointed at a lookalike would go on passing while the real one broke.
  await page.goto('/', { waitUntil: 'networkidle' });
  const badges = page.locator('[data-tier-legend] .tier-badge');
  await expect(badges).toHaveCount(5);
  await expect(badges).toHaveText([
    'High Conviction · 80+',
    'Constructive · 65+',
    'Neutral · 50+',
    'Cautious · 35+',
    'Bearish · below 35',
  ]);
});

test('the reading scale holds its 12px floor on content pages', async ({ page }) => {
  // The leaked app scale put five 8px elements on the old /methodology. The public
  // header is shared chrome and still carries 9px / 10.5px (Layer H), so measure the
  // article only — the part Layer G actually rebuilt.
  const probe = (await measure(page, '/terms')) as Probe;
  const inArticle = await page.evaluate(() => {
    const el = document.querySelector('article');
    if (!el) return null;
    const s = new Set<number>();
    el.querySelectorAll('*').forEach((n) => {
      const has = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim());
      if (has) s.add(parseFloat(getComputedStyle(n).fontSize));
    });
    return [...s].sort((a, b) => a - b);
  });
  expect(inArticle, 'no <article> on /terms').not.toBeNull();
  expect(Math.min(...inArticle!), `sizes found: ${inArticle}`).toBeGreaterThanOrEqual(12);
  // Seven steps exist; a page need not use all of them, but nine distinct sizes
  // on one article is the thing that read as inconsistency rather than hierarchy.
  expect(inArticle!.length, `sizes found: ${inArticle}`).toBeLessThanOrEqual(7);
  expect(probe.measured).toBeGreaterThan(20);
});

test('the public site still needs no exemption at all', async ({ page }) => {
  /* ⚠️ This asserted the OPPOSITE until 2026-08-22 — that the 9px header wordmark
     DOES still fail — because an allow-list nobody re-checks becomes a blindfold.
     It did its job: darkening `--text-muted` fixed the wordmark as a side effect,
     this went red, and the exemption came out instead of quietly outliving its
     defect. Now it guards the other direction, which is the one that matters once
     a list is empty: nothing may be added back without a decision. */
  const probe = await measure(page, '/', 'chrome', MIN_MEASURED.landing);
  expect(
    KNOWN_DEFERRED,
    'a public contrast exemption has been added back — say why in the diff',
  ).toEqual([]);
  expect(
    probe.fails,
    `the landing has ${probe.fails.length} element(s) under the floor:
${JSON.stringify(probe.fails, null, 2)}`,
  ).toEqual([]);
});


test('the product palette carries NO exemption any more', async ({ page }) => {
  /* This file used to carry the opposite assertion — that the landing's screener
     chips DO fail, bounded at 42 — because three of the five tier colours could
     not hold white text and repainting a paid surface was out of scope at the
     time (CLAUDE.md 11l). The owner authorised the fix on 2026-08-22 and the
     debt is paid: the tiers were darkened to clear 4.8 on the darkest ground.

     ⚠️ So this now asserts the exemption is GONE, in both directions. A bounded
     allow-list that has stopped excusing anything is worse than no allow-list —
     it is a live blindfold over whatever moves under it next (14g). Deleting the
     marker without this test would leave nothing saying it must never come back. */
  const probe = await measure(page, '/', 'chrome', MIN_MEASURED.landing);

  const marked = await page.locator('[data-legacy-contrast]').count();
  expect(
    marked,
    'a [data-legacy-contrast] marker is back. The tier palette clears WCAG AA now; ' +
      'if a surface needs excusing, it is a NEW defect and needs its own decision.',
  ).toBe(0);

  // And the elements it used to cover really do pass, rather than merely having
  // lost their marker. Named by class, so this keeps testing the chips even if
  // the table around them is restructured.
  const chips = await page.locator('.score-num, .score-tag').count();
  expect(chips, 'the worked screener run should still draw real score chips').toBeGreaterThan(20);
  // ⚠️ `unexpected()`, not `probe.fails`. The FIRST version of this assertion used
  // the raw list and went red on "Financial Terminal" — the 9px header wordmark at
  // 2.94:1, which is the OTHER exemption and still deliberately in force. Two
  // exemptions retired at different times is exactly how a test starts asserting
  // something nobody meant; the filter is the single place that knows what is
  // still excused.
  const remaining = unexpected(probe);
  expect(
    remaining,
    `the landing's screener chips are failing again:\n${JSON.stringify(remaining, null, 2)}`,
  ).toEqual([]);
});
