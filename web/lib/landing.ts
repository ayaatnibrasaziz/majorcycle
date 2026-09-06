import snapshot from '@/app/landing-snapshot.json';
import universe from '@/app/universe-count.json';

/**
 * The landing page's worked example — Apple, on a stated date.
 *
 * Built by `analytics/cron/build_landing_snapshot.py --worked-example` from the
 * site's own price history, through the canonical cycle maths in
 * `analytics/major_cycle.py`. Imported as JSON, so the front door has no database
 * in its critical path and nothing for a visitor to wait on.
 *
 * ⚠️ **FROZEN, and deliberately on the same lifecycle as `mag7-snapshot.json`**
 * (finding 5A-013, 2026-09-01). Apple appears here AND in the Mag 7 table above
 * it on the page. While this file rebuilt nightly and that one stayed frozen, the
 * two drifted 18 days apart and the live page printed Apple at **−11.3%** in the
 * table and **"8.0% below its high"** three screens later — both correct for
 * their own date, and together indistinguishable from a mistake. CLAUDE.md 11k:
 * *two snapshots describing the same subject must carry the same date.*
 *
 * ⚠️ **Two things moved OUT of this file rather than being frozen with it**, because
 * neither is part of the worked example:
 *
 * - the company count → `universe-count.json` (a fact; must stay current);
 * - the `/learn` figures → `learn-snapshot.json`, read via `lib/learn-figures.ts`
 *   (an explainer describes how the product behaves *today* — owner decision,
 *   2026-09-01: *"keep the learn articles as is ... keep it separate"*).
 *
 * **So nothing outside the landing page should import `LANDING`.** Freezing it was
 * never meant to freeze anything else.
 *
 * ⚠️ These are FREE-tier fields only, and that is enforced upstream rather than
 * here: the generator calls `calculate_cycle_metrics`, which returns cycle
 * geometry and cannot return a rating, a health score or a valuation. There is no
 * path from the snapshot to a paid field, which is a stronger guarantee than
 * remembering to strip one (CLAUDE.md 11b).
 */
export interface LandingSnapshot {
  ticker: string;
  name: string;
  currency: string;
  /** Last close, in the stock's home currency (#13). */
  price: number;
  // ── how far it falls ──
  /** Negative: how far below its rolling high the stock is now. */
  currentDrawdownPct: number;
  /** Negative: the average of this stock's own historical pullbacks. */
  typicalDrawdownPct: number;
  /** Negative: the deepest fall in its whole record. */
  deepestDrawdownPct: number;
  pullbackEvents: number;
  // ── how far it recovers ──
  /** Positive: how far it has risen since its last low. */
  currentProfitPct: number;
  /** Positive: the average of this stock's own past recoveries. */
  typicalRecoveryPct: number;
  /** Positive: the largest single recovery in its record. */
  largestRecoveryPct: number;
  recoveryEvents: number;
  /** Exchange calendar date of the last bar (14a) — not the build date. */
  asOf: string;
  generatedAt: string;
}

export const LANDING: LandingSnapshot = snapshot;

/**
 * Depth as a positive magnitude, one decimal.
 *
 * The figures are stored negative because a drawdown IS negative, and the page
 * says "fallen 9.1%" rather than "−9.1% fallen". Converting at the point of
 * display keeps the sign convention honest in the data.
 */
export const depth = (pct: number): string => `${Math.abs(pct).toFixed(1)}%`;

/**
 * How many companies the site covers, formatted for prose.
 *
 * ⚠️ Counted in the database every night, never typed into the copy. The
 * universe **auto-expands on every reader's ticker request** (CLAUDE.md #16), so
 * a literal here is a number the product is actively working to falsify — and it
 * already had: the landing page said **863** in five places on 2026-08-19 while
 * the database held **866**. Nothing errored, nothing looked stale, and the
 * sentences stayed fluent and specific. That is 11c-v exactly: a sentence that
 * states a constant IS a copy of that constant, and prose is where copies go to
 * drift unnoticed.
 *
 * `toLocaleString`, not the bare number, so the day we pass a thousand the page
 * reads "1,204 companies" rather than "1204 companies".
 *
 * ⚠️ **Its own file, rebuilt and committed NIGHTLY** — unlike `LANDING` above,
 * which is frozen. The two lifecycles are the whole point of the split: a count
 * is a fact that must never be stale, while a worked example is a measurement
 * that must never disagree with the one beside it (5A-013). Keeping both in one
 * file forced one rule on two different kinds of number, and the wrong rule won.
 */
export const UNIVERSE_COUNT: string = universe.universeCount.toLocaleString('en-AU');

/**
 * Price in the stock's home currency (#13).
 *
 * `Intl` rather than `toFixed`, deliberately: `toFixed` rounds the binary double
 * and `Intl` rounds the decimal a reader is shown, and the two disagree on about
 * 4% of values. That gap once printed one analyst target three different ways on
 * one screener run (CLAUDE.md 11c iii).
 */
export const price = (value: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(value);
