import { expect, test } from '@playwright/test';

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
// ⚠️ `/learn` and one article added 2026-08-15. A new public page that nothing
// measures is not "passing" — it is unmeasured, and the difference is invisible
// (CLAUDE.md 14g). The article is the first public surface to render `.lead`
// inside a brand-ruled block and `<time>` in --text-secondary, neither of which
// any existing page put in front of the contrast probe.
const READING_PAGES = ['/disclaimer', '/terms', '/privacy', '/learn', '/learn/what-is-a-drawdown'];

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
 * Together with READING_PAGES this covers every entry in PUBLIC_PAGES. Adding the
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
 * The one element still under the floor, and it is deliberate: the 9px
 * "Financial Terminal" wordmark in the shared public header measures 2.69:1.
 * design-system.md §14 assigns it to Layer H with the rest of the sweep.
 *
 * It is listed BY TEXT rather than raised as a threshold, so the exemption
 * cannot quietly cover a second element. If the header is restyled and this
 * stops failing, the last assertion in this file turns red and says so — an
 * allow-list that is never checked for staleness becomes a blindfold.
 */
const KNOWN_DEFERRED = ['Financial Terminal'];

/** Serialised into the page; keep it dependency-free. */
const PROBE = `(() => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => {
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,\\s\\/]+/).filter((x) => x !== '').map(Number);
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  // Composite every translucent ancestor, outermost first. A tinted badge on a
  // white card is the whole reason the tier fix works, and a probe that stopped
  // at the first background would score it against nothing.
  const bgOf = (el) => {
    let n = el, acc = [255, 255, 255];
    const stack = [];
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) stack.push(c);
      n = n.parentElement;
    }
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };
  const ratio = (a, b) => {
    const L1 = lum(a), L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };
  // ⚠️ ACCUMULATED \`opacity\`, and this probe was blind to it until 2026-08-17.
  // A wrapper carrying \`opacity: .7\` dims its text exactly as an alpha on
  // \`color\` would, but appears in NEITHER \`color\` nor \`backgroundColor\` — so
  // the reading came out at full strength. On /learn that scored 25 elements at
  // 6.81 which a reader was seeing at 3.38, i.e. the page broke a compliance
  // rule (CLAUDE.md #4/#12) with the guard green. Unmeasurable counted as
  // clean, one more time (14g).
  //
  // Multiplied up the whole ancestor chain rather than read off the element,
  // because \`opacity\` composites per layer: .7 nested inside .7 is .49.
  const effOpacity = (el) => {
    let o = 1, n = el;
    while (n && n !== document.documentElement) {
      o *= parseFloat(getComputedStyle(n).opacity || '1');
      n = n.parentElement;
    }
    return o;
  };

  const out = { measured: 0, sizes: [], fails: [], skipped: { hidden: 0, transparent: 0, noText: 0, noColor: 0 } };
  const seen = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    // Own text only: an ancestor inherits colour but not necessarily background,
    // and counting it twice would score the wrong pairing.
    const txt = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!txt) { out.skipped.noText++; return; }
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') { out.skipped.hidden++; return; }
    // Fully transparent anywhere up the chain: genuinely invisible, nothing to
    // measure. This replaces a check on the element's OWN opacity, which let a
    // subtree hidden by its parent through.
    const op = effOpacity(el);
    if (op === 0) { out.skipped.transparent++; return; }
    const fs = parseFloat(cs.fontSize);
    seen.add(fs);
    const fg = parse(cs.color);
    if (!fg) { out.skipped.noColor++; return; }
    // The two ways text gets faded are one number to the eye, so make them one
    // number here too.
    fg.a *= op;
    const bg = bgOf(el);
    const r = ratio(over(fg, bg), bg);
    // WCAG "large text" = 24px, or 18.66px when bold.
    const need = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5;
    out.measured++;
    // \`opacity\` is reported so a failure NAMES its cause: "3.38 at opacity 0.7"
    // sends you to the right line, where a bare "3.38" sends you hunting for a
    // colour token that is in fact perfectly fine.
    if (r < need) out.fails.push({ text: txt.slice(0, 60), fontSize: fs, ratio: +r.toFixed(2), need, opacity: +op.toFixed(2), legacy: !!el.closest('[data-legacy-contrast]') });
  });
  out.sizes = [...seen].sort((a, b) => a - b);
  return out;
})()`;

