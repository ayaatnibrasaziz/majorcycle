/**
 * Lighthouse, against the PRODUCTION build.
 *
 * Decision #33 sets the target: 90+ on per-ticker pages. Layer G adds the public
 * pages, which are the ones a stranger meets first.
 *
 * ⚠️ **`next dev` scores are meaningless** — unminified bundles, no static
 * prerender, a compile step inside the first request. This drives `next start`
 * on :3200 and refuses to run against :3000, because a number measured on the
 * wrong server is worse than no number (CLAUDE.md 11o).
 *
 * ⚠️ **Ticker pages are gated**, so a naive run measures `/login` and reports a
 * flattering score for a page nobody asked about — the exact trap G1 hit when it
 * measured a signed-in reader by accident. Cookies come from a real Playwright
 * sign-in, and every run PRINTS THE URL IT LANDED ON so a redirect cannot pass
 * for a reading.
 *
 * ⚠️ **One run is not a number.** On this machine the same unchanged page scored
 * 85, 81, 76, 63 and 62 across five consecutive runs — the spread is wider than
 * most of the improvements you would be trying to detect, and it drifts downward
 * as the machine warms up. A single reading led me to report a 26-point gain
 * that was really 15. So `LH_RUNS` defaults to 3 and the table prints the
 * MEDIAN, with the raw scores beside it so the spread is visible rather than
 * hidden behind an average.
 *
 * The byte counts in the full reports do not have this problem and are the
 * better evidence when one exists: "588 KB fetched on load" is exact.
 *
 * Usage: pnpm lighthouse            (3 runs per route)
 *        LH_RUNS=1 pnpm lighthouse  (quick look)
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';

/**
 * Pull the two e2e credentials out of `.env.local` if they are not already in the
 * environment.
 *
 * ⚠️ Without this the tool printed "gated routes will be SKIPPED, not guessed" and
 * measured only the five public pages — which is honest, and still means the run
 * silently omitted `/stocks/us/AAPL`, THE route decision #33 actually sets a target
 * for. Next loads `.env.local` itself, so the dev server and Playwright both see
 * these; a plain Node script does not, and the difference is invisible unless you
 * read the one line of output that says so. A tool whose default run skips its own
 * headline metric will eventually be trusted for a number it never took.
 *
 * Named keys only, never logged. Nothing else in the file is touched or echoed.
 */
function loadE2ECredsFromEnvLocal() {
  if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) return;
  const f = '.env.local';
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(E2E_EMAIL|E2E_PASSWORD)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadE2ECredsFromEnvLocal();

const ORIGIN = process.env.LH_ORIGIN ?? 'http://localhost:3200';
const OUT = 'lighthouse-report';

