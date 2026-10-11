import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { ZONE_DISPLAY, ZONE_ORDER } from '../lib/ratings';

/**
 * The four zones are named for what they measure — how far the price has fallen
 * against the stock's typical fall (owner-approved, 2026-10-03; beta review C-2 /
 * B-14 / F-4). One table names them; nothing else may.
 */

test('the four names, deepest first', () => {
  expect(ZONE_ORDER.map((z) => ZONE_DISPLAY[z])).toEqual(['Deep pullback', 'Pullback', 'Shallow dip', 'Near high']);
});

test('no surface still shows an old zone name', () => {
  // The old names, as a READER would have seen them (the stored codes are upper case
  // and stay). dev-fixtures is local-only and names everything by design (11p).
  const banned = [/Deep Value/, /\bStretched\b/, /\bFair\b(?= ·| →|')/];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== 'node_modules' && name !== 'dev-fixtures') walk(p);
      } else if (/\.tsx?$/.test(name)) {
        const code = readFileSync(p, 'utf8')
          .split('\n')
          .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
          .join('\n');
        for (const re of banned) if (re.test(code)) offenders.push(`${p}: ${re}`);
      }
    }
  };
  for (const root of ['components', 'app', 'lib']) walk(root);
  expect(offenders).toEqual([]);
});
