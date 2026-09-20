/**
 * `pnpm e2e:browsers` — the whole Playwright suite in Chromium, Firefox AND WebKit
 * (Layer H4, owner decision 4: "the whole site, run locally on demand — NOT in CI").
 *
 * ⚠️ **Three totals, never one.** An engine that fails to launch does not report
 * as red; depending on where it fails it reports as nothing at all, and a combined
 * "0 failed" would read as three clean engines. So each engine runs as its OWN
 * Playwright invocation (its own dev server, its own JSON report), and this script
 * refuses to call a run clean unless every engine:
 *   - ran at least one test, and
 *   - saw the SAME number of tests as the others (same suite — a shortfall means
 *     tests were lost, not passed), and
 *   - had no unexpected failures.
 * Flaky (passed on retry) is printed per engine and never folded into "passed".
 *
 * ⚠️ **Sequential, not parallel.** Three engines at once would put three writers
 * on the shared E2E account and three dev servers on one machine; the resulting
 * flake would be indistinguishable from an engine difference, which is the one
 * thing this run exists to find (CLAUDE.md 11bd).
 *
 * ⚠️ **Windows: `PLAYWRIGHT_BROWSERS_PATH`.** The Claude desktop app virtualises
 * AppData, and Firefox cannot start from the redirected `ms-playwright` folder
 * (Layer H plan §3 finding E). If the variable is unset and
 * `%USERPROFILE%\playwright-browsers` exists, it is used — and the path is printed,
 * so nobody has to wonder which install ran.
 *
 * Usage:  pnpm e2e:browsers                         all three, whole suite
 *         pnpm e2e:browsers firefox webkit           a subset of engines
 *         pnpm e2e:browsers -- e2e/learn.spec.ts     any Playwright args after --
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const ALL = ['chromium', 'firefox', 'webkit'];
const argv = process.argv.slice(2);
const dash = argv.indexOf('--');
const picked = (dash === -1 ? argv : argv.slice(0, dash)).filter((a) => ALL.includes(a));
const passthrough = dash === -1 ? [] : argv.slice(dash + 1);
const engines = picked.length ? picked : ALL;

const env = { ...process.env, MC_ALL_BROWSERS: '1' };
if (!env.PLAYWRIGHT_BROWSERS_PATH && process.platform === 'win32') {
  const outside = join(homedir(), 'playwright-browsers');
  if (existsSync(outside)) env.PLAYWRIGHT_BROWSERS_PATH = outside;
}
console.log(`browsers: ${env.PLAYWRIGHT_BROWSERS_PATH ?? '(Playwright default)'}`);
console.log(`engines:  ${engines.join(', ')}${passthrough.length ? `   args: ${passthrough.join(' ')}` : ''}\n`);

/**
 * ⚠️ THE FOCUS WALKS RUN ONE AT A TIME; EVERYTHING ELSE DOES NOT.
 *
 * Those specs measure what a browser draws for the KEYBOARD, and only one page in a
 * browser can hold focus — with two workers, whichever page lost it reported every
 * control as "no ring" (Firefox and WebKit both did; Chromium does not, which is why CI
 * is unaffected). Making the WHOLE suite serial to fix three specs was the first answer
 * and it taxed every other test for a fault they do not have, so each engine now runs
 * twice: the walks with `--workers=1`, the rest in parallel. The two totals are summed,
 * so the "same number of tests in every engine" check is unchanged.
 */
const FOCUS_SPECS = ['e2e/focus-visible.spec.ts', 'e2e/app-a11y.spec.ts', 'e2e/focus-dialogs.spec.ts'];

const dir = mkdtempSync(join(tmpdir(), 'mc-e2e-browsers-'));
const results = [];

/** One Playwright invocation. Returns its stats (or null if it never reported). */
function invoke(engine, report, args, extraEnv = {}) {
  // One command STRING, not an args array: `pnpm` is a .cmd shim on Windows and needs a
  // shell, and Node deprecates shell + args (DEP0190) because it only concatenates them.
  const cmd = ['pnpm exec playwright test', `--project=${engine}`, '--reporter=list,json', ...args].join(' ');
  const run = spawnSync(cmd, {
    stdio: 'inherit',
    shell: true,
    env: { ...env, ...extraEnv, PLAYWRIGHT_JSON_OUTPUT_NAME: report },
  });
  let stats = null;
  try {
    stats = JSON.parse(readFileSync(report, 'utf8')).stats;
  } catch {
    // No report at all — this invocation never got as far as running a test.
  }
  return { stats, exit: run.status };
}

const add = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  return {
    expected: a.expected + b.expected,
    unexpected: a.unexpected + b.unexpected,
    flaky: a.flaky + b.flaky,
    skipped: a.skipped + b.skipped,
  };
};

for (const engine of engines) {
  console.log(`━━ ${engine} ━━`);
  const t0 = Date.now();
  let stats = null;
  let exit = 0;

  if (passthrough.length) {
    // Explicit spec paths: one serial run, because the caller may well have named a walk.
    const r = invoke(engine, join(dir, `${engine}.json`), ['--workers=1', ...passthrough.map((a) => JSON.stringify(a))]);
    stats = r.stats;
    exit = r.exit;
  } else {
    const walks = invoke(engine, join(dir, `${engine}-walks.json`), ['--workers=1', ...FOCUS_SPECS]);
    const rest = invoke(engine, join(dir, `${engine}-rest.json`), [], { MC_SKIP_FOCUS_SPECS: '1' });
    stats = add(walks.stats, rest.stats);
    // Either invocation failing fails the engine; a missing report shows up as no stats.
    exit = walks.exit || rest.exit;
    if (!walks.stats || !rest.stats) stats = walks.stats ?? rest.stats;
  }
  results.push({ engine, exit, stats, mins: (Date.now() - t0) / 60000 });
}

/* ── the verdict ─────────────────────────────────────────────────────────── */
const total = (s) => (s ? s.expected + s.unexpected + s.flaky + s.skipped : 0);
const most = Math.max(...results.map((r) => total(r.stats)));
const problems = [];

console.log('\nengine     passed  flaky  failed  skipped  total   time');
for (const r of results) {
  const s = r.stats;
  if (!s) {
    console.log(`${r.engine.padEnd(10)} NO REPORT — the run never produced results (exit ${r.exit})`);
    problems.push(`${r.engine}: no report`);
    continue;
  }
  console.log(
    `${r.engine.padEnd(10)} ${String(s.expected).padStart(6)} ${String(s.flaky).padStart(6)} ` +
      `${String(s.unexpected).padStart(7)} ${String(s.skipped).padStart(8)} ${String(total(s)).padStart(6)}  ` +
      `${r.mins.toFixed(1)}m`,
  );
  if (s.expected + s.flaky === 0) problems.push(`${r.engine}: ran nothing`);
  if (s.unexpected > 0) problems.push(`${r.engine}: ${s.unexpected} failed`);
  if (total(s) !== most) problems.push(`${r.engine}: saw ${total(s)} tests, another engine saw ${most}`);
  if (r.exit !== 0 && s.unexpected === 0) problems.push(`${r.engine}: exited ${r.exit} with no failed test`);
}

if (problems.length) {
  console.log(`\nNOT CLEAN:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nclean in ${results.length} engine(s)`);
