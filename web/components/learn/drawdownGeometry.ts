/**
 * The one price path the drawdown article's two schematics are drawn from.
 *
 * ⚠️ **Both figures share this, and the second is DERIVED from the first.** The
 * article shows the same imaginary stock twice — once zoomed into its recent
 * year, once pulled back over three years — and the whole argument depends on
 * those being the same stock. Drawing them as two hand-tuned paths would make
 * that a promise nobody checks: nudge one and the other stays put, both still
 * render perfectly, and the figures quietly start describing different
 * companies. That is CLAUDE.md 11c-iii — when the shared rule is an ALGORITHM,
 * extracting a constant is not enough, the second consumer has to consume the
 * first's output.
 *
 * ⚠️ **The percentages are computed here too, never typed.** Same reason: a
 * label reading "−20%" beside a line that no longer sits at the one-year high is
 * a figure that contradicts itself, and it looks completely deliberate.
 *
 * ⚠️ **This module hands the components NAMED LANDMARKS, not an array to index
 * into.** The first version had the figures reach for `ZOOMED[3]` to find the
 * last local top, which is the sort of thing that is correct until somebody adds
 * a vertex and silently becomes the wrong point — no error, a plausible picture,
 * a wrong label. `recentView()` finds it by what it IS (the highest price after
 * the trough) and returns it by name.
 */

/** y is inverted — a SMALL y is a HIGH price, as on a real chart. */
export type Point = readonly [x: number, y: number];

/** The two calibration points that turn a y coordinate into a price. */
const Y_HIGH = 10;
const PRICE_HIGH = 130;
const Y_LOW = 79;
const PRICE_LOW = 70;

/** Today's level, named rather than reached for by index. */
export const TODAY_Y = 67;

/** Price at a y coordinate. Linear — this is a schematic, not a log chart. */
export const priceAt = (y: number): number =>
  PRICE_HIGH - ((y - Y_HIGH) * (PRICE_HIGH - PRICE_LOW)) / (Y_LOW - Y_HIGH);

/**
 * Three years of an imaginary share price.
 *
 * Shaped so the three horizons a reader can actually choose land on three
 * genuinely different peaks — which is the point being made, and would collapse
 * into one number on a path that only ever fell once.
 */
/**
 * Three years of an imaginary share price.
 *
 * ⚠️ **The stretch before x = 66.7 carries SEVERAL falls of different depths, and
 * that is load-bearing rather than decorative.** The product's drawdown chart
 * overlays an "Avg" line and a "Low" line, and those two only say anything when a
 * stock's falls actually vary — an earlier version of this path had three
 * near-identical troughs and produced Avg −31.0% against Low −32.0%, two rules a
 * millimetre apart teaching nothing. A real record has shallow dips and deep
 * ones; the schematic has to as well or it misrepresents the chart it is
 * explaining.
 *
 * ⚠️ **Everything from x = 66.7 onwards is untouched on purpose.** That is the
 * window the first figure zooms into and the stretch the article's worked example
 * describes in words ($100 in January, $70, $90 in June, $80 today). Changing it
 * would silently put the prose and the picture at odds.
 */
export const FULL_PATH: readonly Point[] = [
  [0, 62],
  [10, Y_HIGH], // the highest it has ever traded: $130
  [16, 34], // a shallow dip
  [21, 20],
  [27, 56], // a deeper one
  [33, 30],
  [39, 62],
  [44, 38],
  [49, 71], // deeper still
  [56, 42],
  [62, 66],
  [70, 44], // the highest of the last year: $100
  [79, Y_LOW], // the trough: $70
  [87, 56], // the last local top: $90
  [93, 63],
  [100, TODAY_Y], // today: $80
];