interface Fail {
  text: string;
  fontSize: number;
  ratio: number;
  need: number;
  /** Accumulated ancestor `opacity` at the moment of measurement. 1 means the
   *  colour token itself is too weak; anything less names the dimming as the
   *  cause and points at the wrapper rather than at the palette. */
  opacity: number;
  /** Inside a subtree flagged as carrying the PRODUCT's palette — see below. */
  legacy: boolean;
}
interface Probe {
  measured: number;
  skipped: { hidden: number; transparent: number; noText: number; noColor: number };
  sizes: number[];
  fails: Fail[];
}

/**
 * Proof the stylesheet is live, expressed as something that can only be true once
 * it is. Two of them because the two page families share no styled feature:
 *
 *  · `reading` — `.reading` computing to --rd-body (17px). Nothing else sets it.
 *  · `chrome`  — the shared public header computing `position: sticky`. Every
 *                element is `static` until a stylesheet says otherwise, so this
 *                cannot pass on an unstyled page.
 */
const SENTINEL = {
  reading: () => {
    const el = document.querySelector('.reading');
    return !!el && parseFloat(getComputedStyle(el).fontSize) === 17;
  },
  chrome: () => {
    const el = document.querySelector('[data-public-header]');
    return !!el && getComputedStyle(el).position === 'sticky';
  },
} as const;

/**
 * How many measurable elements a page must carry before it counts as rendered.
 *
 * ⚠️ ONE constant serving two jobs, and that is the point (CLAUDE.md 11c). It is
 * the floor the test asserts — "did we measure anything at all?" — AND the
 * precondition `measure()` waits for. Written twice, the wait and the assertion
 * could disagree, and the failure mode of that disagreement is a guard that
 * waits for less than it demands and reports a flake instead of a defect.
 *
 * The numbers are the pages' real sizes, not round guesses: an article and the
 * legal documents clear 20 comfortably; the landing carries eight sections, a
 * ten-column table and two rulers, so 120 is a floor it passes by a wide margin
 * while a shell (47 — header and footer only) never can; /reset-password is the
 * smallest card at 21.
 */
const MIN_MEASURED = { reading: 20, landing: 120, form: 15 } as const;

