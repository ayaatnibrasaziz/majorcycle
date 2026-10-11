import { expect, test } from '@playwright/test';

import { annualDividendSeries, dividendStreak, lastDividendYear } from '../lib/dividends';

/**
 * Dividend History tells the truth about gap years and stopped payers (beta review
 * B-18, 2026-10-03). Pure and credential-free.
 */

test('a year with no payment is a year, not a missing column', () => {
  const s = annualDividendSeries(
    [
      { year: 1995, amount: 0.1 },
      { year: 1998, amount: 0.12 },
    ],
    2000,
  );
  expect(s.map((d) => d.year)).toEqual([1995, 1996, 1997, 1998, 1999]);
  expect(s.map((d) => d.amount)).toEqual([0.1, 0, 0, 0.12, 0]);
});

test('this year is left out — it holds only the payments made so far', () => {
  const s = annualDividendSeries([{ year: 2025, amount: 1 }, { year: 2026, amount: 0.3 }], 2026);
  expect(s).toEqual([{ year: 2025, amount: 1 }]);
});

test('a resumption after a gap is not growth', () => {
  // 1.0 → 0 → 1.2: the last year rose from zero, which is a restart, not a rise.
  expect(dividendStreak([{ year: 1, amount: 1 }, { year: 2, amount: 0 }, { year: 3, amount: 1.2 }])).toBe(0);
  // CONTROL: three rises in a row still count as three.
  expect(
    dividendStreak([
      { year: 1, amount: 1 },
      { year: 2, amount: 1.1 },
      { year: 3, amount: 1.2 },
      { year: 4, amount: 1.3 },
    ]),
  ).toBe(3);
});

test('a company that stopped paying ends on zero, and says when it last paid', () => {
  const s = annualDividendSeries([{ year: 2020, amount: 2 }, { year: 2021, amount: 2.1 }], 2026);
  expect(s[s.length - 1]).toEqual({ year: 2025, amount: 0 });
  expect(lastDividendYear(s)).toBe(2021);
  expect(lastDividendYear([])).toBeNull();
});
