#!/usr/bin/env node
/**
 * How many bytes a page costs a reader to open — measured on the PRODUCTION build.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * On 2026-08-22 every ticker page was pulling **588 KB** of offline-report bundle
 * on load, for every viewer including free accounts who cannot use it, because the
 * prefetch fired unconditionally while the sibling call one line away checked
 * `entitled`. It had been there for weeks with every check green — the page
 * rendered correctly and behaved correctly, it was just heavy. A defect with no
 * wrong output has to be measured or it stays invisible.
 *
 * ⚠️ **A static bundle analyser would have missed it.** Those bytes were in no
 * route's entry chunk; they were a runtime fetch issued by client code after
 * hydration. Only asking a real browser what it actually pulled can see that.
 *
 * ⚠️ **And a Playwright test cannot hold the numbers**, which is why this is a
 * script rather than a spec. The e2e suite boots `next dev`: unminified, split
 * differently, recompiling per route. A KB budget written against that is a fact
 * about the development server — several times production and drifting with the
 * compiler cache — and the danger is not that it is wrong, it is that it would be
 * believed. `e2e/page-weight.spec.ts` keeps the half that IS invariant to
 * bundling: whether a request is made at all.
 *
 * ── Reading the numbers ─────────────────────────────────────────────────────
 * `encodedBodySize` from the Resource Timing API — what actually crossed the wire,
 * compressed, which is what a reader on a phone pays for. Decoded sizes would read
 * two to four times larger and quietly make every budget meaningless.
 *
 * Counted up to the `load` event, deliberately NOT to networkidle: the report
 * bundle is now prefetched ON PURPOSE for entitled viewers inside
 * `requestIdleCallback`, precisely so it lands after the page the reader is waiting
 * for. Counting to networkidle would score that correct behaviour as a regression
 * and teach the next person to remove it.
 *
 * Budgets are the measured figure plus room, not aspirations. A budget the page
 * does not already meet is a check that starts red and gets raised, which teaches
 * everyone to raise it.
 *
 * Usage:  pnpm check:page-weight        (needs `pnpm start:fresh --port 3200`)
 */
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

function loadE2ECredsFromEnvLocal() {
  if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) return;
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(E2E_EMAIL|E2E_PASSWORD)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadE2ECredsFromEnvLocal();

const ORIGIN = process.env.LH_ORIGIN ?? 'http://localhost:3200';

