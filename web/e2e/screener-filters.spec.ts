import { test, expect } from '@playwright/test';

import { buildRows, type ResultRow } from '../components/results/columns';
import {
  advRulesPass,
  applyFilters,
  defaultRule,
  firstAvailableField,
  INITIAL_FILTER,
  type AdvRule,
} from '../components/results/filters';

/**
 * An EMPTY advanced-filter rule must not remove any row.
 *
 * `/results` lets a subscriber stack rules — field, operator, value — and the
 * table updates live. Adding a rule creates it with the value box blank, and the
 * user then picks the field they care about before typing anything. So there is
 * always a moment where a rule exists and states no criterion, and in that moment
 * the rule must be a no-op.
 *
 * It was not, for the numeric fields. `rulePasses()` tested the ROW's value for
 * null *before* it tested whether the user had typed anything, so a blank rule on
 * a nullable field silently deleted every row lacking that value — measured
 * 2026-09-04, finding 5A-107. The field list is full of nullable ones (Health,
 * Target, Upside%, P/E, PEG, ROE%, FCF Yld%, D/E…), and the first row to vanish
 * is always the **cycle-only** stock whose Financial Health we deliberately
 * withheld: a stock disappeared from a paid screen because we lack data on it,
 * at a moment the reader had asked for nothing.
 *
 * Nothing could see it. A filtered table looks exactly like a filtered table, the
 * count updates as though the rule worked, and the code's own comment on the line
 * below the bug asserted the opposite ("no value yet = no constraint (matches
 * between/categorical/text)") — categorical and text really did behave that way,
 * so the stated parity read as a description of all three branches. Same family as
 * CLAUDE.md 11c-iv: a rule that reached some of its consumers and not the rest.
 *
 * ⚠️ The load-bearing assertion here is not the empty case — a `rulePasses()` that
 * returned `true` unconditionally would sail through it. It is the CONTROL: a rule
 * with a value in it must STILL exclude nulls, because "P/E ≥ 10" excluding a
 * stock with no P/E is correct and must not be traded away to fix the blank case.
 *
 * Pure and credential-free (no browser, no network), so it runs on a fork PR and
 * can never self-skip — same posture as `export-parity.spec.ts`. The real
 * `advRulesPass`/`applyFilters`/`defaultRule` are imported, never re-implemented.
 */

const PARAMS = { pullbackThreshold: -5, profitThreshold: 5, lookbackBars: 252 };

/** A row with every scored field present, and one with the nullable ones absent. */
function rows(): ResultRow[] {
  const base = (ticker: string, health: number | null, pe: number | null): ResultRow =>
    buildRows(
      [
        {
          ticker,
          params: PARAMS,
          asOf: '2026-09-04',
          currentClose: 100,
          currentDrawdownPct: -8,
          currentProfitPct: 4,
          typicalDrawdown: -24,
          lowerBound: -40,
          typicalProfit: 30,
          upperBound: 55,
          totalPullbackEvents: 6,
          totalProfitEvents: 6,
          financialHealthScore: health,
          valuationScore: 55,
          valuationScoreRaw: 60,
          qualityFactor: health === null ? null : 0.9,
          valuationZone: 'FAIR',
          cyclePayoffScore: 50,
          overallRating: 62,
          overallLabel: 'Neutral',
          fhSubscores: {},
          ...(pe === null
            ? {}
            : {
                fundamentals: {
                  pe,
                  peg: null,
                  roe: null,
                  grossMargin: null,
                  netMargin: null,
                  fcfYieldPct: null,
                  debtToEquity: null,
                  currentRatio: null,
                  interestCoverage: null,
                  revenueGrowthYoy: null,
                  shortPctOfFloat: null,
                  shortRatio: null,
                  analystTargetPrice: null,
                  analystRecommendation: null,
                  numAnalystOpinions: null,
                },
              }),
        },
      ],
      { [ticker]: { name: ticker, sector: 'Technology', market: 'us' } },
    )[0]!;

  return [
    base('FULL', 83, 22.5),
    // The withheld state the product really produces: fewer than 3 of 5 Financial
    // Health pillars available, so the score is null and fundamentals never arrived.
    base('CYCLEONLY', null, null),
  ];
}

