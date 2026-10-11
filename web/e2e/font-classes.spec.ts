import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * The number face (JetBrains Mono, decision #26) must be asked for as a FONT FAMILY.
 *
 * ⚠️ Beta review E-14, fixed 2026-10-03: the class "font" + "[var(--font-mono)]" is
 * ambiguous to Tailwind v4, which compiles an arbitrary font value to a font-WEIGHT, so 22
 * places — the price in the stock header, the sidebar's plan badge, the 52-week gauge —
 * asked for the number face and drew Sora. Nothing errors and the page looks fine,
 * which is why it lived for months. The fix adds the "family-name:" type hint inside the
 * brackets, which compiles to `font-family`.
 *
 * ⚠️ Tailwind scans THIS file for class names too, so no complete class may be written
 * in it: a comment holding one with an ellipsis broke the whole stylesheet on 2026-10-03.
 *
 * A source-shape ban, credential-free: reads every component and route file.
 */
const ROOTS = ['components', 'app', 'lib'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : files(p);
    return /\.(tsx?|jsx?)$/.test(name) ? [p] : [];
  });
}

test('no bracketed var() font class without a family-name hint: Tailwind reads it as a weight', () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const f of files(root)) {
      // Comments may name the mistake (components/ui/button.tsx explains it); code may not.
      const code = readFileSync(f, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');
      if (/\bfont-\[var\(--font-[a-z]+\)\]/.test(code)) offenders.push(f);
    }
  }
  expect(offenders, 'add the family-name: type hint inside the brackets').toEqual([]);
});
