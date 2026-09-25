import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * Production builds must compile from scratch — `next.config.ts` says why.
 *
 * On 2026-09-25 a merge reached the live site with its new page text and its OLD
 * stylesheet: Vercel restored the previous deployment's `.next/cache`, Turbopack's
 * build cache (on by default since Next 16.3) handed back the stale CSS, and every
 * check was green because CI always builds from a clean checkout. So this cannot be
 * proven by building here; what CAN be held is the setting that prevents it.
 */

function configSource(): string {
  return readFileSync(join(__dirname, '..', 'next.config.ts'), 'utf8')
    // Comments stripped, so the paragraph explaining the rule cannot satisfy it.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('the Turbopack build cache is switched OFF, explicitly', () => {
  const src = configSource();
  // Explicit, because the default is ON — deleting the line must fail this test.
  expect(src).toMatch(/turbopackFileSystemCacheForBuild:\s*false\b/);
  expect(src).not.toMatch(/turbopackFileSystemCacheForBuild:\s*(true|process\.)/);
});

/**
 * The screener's time limits — `vercel.json` cannot hold a comment, so the reason
 * lives here.
 *
 * On 2026-09-25 the owner's screen of 760 stocks "took ages and did not work": six
 * batches answered 504 at exactly 60 seconds. Measured the same afternoon, the same
 * screen took 38s with the database idle, 155s while the (GitHub-delayed) nightly
 * refresh was writing, and failed outright while a CI run was also hitting the one
 * database. The code was not slower; the batches were waiting on a busy database, and
 * at 60s a slow batch was killed and retried into the same wall.
 *
 * On Vercel Hobby with Fluid compute the ceiling is 300s, and a function waiting on
 * I/O is not billed for CPU, so a slow batch should FINISH rather than fail. The
 * screener's own retry and reconciliation passes stay as the second line.
 */
test('the screener may run to the plan maximum, and the stock page gets a minute', () => {
  const cfg = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf8')) as {
    functions: Record<string, { maxDuration?: number }>;
  };
  // Exactly 300: more is refused by Hobby at deploy time; less brings the 504s back.
  expect(cfg.functions['api/analyze.py']?.maxDuration).toBe(300);
  expect(cfg.functions['api/cycle.py']?.maxDuration).toBeGreaterThanOrEqual(60);
  expect(cfg.functions['api/cycle.py']?.maxDuration).toBeLessThanOrEqual(300);
});