/** path, budget in KB transferred up to `load`, whether it needs a session, why. */
const BUDGETS = [
  // Measured 2026-08-22 on the production build, plus roughly a quarter for
  // headroom. Sized so the defect that prompted this file WOULD trip them: 588 KB
  // back on the ticker page is 1810 KB against a 1400 ceiling. A budget generous
  // enough that the original bug still passes is decoration.
  ['/', 360, false, 'the landing — the first thing a stranger meets'],       // 277
  ['/learn', 380, false, 'the library index'],                              // 288
  // ⚠️ **Added 2026-08-31 by the Layer G delta audit, because this list is a
  // hand-written one and `/articles` had never been on it.** Two public routes and
  // five published pieces shipped while this guard reported "every page within
  // budget" — which it did, truthfully, about the six pages it knew about. A guard
  // scoped to a list is silent about everything outside it, and silence reads
  // exactly like a pass (CLAUDE.md 14g, and 11c-iv for the rule a new consumer
  // never received).
  //
  // ⚠️ **And the measurement corrected the assumption that prompted it.** The audit
  // predicted these would be the heaviest public pages we ship — they carry frozen
  // datasets, ranked tables and an inline SVG figure. Measured, they are among the
  // LIGHTEST: 268 and 272 KB against /learn's 288 and the landing's 277. The tables
  // are HTML and the figure is inline SVG, so the content that felt heavy costs
  // almost nothing to send. The finding (a guard that cannot see them) was right;
  // the reason given for its urgency was wrong, and it is corrected here rather
  // than left to look confirmed.
  //
  // Two entries, not five: the featured piece is the heaviest article and carries
  // the figure, so it is the one a shared-bundle regression shows up in first. The
  // three ranked pieces measured 267 KB, within 5 KB of it. Each figure was taken
  // three consecutive times and did not move by a single KB, so the ~28% headroom
  // is headroom rather than noise.
  ['/articles', 340, false, 'the articles index'],                          // 268
  ['/articles/how-far-do-asx-shares-fall', 350, false, 'the featured article — the heaviest of the five, and the only one with a figure'], // 272
  ['/pricing', 350, false, 'the page a reader is on when deciding to pay'], // 267
  ['/login', 430, false, 'the sign-in path, plus Google Identity Services'],// 332
  // Ratcheted 500 → 400 on 2026-08-24 (F-022): the Supabase client stopped being
  // pulled onto every signed-in page, taking Browse from 389 to 327 KB.
  ['/stocks', 400, true, 'Browse'],                                         // 327
  // ⚠️ RATCHETED TWICE on 2026-08-24 — 1400 → 1250 → 1150 — because the measurement
  // moved twice in one day:
  //   1222 → 1079 KB  the four benchmark index series left the document for
  //                   `/api/benchmarks`, browser-cached across ticker pages (F-019)
  //   1079 → 1017 KB  the Supabase client stopped being pulled onto every
  //                   signed-in page by the run-history fetch (F-022)
  //
  // Leaving the old ceiling would have let both savings be given back with nothing
  // going red. Today's measurement becomes the floor, which is how these stop
  // rotting (CLAUDE.md 11t); each figure was measured three consecutive times, so
  // the ~13% headroom is headroom rather than noise.
  //
  // ⚠️ The 588 KB regression this file was written for still trips it: 1017 + 588
  // is 1605 against a 1150 ceiling. A budget the original bug passes is decoration.
  //
  // ⚠️ Known timing sensitivity, unchanged by the ratchet. The benchmark fetch is
  // deferred to browser-idle, so it normally lands AFTER `load` and is not counted
  // here. If it ever landed inside the window it would add ~900 KB and trip this —
  // and it would equally have tripped the old 1400. So this is not a new flake
  // risk; it is the same one, and a red here should first be checked against
  // `RelativePerformance`'s idle arming before anyone touches the number.
  ['/stocks/us/AAPL', 1150, true, 'the heaviest page we ship, and where the 588 KB regression landed'], // 1017

  /**
   * ⚠️ **AUDIT 5A-153, 2026-09-05. Added because a route-by-route diff found
   * EIGHT routes in NONE of the three server gates** — this file, `check:csp` and
   * `lighthouse` each walk their own hand-written list, and the union of the three
   * still missed the whole screener, both remaining legal pages and all three
   * confinement pages. That is the same gap the Layer G delta audit found for
   * `/articles`, which shipped unwatched for weeks while this file truthfully
   * reported "every page within budget" about the six pages it knew about (14g,
   * and 11c-iv for the consumer a rule never reached).
   *
   * Measured on 2026-09-05, three consecutive readings each, none moving by a KB.
   * Budgets are that figure plus roughly a quarter, the same rule as above.
   *
   * ⚠️ `/results` is measured on the E2E account, which holds no subscription,
   * so it renders the upsell rather than the screener table. An entitled run with
   * 25 rows of charts is heavier and is NOT covered by this number — saying so is
   * cheaper than letting the row imply a coverage it does not have.
   */
  ['/privacy', 340, false, 'a legal page a reader may be sent straight to'],   // 268
  ['/disclaimer', 340, false, 'the compliance page, linked from every rating'], // 267
  ['/run', 380, true, 'the screener entry point'],                            // 303
  ['/results', 540, true, 'the screener output — UNENTITLED; an entitled table is heavier'], // 427
  ['/request', 370, true, 'Request a Ticker, which loads the listings search'], // 294
];

/**
 * ⚠️ **The three routes this file still cannot weigh, named rather than
 * omitted.** `/account/update-password`, `/deletion-requested` and `/reactivate`
 * are each reachable only behind a one-shot session marker or a scheduled-deletion
 * account, so no ordinary sign-in reaches them. `e2e/deletion-notice.spec.ts` and
 * `e2e/auth.spec.ts` drive them by pressing the real buttons; neither measures
 * bytes. An unstated blind spot reads as coverage (14g).
 */

async function weigh(page, path) {
  await page.goto(ORIGIN + path, { waitUntil: 'load', timeout: 60_000 });
  return page.evaluate(() => {
    const res = performance.getEntriesByType('resource');
    const nav = performance.getEntriesByType('navigation')[0];
    const until = nav?.loadEventStart ?? Infinity;
    const counted = res.filter((e) => e.startTime <= until);
    const bytes =
      counted.reduce((n, e) => n + (e.encodedBodySize || 0), 0) + (nav?.encodedBodySize ?? 0);
    const heaviest = counted
      .filter((e) => (e.encodedBodySize || 0) > 0)
      .sort((a, b) => b.encodedBodySize - a.encodedBodySize)
      .slice(0, 5)
      .map((e) => `${Math.round(e.encodedBodySize / 1024)}KB ${new URL(e.name).pathname}`);
    return { bytes, requests: counted.length, heaviest };
  });
}

