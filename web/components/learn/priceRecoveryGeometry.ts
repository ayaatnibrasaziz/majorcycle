/**
 * Geometry for the worked example in "How long do recoveries actually take?".
 *
 * The article used to answer "nobody knows" and stop there, which was true and
 * unhelpful: the stock page **does** put falls and recoveries on a time axis, so
 * a reader can measure how long every past recovery took for the company in
 * front of them. This figure is that measurement, done once, on the two panels
 * the product actually draws — the price, and the same years as a drawdown.
 *
 * ⚠️ **Everything is DERIVED from one price path.** The drawdown is computed from
 * the running peak, and each underwater stretch — where the curve leaves zero,
 * where it bottoms, where it gets back — is *found* by scanning that curve, never
 * typed beside it. So the durations in the caption and the prose are readings off
 * the drawing rather than claims about it, and reshaping the path restates them
 * (CLAUDE.md 11c-iii, 11k).
 *
 * ⚠️ **Illustrative, and the caption says so.** MajorCycle stores no durations —
 * the engine measures magnitudes only. The point of the article is that the
 * reader takes the measurement off the chart themselves; a figure drawn in our
 * house style must not imply we publish the number.
 */

export interface Sample {
  readonly x: number;
  readonly price: number;
}

export interface DdPoint {
  readonly x: number;
  readonly pct: number;
}

/** The plotted window. Everything horizontal is read against this. */
export const SPAN_YEARS = 8;

const SAMPLES = 321;

/**
 * The price path, as keyframes in (years, price).
 *
 * Three falls on purpose, of three different depths and three different
 * lengths — and the last one is still in progress, because that is the situation
 * a reader is actually in when they open the page.
 */
const KEYS: readonly (readonly [number, number])[] = [
  [0, 84],
  [0.4, 100],
  [1.1, 72],
  [2.0, 100],
  [3.0, 130],
  [4.2, 78],
  [5.1, 104],
  [6.0, 130],
  [6.8, 150],
  [7.4, 120],
  [8.0, 132],
];

function interpolate(keys: readonly (readonly [number, number])[]): readonly Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const t = (i / (SAMPLES - 1)) * SPAN_YEARS;
    let k = 0;
    while (k < keys.length - 2 && t > keys[k + 1]![0]) k += 1;
    const [t0, p0] = keys[k]!;
    const [t1, p1] = keys[k + 1]!;
    const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    out.push({ x: (t / SPAN_YEARS) * 100, price: p0 + (p1 - p0) * f });
  }
  return out;
}

export const PRICES: readonly Sample[] = interpolate(KEYS);

/** Drawdown from the running peak, in percent — the engine's own definition. */
export const DRAWDOWN: readonly DdPoint[] = (() => {
  let peak = -Infinity;
  return PRICES.map((s) => {
    peak = Math.max(peak, s.price);
    return { x: s.x, pct: (s.price / peak - 1) * 100 };
  });
})();

export interface Underwater {
  readonly id: string;
  /** Plot x where the price left its old high. */
  readonly fromX: number;
  /** Plot x where it got back to it — or the right edge, if it has not. */
  readonly toX: number;
  /** Plot x and depth of the lowest point in between. */
  readonly troughX: number;
  readonly troughPct: number;
  /** How long it spent below its old high, in years. */
  readonly years: number;
  /** False when the stretch runs to the right edge — i.e. it is still going. */
  readonly recovered: boolean;
}

/**
 * Every stretch the price spent below a previous high, found by scanning.
 *
 * ⚠️ **This is the whole reading method the article teaches**, written as code:
 * the shaded region under the drawdown curve *is* the time spent underwater, and
 * its width *is* the duration. Finding the stretches rather than declaring them
 * is what makes the figure an instance of the instruction rather than a picture
 * of it — and it is why a marker cannot end up somewhere the curve is not.
 */
