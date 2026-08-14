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
