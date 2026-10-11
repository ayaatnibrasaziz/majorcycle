import { expect, test } from '@playwright/test';
import type { IChartApi, Time } from 'lightweight-charts';

import { edgeSafeTickFormatter, timeToSeconds } from '../lib/chartTicks';
import { makeCompactAxisFormatter, niceZeroAxis, printedDifference } from '../lib/format';
import { newestFirst } from '../lib/newsOrder';
import { bestStrength } from '../lib/thesisText';
import type { FundamentalsSnapshot } from '../lib/types';

/**
 * Rules from the visual audit of 2026-10-07 — each one a thing a screenshot showed
 * wrong. Pure: no browser, no network.
 */

test('the balance-sheet axis counts in even, round steps and labels them exactly', () => {
  // Moderna's assets topped out near $25.3B: Recharts drew 0 / 6.5 / 13 / 19.5 / 26
  // and the whole-number labels printed "$7B / $13B / $20B / $26B".
  const axis = niceZeroAxis(25.3e9);
  expect(axis.ticks).toEqual([0, 10e9, 20e9, 30e9]);
  const fmt = makeCompactAxisFormatter(axis.top, 'USD', axis.ticks[1]);
  expect(axis.ticks.map(fmt)).toEqual(['$0', '$10B', '$20B', '$30B']);
  // A half step keeps its decimal rather than rounding it away.
  const half = niceZeroAxis(9.6e9);
  expect(half.ticks).toEqual([0, 2.5e9, 5e9, 7.5e9, 10e9]);
  expect(half.ticks.map(makeCompactAxisFormatter(half.top, 'USD', half.ticks[1]))).toEqual([
    '$0', '$2.5B', '$5.0B', '$7.5B', '$10.0B',
  ]);
  // Every tick is an exact multiple of the step, and the top covers the data.
  for (const max of [1, 3.7, 26, 410, 9999]) {
    const a = niceZeroAxis(max);
    const step = a.ticks[1]!;
    expect(a.top, String(max)).toBeGreaterThanOrEqual(max);
    a.ticks.forEach((t, i) => expect(t, `${max} tick ${i}`).toBeCloseTo(i * step, 6));
  }
});

test('alpha is the gap between the two returns as printed', () => {
  // Apple's strip printed +30.2% and +15.3% beside an alpha of +14.8%, from raw values
  // like 30.16 and 15.34 (raw gap 14.82). The reader's subtraction is the one that counts.
  expect(printedDifference(30.2449, 15.3449)).toBe(14.9);
  expect(printedDifference(30.16, 15.34)).toBe(14.9);
  expect(printedDifference(-2.04, 3.06)).toBe(-5.1);
  expect(printedDifference(1, 1)).toBe(0);
});

test('news reads newest first, and an undated story goes last', () => {
  const item = (title: string, publishedAt: string) => ({ title, url: '#', source: 's', publishedAt });
  const order = newestFirst([
    item('a', '2026-09-30T10:00:00Z'),
    item('b', 'not a date'),
    item('c', '2026-10-01T09:00:00Z'),
    item('d', '2026-10-01T15:00:00Z'),
  ]).map((n) => n.title);
  expect(order).toEqual(['d', 'c', 'a', 'b']);
});

test('a date label at the chart’s right edge is left blank; every other keeps its default', () => {
  const range = { from: '2025-10-06' as Time, to: '2026-10-06' as Time };
  const chart = { timeScale: () => ({ getVisibleRange: () => range }) } as unknown as IChartApi;
  const fmt = edgeSafeTickFormatter(() => chart);
  // The lone "5" the 1-year chart ended with: 1 day from the edge of a 365-day span.
  expect(fmt('2026-10-05' as Time, 3, 'en')).toBe('');
  // CONTROL: a label well inside the chart is left to the library.
  expect(fmt('2026-09-01' as Time, 1, 'en')).toBeNull();
  expect(fmt('2026-03-01' as Time, 1, 'en')).toBeNull();
  // No chart yet (during creation): never blank anything.
  expect(edgeSafeTickFormatter(() => null)('2026-10-05' as Time, 3, 'en')).toBeNull();
  // All three Time shapes read the same instant.
  const s = timeToSeconds('2026-10-05' as Time);
  expect(timeToSeconds({ year: 2026, month: 10, day: 5 } as Time)).toBe(s);
  expect(timeToSeconds(s as Time)).toBe(s);
});

test('"fortress balance sheet" only where the Balance Sheet pillar agrees', () => {
  // Moderna: D/E 0.19 beside a Balance Sheet pillar of 68.
  const f = { debtToEquity: 0.19 } as unknown as FundamentalsSnapshot;
  expect(bestStrength(f, { balanceSheet: 68 })).toBe('little debt (D/E 0.19)');
  expect(bestStrength(f, { balanceSheet: 92 })).toBe('a fortress balance sheet (D/E 0.19)');
  // No pillar to check: no fortress claim.
  expect(bestStrength(f)).toBe('little debt (D/E 0.19)');
});
