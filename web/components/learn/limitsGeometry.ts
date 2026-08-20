/**
 * Geometry for "What MajorCycle deliberately doesn't do".
 *
 * The article's central limit is a shape rather than a sentence: **almost
 * everything on a stock page describes what has already happened.** So the
 * figure is a timeline, and what makes the point is how little of it sits to the
 * right of today.
 *
 * ⚠️ **The price-history bar's length is READ FROM THE PRODUCT** — it is the
 * longest lookback a reader can actually choose (`PRESETS.long.lookbackBars`),
 * converted from trading days to years here. Typing "3 years" would be a copy of
 * a constant sitting in prose, and prose is where copies drift (CLAUDE.md 11c-v).
 *
 * ⚠️ **Exactly one bar crosses today, and it is the one that is not ours.**
 * Analyst price targets are third-party estimates about the next twelve months
 * (decision #17 — shown verbatim, never our judgement), and they are the single
 * forward-looking thing on the page. Drawing them the same way as the rest would
 * quietly claim we forecast. `learn.spec.ts` asserts the count is one and that it
 * is the third-party row, because "one forward bar" is the entire figure.
 */

import { PRESETS } from '@/lib/presets';

/** Trading days in a year — the same convention the presets are expressed in. */
const TRADING_DAYS_PER_YEAR = 252;

/** The longest window a reader can choose, in years. */
export const LOOKBACK_YEARS = PRESETS.long.lookbackBars / TRADING_DAYS_PER_YEAR;

/** Analysts' conventional horizon. Theirs, not ours. */
export const TARGET_HORIZON_YEARS = 1;

/** Years shown either side of today. */
export const PAST_YEARS = LOOKBACK_YEARS + 0.6;
export const FUTURE_YEARS = TARGET_HORIZON_YEARS + 0.6;

export interface Span {
  readonly id: string;
  readonly label: string;
  /** Years relative to today: negative is past, positive is future. */
  readonly from: number;
  readonly to: number;
  /** Whose number it is. Third-party rows are drawn differently and said so. */
  readonly ours: boolean;
  readonly note: string;
}

export const SPANS: readonly Span[] = [
  {
    id: 'prices',
    label: 'Price history',
    from: -LOOKBACK_YEARS,
    to: 0,
    ours: true,
    note: 'every fall and recovery the cycle reading is built from',
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
    note: 'the most recent reported figures, for a period that has already closed',
  },
  {
    id: 'targets',
    label: 'Analyst price targets',
    from: 0,
    to: TARGET_HORIZON_YEARS,
    ours: false,
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
 * ⚠️ **And no label may read `3y`.** The run-on guard scans for a digit butted
 * against a letter, because that is the shape of a swallowed JSX space around an
 * interpolated number — so a legitimate axis label in that form is
 * indistinguishable from the defect. Spelling it `3 yrs ago` keeps the guard
 * able to do its job instead of teaching the next person to widen it.
 */
/**
 * Two ticks, and the forward one is deliberately absent.
 *
 * ⚠️ It was added on 2026-08-20 and taken straight back out: "1 yr ahead" is 60px
 * of text pinned 19% of the plot from "today", which overlapped it by 2px at
 * 375px and 5px at 360px — measured, not guessed, and invisible above 414px. The
 * horizon belongs in the analyst row's own note, where there is room for words,
 * rather than crammed onto an axis. Shortening the label instead would have kept
 * a collision class alive for the sake of a mark nothing needs.
 */
export const YEAR_TICKS: readonly number[] = [-Math.round(LOOKBACK_YEARS), 0];

/**
 * A marker's words, with the direction in them.
 *
 * ⚠️ Never `3y` — a digit butted against a letter is the shape of a lost JSX
 * space, and the run-on guard cannot tell one from an axis label. Singular at
 * one, for the same reason `yearTick` in `chartPrimitives` is.
 */
export function edgeLabel(years: number): string {
  if (years === 0) return 'today';
  const n = Math.abs(years);
  const unit = n === 1 ? 'yr' : 'yrs';
  return years < 0 ? `${n} ${unit} ago` : `${n} ${unit} ahead`;
}
