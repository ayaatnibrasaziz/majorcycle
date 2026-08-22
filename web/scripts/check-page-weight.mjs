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
  ['/pricing', 350, false, 'the page a reader is on when deciding to pay'], // 267
  ['/login', 430, false, 'the sign-in path, plus Google Identity Services'],// 332
  ['/stocks', 500, true, 'Browse'],                                         // 389
  ['/stocks/us/AAPL', 1400, true, 'the heaviest page we ship, and where the 588 KB regression landed'], // 1222
];

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

  // Print the landed URL: a route that redirects would otherwise be reported as a
  // very light version of the page you asked for.
  const flag = kb > maxKB ? 'OVER' : '  ok';
  console.log(
    `  ${flag}  ${path.padEnd(22)} ${String(kb).padStart(5)} KB / ${maxKB}  ` +
      `${String(requests).padStart(3)} reqs  landed ${landed}`,
  );

  if (landed !== path) {
    problems.push(`${path} redirected to ${landed} — that is not the page this budget describes`);
  }
  // A page that did not load transfers almost nothing and would pass every budget
  // in this file (CLAUDE.md 14g).
  if (kb < 40 || requests < 5) {
    problems.push(`${path} transferred only ${kb} KB over ${requests} requests — it did not load`);
  }
  if (kb > maxKB) {
    problems.push(
      `${path} is ${kb} KB, over its ${maxKB} KB budget (${why}).\n` +
        `      heaviest: ${heaviest.join('\n                ')}`,
    );
  }
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
