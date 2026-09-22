#!/usr/bin/env node
/**
 * The ONE count for a sharded E2E run, and the proof that it is the whole suite.
 *
 *     node scripts/e2e-merge-check.mjs <merged.json> <blob-dir>
 *
 * The expected number of shards is READ from `ci.yml`'s matrix rather than passed in,
 * so there is one place that says how many shards there are.
 *
 * ⚠️ WHY THIS EXISTS (2026-09-22). The first sharded run merged five shards' results,
 * printed a clean summary and went GREEN — while shard 3 had failed to start and
 * contributed nothing. A merged total with a shard missing is a smaller suite that
 * reports like a passing one: CLAUDE.md 11i ("reconcile the COUNT, not the colour")
 * and 14g ("unmeasurable counted as clean") at once. So the verdict is not "did the
 * merge print passed" but three facts, each checked:
 *
 *   1. every shard delivered a report;
 *   2. the merged total equals the number of tests the suite LISTS;
 *   3. nothing failed.
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [mergedPath, blobDir] = process.argv.slice(2);
const WEB = resolve(import.meta.dirname, '..');

const problems = [];

const ci = readFileSync(resolve(WEB, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
const matrix = ci.match(/^\s+shard:\s*\[([^\]]+)\]/m);
const expectedShards = matrix ? matrix[1].split(',').length : NaN;
if (!Number.isFinite(expectedShards)) problems.push('could not read the shard matrix from ci.yml');

const blobs = readdirSync(blobDir).filter((f) => f.endsWith('.zip'));
if (blobs.length !== expectedShards) {
  problems.push(`${blobs.length} of ${expectedShards} shards delivered a report (${blobs.join(', ') || 'none'})`);
}

const { stats } = JSON.parse(readFileSync(mergedPath, 'utf8'));
const ran = stats.expected + stats.unexpected + stats.flaky + stats.skipped;

const listing = execSync('pnpm exec playwright test --list', { cwd: WEB, encoding: 'utf8' });
const listed = Number(listing.match(/Total: (\d+) tests?/)?.[1] ?? NaN);
if (!Number.isFinite(listed)) problems.push('could not read the listed test total');
else if (ran !== listed) problems.push(`the shards ran ${ran} tests but the suite lists ${listed}`);

if (stats.unexpected > 0) problems.push(`${stats.unexpected} test(s) failed`);

console.log(
  `E2E, all shards: ${ran} of ${listed} listed — ${stats.expected} passed, ` +
    `${stats.flaky} flaky, ${stats.unexpected} failed, ${stats.skipped} skipped`,
);
if (stats.flaky > 0) console.log('  ⚠️  flaky is a finding, not noise (CLAUDE.md 11i) — the titles are above.');
if (problems.length) {
  for (const p of problems) console.error(`  ✘ ${p}`);
  process.exit(1);
}
