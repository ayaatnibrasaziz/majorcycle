/**
 * Fifty-two weekly candles, for the 52-week-high article.
 *
 * ⚠️ **Weekly, not daily, and that is the whole reason it is readable.** 260
 * daily candles in a 570px panel is 2px each — a smear, and 1px at 375px. One
 * candle per week gives exactly 52 of them, which is literally the window the
 * article is about: ~11px per candle on a laptop, ~5px on a phone, wicks
 * visible at both.
 *
 * ⚠️ **The wick is the point.** A candle's BODY spans open to close; its WICK
 * spans the whole range traded. The quoted 52-week high is the top of the
 * highest wick and the 52-week low is the bottom of the lowest — neither of
 * which any close ever reached. That is the article's argument, drawn rather
 * than asserted, and it is why this figure shows candles instead of a line.
 *
 * ⚠️ **`high >= max(open, close)` and `low <= min(open, close)` on every week.**
 * A body poking out of its own wick would draw a price nobody paid, and it
 * would look like ordinary chart noise rather than a defect. `learn.spec.ts`
 * asserts it across all 52 weeks instead of trusting the construction.
 *
 * Deterministic — a seeded LCG, never `Math.random()`. A figure that redraws
 * itself on every build is a diff nobody can review and a test nobody can pin.
 */

export const WEEKS = 52;

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** The year's shape, as control points the weekly closes follow. */
const SHAPE: readonly (readonly [number, number])[] = [
  [0, 84],
  [6, 89],
  [12, 86],
  [18, 95],
  [26, 104], // the best CLOSE of the year
  [31, 96],
  [37, 101], // closes lower — but this is the week of the spike
  [43, 93],
  [48, 90],
  [51, 92],
];

/** The week whose price spiked far above anything it closed at. */
const SPIKE_WEEK = 37;
/** The week that sold off hard intraday and recovered before the close. */
const FLUSH_WEEK = 2;

/*
 * ⚠️ Placed at week 2, near the year's low, and that placement is load-bearing.
 * At week 9 the big down-wick sat mid-range and an ORDINARY week's wick set the
 * 52-week low instead — so the figure still had a low, but it no longer
 * demonstrated the thing the article is about. The extreme has to be made by
 * the extreme, or the picture teaches nothing.
 */

function shapeAt(i: number): number {
  const first = SHAPE[0];
  const last = SHAPE[SHAPE.length - 1];
  if (!first || !last) return 90;
  if (i <= first[0]) return first[1];
  if (i >= last[0]) return last[1];
  for (let k = 1; k < SHAPE.length; k += 1) {
    const a = SHAPE[k - 1];
    const b = SHAPE[k];
    if (!a || !b) continue;
    if (i <= b[0]) return a[1] + ((i - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return last[1];
}

const rnd = rng(20260819);

export interface Candle {
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

const round2 = (v: number): number => Number(v.toFixed(2));

/**
 * ⚠️ Built in one pass, each field derived from the ones before it. Generating
 * four independent series and hoping they stayed ordered is how a low ends up
 * above its own body; deriving the wick FROM the body makes the invariant true
 * by construction rather than by luck.
 */
export const CANDLES: readonly Candle[] = (() => {
  const out: Candle[] = [];
  let prevClose = shapeAt(0);
  for (let i = 0; i < WEEKS; i += 1) {
    const close = shapeAt(i) * (1 + (rnd() - 0.5) * 0.02);
    const open = prevClose * (1 + (rnd() - 0.5) * 0.008);
    const top = Math.max(open, close);
    const bottom = Math.min(open, close);

    const upWick = i === SPIKE_WEEK ? 0.055 : 0.004 + rnd() * 0.011;
    const downWick = i === FLUSH_WEEK ? 0.05 : 0.004 + rnd() * 0.011;

    out.push({
      open: round2(open),
      close: round2(close),
      high: round2(top * (1 + upWick)),
      low: round2(bottom * (1 - downWick)),
    });
    prevClose = close;
  }
  return out;
})();

function argBy(pick: (c: Candle) => number, better: (a: number, b: number) => boolean): number {
  let best = 0;
  CANDLES.forEach((c, i) => {
    if (better(pick(c), pick(CANDLES[best]!))) best = i;
  });
  return best;
}

const hiWeek = argBy((c) => c.high, (a, b) => a > b);
const loWeek = argBy((c) => c.low, (a, b) => a < b);
const peakCloseWeek = argBy((c) => c.close, (a, b) => a > b);
const troughCloseWeek = argBy((c) => c.close, (a, b) => a < b);

/** The quoted 52-week high: the top of the highest wick. */
export const HIGH_52 = { week: hiWeek, price: CANDLES[hiWeek]!.high };
/** The quoted 52-week low: the bottom of the lowest wick. */
export const LOW_52 = { week: loWeek, price: CANDLES[loWeek]!.low };
/** The peak a line drawn through CLOSES reaches. */
export const CHART_PEAK = { week: peakCloseWeek, price: CANDLES[peakCloseWeek]!.close };
export const CHART_TROUGH = { week: troughCloseWeek, price: CANDLES[troughCloseWeek]!.close };

/** How far the quoted high sits above the highest close. */
export const GAP_PCT = (HIGH_52.price / CHART_PEAK.price - 1) * 100;
/** How far the quoted low sits below the lowest close. */
export const LOW_GAP_PCT = (1 - LOW_52.price / CHART_TROUGH.price) * 100;

// ── plotting ────────────────────────────────────────────────────────────────

const TOP_Y = 14;
const FLOOR_Y = 80;
const HI = Math.max(...CANDLES.map((c) => c.high));
const LO = Math.min(...CANDLES.map((c) => c.low));
const PAD = (HI - LO) * 0.1;
const TOP_PRICE = HI + PAD;
const BOTTOM_PRICE = LO - PAD;

/** Week index → x in the 0–100 space `rx()` expects, inset half a slot so the
 *  first and last candles are not clipped by the plot edges. */
export const SLOT = 100 / WEEKS;
export const xOf = (week: number): number => (week + 0.5) * SLOT;

export const yOf = (price: number): number =>
  TOP_Y + ((TOP_PRICE - price) / (TOP_PRICE - BOTTOM_PRICE)) * (FLOOR_Y - TOP_Y);

export const PLOT_FLOOR_Y = FLOOR_Y;

export const PRICE_TICKS: readonly { readonly y: number; readonly value: number }[] = [
  0, 0.5, 1,
].map((t) => {
  const price = TOP_PRICE - t * (TOP_PRICE - BOTTOM_PRICE);
  return { y: yOf(price), value: Math.round(price) };
});
