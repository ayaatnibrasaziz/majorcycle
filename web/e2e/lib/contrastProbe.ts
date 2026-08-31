import { expect, type Page } from '@playwright/test';

/**
 * The contrast probe: ONE implementation, two callers.
 *
 * ⚠️ Extracted from `contrast.spec.ts` on 2026-08-22, when the signed-in pages
 * finally got measured. Copying the probe and `measure()` into a second spec was
 * the obvious move and the wrong one — `contrast.spec.ts` already carries a scar
 * from exactly that: one of its tests re-implemented the goto-and-wait preamble
 * instead of calling `measure()`, and when `measure()` later grew a wait for the
 * landing's late render, the copy did not. It went on reading a bare shell,
 * found nothing, and would have reported a real exemption as stale (CLAUDE.md 11c).
 *
 * ⚠️ Why the two callers stay in SEPARATE spec files rather than one: the public
 * suite is deliberately **credential-free** — no login, no network past the dev
 * server — so it runs on a fork PR and can never self-skip. The signed-in suite
 * needs E2E_EMAIL/E2E_PASSWORD and therefore CAN skip. Merging them would put a
 * skippable test in a file whose whole promise is that it cannot skip.
 *
 * Everything here is mechanism. What to measure, which floor, and which exemptions
 * apply belong to the callers.
 */

export const PROBE = `(() => {
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
  // ⚠️ An ancestor only counts if the element is actually PAINTED ON IT. Walking
  // the DOM chain alone is wrong for anything absolutely positioned out of its
  // parent's box, and it produced two spectacular false findings on the Stock
  // Detail page: the analyst track's price label measured **1.00:1** (brand blue
  // on brand blue, i.e. reported as completely invisible) and its consensus label
  // **1.88** (gold on gold). Both are .target-label { position: absolute; top:
  // 18px } inside an 18px round marker — they render BELOW the dot, on the page
  // ground, perfectly legible. The DOM said child-of-gold; the screen said next-to-gold.
  //
  // So test containment: an ancestor contributes its background only when the
  // element's CENTRE falls inside that ancestor's box. Cheap, and it is the same
  // question the compositor answers. Verified not to move any previously-correct
  // reading — the public suite's numbers are unchanged, including the deliberately
  // exempt 2.94 header wordmark, which is the control for this change.
  //
  // (CLAUDE.md 11q: when a measurement disagrees with the screen, instrument the
  // INSTRUMENT. A guard that invents failures gets ignored just as fast as one
  // that misses them.)
  const bgOf = (el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let n = el, acc = [255, 255, 255];
    const stack = [];
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        const ar = n.getBoundingClientRect();
        const paints =
          n === el ||
          (cx >= ar.left - 0.5 && cx <= ar.right + 0.5 && cy >= ar.top - 0.5 && cy <= ar.bottom + 0.5);
        if (paints) stack.push(c);
      }
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

  const out = { measured: 0, sizes: [], fails: [], skipped: { hidden: 0, transparent: 0, noText: 0, noColor: 0, disabled: 0 } };
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
    // A DISABLED control has no contrast requirement -- WCAG 1.4.3 exempts
    // "text ... that is part of an inactive user interface component". Skipping
    // them is not a loophole, it is the spec, and not skipping them produces
    // confident nonsense: /account's "Save changes" starts disabled (nothing is
    // dirty yet) and its 50% dimming scored the primary button at 2.83:1, which
    // reads as a sitewide CTA failure. The same button ENABLED measures 6.49.
    // Chased as a real defect first; the tell was the public suite passing on the
    // identical component.
    if (el.closest('[disabled], [aria-disabled="true"], fieldset[disabled]')) { out.skipped.disabled++; return; }
    const fs = parseFloat(cs.fontSize);
    seen.add(fs);
    // SVG text takes its colour from 'fill', not 'color'. Reading only 'color'
    // made EVERY chart label on the site unmeasurable -- axis ticks, legends,
    // watermarks -- and unmeasurable reads as clean (CLAUDE.md 14g). Recharts and
    // Lightweight Charts set fill from props, so this is most of the numbers a
    // subscriber actually looks at. Found 2026-08-22, when a single Recharts
    // legend leaked through as an inherited 'color' and raised the question of
    // why only one had.
    const isSvgText = el instanceof SVGElement && (el.tagName === 'text' || el.tagName === 'tspan');
    // Report the property actually MEASURED. This said cs.color while measuring
    // cs.fill for SVG text, so a Recharts label failing at gold's 2.38 was filed
    // under --text-primary's rgb(15, 25, 35) -- a ratio that colour cannot
    // produce on white (it is 17:1). A failure list that names the wrong cause
    // sends you to the wrong file.
    const fgSource = isSvgText && cs.fill && cs.fill !== 'none' ? cs.fill : cs.color;
    const fg = parse(fgSource);
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
    if (r < need) out.fails.push({ text: txt.slice(0, 60), fontSize: fs, ratio: +r.toFixed(2), need, opacity: +op.toFixed(2), color: fgSource, bg: 'rgb(' + bg.map(Math.round).join(', ') + ')' });
  });
  out.sizes = [...seen].sort((a, b) => a - b);
  return out;
})()`;

