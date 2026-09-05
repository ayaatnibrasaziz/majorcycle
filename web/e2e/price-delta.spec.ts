import { expect, test } from '@playwright/test';

import { fmtPrice, fmtPriceDelta } from '../lib/format';

/**
 * A price CHANGE is shown at the precision of the price it came from.
 *
 * ⚠️ AUDIT 5A-111. The daily move went through `fmtPrice`, which picks decimal places from
 * the value's OWN magnitude — 2dp at $1 and above, 3dp between $0.10 and $1. That ladder is
 * right for a price (a stock trading at $0.52 deserves the extra place) and wrong for a
 * delta, because a delta is nearly always under $1 while the price above it is not.
 *
 * Measured on the live site: BHP rendered `A$63.78` with `+A$0.522` directly beneath it —
 * the only one of twenty money figures on the page carrying three decimals. The ASX quotes
 * BHP in cents; a fifth of a cent is precision we invented. It fires for any stock over $1
 * that moves less than $1 in a day, which is the ordinary case on nearly every page.
 *
 * ⚠️ The irony is the finding: `fmtPrice`'s own docblock says it exists "so a group of
 * related prices never mixes precision", and it produced exactly that mixing — because it
 * judged the change ALONE rather than as a member of the group it is displayed in. A rule
 * can be correct and still be applied to the wrong subject.
 *
 * Pure and credential-free: it imports the real formatters and never restates them.
 */

test.describe('price delta formatting', () => {
  test('a delta under $1 keeps the precision of the price it belongs to', () => {
    // The exact live case.
    expect(fmtPriceDelta(0.522, 63.78, 'AUD')).toBe('A$0.52');
    expect(fmtPrice(63.78, 'AUD')).toBe('A$63.78');

    // Same number of decimals as the price it sits under — the property that was broken.
    const decimals = (s: string) => (s.split('.')[1] ?? '').length;
    for (const [delta, price] of [
      [0.522, 63.78],
      [0.005, 12.5],
      [0.999, 250.0],
      [0.01, 1.0],
    ] as const) {
      expect(
        decimals(fmtPriceDelta(delta, price, 'USD')),
        `delta ${delta} under price ${price}`,
      ).toBe(decimals(fmtPrice(price, 'USD')));
    }
  });

  test('CONTROL — a genuinely small-priced stock still gets its extra places', () => {
    // Without this the "fix" could be a hard-coded 2dp, which would round a penny
    // stock's real move to nothing and destroy the behaviour fmtPrice was built for.
    expect(fmtPriceDelta(0.003, 0.42, 'USD')).toBe('$0.003');
    expect(fmtPriceDelta(0.0004, 0.05, 'USD')).toBe('$0.0004');
    // And the reference price's own formatting is untouched.
    expect(fmtPrice(0.42, 'USD')).toBe('$0.42');
  });

  test('CONTROL — currency and sign handling are unchanged', () => {
    expect(fmtPriceDelta(0.52, 63.78, 'CAD')).toBe('CA$0.52');
    expect(fmtPriceDelta(0.52, 63.78, 'USD')).toBe('$0.52');
    // Never fewer than 2 decimals, so a whole-cent move is not shown as "$1".
    expect(fmtPriceDelta(1, 63.78, 'USD')).toBe('$1.00');
  });
});
