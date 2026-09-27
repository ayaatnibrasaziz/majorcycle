#!/usr/bin/env node
/**
 * Pick each shard's report from its LATEST attempt, so a re-run is merged correctly.
 *
 *     node scripts/e2e-pick-latest.mjs <downloaded-artifacts-dir> <out-dir>
 *
 * Each shard uploads `blob-report-<shard>-attempt-<n>`, and the merge job downloads
 * every one of them into its own folder. This copies, for each shard, only the report
 * from its highest attempt into <out-dir>, and prints which attempt it took.
 *
 * ⚠️ WHY (2026-09-26). `gh run rerun --failed` re-runs the failed shards and keeps
 * the passed ones. When every shard uploaded under the same name, the re-run shards
 * left TWO artifacts called `blob-report-N`, and download-artifact kept one per name
 * by artifact ID — which is not the order they were made in. Run 36238576004 merged
 * shards 1, 4 and 5 from the FAILED first attempt, so the merged count went red with
 * every shard green. Naming the attempt and choosing it here makes the choice ours.
 *
 * Choosing the highest attempt is safe on its own: a re-run shard that failed to
 * upload leaves only its older report here, but that shard's job is then red, and the
 * merge job already fails on any shard that did not succeed.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ARTIFACT = /^blob-report-(\d+)-attempt-(\d+)$/;

/** Map of shard → { attempt, dir } for the latest attempt of each shard. */
export function latestPerShard(names) {
  const unknown = names.filter((n) => !ARTIFACT.test(n));
  if (unknown.length) throw new Error(`not a shard report: ${unknown.join(', ')}`);
  const latest = new Map();
  for (const name of names) {
    const [, shard, attempt] = name.match(ARTIFACT).map(Number);
    if (!latest.has(shard) || attempt > latest.get(shard).attempt) latest.set(shard, { attempt, dir: name });
  }
  return latest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) {
    console.error('usage: node scripts/e2e-pick-latest.mjs <downloaded-artifacts-dir> <out-dir>');
    process.exit(2);
  }
  const latest = latestPerShard(readdirSync(src));
  mkdirSync(out, { recursive: true });
  for (const [shard, { attempt, dir }] of [...latest].sort((a, b) => a[0] - b[0])) {
    const zips = readdirSync(join(src, dir)).filter((f) => f.endsWith('.zip'));
    if (zips.length !== 1) {
      console.error(`shard ${shard}, attempt ${attempt}: expected 1 report, found ${zips.length}`);
      process.exit(1);
    }
    copyFileSync(join(src, dir, zips[0]), join(out, `shard-${shard}-${zips[0]}`));
    console.log(`shard ${shard}: attempt ${attempt}`);
  }
}
