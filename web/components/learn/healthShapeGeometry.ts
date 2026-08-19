/**
 * Geometry for "How to check if a company is financially healthy".
 *
 * The figure's point is the opposite of the bargain article's: there, two
 * identical charts hid two different businesses. Here, **two identical SCORES
 * hide two different risks.** Both companies total the same number out of 100,
 * built from completely different pillars — so the headline is honest and still
 * tells you nothing about which weakness you would be taking on.
 *
 * ⚠️ The five pillars and their weights are the engine's, re-used from
 * `bargainGeometry.ts` rather than restated, so the two figures cannot disagree
 * about what the product measures (CLAUDE.md 11c).
 */

import { CHECKS, WEIGHT_TOTAL, type CheckKey, type Company } from './bargainGeometry';

export { CHECKS, WEIGHT_TOTAL };

/**
 * Strong earnings, fragile balance sheet. The kind of company that looks
 * excellent until it has to refinance.
 */
export const GEARED: Company = {
  name: 'Company C',
  scores: { profitability: 88, balance: 35, growth: 70, cashflow: 80, shareholder: 60 },
};

/**
 * Unexciting but unbreakable. Modest margins, almost no debt, returns cash.
 *
 * ⚠️ Tuned so the two weighted totals are EQUAL, not merely close. "Roughly the
 * same score" would let a reader explain the difference away as rounding, which
 * is exactly the escape hatch the figure exists to close.
 */
export const SOLID: Company = {
  name: 'Company D',
  scores: { profitability: 55, balance: 95, growth: 40, cashflow: 72, shareholder: 81 },
};

export function healthOf(c: Company): number {
  const total = CHECKS.reduce((sum, chk) => sum + c.scores[chk.key as CheckKey] * chk.weight, 0);
  return total / WEIGHT_TOTAL;
}

export const GEARED_HEALTH = healthOf(GEARED);
export const SOLID_HEALTH = healthOf(SOLID);

/** The single pillar each company is weakest on — read, never typed. */
function weakest(c: Company): { label: string; value: number } {
  return CHECKS.map((chk) => ({ label: chk.label, value: c.scores[chk.key as CheckKey] })).reduce(
    (lo, x) => (x.value < lo.value ? x : lo),
  );
}

export const GEARED_WEAKEST = weakest(GEARED);
export const SOLID_WEAKEST = weakest(SOLID);

/** The widest gap between the two on any single pillar — the figure's real subject. */
export const BIGGEST_PILLAR_GAP = CHECKS.reduce((max, chk) => {
  const gap = Math.abs(GEARED.scores[chk.key as CheckKey] - SOLID.scores[chk.key as CheckKey]);
  return gap > max ? gap : max;
}, 0);