async function measure(
  page: import('@playwright/test').Page,
  path: string,
  sentinel: keyof typeof SENTINEL = 'reading',
  expectAtLeast: number = MIN_MEASURED.reading,
): Promise<Probe> {
  await page.goto(path, { waitUntil: 'networkidle' });

  // ⚠️ ONE reload if `next dev` hands back an EMPTY DOCUMENT.
  //
  // Under a repeated run the dev server occasionally serves a shell with no app
  // in it at all. Caught with a diagnostic rather than guessed at, and the
  // numbers are what make it identifiable:
  //
  //   {"readingEls":0,"publicHeader":false,"stillLoading":false,"bodyEls":5,"text":""}
  //
  // `publicHeader: false` is the tell. That element lives in the public LAYOUT,
  // which renders above every page here — so this is not a slow page, a
  // suspended page, or a page of mine that rendered wrong. The layout itself is
  // absent, which nothing in the application can cause. It is the dev server
  // dropping a stream, roughly one navigation in a hundred and only under load.
  //
  // ⚠️ Deliberately NOT a blanket retry. It re-navigates only when the document
  // is empty, so it can never mask a real assertion — a page that renders and
  // fails still fails on the first pass. Reloading is also the honest response
  // to a dropped response: it is what a reader does.
  if (await page.evaluate(() => document.querySelectorAll('body *').length < 10)) {
    await page.reload({ waitUntil: 'networkidle' });
  }

  await page.evaluate(() => document.fonts.ready);

  // Prove we are on the page we think we are. A public route that starts
  // redirecting to /login would otherwise be measured as a clean pass, which is
  // exactly how "unmeasurable counted as clean" has bitten this repo before.
  //
  // Compared pathname-to-pathname. This read `.toBe(path)` until a FORM_PAGES
  // entry first carried a query string (`/login?error=…`, added to measure the
  // error banner) — and then it could never match, so the entry failed with
  // "did not stay put" while sitting on exactly the right page. The assertion
  // was right to refuse rather than measure something else; it was simply
  // comparing two different kinds of string.
  const expected = new URL(path, 'http://localhost').pathname;
  expect(new URL(page.url()).pathname, `${path} did not stay put`).toBe(expected);

  // ⚠️ WAIT FOR THE STYLESHEET, don't assume it. Without this the suite was
  // genuinely flaky: the same deliberate break reported "1 failed" on one run
  // and "4 failed" on the next, because on a cold dev-server compile the probe
  // could run before the reading stylesheet had been applied — and an unstyled
  // page has no low-contrast text to find, so it scores as PERFECT.
  //
  // A contrast guard that reports clean when it cannot see is the same failure
  // mode as check_invariants() finding zero violations over a universe missing
  // the field it inspects (CLAUDE.md 14g). See SENTINEL above for the two proofs.
  // ⚠️ AND WAIT FOR THE PAGE ITSELF, which the sentinel above does not prove.
  // Both sentinels are satisfied by the LAYOUT: `.reading` and the sticky header
  // are chrome, and chrome renders while the page body is still suspended. So a
  // green sentinel can sit above a page that is still `app/loading.tsx`.
  //
  // Observed here, not imagined: `/` went flaky with the probe reporting 47
  // measured elements against its floor of 120 — the header, the footer and
  // nothing in between. The assertion is a negative one ("no failures"), and a
  // page with no content trivially satisfies it, so only the `measured` control
  // stood between that and a silent pass. Same shape as CLAUDE.md 14g.
  await page.waitForFunction(
    () => !document.querySelector('[data-route-loading]'),
    undefined,
    { timeout: 15_000 },
  );

  // 20s, not 10: a COLD `next dev` route compile regularly runs past ten
  // seconds on a 2-core CI box, and the article page timed out here once per
  // four-run sweep for that reason alone. Raising it weakens nothing — a
  // sentinel that never becomes true still fails, it just stops reporting the
  // dev server's compile time as a contrast defect.
  // ⚠️ REPORT WHAT IT SAW. A bare `waitForFunction` timeout says only
  // "Timeout 20000ms exceeded" and names a line — which sent me hunting through
  // three different theories for a flake that turned out to be an ORDERING bug
  // (this waited for `.reading`, which cannot exist while the Suspense fallback
  // is on screen, so it was checking the stylesheet of a page that had not
  // arrived). A guard that fails without evidence costs more than it saves.
  try {
    await page.waitForFunction(SENTINEL[sentinel], undefined, { timeout: 20_000 });
  } catch {
    const diag = await page.evaluate(() => {
      const el = document.querySelector('.reading');
      return {
        url: location.href,
        readingEls: document.querySelectorAll('.reading').length,
        firstReadingFontSize: el ? getComputedStyle(el).fontSize : null,
        publicHeader: !!document.querySelector('[data-public-header]'),
        stillLoading: !!document.querySelector('[data-route-loading]'),
        bodyEls: document.querySelectorAll('body *').length,
        text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
      };
    });
    throw new Error(
      `${path}: the "${sentinel}" stylesheet sentinel never became true within 20s. ` +
        `Page state: ${JSON.stringify(diag)}`,
    );
  }


  // ⚠️ AND THEN WAIT FOR THE THING THE MEASUREMENT ACTUALLY DEPENDS ON — the
  // count of measurable elements — rather than for something that merely
  // correlates with the page being ready.
  //
  // Everything above is a proxy. On a warm server the proxies suffice: `/`
  // reaches its full 581 nodes before networkidle every time, which is exactly
  // why this looked fine. Under load it does not — `--repeat-each=4` put `/` at
  // 47 measured elements, the header and footer with nothing between them, and
  // took the legacy-palette test down with it because that reads the same page.
  // Two symptoms, one cause.
  //
  // ⚠️ AND A PLATEAU IS NOT A FINISH. The first version of this waited for two
  // consecutive equal readings, which sounds like settling and is not: the dev
  // server serves the shell, sits at 47 while it compiles the rest, then
  // streams. Two equal samples across that pause satisfied "stable" perfectly,
  // and the guard measured the shell. Stability is only evidence of completion
  // when you already know what completion looks like.
  //
  // So wait for a POSITIVE signal instead — the floor the assertion itself
  // demands. If a page genuinely cannot reach it, nothing is masked: the loop
  // simply runs out and the assertion below fails with the real count, which is
  // the honest outcome. The wait can never turn a defect into a pass, only a
  // race into a wait.
  // ⚠️ DISARM THE REVEAL, so the page is measured in its RESTING state.
  //
  // The landing arms its sections at `opacity: 0` and reveals them on scroll.
  // Now that the probe composites `opacity`, an unrevealed section is —
  // correctly — invisible text and gets skipped: measured, 244 elements skipped
  // as transparent and 47 survivors on a page of 291. The header, the footer,
  // and none of the argument between them. A guard reporting a clean page it had
  // never looked at is the exact failure CLAUDE.md 14g is about, and the
  // `MIN_MEASURED` floor below is the only reason it announced itself.
  //
  // `data-motion` is `LandingMotion`'s own arming switch, set on mount, and the
  // armed state lives entirely behind it in landing.css. Removing it is
  // therefore not a hack against the page — it is precisely the no-JS path the
  // component is built around ("No JS → no class → the page simply renders"),
  // which is the final state, fully visible, with no animation in flight.
  //
  // Preferred over the two alternatives after both were tried: driving a scroll
  // to fire every observer works but costs a multi-second pass on all thirteen
  // pages (the suite went 1.5m → 4.3m and tests began timing out), and
  // `reducedMotion` alone is one code path's courtesy rather than a property of
  // the page. This is one line and cannot race.
  // ⚠️ AND IT HAS TO WAIT FOR THE ARMING FIRST, or it races it. `data-motion` is
  // set inside a mount effect, so removing it on arrival simply loses: hydration
  // runs a moment later, re-arms, and the observer then reveals only what is in
  // view. That produced a clean 291 / 47 / 47 / 291 across four identical runs —
  // the signature of a race, not of a page that renders differently.
  //
  // Waiting for the attribute to APPEAR is what makes this deterministic: its
  // presence is proof the effect has already run, so the removal cannot be undone
  // by it. Scoped to pages that actually carry the motion root, because a
  // blanket wait would cost every other page the full timeout for nothing.
  if (await page.evaluate(() => !!document.querySelector('.lp'))) {
    await page.waitForFunction(() => !!document.querySelector('[data-motion]'), undefined, {
      timeout: 10_000,
    });
    await page.evaluate(() => {
      document.querySelectorAll('[data-motion]').forEach((e) => e.removeAttribute('data-motion'));
    });
  }

  for (let i = 0; i < 60; i++) {
    if (((await page.evaluate(PROBE)) as Probe).measured >= expectAtLeast) break;
    await page.waitForTimeout(250);
  }

  // ⚠️ LET THE MOUNT ANIMATIONS FINISH. Now that the probe composites `opacity`,
  // a page measured mid-fade reports every element at the animation's CURRENT
  // opacity rather than its resting one — and a fade starts near zero, so a
  // whole page would fail at once.
  //
  // This is not hypothetical: while auditing /learn I swept the public pages
  // with an opacity-aware probe and it reported 217 failures on the landing at
  // opacity 0.05. Every one was an artefact of measuring 300ms after
  // networkidle, mid-transition. Re-measured after settling, the landing is
  // clean. The lesson cost nothing that time because I checked; inside a CI
  // guard it would have been an intermittent red on a page with no defect.
  //
  // Infinite animations (`metaPulse`) never resolve `finished`, so they are
  // filtered out rather than waited on — otherwise this hangs on any page that
  // has one. `catch` because an animation cancelled mid-flight rejects, and a
  // cancelled animation is exactly as settled as a finished one.
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming?.().iterations !== Infinity);
    await Promise.all(finite.map((a) => a.finished.catch(() => {})));
  });

  return (await page.evaluate(PROBE)) as Probe;
}

