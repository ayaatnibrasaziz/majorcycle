/**
 * Geometry for "Is a falling share price a bargain or a warning?".
 *
 * The article's whole argument is that a price chart cannot answer the question,
 * so the figure has to make that literally true: **both panels draw the SAME
 * fall**, from one shared series, and differ only underneath. Two hand-drawn
 * curves that merely looked similar would undercut the point at exactly the
 * moment a reader was checking it — and would still render perfectly
 * (CLAUDE.md 11j). `learn.spec.ts` asserts the two `points` strings are
 * byte-identical.
 *
 * ⚠️ **The five checks and their weights are the PRODUCT's, not the article's.**
 * They mirror `_FH_WEIGHTS` in `analytics/scoring/financial_health.py`
 * (profitability 30, balance sheet 25, growth 20, cash flow 15, shareholder 10),
 * and each company's headline score is the weighted average of its five bars
 * rather than a number typed beside them. So the picture cannot claim a total
 * its own bars do not support — the failure CLAUDE.md 11c-iii is about, where
 * two implementations of one rule drift while both look plausible.
 */

/** The five checks, in the order the product weights them. */
export const CHECKS = [
  { key: 'profitability', label: 'Profitable', weight: 30 },
  { key: 'balance', label: 'Can survive a bad year', weight: 25 },
  { key: 'growth', label: 'Growing', weight: 20 },
  { key: 'cashflow', label: 'Profit becomes cash', weight: 15 },
  { key: 'shareholder', label: 'Returns to shareholders', weight: 10 },
] as const;

export type CheckKey = (typeof CHECKS)[number]['key'];

/** Weights sum to 100 — asserted, because a silent 99 would rescale every score. */
export const WEIGHT_TOTAL = CHECKS.reduce((sum, c) => sum + c.weight, 0);

export interface Company {
  readonly name: string;
  readonly scores: Readonly<Record<CheckKey, number>>;
}

/**
 * Two imaginary companies. Named for what they are, never for a real business —
 * a plausible ticker on an invented balance sheet is a claim about a real
 * company that nobody would think to check.
 */
export const STEADY: Company = {
  name: 'Company A',
  scores: { profitability: 88, balance: 82, growth: 80, cashflow: 90, shareholder: 78 },
};

export const STRAINED: Company = {
  name: 'Company B',
  scores: { profitability: 42, balance: 30, growth: 35, cashflow: 38, shareholder: 55 },
};

/** The weighted average, exactly as the engine computes it. */
export function healthOf(c: Company): number {
  const total = CHECKS.reduce((sum, chk) => sum + c.scores[chk.key] * chk.weight, 0);
  return total / WEIGHT_TOTAL;
}

export const STEADY_HEALTH = healthOf(STEADY);
export const STRAINED_HEALTH = healthOf(STRAINED);

// ── The one fall, drawn twice ────────────────────────────────────────────────

/** How far the share falls from its peak, in percent. Both companies. */
export const FALL_PCT = -30;

/**
 * A deterministic wobble. Seeded, never `Math.random()` — a figure that redraws
 * differently on every build cannot be reviewed, and a guard measuring it would
 * be flaky for a reason nobody could reproduce.
 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export interface PricePoint {
  readonly x: number;
  /** Price as a percentage of the starting peak: 100 at the left, 70 at the right. */
  readonly pct: number;
}

/**
 * The shared path: flat-ish, then a decline that steepens, then a limp along the
 * bottom. Shaped to read as "a bad year" rather than a single crash, because the
 * article is about a fall you have had time to think about.
 */
function buildFall(): readonly PricePoint[] {
  const rnd = lcg(20260820);
  const STEPS = 60;
  const out: PricePoint[] = [];
  for (let i = 0; i <= STEPS; i += 1) {
    const t = i / STEPS;
    // Smooth S-shaped descent from 100 to 100 + FALL_PCT.
    const eased = t < 0.18 ? 0 : (1 - Math.cos(((t - 0.18) / 0.82) * Math.PI)) / 2;
    const base = 100 + FALL_PCT * eased;
    const wobble = (rnd() - 0.5) * 2.4;
    out.push({ x: t * 100, pct: base + wobble });
  }
  // The last point is the headline number, so it is exact rather than wobbled:
  // the caption states it, and a reader can measure it against the axis.
  out[out.length - 1] = { x: 100, pct: 100 + FALL_PCT };
  return out;
}

export const FALL: readonly PricePoint[] = buildFall();

/** Plot bounds, with headroom so the wobble never touches the frame. */
export const PRICE_TOP = 106;
export const PRICE_BOTTOM = 62;
export const PLOT_FLOOR_Y = 76;

/** Price → y, in viewBox units, over the price plot only (not the bars below). */
export const yOf = (pct: number): number =>
  4 + ((PRICE_TOP - pct) / (PRICE_TOP - PRICE_BOTTOM)) * (PLOT_FLOOR_Y - 4);

export const PRICE_TICKS = [100, 85, 70].map((value) => ({ value, y: yOf(value) }));
