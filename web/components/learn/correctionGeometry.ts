/**
 * The two imaginary companies behind "Dip, correction, crash".
 *
 * The article's whole argument is that one percentage means two different
 * things depending on whose record it sits in, so the figure has to show two
 * companies **at the identical depth** and let their own histories disagree.
 *
 * ⚠️ **Today's fall is CONSTRUCTED to be equal, not tuned until it looks equal.**
 * `endingAt()` computes the final vertex from the trailing-year peak, so both
 * panels land on exactly `TODAY_PCT` by arithmetic. Hand-placing two dots at
 * "about the same" height would make the comparison a promise nobody checks —
 * and the promise is the entire figure. `learn.spec.ts` asserts the two are
 * equal rather than trusting this paragraph.
 *
 * ⚠️ **Every other number is DERIVED, never typed** — each company's average
 * fall, its deepest ever, and how many falls it has had all come out of
 * `seriesStats` over its own drawdown curve, the same way the engine derives
 * them from a real record (`analytics/major_cycle.py`). The prose in the article
 * renders these same values, so a reshaped path restates the sentence instead of
 * quietly contradicting the picture (CLAUDE.md 11k, 11c-iii).
 *
 * ⚠️ **The algorithms are imported, not re-implemented.** `drawdownSeries`,
 * `seriesStats`, `peakYFrom` and `detailed` come from `drawdownGeometry.ts`, so
 * this article's figures and the drawdown article's figures cannot drift into
 * describing two different products. Only the PATHS are new here.
 */

import {
  type Point,
  WINDOW_SPAN,
  drawdownSeries,
  seriesStats,
} from './drawdownGeometry';

/** The depth both companies sit at today. One number, used by both panels. */
export const TODAY_PCT = -25;

/** The engine's threshold for "a fall worth counting" on the default horizon. */
const FALL_THRESHOLD = -5;

export interface PriceScale {
  readonly priceOf: (y: number) => number;
  readonly yOf: (price: number) => number;
}

/**
 * A linear y→price mapping over the full 0–100 canvas, and its inverse.
 *
 * ⚠️ The inverse is why this is a pair rather than a lone function. `endingAt`
 * has to go BACKWARDS — from a price it wants to the y that draws it — and a
 * second, separately-written conversion is exactly the drift 11c-iii warns
 * about. One scale, both directions, defined together.
 */
export function priceScale(topPrice: number, bottomPrice: number): PriceScale {
  const span = topPrice - bottomPrice;
  return {
    priceOf: (y) => topPrice - (y / 100) * span,
    yOf: (price) => ((topPrice - price) / span) * 100,
  };
}

/**
 * Close the path with a final point that sits exactly `targetPct` below the
 * highest price of the trailing window.
 *
 * The peak is read from the path itself, so reshaping the history moves today
 * with it and the panel stays honest without anyone remembering to re-tune.
 */
function endingAt(
  history: readonly Point[],
  targetPct: number,
  scale: PriceScale,
  spanX: number = WINDOW_SPAN.medium,
): readonly Point[] {
  // A placeholder low at x=100, so the window has a right edge while its peak is
  // measured. Deliberately below every historical point: today must never be the
  // peak it is being measured against.
  const floorY = Math.min(100, Math.max(...history.map((p) => p[1])) + 5);
  const probe: readonly Point[] = [...history, [100, floorY]];

  /**
   * ⚠️ **The peak is taken from `drawdownSeries`, not from `peakYFrom`.** The
   * first version used `peakYFrom`, which walks the path's VERTICES; the curve
   * is computed by sampling the path at fixed intervals. Those two disagree
   * whenever a peak vertex falls between samples — which it did: the high at
   * x=68 sat between samples at 67.5 and 68.33, so the series measured against a
   * slightly lower peak and the panel came out at **−23.5% while the label said
   * −25%**, with a second panel beside it at exactly −25%. A comparison figure
   * whose two halves are not actually comparable, and nothing errored.
   *
   * So the target is solved against the curve that will really be drawn: run the
   * series once, recover the peak price it used, and place today against THAT.
   * One iteration is exact, because the peak cannot depend on today's price.
   * This is 11c-iii — the second consumer has to consume the first's output.
   */
  const probeToday = drawdownSeries(probe, spanX, scale.priceOf).at(-1)?.pct ?? 0;
  const peakPrice = scale.priceOf(floorY) / (1 + probeToday / 100);
  return [...history, [100, scale.yOf(peakPrice * (1 + targetPct / 100))]];
}

