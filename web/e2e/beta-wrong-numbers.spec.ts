import { expect, test } from '@playwright/test';

import { CSV_COLUMNS, formatValue, type ResultRow } from '../components/results/columns';
import { insiderTotals } from '../lib/insiderSentiment';
import { holdersWorthShowing } from '../lib/ownership';
import { exportText, healthColor, healthRatingLabel, tierFromScore, toCsv, valuationAppealLabel } from '../lib/ratings';
import { relativeRows } from '../lib/relativePerformance';
import { bestStrength, healthSentence, HEALTH_PILLARS, topRisk, weakPillars, type HealthSubscores } from '../lib/thesisText';
import type { FundamentalsSnapshot, InsiderTransaction, PriceBar } from '../lib/types';
import { cellValue } from '../lib/xlsx';

/**
 * The "wrong numbers" found by the pre-launch beta review (docs/beta-review/README.md),
 * each fixed on the owner's instruction of 2026-09-28. Pure and credential-free.
 * Every example is a real stock's figures from the review.
 */

const F = (over: Partial<FundamentalsSnapshot>): FundamentalsSnapshot => over as FundamentalsSnapshot;

test.describe('#2 a loss is not a thin margin', () => {
  test('Moderna (−141%) is loss-making; a 3% margin is still thin', () => {
    expect(topRisk(F({ netMargin: -141.43 }), 20)).toBe('loss-making — net margin of -141.4%');
    expect(topRisk(F({ netMargin: 3 }), 20)).toContain('thin net margin of 3.0%');
    expect(topRisk(F({ netMargin: -0.1 }), 20)).toMatch(/^loss-making/);
  });
});

test.describe('#3 the health sentence cannot contradict the scorecard', () => {
  const ADAVALE: HealthSubscores = { profitability: 33.3, balanceSheet: 100, growth: 10, cashflow: 5, shareholder: 50 };

  test('Adavale names its genuinely weak areas, weakest first — never its Balance Sheet 100', () => {
    expect(healthSentence(42.8, F({}), ADAVALE)).toBe(
      'Financial health is stressed at 43/100 — weakest on Cash Flow (5) and Growth (10).',
    );
  });

  test('"the two lowest" is not the rule: a 50 and a 100 are not weak', () => {
    expect(weakPillars({ profitability: 30, balanceSheet: 100, growth: 50, cashflow: 100, shareholder: 100 })).toEqual([
      'Profitability (30)',
    ]);
    expect(healthSentence(45, F({}), { profitability: 50, balanceSheet: 100, growth: 60 })).toBe(
      'Financial health is stressed at 45/100.',
    );
    // 49.6 is printed as 50 on the scorecard, so it is not called weak either.
    expect(weakPillars({ growth: 49.6 })).toEqual([]);
  });

  test('sweep: no sentence ever names an area scored 50 or more, and no strength comes from a weak area', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 100;
    const strengthArea: Array<[RegExp, keyof HealthSubscores]> = [
      [/return on equity|gross margins|operating margins|net margins/, 'profitability'],
      [/free-cash-flow/, 'cashflow'],
      [/balance sheet/, 'balanceSheet'],
      [/revenue growth/, 'growth'],
    ];
    const f = F({ roe: 30, fcfYieldPct: 8, debtToEquity: 0.2, grossMargin: 70, revenueGrowthYoy: 25, operatingMargin: 25, netMargin: 15 });
    for (let i = 0; i < 2000; i++) {
      const sub: HealthSubscores = {};
      for (const p of HEALTH_PILLARS) if (rnd() > 10) sub[p.key] = rnd();
      const hs = rnd();
      const text = healthSentence(hs, f, sub);
      for (const p of HEALTH_PILLARS) {
        const v = sub[p.key];
        if (v != null && Math.round(v) >= 50) expect(text, JSON.stringify({ hs, sub })).not.toContain(`${p.label} (`);
      }
      const strength = bestStrength(f, sub);
      for (const [re, key] of strengthArea) {
        const v = sub[key];
        if (re.test(strength) && v != null) expect(Math.round(v), strength).toBeGreaterThanOrEqual(50);
      }
    }
  });
});

test.describe('#4 prices: screen and both downloads agree, at the precision a small price needs', () => {
  const cases: Array<[number, string, string]> = [
    [0.365, '0.365', 'A$0.365'], // AOF.AX: was "$0.36" on screen and 0.37 in the files
    [0.041, '0.041', 'A$0.041'], // ADD.AX: was "$0.04"
    [1.08, '1.08', 'A$1.08'], //    PAR target: was "$1"
    [65.755, '65.76', 'A$65.76'], // the half-cent case the parity guard was built on
    [150.83, '150.83', 'A$150.83'],
  ];
  for (const [v, file, screen] of cases) {
    test(`${v} → file ${file}, screen ${screen}`, () => {
      expect(exportText(v, 'price')).toBe(file);
      expect(cellValue(v, 'price')).toBe(Number(file));
      expect(formatValue(v, 'price', { currency: 'AUD' })).toBe(screen);
    });
  }
  test('the home currency, never a bare $', () => {
    expect(formatValue(201.2, 'price', { currency: 'CAD' })).toBe('CA$201.20');
    expect(formatValue(341.07, 'price', { currency: 'USD' })).toBe('$341.07');
  });
});

