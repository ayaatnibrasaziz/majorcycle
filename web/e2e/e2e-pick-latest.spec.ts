import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * CI's merge job must merge each shard's LATEST attempt (scripts/e2e-pick-latest.mjs).
 *
 * The fixture is run 36238576004 as it really was: shards 1, 2, 4, 5, 7 and 10 failed
 * and were re-run, the other four were kept. Before the fix the merge took shards 1, 4
 * and 5 from the failed first attempt and went red with every shard green.
 */

const SCRIPT = resolve(__dirname, '..', 'scripts', 'e2e-pick-latest.mjs');
const RERUN = new Set([1, 2, 4, 5, 7, 10]);

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pick-latest-'));
  for (let shard = 1; shard <= 10; shard++) {
    for (const attempt of RERUN.has(shard) ? [1, 2] : [1]) {
      const d = join(dir, 'in', `blob-report-${shard}-attempt-${attempt}`);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, `report-${shard}${attempt}.zip`), `shard ${shard} attempt ${attempt}`);
    }
  }
  return dir;
}

test('a re-run shard is merged from its re-run, a kept shard from its only run', () => {
  const dir = fixture();
  try {
    const out = execFileSync('node', [SCRIPT, join(dir, 'in'), join(dir, 'out')], { encoding: 'utf8' });
    const files = readdirSync(join(dir, 'out'));
    expect(files, 'one report per shard').toHaveLength(10);
    for (let shard = 1; shard <= 10; shard++) {
      const want = RERUN.has(shard) ? 2 : 1;
      const file = files.find((f) => f.startsWith(`shard-${shard}-`))!;
      expect(readFileSync(join(dir, 'out', file), 'utf8'), `shard ${shard}`).toBe(`shard ${shard} attempt ${want}`);
      expect(out).toContain(`shard ${shard}: attempt ${want}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('attempts compare as NUMBERS — attempt 10 beats attempt 9', () => {
  // A string comparison would pick "9" over "10"; so would sorting the folder names.
  const dir = mkdtempSync(join(tmpdir(), 'pick-latest-'));
  try {
    for (const attempt of [9, 10]) {
      const d = join(dir, 'in', `blob-report-3-attempt-${attempt}`);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'report.zip'), String(attempt));
    }
    execFileSync('node', [SCRIPT, join(dir, 'in'), join(dir, 'out')]);
    expect(readFileSync(join(dir, 'out', 'shard-3-report.zip'), 'utf8')).toBe('10');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an artifact it does not recognise stops the merge rather than being skipped', () => {
  // An old-style `blob-report-4` (no attempt) would otherwise be silently left out,
  // and the merge check would then report a missing shard for the wrong reason.
  const dir = fixture();
  try {
    mkdirSync(join(dir, 'in', 'blob-report-4'));
    expect(() =>
      execFileSync('node', [SCRIPT, join(dir, 'in'), join(dir, 'out')], { stdio: 'pipe' }),
    ).toThrow(/not a shard report: blob-report-4/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
