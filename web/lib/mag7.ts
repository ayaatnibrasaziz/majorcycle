import snapshot from '@/app/mag7-snapshot.json';

import { tierFromScore } from '@/lib/ratings';
import type { OverallLabel } from '@/lib/types';

/**
 * The worked screener run the landing page shows.
 *
 * Seven stocks, one preset, frozen and dated (owner decision 2026-08-13) — NOT
 * refreshed nightly like `landing.ts`. The distinction is the whole reason this is
 * a second file: the landing writes *sentences about* this run ("the biggest
 * discount on the list belongs to the weakest business on it"), and a sentence
 * that was true on Thursday is a lie on Friday if the numbers move underneath it.
 * Frozen data lets the prose be checked once. See `analytics/cron/build_mag7_snapshot.py`.
 *
 * ⚠️ This is the ONE place premium fields appear on a public page, and it is a
 * deliberate, bounded exception (docs/architecture.md §7.1): seven allow-listed
 * tickers, an allow-listed set of keys, a static import so no request ever reaches
 * the entitlement-gated APIs, and no path from here to an eighth stock.
 *
 * ⚠️ EVERY figure the page states in words is DERIVED below, never typed into the
 * JSX. That is not tidiness. The approved storyboard's own copy said "5 rate
 * Constructive or better" and "Tesla ... still comes sixth"; when the run was
 * regenerated on 2026-08-13 the answers became FOUR and SEVENTH, and both
 * sentences would have shipped as confident, specific, wrong statements about real
 * companies. Nothing would have errored. A number in prose is a number that has to
 * come from the data (CLAUDE.md 11c iii).
 */

export interface Mag7Row {
  ticker: string;
  name: string;
  currency: string;
  /** 0–100. Premium — see the bounded-exception note above. */
  overallRating: number;
  overallLabel: OverallLabel;
  healthScore: number;
  valuationScore: number;
  valuationZone: string;
  /** Negative: how far below its rolling high the stock sits on `asOf`. */
  currentDrawdownPct: number;
  /** Negative: the average of this stock's own past pullbacks. */
  typicalDrawdownPct: number;
  /** Negative: the deepest fall in its record. */
  lowerBoundPct: number;
  pullbackEvents: number;
}

export interface Mag7Snapshot {
  preset: string;
  /** Exchange calendar date of the last bar (14a) — not the build date. */
  asOf: string;
  generatedAt: string;
  rows: Mag7Row[];
}

export const MAG7: Mag7Snapshot = snapshot as Mag7Snapshot;

/**
 * The quadrant divider on the Opportunity Map.
 *
 * DERIVED from the rating ladder rather than typed as 65: the boundary *means*
 * "Constructive or better", and `tierFromScore` is where that threshold is
 * defined. Writing `65` here would be a second copy of a number that already
 * exists — the shape of defect that put three different roundings of one analyst
 * target on one screener run (CLAUDE.md 11c iii).
 */
export const strong = (score: number): boolean => tierFromScore(score) <= 2;

/** Ordinals, for prose. Only ever needs to reach seven. */
const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
] as const;

/**
 * Everything the page says in words about this run, computed from the rows.
 *
 * Read this list as the answer to "which claims on the landing page are load
 * bearing?" — each one is a sentence a reader could check against the table
 * directly above it.
 */
export interface Mag7Facts {
  total: number;
  /** Rating ≥ 65 — the same threshold as `strong`. */
  constructiveOrBetter: number;
  /** Rating < 50: Cautious or Bearish. */
  cautiousOrWorse: number;
  /** Highest Overall Rating — the briefing's "standout". */
  top: Mag7Row;
  /** The stock that has fallen furthest from its high. */
  deepestFall: Mag7Row;
  /** Where `deepestFall` places in the ranking, as a word ("seventh"). */
  deepestFallRank: string;
  /** Lowest Financial Health — the business the discount is attached to. */
  weakest: Mag7Row;
  /** Strongest Financial Health, for the contrast the callout draws. */
  healthiest: Mag7Row;
  /** Healthy AND attractively valued — the green quadrant. Often empty, honestly. */
  opportunityZone: Mag7Row[];
}

export function mag7Facts(snap: Mag7Snapshot = MAG7): Mag7Facts {
  // Ranked strongest-first, exactly as the screener sorts a run. `toSorted` would
  // be tidier but this file is imported by a server component AND by a test, so it
  // copies first rather than assuming the JSON's order is already the display order.
  const rows = [...snap.rows].sort((a, b) => b.overallRating - a.overallRating);

  const by = (pick: (r: Mag7Row) => number) =>
    rows.reduce((best, r) => (pick(r) < pick(best) ? r : best), rows[0]!);

  const deepestFall = by((r) => r.currentDrawdownPct);
  const rank = rows.indexOf(deepestFall);

  return {
    total: rows.length,
    constructiveOrBetter: rows.filter((r) => strong(r.overallRating)).length,
    cautiousOrWorse: rows.filter((r) => r.overallRating < 50).length,
    top: rows[0]!,
    deepestFall,
    // Guarded rather than assumed: seven rows can only produce indexes 0–6, but
    // the generator's ticker list is editable and an eighth would read `undefined`
    // into a sentence about real companies.
    deepestFallRank: ORDINALS[rank] ?? `${rank + 1}th`,
    weakest: by((r) => r.healthScore),
    healthiest: by((r) => -r.healthScore),
    opportunityZone: rows.filter((r) => strong(r.healthScore) && strong(r.valuationScore)),
  };
}

/** Rows in display order — ranked, strongest first. */
export const mag7Rows = (snap: Mag7Snapshot = MAG7): Mag7Row[] =>
  [...snap.rows].sort((a, b) => b.overallRating - a.overallRating);

/**
 * Depth as a positive magnitude, one decimal — the same convention as
 * `landing.ts`, because the two files describe the same Apple on the same page and
 * a reader scrolling between them must not meet "11.3%" and "-11.33%".
 */
export const pct1 = (value: number): string => `${Math.abs(value).toFixed(1)}%`;

/** Signed, one decimal — for table cells, where the sign carries meaning. */
export const signed1 = (value: number): string =>
  `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}%`;
