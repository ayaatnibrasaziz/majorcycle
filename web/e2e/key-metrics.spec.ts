import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { PAYOUT_DISPLAY_CAP } from '../lib/dividends';
import {
  DAYS_TO_COVER_DECIMALS,
  KEY_METRICS,
  SHORT_PCT_DECIMALS,
  buildKeyMetricsTable,
  type MetricCategory,
  type MetricKey,
} from '../lib/keyMetrics';
import type { MedianTables } from '../lib/medians.server';
import type { FundamentalsSnapshot } from '../lib/types';

/**
 * Key Metrics — Layer H6a (2026-09-25). 13 rows → 25, in six groups.
 *
 * Pure: drives `buildKeyMetricsTable` — the function MetricsTable renders, and
 * nothing else — with a fixture. No server, no network, so it runs on a fork PR and
 * can never self-skip. (It cannot render the component itself: Playwright rewrites
 * JSX in anything a spec imports.) What it holds:
 *
 * - every row points at a field that exists, on BOTH sides of the pipeline — a
 *   misspelt key does not error, the row simply never appears (a compile-time
 *   check in lib/keyMetrics.ts covers the TypeScript half; this covers Python);
 * - the approved shape: which rows, in which order, in which group;
 * - the Risk rows carry NO better/worse verdict — with the control that every
 *   other row still does, because "no verdicts anywhere" passes the first half;
 * - a figure shown twice on one page reads the same both times (11c-iii).
 */

const ROOT = join(__dirname, '..', '..');

/** The approved design's row order (claude.ai/code/artifact/287083d9). */
const APPROVED: Array<[string, MetricCategory]> = [
  ['Trailing P/E', 'Valuation'],
  ['Forward P/E', 'Valuation'],
  ['PEG Ratio', 'Valuation'],
  ['Price / Book', 'Valuation'],
  ['Price / Sales', 'Valuation'],
  ['EV / EBITDA', 'Valuation'],
  ['EV / Revenue', 'Valuation'],
  ['FCF Yield', 'Valuation'],
  ['Gross Margin', 'Profitability'],
  ['EBITDA Margin', 'Profitability'],
  ['Operating Margin', 'Profitability'],
  ['Net Margin', 'Profitability'],
  ['FCF Margin', 'Profitability'],
  ['Return on Equity', 'Profitability'],
  ['Return on Assets', 'Profitability'],
  ['Revenue Growth', 'Growth'],
  ['Earnings Growth', 'Growth'],
  ['Debt / Equity', 'Balance Sheet'],
  ['Current Ratio', 'Balance Sheet'],
  ['Quick Ratio', 'Balance Sheet'],
  ['Payout Ratio', 'Shareholder'],
  ['Share Count change', 'Shareholder'],
  ['Beta', 'Risk'],
  ['Short % of Float', 'Risk'],
  ['Days to Cover', 'Risk'],
];

/** Apple's figures from the approved design (14 Sep 2026), plus a market median per
 *  metric set far enough away that every comparison is a real gap, not "in line". */
const VALUES: Record<MetricKey, number> = {
  pe: 38.15, forwardPe: 34.7, peg: 2.48, priceToBook: 45.15, priceToSales: 10.39,
  evToEbitda: 29, evToRevenue: 10.44, fcfYieldPct: 2.22, grossMargin: 48.65,
  ebitdaMargin: 35.98, operatingMargin: 32.62, netMargin: 27.62, fcfMarginPct: 23.08,
  roe: 148.75, roa: 27.08, revenueGrowthYoy: 16.4, earningsGrowthYoy: 28.7,
  debtToEquity: 0.78, currentRatio: 1, quickRatio: 0.81, payoutRatioPct: 12.04,
  sharesChangeYoyPct: -2.27, beta: 1.08, shortPctOfFloat: 0.96, shortRatio: 2.97,
};

function medians(): MedianTables {
  const market: MedianTables['market'][string] = {};
  for (const m of KEY_METRICS) market[m.key] = { median: VALUES[m.key] * 0.5 - 1, n: 500 };
  return { industry: {}, sector: {}, market: { us: market } };
}

function build(values: Partial<Record<MetricKey, number>> = VALUES) {
  return buildKeyMetricsTable({
    fundamentals: values as unknown as FundamentalsSnapshot,
    industry: null,
    sector: null,
    market: 'us',
    medians: medians(),
  });
}

/** Each row as a reader meets it: label, pill, value, and the "vs US" cell. */
function rows(values?: Partial<Record<MetricKey, number>>) {
  return build(values).rows.map((r) => ({
    label: r.def.label,
    cat: r.def.cat,
    value: r.disp,
    verdict: r.marketCmp.verdict,
    tip: r.marketCmp.tip,
    text: r.marketCmp.text,
  }));
}

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

