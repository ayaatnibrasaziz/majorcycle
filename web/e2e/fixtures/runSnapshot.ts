/**
 * A finished screener run, as the client stores it — so `/results` can be measured
 * with a full table rather than in its empty state.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * `/results` holds its rows client-side (AnalysisContext, mirrored to
 * sessionStorage) and never re-derives ratings on the server — CLAUDE.md #15. So a
 * cold navigation lands on the empty state, and a contrast or axe scan there
 * measures the chrome and none of the product: no score chips, no tier badges, no
 * composition bars, no Opportunity Map. Every assertion passes and nothing has been
 * looked at (14g).
 *
 * Driving a real run instead would need the Python function and a live provider —
 * minutes, flaky, and it would still not guarantee that all five tiers appear.
 *
 * ── Two things keep this from rotting ───────────────────────────────────────
 * 1. **It is typed as the real `RunResult`.** Add a field to `CycleAnalysis` and
 *    this file stops compiling, which is the only kind of reminder that works. A
 *    JSON blob would have gone quietly stale instead.
 * 2. **It imports `SNAPSHOT_KEY`** rather than restating `'mc:analysis-snapshot-v1'`.
 *    A hard-coded key seeds nothing the day the key changes, and the page then
 *    measured is the empty state — a green run over an empty page.
 *
 * ⚠️ The rows exist to exercise COLOUR, not to be plausible research. One stock per
 * rating tier, plus one with Financial Health withheld (the "cycle-only" row, which
 * renders a different badge and a muted Overall). Tickers are fictional so nobody
 * can mistake this for a real MajorCycle reading.
 */
import { SNAPSHOT_KEY } from '../../lib/analysis';
import type { CycleParams, OverallLabel, RunResult, ValuationZone } from '../../lib/types';

const PARAMS: CycleParams = { pullbackThreshold: -5, profitThreshold: 5, lookbackBars: 252 };

interface TierSpec {
  ticker: string;
  overallRating: number;
  overallLabel: OverallLabel;
  /** null exercises the withheld-Financial-Health row. */
  financialHealthScore: number | null;
  valuationScore: number;
  valuationZone: ValuationZone;
}

/**
 * One row per tier, top to bottom, so every `--c-tier-N` is drawn at least once —
 * as a chip background under white numerals, as a `.score-tag` word, and as a badge.
 * The scores sit mid-band rather than on a boundary, so a threshold tweak does not
 * silently move a row into a neighbouring colour and stop testing the one it names.
 */
const TIERS: TierSpec[] = [
  { ticker: 'AAAA', overallRating: 88, overallLabel: 'High Conviction', financialHealthScore: 91, valuationScore: 84, valuationZone: 'DEEP VALUE' },
  { ticker: 'BBBB', overallRating: 72, overallLabel: 'Constructive', financialHealthScore: 74, valuationScore: 70, valuationZone: 'VALUE' },
  { ticker: 'CCCC', overallRating: 57, overallLabel: 'Neutral', financialHealthScore: 63, valuationScore: 55, valuationZone: 'FAIR' },
  { ticker: 'DDDD', overallRating: 42, overallLabel: 'Cautious', financialHealthScore: 48, valuationScore: 40, valuationZone: 'STRETCHED' },
  { ticker: 'EEEE', overallRating: 24, overallLabel: 'Bearish', financialHealthScore: 31, valuationScore: 22, valuationZone: 'STRETCHED' },
  // Financial Health withheld — de-ranked, muted Overall, "Cycle-only" badge.
  { ticker: 'FFFF', overallRating: 61, overallLabel: 'Neutral', financialHealthScore: null, valuationScore: 58, valuationZone: 'FAIR' },
];

function row(spec: TierSpec): RunResult {
  return {
    ticker: spec.ticker,
    params: PARAMS,
    asOf: '2026-08-21',

    currentClose: 100 + spec.overallRating,
    currentDrawdownPct: -(5 + spec.overallRating / 5),
    currentProfitPct: 3.2,

    typicalDrawdown: -14.5,
    lowerBound: -38.2,
    typicalProfit: 11.4,
    upperBound: 26.8,
    totalPullbackEvents: 42,
    totalProfitEvents: 51,

    financialHealthScore: spec.financialHealthScore,
    valuationScore: spec.valuationScore,
    valuationScoreRaw: spec.valuationScore + 4,
    qualityFactor: spec.financialHealthScore == null ? null : 0.94,
    valuationZone: spec.valuationZone,
    cyclePayoffScore: 65,
    overallRating: spec.overallRating,
    overallLabel: spec.overallLabel,

    fhSubscores:
      spec.financialHealthScore == null
        ? {}
        : {
            profitability: spec.financialHealthScore,
            balanceSheet: spec.financialHealthScore - 6,
            growth: spec.financialHealthScore + 3,
            cashflow: spec.financialHealthScore - 2,
            shareholder: spec.financialHealthScore - 11,
          },
  };
}

export const RUN_SNAPSHOT = {
  results: TIERS.map(row),
  unavailable: ['GGGG'],
  params: { tickers: TIERS.map((t) => t.ticker), preset: 'medium' as const },
  runMeta: {
    startedAt: '2026-08-21T00:00:00.000Z',
    finishedAt: '2026-08-21T00:00:12.000Z',
    tickerCount: TIERS.length,
  },
};

/** How many rows the seeded table must show — the positive control for a scan. */
export const RUN_SNAPSHOT_ROWS = TIERS.length;

export { SNAPSHOT_KEY };