test.describe('#6 a label follows the number printed beside it', () => {
  test('79.6 prints as 80, so it is Healthy — on screen, in colour and in the export', () => {
    expect(healthRatingLabel(79.6)).toBe('Healthy');
    expect(healthColor(79.6)).toBe(healthColor(80));
    expect(healthRatingLabel(79.4)).toBe('Adequate'); // CONTROL: prints 79
    expect(valuationAppealLabel(64.5)).toBe(valuationAppealLabel(65)); // CYL vs RMD
    expect(tierFromScore(64.4)).toBe(tierFromScore(64));
  });

  test('the CSV row says "80" and "Healthy" together', () => {
    const row = { ticker: 'META', name: 'Meta', sector: 'Tech', market: 'us', overallRating: 72, overallLabel: 'Constructive',
      valuationScore: 64.5, financialHealthScore: 79.6, cyclePayoffScore: 90, cyclePos: 20, valuationZone: 'VALUE', currentClose: 700 } as unknown as ResultRow;
    const cols = CSV_COLUMNS.filter((c) => ['Health Score', 'Health Rating', 'Valuation Score', 'Valuation Appeal'].includes(c.header));
    const [, line] = toCsv([row], cols).split('\n');
    // CSV_COLUMNS order: Valuation Score, Valuation Appeal, Health Score, Health Rating.
    expect(line).toBe(`65,${valuationAppealLabel(65)},80,Healthy`);
  });
});

test.describe('#7 every line in the relative-performance chart starts on the same date', () => {
  const series = (from: number, to: number, start = 10): Array<{ date: string; close: number }> =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ date: `${from + i}-06-30`, close: start * 1.1 ** i }));
  const stock = series(1980, 2026, 1).map((b) => ({ ...b, open: b.close, high: b.close, low: b.close, volume: 0 })) as PriceBar[];

  test('Max starts at the LATEST first date among the stock and the indices', () => {
    const { rows } = relativeRows(stock, { '^GSPC': series(2002, 2026), '^IXIC': series(2010, 2026), '^AXJO': series(2003, 2026) }, 'max');
    expect(new Date(rows[0]!.ts).getUTCFullYear()).toBe(2010);
    for (const t of ['^GSPC', '^IXIC', '^AXJO']) expect(rows[0]![t], t).toBeCloseTo(100, 6);
    expect(rows[0]!.stock).toBeCloseTo(100, 6);
  });

  test('CONTROL: an index that starts before the stock does not move the start', () => {
    const young = series(2015, 2026, 1).map((b) => ({ ...b, open: b.close, high: b.close, low: b.close, volume: 0 })) as PriceBar[];
    const { rows } = relativeRows(young, { '^GSPC': series(2002, 2026) }, 'max');
    expect(new Date(rows[0]!.ts).getUTCFullYear()).toBe(2015);
  });
});

test.describe('#9 the insider label states its period and totals', () => {
  const tx = (date: string, type: InsiderTransaction['type'], value: number | null): InsiderTransaction =>
    ({ date, type, value, insider: 'X', position: 'Director', text: '', shares: 1 });
  test('CSL: totals over EVERY filing on record, not the ten listed', () => {
    const txs = [
      ...Array.from({ length: 10 }, (_, i) => tx(`2026-08-${String(21 - i).padStart(2, '0')}`, 'Purchase', 36096)),
      tx('2025-03-01', 'Sale', 756027),
      tx('2024-10-31', 'Purchase', 32000),
      tx('2025-01-01', 'Award', null),
    ];
    const t = insiderTotals(txs)!;
    expect(t.sold).toBe(756027);
    expect(t.bought).toBeCloseTo(360960 + 32000, 0);
    expect([t.from, t.to]).toEqual(['2024-10-31', '2026-08-21']);
  });
});

test.describe('#10 the holder table only when a holder owns 1% or more', () => {
  const h = (pct: number | null) => ({ holder: 'H', shares: 1, pct_out: pct, value: 1, date_reported: '2026-06-30' });
  test('BHP: three US funds at 0.00% — hidden; AAPL: BlackRock 7.97% — shown', () => {
    expect(holdersWorthShowing([h(0), h(0), h(0.0004)])).toBe(false);
    expect(holdersWorthShowing([h(0.0797), h(0.0657)])).toBe(true);
    expect(holdersWorthShowing([h(0.01)])).toBe(true); // the boundary counts
    expect(holdersWorthShowing([h(null), h(null)])).toBe(false);
  });
});
