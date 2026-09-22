#!/usr/bin/env node
/**
 * Rebuild `e2e/timings.json` from a merged CI report.
 *
 *     node scripts/e2e-timings.mjs <merged.json> <out.json>
 *
 * `scripts/e2e-shard.mjs` balances shards with these durations. They go stale as tests
 * are added or get faster, which never breaks anything — a test with no entry counts
 * 3 s and the merge check still proves every test ran — it only lets the shards drift
 * out of balance. The `e2e-report` job writes a fresh file as an artifact on every run;
 * download it and commit it when the shard times in a run look uneven.
 *
 * Keyed exactly as the sharder reads them: `e2e/<file> › <describe…> › <title>`, in
 * seconds, from the LAST attempt of each test (a retried test's first try is not its
 * normal duration).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node scripts/e2e-timings.mjs <merged.json> <out.json>');
  process.exit(2);
}

const report = JSON.parse(readFileSync(input, 'utf8'));
const out = {};
const walk = (suite, titles, file) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const last = t.results?.[t.results.length - 1];
      if (!last) continue;
      out[`e2e/${file} › ${[...titles, spec.title].join(' › ')}`] = Math.round(last.duration / 100) / 10;
    }
  }
  for (const child of suite.suites ?? []) walk(child, [...titles, child.title], file);
};
for (const fileSuite of report.suites ?? []) walk(fileSuite, [], fileSuite.file);

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(output, JSON.stringify(sorted, null, 1) + '\n', 'utf8');
console.log(`e2e-timings: ${Object.keys(sorted).length} tests, ${Object.values(sorted).reduce((a, b) => a + b, 0).toFixed(0)} s total`);
