/**
 * Geometry for "How long do recoveries actually take?".
 *
 * The article's answer is that there isn't one, so the figure has to make the
 * absence visible rather than describe it: **three identical falls, three
 * completely different waits.** Same depth, same starting point, and the only
 * thing that differs is horizontal distance — which is exactly the axis nobody
 * looks at.
 *
 * ⚠️ **The three troughs are the SAME number, by construction.** Each path is
 * built from one shared `TROUGH_PCT` rather than three hand-placed lows, because
 * the comparison only means anything if the depths are genuinely equal. Three
 * dots at "about the same height" would look identical and prove nothing —
 * `learn.spec.ts` asserts they match to the decimal.
 *
 * ⚠️ **We do not hold this data, and the figure must not imply we do.** The
 * MajorCycle engine measures how FAR a share fell and how far it recovered; it
 * stores no durations at all (`CycleAnalysis` has `typicalDrawdown` and
 * `typicalProfit`, and nothing about time). These three paths are therefore
 * explicitly illustrative, said in the caption in words — the alternative is a
 * reader assuming a chart drawn in our house style is a chart of our data.
 */

export interface DdPoint {
  readonly x: number;
  readonly pct: number;
}

/** The depth all three falls share. */
export const TROUGH_PCT = -40;

/** The plotted window, in years. Everything horizontal is read against this. */
export const SPAN_YEARS = 8;

/** Where the fall bottoms out, in years from the peak. Shared, like the depth. */
const TROUGH_YEAR = 0.7;

export interface Recovery {
  readonly id: string;
  /** How the article refers to it. */
  readonly label: string;
  /** Years from the peak until the price is back to it. */
  readonly years: number;
  readonly color: string;
  readonly series: readonly DdPoint[];
}

const SAMPLES = 97;

/**
 * One fall and one recovery, as a drawdown curve.
 *
 * The recovery is drawn with an ease that starts slow and finishes flat, which
 * is what a real climb back looks like — a straight line to zero would suggest a
 * steady, predictable rate, and the article's whole point is that there isn't
 * one. After the recovery completes the curve simply sits at zero: it is back at
 * its old peak, which is what "recovered" means.
 */
function build(years: number): readonly DdPoint[] {
  // ⚠️ The trough time is inserted into the sample grid rather than hoped for.
  // Sampling evenly over 8 years lands NEAR 0.7 and not on it, and the three
  // curves then bottom out at −38.1%, −38.7% and −39.5% — three different depths
  // in a figure whose entire claim is that the depths are identical. Nothing
  // looks wrong at that size; the promise is simply not kept.
  const grid = [
    ...Array.from({ length: SAMPLES }, (_, i) => (i / (SAMPLES - 1)) * SPAN_YEARS),
    TROUGH_YEAR,
  ].sort((a, b) => a - b);

  return grid.map((t) => {
    let pct: number;
    if (t <= TROUGH_YEAR) {
      pct = TROUGH_PCT * (t / TROUGH_YEAR);
    } else if (t >= years) {
      pct = 0;
    } else {
      const p = (t - TROUGH_YEAR) / (years - TROUGH_YEAR);
      // Ease-out: fast at the bottom, flattening as it approaches the old peak.
      pct = TROUGH_PCT * (1 - Math.sin((p * Math.PI) / 2));
    }
    return { x: (t / SPAN_YEARS) * 100, pct };
  });
}

/**
 * A number of years in the words a reader says out loud.
 *
 * Derived rather than typed beside each path, so a retuned duration restates its
 * own label instead of leaving a sentence that is fluent, specific and wrong
 * (CLAUDE.md 11c-v).
 */
export function yearsInWords(y: number): string {
  if (y < 2) return `${Math.round(y * 12)} months`;
  return Number.isInteger(y) ? `${y} years` : `${y.toFixed(1)} years`;
}

export const RECOVERIES: readonly Recovery[] = [
  { id: 'fast', years: 1.5, color: 'var(--brand-bright)' },
  { id: 'middling', years: 3.5, color: 'var(--brand-mid)' },
  { id: 'slow', years: 7, color: 'var(--brand-deep)' },
].map((r) => ({ ...r, label: yearsInWords(r.years), series: build(r.years) }));

/** Years of waiting, measured from the trough rather than from the peak. */
export const waitFromTrough = (r: Recovery): number => r.years - TROUGH_YEAR;

/**
 * Where a curve first gets back to its old peak, as an x on the plot.
 *
 * Read off the drawn series rather than computed from `years`, so the marker
 * cannot sit anywhere the line does not actually reach zero.
 */
export const recoveryX = (r: Recovery): number =>
  r.series.find((p, i) => i > 2 && p.pct === 0)?.x ?? 100;

export const FASTEST = RECOVERIES[0]!;
export const SLOWEST = RECOVERIES[RECOVERIES.length - 1]!;

/**
 * How many times longer the slow one took, measured from the bottom.
 *
 * From the TROUGH, not from the peak: the fall is the same in all three, so
 * including it would dilute the very difference the figure exists to show.
 */
export const WAIT_RATIO = waitFromTrough(SLOWEST) / waitFromTrough(FASTEST);

export const DD_FLOOR = TROUGH_PCT - 6;
export const yOf = (pct: number): number => (pct / DD_FLOOR) * 86;
export const DD_TICKS = [0, -20, -40] as const;
export const YEAR_TICKS = [0, 2, 4, 6, 8] as const;