export const UNDERWATER: readonly Underwater[] = (() => {
  const out: Underwater[] = [];
  const toYears = (x: number) => (x / 100) * SPAN_YEARS;
  let start: number | null = null;
  let lowX = 0;
  let lowPct = 0;

  DRAWDOWN.forEach((p, i) => {
    const under = p.pct < -0.05;
    if (under && start === null) {
      start = i === 0 ? 0 : i - 1;
      lowX = p.x;
      lowPct = p.pct;
    } else if (under) {
      if (p.pct < lowPct) {
        lowPct = p.pct;
        lowX = p.x;
      }
    } else if (start !== null) {
      out.push({
        id: `uw${out.length + 1}`,
        fromX: DRAWDOWN[start]!.x,
        toX: p.x,
        troughX: lowX,
        troughPct: lowPct,
        years: toYears(p.x) - toYears(DRAWDOWN[start]!.x),
        recovered: true,
      });
      start = null;
    }
  });

  if (start !== null) {
    const last = DRAWDOWN[DRAWDOWN.length - 1]!;
    out.push({
      id: `uw${out.length + 1}`,
      fromX: DRAWDOWN[start]!.x,
      toX: last.x,
      troughX: lowX,
      troughPct: lowPct,
      years: toYears(last.x) - toYears(DRAWDOWN[start]!.x),
      recovered: false,
    });
  }

  // ⚠️ The first keyframe starts BELOW the opening peak so the path looks like a
  // chart rather than a diagram, which creates a sliver of drawdown at x=0 that
  // is an artefact of where the window happens to begin, not an event. Dropped
  // here rather than in the figure: a reader would otherwise be shown a stretch
  // whose start is off the left edge and invited to measure it.
  return out.filter((u) => u.fromX > 0.5 && Math.abs(u.troughPct) > 3);
})();

/** The completed ones — the only stretches whose length is a finished number. */
export const RECOVERED = UNDERWATER.filter((u) => u.recovered);
export const IN_PROGRESS = UNDERWATER.find((u) => !u.recovered);

/** A number of years in the words a reader says out loud. */
export function yearsInWords(y: number): string {
  const months = Math.round(y * 12);
  if (months < 24) return `${months} months`;
  const years = months / 12;
  // ⚠️ `3 years`, not `3.0 years`. A trailing zero on a schematic reads as a
  // precision the drawing does not have.
  return Number.isInteger(years) ? `${years} years` : `${years.toFixed(1)} years`;
}

/** Shortest and longest completed wait — the range the article quotes. */
export const SHORTEST = RECOVERED.reduce((a, b) => (a.years < b.years ? a : b));
export const LONGEST = RECOVERED.reduce((a, b) => (a.years > b.years ? a : b));

/** ── plot scales ──────────────────────────────────────────────────────────── */

const PRICE_MAX = 160;
const PRICE_MIN = 60;
export const PRICE_FLOOR_Y = 90;
export const priceY = (p: number): number =>
  ((PRICE_MAX - p) / (PRICE_MAX - PRICE_MIN)) * PRICE_FLOOR_Y;
export const PRICE_TICKS = [150, 120, 90, 60].map((v) => ({ y: priceY(v), value: v }));

export const DD_FLOOR = -50;
export const DD_FLOOR_Y = 86;
/**
 * Headroom above the zero line.
 *
 * ⚠️ Not decoration. The span rules that mark each underwater stretch are drawn
 * ON zero with a tick either side of it, so a zero line at the very top of the
 * viewBox puts half of every tick outside the drawing — clipped silently, and the
 * bracket then reads as a one-sided line pointing down.
 */
export const DD_TOP_PAD = 22;
export const ddY = (pct: number): number =>
  DD_TOP_PAD + (pct / DD_FLOOR) * (DD_FLOOR_Y - DD_TOP_PAD);
export const DD_TICKS = [0, -20, -40].map((v) => ({ y: ddY(v), value: v }));

/** ⚠️ `2 yrs`, never `2y` — see `yearTick` in `chartPrimitives`. */
export const YEAR_TICKS: readonly number[] = [0, 2, 4, 6, 8];
export const yearX = (y: number): number => (y / SPAN_YEARS) * 100;
