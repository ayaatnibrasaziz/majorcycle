/**
 * Geometry for "How to read an analyst price target".
 *
 * One imaginary company, and the four numbers a stock page actually shows for
 * it: today's price, and the low / average / high of the analysts' twelve-month
 * targets. Everything the article says about the spread is derived from these
 * four, so the prose cannot state a range the picture does not draw
 * (CLAUDE.md 11k).
 *
 * ⚠️ These are the same four fields the product holds — `analyst_low_price`,
 * `analyst_target_price`, `analyst_high_price` and the current price. The figure
 * is not inventing a view of analyst data we do not have.
 */

export const PRICE_TODAY = 100;
export const TARGET_LOW = 82;
export const TARGET_MEAN = 124;
export const TARGET_HIGH = 178;

/** How many analysts the average is made of — the number most people never look at. */
export const ANALYST_COUNT = 14;

/** Upside implied by the consensus, in percent. */
export const MEAN_UPSIDE_PCT = (TARGET_MEAN / PRICE_TODAY - 1) * 100;

/** The most pessimistic and most optimistic views, as moves from today. */
export const LOW_MOVE_PCT = (TARGET_LOW / PRICE_TODAY - 1) * 100;
export const HIGH_MOVE_PCT = (TARGET_HIGH / PRICE_TODAY - 1) * 100;

/**
 * The width of the range, as a percentage of today's price.
 *
 * This is the figure's headline: the disagreement between the most and least
 * optimistic analyst is usually far larger than the "upside" the average
 * implies, and almost nobody quotes it.
 */
export const SPREAD_PCT = ((TARGET_HIGH - TARGET_LOW) / PRICE_TODAY) * 100;

/** Plot bounds, with a margin either side so nothing touches the frame. */
export const AXIS_MIN = 70;
export const AXIS_MAX = 190;

/** Price → horizontal position, 0–100 across the plot. */
export const xOf = (price: number): number =>
  ((price - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100;

export const AXIS_TICKS = [80, 110, 140, 170] as const;
