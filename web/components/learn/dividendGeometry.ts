/**
 * Geometry for "Is a dividend safe, and how would you know?".
 *
 * One imaginary company over six years, and the trap the article is about: the
 * **yield climbed the whole way down**, because the share price was falling and
 * the payment had not been cut yet. It looked more generous every quarter, right
 * up to the quarter it was halved.
 *
 * ⚠️ **The yield is DIVIDED, not drawn.** `yieldPct` is computed from the same
 * `dps` and `price` the other panel uses, because the article's claim is that a
 * yield is a fraction whose denominator moves — and a hand-shaped yield line
 * would illustrate that claim while quietly not being an instance of it
 * (CLAUDE.md 11c-iii). `learn.spec.ts` recomputes it from the two inputs.
 *
 * ⚠️ **The payout ratio crosses 100% BEFORE the cut, and the gap is derived.**
 * That gap is the whole practical takeaway — the warning was on the page for six
 * quarters — so it is measured off the series rather than asserted in prose.
 * Retune the earnings path and the sentence restates itself (CLAUDE.md 11k).
 */

export interface Quarter {
  readonly q: number;
  /** Earnings per share for the quarter. */
  readonly eps: number;
  /** Dividend per share paid for the quarter. */
  readonly dps: number;
  readonly price: number;
  /** Annualised yield, in percent: four quarters of dividend over today's price. */
  readonly yieldPct: number;
  /** Share of earnings paid out, in percent. */
  readonly payoutPct: number;
}

// ⚠️ 25, not 24. The caption says "six years" and 24 quarters spans 5.75, which
// filtered the 6-year tick off the axis — a chart that stopped at "4 yrs" under a
// sentence promising six. An off-by-one in a span is invisible until something
// reads the axis (CLAUDE.md 11c-v: prose is a copy of a constant).
const N_Q = 25;

/** The quarter the dividend is cut. Everything about the story hangs off this. */
export const CUT_Q = 19;

const EPS_START = 1.6;
const EPS_END = 0.55;
const DPS_BEFORE = 0.9;
const DPS_AFTER = 0.32;
const PRICE_START = 90;
const PRICE_AT_CUT = 26;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const QUARTERS: readonly Quarter[] = Array.from({ length: N_Q }, (_, q) => {
  const t = Math.min(1, q / CUT_Q);
  const eps = lerp(EPS_START, EPS_END, t);
  const dps = q < CUT_Q ? DPS_BEFORE : DPS_AFTER;
  // After the cut the price keeps sliding for two quarters, then steadies. A cut
  // is not the end of the story, and a line that turned up the moment it landed
  // would say something about market reaction we have no basis for.
  const price =
    q <= CUT_Q
      ? lerp(PRICE_START, PRICE_AT_CUT, t)
      : lerp(PRICE_AT_CUT, 29, Math.min(1, (q - CUT_Q) / 4));
  return {
    q,
    eps,
    dps,
    price,
    yieldPct: ((dps * 4) / price) * 100,
    payoutPct: (dps / eps) * 100,
  };
});

/** The line a payout ratio is read against: paying out everything it earns. */
export const PAYOUT_LIMIT = 100;

/** The first quarter the company paid out more than it earned. */
export const FIRST_OVER_LIMIT = QUARTERS.find((x) => x.payoutPct > PAYOUT_LIMIT)!;

/** How many quarters that warning was visible before the cut arrived. */
export const WARNING_QUARTERS = CUT_Q - FIRST_OVER_LIMIT.q;

/** The most generous the yield ever looked — the quarter before it was halved. */
export const PEAK_YIELD = QUARTERS.slice(0, CUT_Q).reduce((a, b) =>
  b.yieldPct > a.yieldPct ? b : a,
);

/** What the yield became once the payment was cut. */
export const POST_CUT_YIELD = QUARTERS[CUT_Q]!;

export const START_YIELD = QUARTERS[0]!;

/** How much of the dividend was taken away, in percent. */
export const CUT_PCT = (1 - DPS_AFTER / DPS_BEFORE) * 100;

/** Plot bounds. */
export const YIELD_MAX = Math.ceil(PEAK_YIELD.yieldPct / 5) * 5;
export const PAYOUT_MAX = Math.ceil(Math.max(...QUARTERS.map((x) => x.payoutPct)) / 50) * 50;

export const yieldY = (v: number): number => 92 - (v / YIELD_MAX) * 84;
export const payoutY = (v: number): number => 92 - (v / PAYOUT_MAX) * 84;
export const qx = (q: number): number => (q / (N_Q - 1)) * 100;

/** Quarters in a year, so the axis can be read in the units a person thinks in. */
const QUARTERS_PER_YEAR = 4;
export const SPAN_YEARS = (N_Q - 1) / QUARTERS_PER_YEAR;

/**
 * Year markers for the shared time axis.
 *
 * ⚠️ Spelled `2 yrs`, never `2y`. The run-on guard scans for a digit butted
 * against a letter, because that is what a swallowed JSX space around an
 * interpolated number looks like — so an axis label in that form is
 * indistinguishable from the defect it exists to catch.
 */
export const YEAR_TICKS: readonly { year: number; q: number }[] = [0, 2, 4, 6]
  .filter((y) => y <= SPAN_YEARS)
  .map((year) => ({ year, q: year * QUARTERS_PER_YEAR }));

/**
 * Axis ticks, generated from the bounds rather than typed beside them.
 *
 * ⚠️ Typed ticks are a second copy of the scale. `[0, 100, 200]` was correct for
 * a payout axis that happened to reach 200 and silently printed a label at 200
 * on an axis that stops at 150 — a number outside the plot, drawn as though it
 * were inside it. The limit line is always a tick, because it is the one value a
 * reader is asked to compare against.
 */
const ticksTo = (max: number, step: number): readonly number[] =>
  Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);

export const YIELD_TICKS = ticksTo(YIELD_MAX, 5);
export const PAYOUT_TICKS = ticksTo(PAYOUT_MAX, PAYOUT_LIMIT / 2);