const browser = await chromium.launch();
const problems = [];

/* ⚠️ TWO CONTEXTS, and the first version of this script had one. Signing in and
   then measuring `/`, `/login` and `/pricing` measures none of them: a signed-in
   reader is deliberately bounced off all three (`SIGNED_OUT_ONLY_PATHS`), so the
   script cheerfully reported 389 KB for three different pages, which was /stocks
   three times. The landed-URL check below is what caught it — it exists because a
   redirect turns a budget into a measurement of somewhere else entirely, and the
   number still looks perfectly plausible. */
const publicCtx = await browser.newContext();
const publicPage = await publicCtx.newPage();

let appPage = null;
if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) {
  const appCtx = await browser.newContext();
  appPage = await appCtx.newPage();
  await appPage.goto(`${ORIGIN}/login`);
  await appPage.fill('input#email', process.env.E2E_EMAIL);
  await appPage.fill('input#password', process.env.E2E_PASSWORD);
  await appPage.getByRole('button', { name: /^sign in$/i }).click();
  await appPage.waitForURL(/\/stocks/, { timeout: 30_000 });
} else {
  console.log('! no E2E_EMAIL/E2E_PASSWORD — the signed-in pages will be SKIPPED, not guessed');
}

console.log(`page weight on ${ORIGIN}, transferred up to load\n`);
for (const [path, maxKB, needsAuth, why] of BUDGETS) {
  if (needsAuth && !appPage) {
    console.log(`  ${path.padEnd(22)}    skipped (needs a session)`);
    continue;
  }
  const page = needsAuth ? appPage : publicPage;
  const { bytes, requests, heaviest } = await weigh(page, path);
  const kb = Math.round(bytes / 1024);
  const landed = new URL(page.url()).pathname;

  // ⚠️ Collect this row's problems BEFORE printing it, so the label can reflect all
  // three of them rather than the budget alone. It printed `ok` beside a failure
  // until 2026-08-23: the flag was `kb > maxKB ? 'OVER' : ' ok'`, so a page that
  // redirected somewhere else, or never loaded at all, was labelled `ok` on the
  // very line meant to summarise it — `ok /robots.txt 1 KB / 400  0 reqs` sat above
  // `it did not load`. Nothing was ever missed (the problem block below prints and
  // the exit code is 1), but a column reading `ok` next to a failure is one skim
  // from being believed, and "looks clean while broken" is the exact defect this
  // whole file exists to catch. Found by sabotaging the guard three ways in the
  // Layer G audit — two of the three sabotages printed `ok`.
  const rowProblems = [];

  if (landed !== path) {
    rowProblems.push(`${path} redirected to ${landed} — that is not the page this budget describes`);
  }
  // A page that did not load transfers almost nothing and would pass every budget
  // in this file (CLAUDE.md 14g).
  if (kb < 40 || requests < 5) {
    rowProblems.push(`${path} transferred only ${kb} KB over ${requests} requests — it did not load`);
  }
  if (kb > maxKB) {
    rowProblems.push(
      `${path} is ${kb} KB, over its ${maxKB} KB budget (${why}).\n` +
        `      heaviest: ${heaviest.join('\n                ')}`,
    );
  }

  // Three labels, each meaning something: OVER = too heavy, FAIL = a problem that
  // is not about size (redirected, or did not load), ok = genuinely nothing wrong.
  // Print the landed URL either way — a route that redirects would otherwise be
  // reported as a very light version of the page you asked for.
  const flag = kb > maxKB ? 'OVER' : rowProblems.length ? 'FAIL' : '  ok';
  console.log(
    `  ${flag}  ${path.padEnd(22)} ${String(kb).padStart(5)} KB / ${maxKB}  ` +
      `${String(requests).padStart(3)} reqs  landed ${landed}`,
  );

  problems.push(...rowProblems);
}

await browser.close();

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error(
    '\n  If an increase is deliberate, move the budget and say why in the diff. If it is\n' +
      '  not, something is being fetched that the reader is not waiting for.\n',
  );
  process.exit(1);
}
console.log('\nevery page within budget');
