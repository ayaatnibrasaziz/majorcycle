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

/**
 * How far a lifted marker label sits from the bar, in pixels.
 *
 * ⚠️ Exported because the AXIS has to clear it, and the two were separate
 * numbers until 2026-08-20: the lowered "Lowest $82" label landed on the "$80"
 * tick and overlapped it by 12px **at every width, including 1280** — for as
 * long as the figure has existed. The collision guard written for this figure
 * compared marker labels with each other and never with the axis, so it was
 * green the whole time (CLAUDE.md 14g: a guard is silent, not clean, about what
 * it does not measure).
 *
 * The axis offset is now derived from this, so moving one moves the other.
 */
export const MARKER_LIFT_PX = 52;

/** Where a label sits when it is not lifted clear of a neighbour. */
export const MARKER_BASE_GAP = 6;

/** A two-line 12px label, plus breathing room before the axis rule. */
export const MARKER_LABEL_H = 36;

export interface Marker {
  readonly id: string;
  readonly price: number;
  readonly label: string;
  /** Above the bar, or below it. */
  readonly above: boolean;
  /**
   * Push this label clear of its neighbour's row. The DOT never moves.
   *
   * ⚠️ Only where two labels on the SAME side of the bar are close enough to
   * collide. "Lowest" carried a lift until 2026-08-20 and never needed one — its
   * only same-side neighbour is "Highest", 80% of the plot away — so it hung 52px
   * below the bar for no reason, dropped onto the axis ticks, and pushed the
   * whole axis down to make room. A lift that guards nothing still costs layout.
   */
  readonly lift: boolean;
}

export const MARKERS: readonly Marker[] = [
  { id: 'today', price: PRICE_TODAY, label: 'Today', above: true, lift: true },
  { id: 'mean', price: TARGET_MEAN, label: 'Average target', above: true, lift: false },
  { id: 'low', price: TARGET_LOW, label: 'Lowest', above: false, lift: false },
  { id: 'high', price: TARGET_HIGH, label: 'Highest', above: false, lift: false },
];

export const markerGap = (m: Marker): number => (m.lift ? MARKER_LIFT_PX : MARKER_BASE_GAP);

/**
 * How far the axis has to sit below the bar.
 *
 * ⚠️ **Derived from the markers that are actually below it.** It was a hand-typed
 * `mt-24` until 2026-08-20, and the lowered "Lowest $82" label landed straight on
 * the "$80" tick — a 12px overlap at every width including 1280, for the life of
 * the figure, while the collision guard written for this very figure compared
 * marker labels only with each other (CLAUDE.md 14g).
 */
export const AXIS_TOP_PX =
  Math.max(...MARKERS.filter((m) => !m.above).map(markerGap)) + MARKER_LABEL_H + 20;

/** Room above the bar for the tallest label that sits there. */
export const PAD_TOP_PX =
  Math.max(...MARKERS.filter((m) => m.above).map(markerGap)) + MARKER_LABEL_H + 8;

/**
 * Breathing room UNDER the tick row.
 *
 * ⚠️ Small, and that is the point. The first attempt set this to
 * `AXIS_TOP_PX + 16 + 10` — which double-counts, because the axis is pushed down
 * by its own `marginTop` INSIDE this box and the padding is added after it. The
 * panel grew ~90px of empty space that looked like a deliberate margin. The
 * labels above the bar are absolutely positioned and escape the flow, so the top
 * genuinely does need the full clearance; the bottom does not.
 */
export const PAD_BOTTOM_PX = 14;