/** y at any x along the path, interpolating between the two points either side. */
export function yAt(x: number, path: readonly Point[] = FULL_PATH): number {
  const first = path[0];
  const final = path[path.length - 1];
  if (!first || !final) return TODAY_Y;
  if (x <= first[0]) return first[1];
  if (x >= final[0]) return final[1];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    if (x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return final[1];
}

/**
 * The highest price (lowest y) reached from `fromX` onwards.
 *
 * ⚠️ The window's own left edge is included as an interpolated point, not
 * skipped. A window that starts partway between two vertices still starts at a
 * real price, and ignoring it reports the peak of a slightly different window —
 * which for the three-month case is the difference between the right answer and
 * a plausible wrong one.
 */
export function peakYFrom(fromX: number, path: readonly Point[] = FULL_PATH): number {
  let best = yAt(fromX, path);
  for (const point of path) {
    if (point[0] >= fromX && point[1] < best) best = point[1];
  }
  return best;
}

/** How far below a peak today's price sits, as a negative whole percentage. */
export function drawdownFromPeakY(peakY: number, todayY: number = TODAY_Y): number {
  return Math.round((priceAt(todayY) / priceAt(peakY) - 1) * 100);
}

/** Where each selectable horizon starts, on a canvas spanning three years. */
export const WINDOW_START = {
  short: 100 - 100 / 12, // ~3 months
  medium: 100 - 100 / 3, // ~1 year
  long: 0, // the full three years
} as const;

export const pointsAttr = (path: readonly Point[]): string =>
  path.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/**
 * The same path, drawn with the small movement a real price series has.
 *
 * ⚠️ **This is a RENDERING detail and must never become a source of truth.** Every
 * landmark — the peaks, the trough, the percentages — is computed from the plain
 * landmark path; only the polyline uses this. That separation is the whole
 * safety property: added wiggle cannot invent a new high and silently change
 * what the figure claims.
 *
 * ⚠️ **And it cannot, by construction.** Each inserted point is clamped inside
 * its own segment's [min, max] and its amplitude is tapered to zero at both
 * ends, so no vertex moves and no segment can overshoot the landmark either
 * side of it. `learn.spec.ts` asserts the detailed path's extremes equal the
 * landmark path's rather than trusting this paragraph.
 *
 * Deterministic — a seeded LCG, never `Math.random()`. A figure that redraws
 * itself differently on every build is a diff nobody can review and a test
 * nobody can pin.
 */
export function detailed(
  path: readonly Point[],
  stepsPerSegment = 6,
  seed = 20260819,
): readonly Point[] {
  const out: Point[] = [];
  let s = seed;
  const rnd = (): number => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };

  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    if (!a || !b) continue;
    out.push(a);

    const lo = Math.min(a[1], b[1]);
    const hi = Math.max(a[1], b[1]);
    const rise = Math.abs(b[1] - a[1]);

    for (let k = 1; k < stepsPerSegment; k += 1) {
      const t = k / stepsPerSegment;
      // Taper to zero at both ends so the landmark vertices keep their exact y.
      const amp = Math.min(3.0, rise * 0.15) * Math.sin(Math.PI * t);
      const y = a[1] + t * (b[1] - a[1]) + (rnd() * 2 - 1) * amp;
      out.push([a[0] + t * (b[0] - a[0]), Math.min(hi, Math.max(lo, y))]);
    }
  }

  const last = path[path.length - 1];
  if (last) out.push(last);
  return out;
}

/**
 * The drawdown series — the same shape the product's own chart draws.
 *
 * ⚠️ **This is a deliberate port of `computeDrawdown` in
 * `components/stocks/DrawdownOverlay.tsx`**: for each point, find the highest
 * price inside the trailing window and express today against it. The article
 * shows a reader what our chart looks like, so it has to be OUR chart — a
 * plausible-looking curve computed some other way would be a promise about the
 * product that the product does not keep (CLAUDE.md 11m).
 *
 * ⚠️ It is a **port rather than a call**, and that is a real cost worth naming.
 * The product's version consumes `PriceBar[]` and runs inside a `'use client'`
 * component built on `lightweight-charts`; importing it here would put a charting
 * library and a hydration cost on a prerendered public page, and a reader without
 * JavaScript would get nothing at all. So the formula is duplicated, and
 * `learn.spec.ts` pins the two together by asserting this one reproduces the
 * percentages the rest of the module derives independently.
 *
 * Values are ≤ 0 by construction: today can never be above its own trailing peak.
 */
export function drawdownSeries(
  path: readonly Point[],
  spanX: number,
  /**
   * ⚠️ **REQUIRED, and the reason is a bug this shipped with.** It defaulted to
   * `priceAt`, which is the calibration of the ORIGINAL three-year path. The
   * zoomed path returned by `recentView` has re-fitted y coordinates, so pricing
   * it with `priceAt` read its peak as $125.7 instead of $100.4 and produced a
   * curve ending at −31.8% while the marker beside it — derived correctly, by a
   * different route — said −20%. The dot floated 11.8 points off its own line and
   * the axis bottomed at −48% instead of −30%.
   *
   * Nothing errored, both numbers were plausible, and the picture looked like a
   * chart. **A path and the function that prices it are one unit; passing only
   * the path lets them separate silently**, so the caller now has to say which
   * space it is in. `recentView().priceOf` for a zoomed path, `priceAt` for the
   * full one.
   */
  priceOf: (y: number) => number,
  samples = 140,
): readonly { readonly x: number; readonly pct: number }[] {
  const out: { x: number; pct: number }[] = [];
  const inner = 40;

  for (let i = 0; i <= samples; i += 1) {
    const x = (i / samples) * 100;
    const from = Math.max(0, x - spanX);

    // Highest price (lowest y) anywhere in the trailing window.
    let peakY = Infinity;
    for (let k = 0; k <= inner; k += 1) {
      const at = from + (k / inner) * (x - from);
      const y = yAt(at, path);
      if (y < peakY) peakY = y;
    }

    const price = priceOf(yAt(x, path));
    const peak = priceOf(peakY);
    out.push({ x, pct: peak > 0 ? (price / peak - 1) * 100 : 0 });
  }
  return out;
}

