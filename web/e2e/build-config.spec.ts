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