export interface Fail {
  text: string;
  fontSize: number;
  ratio: number;
  need: number;
  /** Accumulated ancestor `opacity` at the moment of measurement. 1 means the
   *  colour token itself is too weak; anything less names the dimming as the
   *  cause and points at the wrapper rather than at the palette. */
  opacity: number;
  /** ⚠️ The computed foreground, and the COMPOSITED ground behind it. Added
   *  2026-08-22, when the first signed-in run returned 258 failures on one page
   *  and the report gave no way to tell whether that was 258 problems or one
   *  token used 258 times. It was one token (`--text-muted`, 2.97:1). A failure
   *  list you have to go and diagnose is a search; a failure list that names the
   *  colour is an answer. */
  color: string;
  bg: string;
}
export interface Probe {
  measured: number;
  skipped: { hidden: number; transparent: number; noText: number; noColor: number; disabled: number };
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
export const SENTINEL = {
  reading: () => {
    const el = document.querySelector('.reading');
    return !!el && parseFloat(getComputedStyle(el).fontSize) === 17;
  },
  chrome: () => {
    const el = document.querySelector('[data-public-header]');
    return !!el && getComputedStyle(el).position === 'sticky';
  },
  /**
   * The SIGNED-IN shell. The app layout offsets `<main>` by the sidebar width via
   * `ml-[var(--sidebar-w)]`, so a non-zero computed left margin proves both that
   * the stylesheet is live AND that the token resolved — an unstyled page gives 0,
   * and a page that loaded the stylesheet but not the theme gives 0 as well.
   *
   * ⚠️ Deliberately NOT "the sidebar exists". The sidebar is in the DOM the moment
   * the layout renders, which is true while the page beneath it is still empty —
   * the same trap that let the landing be measured at 47 elements of 291.
   */
  app: () => {
    const main = document.querySelector('main#main-content');
    return !!main && parseFloat(getComputedStyle(main).marginLeft) > 0;
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
export const MIN_MEASURED = {
  reading: 20,
  landing: 120,
  /**
   * `/articles`, which is laid out like the landing page but is nowhere near as
   * dense — so it needs its own floor rather than the landing's.
   *
   * ⚠️ MEASURED, not guessed, and grounded the same way `app` below is: the page
   * carries **65** measurable elements, of which the public header and footer are
   * **19**. A page that rendered nothing but its chrome therefore measures 19, and
   * 40 sits comfortably above that while leaving 25 of slack for ordinary content
   * edits.
   *
   * ⚠️ Sharing `landing: 120` is what this replaced, and the failure is worth
   * naming: the assertion did not report a contrast problem, it reported "rendered
   * too little to measure". A floor calibrated for a different page fails on a page
   * that is entirely correct — and the tempting fix is to lower the shared number,
   * which would quietly weaken the landing's control at the same time.
   */
  articles: 40,
  form: 15,
  /**
   * The signed-in pages. Real sizes, not round guesses, and each is a floor the
   * page clears by a wide margin while a shell can never reach it: the app chrome
   * alone (sidebar nav, header, disclaimer strip) measures about 30, so anything
   * at or under that would be satisfied by a page that failed to render.
   */
  app: 45,
  /** /results with a seeded run: 6 rows x ~10 labelled cells, plus toolbar. */
  results: 90,
  /**
   * The stock detail page, which is an order of magnitude bigger than the rest of
   * the app (572 measured elements against Browse's 772 and /run's ~50).
   *
   * ⚠️ It needs its own floor because `measure()` uses this number as BOTH the wait
   * and the assertion — deliberately, so the two can never disagree. Sharing the
   * generic `app: 45` meant the wait was satisfied after the shell and a couple of
   * cards had rendered, while a dozen chart sections were still arriving. Both
   * signed-in specs went flaky on this one page and passed on retry: the most
   * ignorable result a suite can give, and the one that means the guard is
   * measuring a page that is not finished.
   *
   * 420 is comfortably below the real 572 (charts vary a little with the data a
   * ticker actually has) and far above anything a half-rendered page reaches.
   */
  detail: 420,
} as const;

export async function measure(
  page: Page,
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