/** Public pages a stranger can reach, plus the two gated ones decision #33 names. */
const PUBLIC_ROUTES = ['/', '/learn', '/learn/what-is-a-drawdown', '/pricing', '/terms'];
const GATED_ROUTES = ['/stocks', '/stocks/us/AAPL'];

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const RUNS = Number(process.env.LH_RUNS ?? 3);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function signedInCookieHeader(browser) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) return null;
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}/login`);
    await page.fill('input#email', email);
    await page.fill('input#password', password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/stocks/, { timeout: 30_000 });
    const cookies = await ctx.cookies();
    await ctx.close();
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }
}

async function run(chrome, url, cookieHeader) {
  const result = await lighthouse(
    url,
    {
      port: chrome.port,
      output: 'html',
      logLevel: 'error',
      onlyCategories: CATEGORIES,
      // Desktop-ish: the mobile pass belongs to Layer H, which owns 375px.
      formFactor: 'desktop',
      screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1 },
      throttling: { rttMs: 40, throughputKbps: 10_240, cpuSlowdownMultiplier: 1 },
      extraHeaders: cookieHeader ? { Cookie: cookieHeader } : undefined,
    },
  );
  return result;
}

/**
 * Prove the server answering on :3200 is running THE BUILD ON DISK.
 *
 * ⚠️ This exists because of a real, expensive mistake on 2026-08-22. I killed the
 * old `next start` with `pkill`, it silently did not die, the new one lost the port
 * with EADDRINUSE, and the survivor went on serving routes it held in memory while
 * the chunks on disk had been rebuilt underneath it. I then measured that, chased a
 * 500 on a chunk that existed in no build as if it were a defect, and reported a
 * performance gain that was partly an artifact of comparing an old server with new
 * files. Every individual step looked like it worked (CLAUDE.md 11o — a command
 * that succeeded is not a state that is true).
 *
 * A note telling the next person to "check the server restarted" would not have
 * helped: I believed it HAD. So the check is mechanical. Next stamps every build
 * with a BUILD_ID and embeds it in the page as `buildId` in the __NEXT_DATA__ /
 * flight payload; if the value the server sends differs from `.next/BUILD_ID` on
 * disk, the two have diverged and every number this tool prints is meaningless.
 *
 * ⚠️ Fails LOUDLY rather than rebuilding or restarting anything. Guessing which of
 * the two is the one you meant is how a tool starts destroying work.
 */
async function assertServerMatchesDisk(browser) {
  if (!existsSync(join('.next', 'BUILD_ID'))) {
    console.error('no .next/BUILD_ID — there is no production build to measure. Run `pnpm build` first.');
    process.exit(1);
  }

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let assets = [];
  try {
    const res = await page.goto(ORIGIN, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!res || !res.ok()) {
      console.error(`nothing is answering on ${ORIGIN} (status ${res?.status() ?? 'none'}).`);
      process.exit(1);
    }
    const html = await page.content();
    assets = [...new Set(html.match(/\/_next\/static\/[^"'\s>]+/g) ?? [])];
  } finally {
    await ctx.close();
  }

  /* ⚠️ A page that referenced NO build assets means the extraction broke, not that
     everything is fine. Unmeasurable must never read as clean (CLAUDE.md 14g). */
  if (assets.length < 5) {
    console.error(
      `only ${assets.length} /_next/static asset(s) found on the served page — ` +
        'refusing to report numbers I cannot attribute.',
    );
    process.exit(1);
  }

  const missing = assets.filter((a) => !existsSync(join('.next', a.replace('/_next/', ''))));
  if (missing.length) {
    const lines = [
      '',
      `X THE SERVER ON ${ORIGIN} IS NOT THE BUILD ON DISK.`,
      '',
      `  It is serving ${missing.length} of ${assets.length} assets that do not exist in .next/:`,
      ...missing.slice(0, 5).map((m) => `    ${m}`),
      '',
      '  An old next-start process is still holding the port. It keeps serving routes',
      '  and chunk names from memory while the files under it have been replaced, so',
      '  every number below would belong to neither build. Kill it BY PID, confirm the',
      '  port is free, then start it again.',
      '',
    ];
    console.error(lines.join('\n'));
    process.exit(1);
  }

  console.log(`server on ${ORIGIN} is the build on disk (${assets.length} assets verified)`);
}

async function main() {
  if (ORIGIN.includes(':3000')) {
    console.error('refusing to measure the dev server — run `pnpm start:fresh --port 3200`');
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  /* Playwright's Chromium, with the DevTools port Lighthouse drives — so there is
     one browser download on this machine rather than two, and the sign-in that
     produces the cookies runs in the same binary being measured. */
  const PORT = 9222;
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
  const chrome = { port: PORT, kill: () => browser.close() };

  // ⚠️ BEFORE anything is measured. A wrong-server reading is worse than no
  // reading, because it looks like evidence.
  await assertServerMatchesDisk(browser);

  const cookieHeader = await signedInCookieHeader(browser);
  if (!cookieHeader) {
    console.log('! no E2E_EMAIL/E2E_PASSWORD — gated routes will be SKIPPED, not guessed');
  }

  const rows = [];
  try {
    for (const path of [...PUBLIC_ROUTES, ...(cookieHeader ? GATED_ROUTES : [])]) {
      const gated = GATED_ROUTES.includes(path);
      const takes = [];
      let landed = path;
      for (let i = 0; i < RUNS; i++) {
        const res = await run(chrome, ORIGIN + path, gated ? cookieHeader : null);
        const lhr = res.lhr;
        landed = new URL(lhr.finalDisplayedUrl).pathname;
        takes.push(
          Object.fromEntries(
            CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]),
          ),
        );
        // Keep the LAST report: the detail (opportunities, network list) is what
        // the html is for, and it does not vary the way the score does.
        writeFileSync(`${OUT}/${path.replace(/\W+/g, '_') || 'root'}.html`, res.report);
      }
      const scores = Object.fromEntries(
        CATEGORIES.map((c) => [c, median(takes.map((t) => t[c]))]),
      );
      rows.push({ path, landed, ...scores, raw: takes.map((t) => t.performance) });
    }
  } finally {
    await chrome.kill();
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    `\n${pad('route', 28)}${pad('landed on', 24)}${CATEGORIES.map((c) => pad(c.slice(0, 5), 7)).join('')}`,
  );
  /* ⚠️ **SEO is not scored on the gated routes, and that is not leniency.**
     `/stocks` and `/stocks/us/AAPL` are `Disallow`ed in robots.txt on purpose —
     decision 2026-08-04, nothing the product sells is crawlable — so Lighthouse
     fails `is-crawlable` and hands them 58-66. Reporting that as the site's
     worst score would be flagging correct behaviour as a defect, which is how a
     number stops being read. Their performance and accessibility DO count. */
  const scoreOf = (r, c) =>
    GATED_ROUTES.includes(r.path) && c === 'seo' ? null : r[c];
  let worst = 100;
  let worstAt = '';
  for (const r of rows) {
    const flag = r.landed !== r.path ? '  <-- REDIRECTED' : '';
    console.log(
      pad(r.path, 28) +
        pad(r.landed, 24) +
        CATEGORIES.map((c) => pad(scoreOf(r, c) ?? 'n/a', 7)).join('') +
        (RUNS > 1 ? r.raw.join(' ') : '') +
        flag,
    );
    if (r.landed !== r.path) continue;
    for (const c of CATEGORIES) {
      const v = scoreOf(r, c);
      if (v !== null && v < worst) {
        worst = v;
        worstAt = `${r.path} ${c}`;
      }
    }
  }
  console.log(`
lowest meaningful score: ${worst} (${worstAt}) — decision #33 wants 90+`);
  console.log(`full reports: web/${OUT}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