/** How wide each horizon's window is, in path-x units, on a three-year canvas. */
export const WINDOW_SPAN = {
  short: 100 / 12,
  medium: 100 / 3,
  long: 100,
} as const;

/**
 * The "Avg" and "Low" levels the product overlays on its drawdown chart.
 *
 * ⚠️ **Derived from this schematic's own troughs, the way the engine derives
 * them from a real one** — local lows deeper than the horizon's threshold, then
 * their mean and their minimum (`analytics/major_cycle.py`). Inventing two
 * plausible levels instead would put numbers on a picture of our product that
 * our product would never produce.
 */
export function seriesStats(
  series: readonly { readonly x: number; readonly pct: number }[],
  threshold: number,
  pivotSpan = 6,
): { readonly typical: number | null; readonly lowest: number | null; readonly events: number } {
  const troughs: number[] = [];

  for (let i = pivotSpan; i < series.length - pivotSpan; i += 1) {
    const here = series[i];
    if (!here || here.pct >= threshold) continue;
    let isLow = true;
    for (let k = 1; k <= pivotSpan && isLow; k += 1) {
      const l = series[i - k];
      const r = series[i + k];
      if (!l || !r || l.pct < here.pct || r.pct < here.pct) isLow = false;
    }
    if (isLow) troughs.push(here.pct);
  }

  if (troughs.length === 0) return { typical: null, lowest: null, events: 0 };
  return {
    typical: troughs.reduce((a, b) => a + b, 0) / troughs.length,
    lowest: Math.min(...troughs),
    events: troughs.length,
  };
}

/**
 * Three price levels to label a y-axis with, from a linear y→price mapping.
 *
 * Rounded to whole dollars: this is an imaginary stock and a tick reading
 * "$103.47" implies a precision the schematic does not have.
 */
export function axisTicks(
  topY: number,
  bottomY: number,
  priceOf: (y: number) => number,
): readonly { readonly y: number; readonly price: number }[] {
  return [0, 0.5, 1].map((t) => {
    const y = topY + t * (bottomY - topY);
    return { y, price: Math.round(priceOf(y)) };
  });
}

export interface RecentView {
  /** The recent stretch, rescaled to fill its own box. */
  readonly path: readonly Point[];
  /** The highest price in the window — what the one-year horizon measures from. */
  readonly yearHighX: number;
  readonly yearHighY: number;
  /** The highest price AFTER the trough — the "last point it stopped rising". */
  readonly lastTopX: number;
  readonly lastTopY: number;
  readonly todayY: number;
  /** Price at the top and bottom of the rescaled box, for the y-axis ticks. */
  readonly priceOf: (y: number) => number;
}

/**
 * The same stock as `FULL_PATH`, zoomed into the stretch from `fromX` onwards.
 *
 * Both axes are re-fitted, because that is what zooming in actually does: the
 * y range is re-fitted to the prices inside the window, so the fall fills the
 * box instead of hugging the middle third.
 */
export function recentView(fromX: number, padTop = 15, padBottom = 85): RecentView {
  const kept: Point[] = [[fromX, yAt(fromX)], ...FULL_PATH.filter((p) => p[0] > fromX)];
  const ys = kept.map((p) => p[1]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  const path: Point[] = kept.map((p) => [
    ((p[0] - fromX) / (100 - fromX)) * 100,
    padTop + ((p[1] - minY) / span) * (padBottom - padTop),
  ]);

  // The peak of the window, and the trough that follows it.
  let yearHigh: Point = path[0] ?? [0, padTop];
  let troughIndex = 0;
  let deepest = -Infinity;
  path.forEach((p, i) => {
    if (p[1] < yearHigh[1]) yearHigh = p;
    if (p[1] > deepest) {
      deepest = p[1];
      troughIndex = i;
    }
  });

  // The last local top: the highest price reached after that trough. Found by
  // what it is, so adding a vertex cannot silently move the label.
  let found: Point | undefined;
  for (let i = troughIndex + 1; i < path.length; i += 1) {
    const p = path[i];
    if (p && (!found || p[1] < found[1])) found = p;
  }
  const lastTop: Point = found ?? yearHigh;

  const final = path[path.length - 1];

  // The rescale is linear in y and price is linear in y, so price stays linear
  // in the NEW y — one interpolation between the two prices at the box edges.
  const topPrice = priceAt(minY);
  const bottomPrice = priceAt(maxY);
  const priceOf = (y: number): number =>
    topPrice + ((y - padTop) / (padBottom - padTop)) * (bottomPrice - topPrice);

  return {
    path,
    yearHighX: yearHigh[0],
    yearHighY: yearHigh[1],
    lastTopX: lastTop[0],
    lastTopY: lastTop[1],
    todayY: final ? final[1] : padBottom,
    priceOf,
  };
}