/**
 * ⚠️ Two kinds of exemption, and they are different claims.
 *
 * `KNOWN_DEFERRED` names ONE element by its text. `legacy` excludes a marked
 * SUBTREE — today only the landing page's worked results table, every chip and tag
 * in which is painted by the screener's own palette (white numerals on a tier
 * fill, 9px tier-coloured tags, several at 2.38:1). The owner asked on 2026-08-15
 * that the landing match the live product exactly, so correcting them here would
 * put two different colours on one score. It is a product-wide fix on a paid
 * surface — Layer H — not a landing-page one.
 *
 * The debt is COUNTED rather than waved through, by the test at the foot of this
 * file. An exemption nobody re-checks is a blindfold (same reason KNOWN_DEFERRED
 * is asserted to still be real).
 */
const unexpected = (p: Probe): Fail[] =>
  p.fails.filter((f) => !f.legacy && !KNOWN_DEFERRED.some((k) => f.text.includes(k)));

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

test('the deferred exemption is still real, not stale', async ({ page }) => {
  // If the header gets fixed early, KNOWN_DEFERRED must shrink with it. An
  // allow-list nobody re-checks silently widens into a blindfold.
  const probe = await measure(page, '/', 'chrome', MIN_MEASURED.landing);
  const still = probe.fails.filter((f) => f.text.includes('Financial Terminal'));
  expect(
    still.length,
    'The 9px header wordmark now passes — delete it from KNOWN_DEFERRED.',
  ).toBe(1);
});