const rule = (over: Partial<AdvRule>): AdvRule =>
  ({ id: 1, field: 'health', type: 'numeric', op: 'gte', value: '', ...over }) as AdvRule;

/** Every nullable numeric field a reader can pick from the field dropdown. */
const NULLABLE_NUMERIC = ['health', 'pe', 'peg', 'roe', 'fcfYield', 'de', 'target', 'upside'];

test.describe('advanced filters', () => {
  test('a blank numeric rule removes nothing — on every nullable field', () => {
    const all = rows();
    for (const field of NULLABLE_NUMERIC) {
      for (const op of ['gte', 'lte'] as const) {
        const kept = all.filter((r) => advRulesPass(r, [rule({ field, op, value: '' })]));
        expect(kept.map((r) => r.ticker), `${field} ${op} (blank)`).toEqual([
          'FULL',
          'CYCLEONLY',
        ]);
      }
      // "between" with either bound missing is equally not a criterion.
      for (const value of [['', ''], ['10', ''], ['', '10']] as const) {
        const kept = all.filter((r) =>
          advRulesPass(r, [rule({ field, op: 'between', value: [...value] })]),
        );
        expect(kept.map((r) => r.ticker), `${field} between ${JSON.stringify(value)}`).toEqual([
          'FULL',
          'CYCLEONLY',
        ]);
      }
    }
  });

  test('CONTROL — a rule that states a criterion still excludes rows with no value', () => {
    const all = rows();
    // Without this the fix could be "always return true", which would pass the
    // test above and destroy the feature.
    expect(
      all.filter((r) => advRulesPass(r, [rule({ field: 'health', op: 'gte', value: '0' })])).map(
        (r) => r.ticker,
      ),
      'health >= 0 must drop the row that has no health score',
    ).toEqual(['FULL']);

    expect(
      all
        .filter((r) => advRulesPass(r, [rule({ field: 'pe', op: 'lte', value: '999' })]))
        .map((r) => r.ticker),
      'pe <= 999 must drop the row that has no P/E',
    ).toEqual(['FULL']);

    expect(
      all
        .filter((r) =>
          advRulesPass(r, [rule({ field: 'health', op: 'between', value: ['0', '100'] })]),
        )
        .map((r) => r.ticker),
      'health between 0 and 100 must drop the row that has no health score',
    ).toEqual(['FULL']);

    // And it must still filter on the value, not merely on presence.
    expect(
      all
        .filter((r) => advRulesPass(r, [rule({ field: 'health', op: 'gte', value: '90' })]))
        .map((r) => r.ticker),
      'health >= 90 excludes the 83',
    ).toEqual([]);
  });

  test('the three rule types agree about a blank value', () => {
    const all = rows();
    const blanks: AdvRule[] = [
      rule({ field: 'health', type: 'numeric', op: 'gte', value: '' }),
      rule({ field: 'sector', type: 'categorical', op: 'isany', value: [] }),
      rule({ field: 'ticker', type: 'text', op: 'contains', value: '' }),
    ];
    for (const r of blanks) {
      expect(all.filter((row) => advRulesPass(row, [r])).length, `${r.type} blank`).toBe(2);
    }
    // All three at once is still no constraint.
    expect(all.filter((row) => advRulesPass(row, blanks)).length).toBe(2);
  });

  test('clicking "+ Add filter" repeatedly never removes a row', () => {
    const all = rows();
    let rules: AdvRule[] = [];
    for (let click = 1; click <= 5; click += 1) {
      rules = [...rules, defaultRule(firstAvailableField(rules))];
      const kept = applyFilters(all, { ...INITIAL_FILTER, rules });
      expect(kept.length, `after ${click} click(s) on "+ Add filter"`).toBe(2);
    }
  });
});