export interface Company {
  readonly path: readonly Point[];
  readonly scale: PriceScale;
  readonly dd: readonly { readonly x: number; readonly pct: number }[];
  /** Its own average fall, deepest fall, and how many falls it has had. */
  readonly stats: ReturnType<typeof seriesStats>;
  /** Today, read OFF the curve — never the target it was built from. */
  readonly today: number;
}

function company(history: readonly Point[], scale: PriceScale): Company {
  const path = endingAt(history, TODAY_PCT, scale);
  const dd = drawdownSeries(path, WINDOW_SPAN.medium, scale.priceOf);
  return {
    path,
    scale,
    dd,
    stats: seriesStats(dd, FALL_THRESHOLD),
    // ⚠️ Read from the series, not from TODAY_PCT. If the construction above
    // ever stopped working, taking the target back out would report success
    // while the drawn curve ended somewhere else entirely — a guard the fix
    // makes structurally true is no guard at all (coding-standards §14 item 29).
    today: dd[dd.length - 1]?.pct ?? 0,
  };
}

/**
 * The routine faller: a wide trading range and falls of every size, including
 * one far deeper than today's.
 */
const ROUTINE_SCALE = priceScale(120, 40);
const ROUTINE_HISTORY: readonly Point[] = [
  [0, 34],
  [7, 14],
  [13, 42],
  [19, 24],
  [25, 50],
  [31, 33],
  [37, 50],
  [43, 16],
  [49, 82], // its worst ever, and much deeper than today
  [56, 30],
  [62, 55],
  [68, 26],
  [74, 60],
  [81, 36],
  [88, 54],
  [94, 40],
];

/**
 * The quiet one: a narrow range for years, then a fall unlike anything in its
 * record. Same depth as the other company's ordinary Tuesday.
 */
const QUIET_SCALE = priceScale(120, 88);
const QUIET_HISTORY: readonly Point[] = [
  [0, 30],
  [8, 10],
  [15, 30],
  [22, 12],
  [30, 50],
  [38, 8],
  [46, 28],
  [54, 6],
  [62, 45],
  [70, 4],
  [78, 33],
  [86, 10],
  [94, 26],
];

export const ROUTINE: Company = company(ROUTINE_HISTORY, ROUTINE_SCALE);
export const QUIET: Company = company(QUIET_HISTORY, QUIET_SCALE);

/**
 * The market's three conventional thresholds, in drawdown space.
 *
 * ⚠️ These ARE literals, and deliberately so — unlike our own settings, they
 * are not constants the product owns. They are journalistic convention, which
 * is the article's point, and there is nothing in the codebase to derive them
 * from. Writing them anywhere else would be inventing a false source of truth.
 */
export const MARKET_LEVELS = [
  { pct: -10, label: 'Correction' },
  { pct: -20, label: 'Crash / bear market' },
] as const;

/** A schematic index sliding through all three zones, for the first figure. */
export const MARKET_DD: readonly { readonly x: number; readonly pct: number }[] = [
  [0, 0],
  [6, -1.5],
  [12, -5.5],
  [18, -2],
  [24, -0.5],
  [31, -4],
  [38, -8.5],
  [45, -6],
  [52, -11.5],
  [59, -9],
  [66, -14],
  [73, -12],
  [80, -17.5],
  [87, -21],
  [93, -24],
  [100, -22],
].map(([x, pct]) => ({ x: x as number, pct: pct as number }));