test.describe('every row points at a real field', () => {
  test('each dbField is the snake_case of its key — the one conversion the pipeline does', () => {
    // The web app camel-cases the stored snake_case JSON; the medians read it raw.
    // If these two names ever stop being one conversion apart, the table and the
    // median it is compared with are reading different fields.
    for (const m of KEY_METRICS) expect(m.dbField, m.label).toBe(toSnake(m.key));
  });

  test('each dbField is declared in the Python field spec', () => {
    const spec = readFileSync(join(ROOT, 'analytics', 'providers', 'field_spec.py'), 'utf8');
    const declared = new Set([...spec.matchAll(/^\s+"(\w+)":\s+FieldSpec\(/gm)].map((m) => m[1]!));
    expect(declared.size, 'the field spec was not read').toBeGreaterThan(40);
    for (const m of KEY_METRICS) expect(declared.has(m.dbField), `${m.dbField} (${m.label})`).toBe(true);
  });
});

test.describe('the approved shape', () => {
  test('25 rows, in the approved order and groups', () => {
    const got = rows().map((r) => [r.label, r.cat]);
    expect(got).toEqual(APPROVED);
  });

  test('a metric with no value is OMITTED, not blanked — the Australian Risk group', () => {
    // Short interest is not published for ASX stocks (0 of 248). The group must
    // shrink to Beta alone rather than print two empty rows.
    const { shortPctOfFloat: _a, shortRatio: _b, ...au } = VALUES;
    const risk = rows(au).filter((r) => r.cat === 'Risk').map((r) => r.label);
    expect(risk).toEqual(['Beta']);
  });
});

test.describe('the Risk rows make no better/worse claim', () => {
  const all = rows();

  for (const label of ['Beta', 'Short % of Float', 'Days to Cover']) {
    test(`${label}: plain ink, and no "stronger/weaker" in its tooltip`, () => {
      const r = all.find((x) => x.label === label)!;
      expect(r.verdict).toBe('neutral');
      expect(r.tip).not.toMatch(/stronger|weaker|better|worse/i);
      expect(r.tip, 'the gap itself is still stated').toMatch(/above|below/);
    });
  }

  test('CONTROL — every other row still carries a verdict', () => {
    // "No verdicts anywhere" satisfies the three tests above perfectly, and would
    // strip the table of the one thing it exists to say.
    const judged = all.filter((r) => r.cat !== 'Risk');
    expect(judged).toHaveLength(22);
    for (const r of judged) {
      expect(['better', 'worse'], r.label).toContain(r.verdict);
      expect(r.tip, r.label).toMatch(/stronger than|weaker than/);
    }
  });

  test('the Shareholder rows judge in the direction the Health Score scores them', () => {
    // financial_health.py rewards a LOWER payout ratio and a FALLING share count.
    // A table calling either "weaker" where the score calls it stronger would have
    // the page contradict its own rating.
    const payout = all.find((r) => r.label === 'Payout Ratio')!; // 12.04 vs a 5.02 median
    const shares = all.find((r) => r.label === 'Share Count change')!; // −2.27 vs −2.135
    expect(payout.verdict).toBe('worse');
    expect(shares.verdict).toBe('better');
  });
});

test.describe('one figure, one reading', () => {
  test('Short % of Float and Days to Cover read the same here as in Short Interest', () => {
    const table = rows();
    expect(table.find((r) => r.label === 'Short % of Float')!.value).toBe(
      `${(0.96).toFixed(SHORT_PCT_DECIMALS)}%`,
    );
    expect(table.find((r) => r.label === 'Days to Cover')!.value).toBe((2.97).toFixed(DAYS_TO_COVER_DECIMALS));
    // …and the Short Interest section prints with the SAME constants, read from its
    // source with comments stripped. A literal `toFixed(2)` there would pass the
    // two assertions above and still let the sections drift apart.
    const src = readFileSync(join(__dirname, '..', 'components', 'stocks', 'ShortInterest.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).toContain('pct.toFixed(SHORT_PCT_DECIMALS)');
    expect(src).toContain('shortRatio.toFixed(DAYS_TO_COVER_DECIMALS)');
    expect(src, 'a hard-coded precision is back in Short Interest').not.toMatch(/toFixed\([12]\)%?/);
  });

  test('Payout Ratio is capped by the SAME constant as Dividend History', () => {
    const def = KEY_METRICS.find((m) => m.key === 'payoutRatioPct')!;
    expect(def.cap).toBe(PAYOUT_DISPLAY_CAP);
    const r = rows({ ...VALUES, payoutRatioPct: 450 }).find((x) => x.label === 'Payout Ratio')!;
    expect(r.value).toBe(`>+${PAYOUT_DISPLAY_CAP}%`);
  });
});

test('the Health Score pillar tooltips name only inputs the scoring really uses', () => {
  // Read with comments STRIPPED — the explanation of this fix quotes the old
  // phrases, and a guard reading its own documentation has caught this repo before.
  const src = readFileSync(join(__dirname, '..', 'components', 'stocks', 'SnowflakeRadar.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const phantom of ['operating leverage', 'operating cash conversion', 'payout consistency', 'dividend yield']) {
    expect(src.toLowerCase(), `claims "${phantom}", which financial_health.py never reads`).not.toContain(phantom);
  }
  // CONTROL: the real inputs of the two pillars that were wrong are named.
  for (const real of ['FCF margin', 'payout ratio', 'share count', 'Operating Margin']) {
    expect(src, real).toContain(real);
  }
});