test('the deferred product palette stays inside the table, and does not grow', async ({ page }) => {
  // The landing renders the screener's chips with the screener's colours (owner,
  // 2026-08-15). That debt is real and bounded; this proves both halves.
  // ⚠️ `measure()`, not a hand-rolled goto + sentinel. This test used to open the
  // page itself and run the probe directly, which is the same preamble written a
  // second time — and it drifted exactly as CLAUDE.md 11c says it would. When the
  // landing started arriving late under load, `measure()` grew a wait for the
  // render to complete and THIS copy did not, so it read the bare shell, found no
  // legacy failures and reported the marker as stale. The finding it announced
  // ("remove the marker") would have been completely wrong.
  const probe = await measure(page, '/', 'chrome', MIN_MEASURED.landing);
  const legacy = probe.fails.filter((f) => f.legacy);

  // It exists — if this hits zero the marker is stale or the table is gone, and
  // the exemption must come out rather than sit here excusing nothing (14g).
  expect(legacy.length, 'nothing inside [data-legacy-contrast] fails — remove the marker').toBeGreaterThan(0);

  // Every one of them really is in the results table, not somewhere the marker
  // drifted onto.
  const marked = await page.locator('[data-legacy-contrast]').count();
  expect(marked, 'the legacy marker should sit on exactly one subtree').toBe(1);

  // And it is bounded. 7 rows x (Overall chip + Health chip + Health tag +
  // Valuation chip + Valuation tag + tinted DD) is the ceiling; a jump past it
  // means new low-contrast text has been added, not inherited.
  expect(
    legacy.length,
    `legacy contrast failures grew to ${legacy.length}:
${JSON.stringify(legacy, null, 2)}`,
  ).toBeLessThanOrEqual(42);
});
