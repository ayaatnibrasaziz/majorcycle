/**
 * Geometry for "What MajorCycle deliberately doesn't do".
 *
 * The article's central limit is a shape rather than a sentence: **almost
 * everything on a stock page describes what has already happened.** So the
 * figure is a timeline, and what makes the point is how little of it sits to the
 * right of today.
 *
 * ⚠️ **The price-history bar has NO left end, and that is the correction.**
 *
 * It was drawn from `PRESETS.long.lookbackBars` — 756 trading days, so "3 yrs
 * ago" — on the reasoning that this is the longest window a reader can choose.
 * Both halves of that were wrong, and the owner caught it on 2026-08-22:
 *
 *  1. **It is not the longest window.** `CUSTOM_PARAM_BOUNDS.lookbackBars.max`
 *     is 5040 bars — **20 years** — and a custom run is a first-class choice,
 *     not an edge case.
 *  2. **The lookback is not "how far back we look" at all.** In
 *     `calculate_cycle_metrics` it is the width of the ROLLING window that
 *     defines a high (`ta_highest(high, lookback_bars)`). The falls themselves —
 *     `pullback_list`, which is what `typical_drawdown` and `lower_bound` are
 *     averaged and mined from, and therefore what the valuation score is built
 *     on — are collected across the WHOLE dataframe. And the provider loads
 *     `period="max"` (`yfinance_provider._DOWNLOAD_PERIOD`), which is the
 *     company's entire listed record.
 *
 * So the bar runs off the left edge of the plot and is never given an end. A
 * timeline that put a number there would be claiming a boundary the product
 * does not have — and it read as deliberate, which is why it survived a visual
 * audit and needed someone who knows the engine to see it.
 *
 * ⚠️ **That fact lives in Python and cannot be imported here**, so it is not
 * derived — it is cited, above, with the two file names that hold it. Do not
 * replace this bar's extent with a TypeScript constant: there isn't one, and
 * inventing a plausible number is exactly what went wrong the first time.
 *
 * ⚠️ **Exactly one bar crosses today, and it is the one that is not ours.**
 * Analyst price targets are third-party estimates about the next twelve months
 * (decision #17 — shown verbatim, never our judgement), and they are the single
 * forward-looking thing on the page. Drawing them the same way as the rest would
 * quietly claim we forecast. `learn.spec.ts` asserts the count is one and that it
 * is the third-party row, because "one forward bar" is the entire figure.
 */

/** Analysts' conventional horizon. Theirs, not ours. */
export const TARGET_HORIZON_YEARS = 1;

/**
 * Years shown either side of today.
 *
 * ⚠️ The past side is a WINDOW ONTO an unbounded bar, not the bar's length.
 * 6 years is chosen so the two short bars (last reported accounts, next twelve
 * months) are still legible slivers at 360px, and so the one past tick sits far
 * enough inside the plot that its label does not hang off the edge — measured,
 * not assumed.
 */
export const PAST_YEARS = 6;
export const FUTURE_YEARS = TARGET_HORIZON_YEARS + 0.6;

export interface Span {
  readonly id: string;
  readonly label: string;
  /** Years relative to today: negative is past, positive is future. */
  readonly from: number;
  readonly to: number;
  /** Whose number it is. Third-party rows are drawn differently and said so. */
  readonly ours: boolean;
  /**
   * The bar leaves the plot rather than starting in it: its real extent is
   * longer than any axis here could show. Drawn with a square left edge that
   * fades out, so it reads as "continues" rather than "begins".
   */
  readonly openEnded: boolean;
  readonly note: string;
}

export const SPANS: readonly Span[] = [
  {
    id: 'prices',
    label: 'Price history',
    from: -PAST_YEARS,
    to: 0,
    ours: true,
    openEnded: true,
    note: 'every fall and recovery in the company’s entire listed record, however far back that goes',
  },
  {
    id: 'accounts',
    label: 'Company accounts',
    // ⚠️ Not "the last full year". Most of what the scoring reads comes from the
    // provider's trailing-twelve-month figures, and the statement blobs are
    // annual — two different periods, both closed, both published weeks after
    // they ended. The bar therefore stops SHORT of today rather than touching
    // it, which is the only claim that is true of every field.
    from: -1.25,
    to: -0.25,
    ours: true,
    openEnded: false,
    note: 'the most recent reported figures, for a period that has already closed',
  },
  {
    id: 'targets',
    label: 'Analyst price targets',
    from: 0,
    to: TARGET_HORIZON_YEARS,
    ours: false,
    openEnded: false,
    note: 'other people’s estimates for the next twelve months, shown as given',
  },
];

/** Years → horizontal position across the plot, 0–100. */
export const xOf = (years: number): number =>
  ((years + PAST_YEARS) / (PAST_YEARS + FUTURE_YEARS)) * 100;

export const TODAY_X = xOf(0);

/** The bars that describe things that have already happened. */
export const BACKWARD = SPANS.filter((s) => s.to <= 0);
/** The bars that extend past today. */
export const FORWARD = SPANS.filter((s) => s.to > 0);

/**
 * Two ticks, not five.
 *
 * ⚠️ **Tick labels are text on a narrow axis, and five of them collide at 375px.**
 * The forward half needs no tick at all — the analyst row's own label says what it
 * covers — and the past needs exactly one anchor. `learn.spec.ts` sweeps the
 * widths rather than trusting that (CLAUDE.md 11i-b: run the guard where the
 * defect appears, and the stated 375px floor is not always the worst case).
 *
 * ⚠️ **A forward tick was added on 2026-08-20 and taken straight back out:**
 * "1 yr ahead" is 60px of text pinned 19% of the plot from "today", which
 * overlapped it by 2px at 375px and 5px at 360px — measured, not guessed, and
 * invisible above 414px. The horizon belongs in the analyst row's own note,
 * where there is room for words.
 *
 * ⚠️ **And the past tick is a SCALE MARK, not the start of the price bar.** The
 * bar runs past it and off the plot. `-5` inside a 6-year window is deliberate:
 * a tick at the very edge would read as the bar's beginning, which is the claim
 * this figure was corrected to stop making.
 *
 * ⚠️ **And no label may read `5y`.** The run-on guard scans for a digit butted
 * against a letter, because that is the shape of a swallowed JSX space around an
 * interpolated number — so a legitimate axis label in that form is
 * indistinguishable from the defect. Spelling it `5 yrs ago` keeps the guard
 * able to do its job instead of teaching the next person to widen it.
 */
export const YEAR_TICKS: readonly number[] = [-5, 0];

/**
 * A marker's words, with the direction in them.
 *
 * ⚠️ Never `5y` — a digit butted against a letter is the shape of a lost JSX
 * space, and the run-on guard cannot tell one from an axis label. Singular at
 * one, for the same reason `yearTick` in `chartPrimitives` is.
 */
export function edgeLabel(years: number): string {
  if (years === 0) return 'today';
  const n = Math.abs(years);
  const unit = n === 1 ? 'yr' : 'yrs';
  return years < 0 ? `${n} ${unit} ago` : `${n} ${unit} ahead`;
}
