import snapshot from '@/app/landing-snapshot.json';

/**
 * The landing page's live figures.
 *
 * Built nightly by `analytics/cron/build_landing_snapshot.py` from the site's own
 * price history, through the canonical cycle maths in `analytics/major_cycle.py`.
 * Imported as JSON, so the front door has no database in its critical path and
 * nothing for a visitor to wait on.
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
  /** How many companies the site covers — counted in the database nightly. */
  universeCount: number;
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
 */
export const UNIVERSE_COUNT: string = LANDING.universeCount.toLocaleString('en-AU');

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
