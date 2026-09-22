#!/usr/bin/env node
/**
 * Split the E2E suite into N shards of roughly EQUAL DURATION (2026-09-22).
 *
 *     node scripts/e2e-shard.mjs <shard> <total> <out-file>
 *
 * Writes a Playwright `--test-list` file for one shard and prints what it chose.
 *
 * ── Why not `--shard` ────────────────────────────────────────────────────────
 * Playwright's own `--shard` cuts the suite into contiguous slices of equal TEST
 * COUNT, in file order. Our tests range from 1 ms to over a minute, and the slow ones
 * cluster in a few files — so shard 1 of 6 received the first 188 tests alphabetically,
 * which included `app-a11y` (20 min of work) and `app-responsive` (7 min), and ran for
 * 17.8 min while shard 6 finished in 3. The run is as slow as its slowest shard.
 *
 * ── What this does instead ───────────────────────────────────────────────────
 * 1. Lists every test (`playwright test --list --reporter=json`).
 * 2. Groups them into units that are SAFE to run apart:
 *    - a file that declares `mode: 'parallel'` at the top splits per test;
 *    - every other file stays WHOLE, because its tests may share setup or run in a
 *      declared order (`mode: 'serial'`) — splitting those is how order-dependent
 *      tests start failing for reasons nobody can see.
 * 3. Weighs each unit with `e2e/timings.json` (seconds, from a real CI run; a test
 *    with no entry counts 3 s) and deals the units out largest-first to whichever
 *    shard is lightest — the standard longest-processing-time rule.
 *
 * Deterministic: every shard computes the same assignment from the same inputs, so
 * the shards partition the suite exactly. The `e2e-report` job then checks that the
 * merged total equals the listed total, so a unit that fell between shards fails CI
 * rather than quietly shrinking the count (CLAUDE.md 11i).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WEB = resolve(import.meta.dirname, '..');
const [shardArg, totalArg, outFile] = process.argv.slice(2);
const shard = Number(shardArg);
const total = Number(totalArg);
if (!Number.isInteger(shard) || !Number.isInteger(total) || shard < 1 || shard > total || !outFile) {
  console.error('usage: node scripts/e2e-shard.mjs <shard> <total> <out-file>');
  process.exit(2);
}

const DEFAULT_SECONDS = 3;
const SEP = ' › ';

/** Every test, with the file it lives in and its describe › title path. */
export function listTests() {
  // One command string under a shell (not file + args), which Node's DEP0190 asks for.
  const raw = execSync('pnpm exec playwright test --list --reporter=json', {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const json = JSON.parse(raw.slice(raw.indexOf('{')));
  const tests = [];
  const walk = (suite, titles, file) => {
    for (const spec of suite.specs ?? []) {
      for (let i = 0; i < spec.tests.length; i++) {
        tests.push({ file: `e2e/${spec.file}`, titles: [...titles, spec.title] });
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title], file);
  };
  // The top-level suites are files; their title is the file name, not a describe.
  for (const fileSuite of json.suites) walk(fileSuite, [], fileSuite.file);
  return tests;
}

/**
 * May this spec's tests run apart from one another?
 *
 * Yes if the file declares `mode: 'parallel'`, or if it shares NOTHING between tests:
 * no `beforeAll`/`afterAll` (per-file setup such as a throwaway account), no
 * `mode: 'serial'` (declared order), and no top-level `let` (state one test leaves
 * for the next). `beforeEach` is per test and fine. Anything else stays whole — the
 * cost of a wrong "yes" is an order-dependent failure nobody can reproduce, the cost of
 * a wrong "no" is a few seconds of balance.
 */
function splitsPerTest(file) {
  const src = readFileSync(join(WEB, file), 'utf8');
  if (/mode:\s*'serial'/.test(src)) return false;
  if (/^test\.describe\.configure\(\{\s*mode:\s*'parallel'\s*\}\);/m.test(src)) return true;
  return !/beforeAll|afterAll|^let |^export let /m.test(src);
}

const tests = listTests();
const timingsPath = join(WEB, 'e2e', 'timings.json');
const timings = existsSync(timingsPath) ? JSON.parse(readFileSync(timingsPath, 'utf8')) : {};
const secondsOf = (t) => timings[`${t.file}${SEP}${t.titles.join(SEP)}`] ?? DEFAULT_SECONDS;

// A title containing the delimiter could not be selected unambiguously by a
// test list; refuse rather than run the wrong tests.
for (const t of tests) {
  if (t.titles.some((x) => x.includes('›'))) {
    console.error(`a test title contains "›", which a --test-list cannot express: ${t.file} › ${t.titles.join(' › ')}`);
    process.exit(1);
  }
}

const perTestFiles = new Map();
const units = new Map();
for (const t of tests) {
  if (!perTestFiles.has(t.file)) perTestFiles.set(t.file, splitsPerTest(t.file));
  const key = perTestFiles.get(t.file) ? `${t.file}${SEP}${t.titles.join(SEP)}` : t.file;
  const u = units.get(key) ?? { key, seconds: 0, count: 0 };
  u.seconds += secondsOf(t);
  u.count += 1;
  units.set(key, u);
}

// Largest first; ties broken by key so every shard agrees on the order.
const ordered = [...units.values()].sort((a, b) => b.seconds - a.seconds || a.key.localeCompare(b.key));
const shards = Array.from({ length: total }, () => ({ seconds: 0, count: 0, keys: [] }));
for (const u of ordered) {
  let lightest = 0;
  for (let i = 1; i < total; i++) if (shards[i].seconds < shards[lightest].seconds) lightest = i;
  shards[lightest].seconds += u.seconds;
  shards[lightest].count += u.count;
  shards[lightest].keys.push(u.key);
}

const mine = shards[shard - 1];
// ⚠️ A test list names files relative to `testDir` (`e2e/`), not to `web/` — with the
// prefix Playwright matches NOTHING and reports "0 tests", which would pass (measured).
const toListEntry = (key) => key.replace(/^e2e\//, '');
writeFileSync(outFile, mine.keys.map(toListEntry).join('\n') + '\n', 'utf8');
console.log(`e2e-shard: ${tests.length} tests in ${units.size} units over ${total} shards`);
shards.forEach((s, i) =>
  console.log(`  shard ${i + 1}: ${String(s.count).padStart(4)} tests, ~${Math.round(s.seconds)}s of work${i + 1 === shard ? '   ← this one' : ''}`),
);
