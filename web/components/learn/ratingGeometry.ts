/**
 * Geometry for "How to read a MajorCycle rating".
 *
 * ⚠️ **Nothing here is typed twice.** The weights come from `RATING_WEIGHTS` in
 * `lib/ratings.ts` (itself the mirror of `_RATING_WEIGHTS` in
 * `analytics/scoring/overall.py`), and the five tier bands are DISCOVERED by
 * walking `tierFromScore` rather than restated — so if a threshold ever moves,
 * the article's diagram moves with it instead of becoming a confident, fluent
 * lie about our own product (CLAUDE.md 11c-v).
 */

import { OVERALL_LABELS, RATING_WEIGHTS, tierColorVar, tierFromScore } from '@/lib/ratings';

export { RATING_WEIGHTS };

export interface TierBand {
  readonly label: string;
  readonly tier: 1 | 2 | 3 | 4 | 5;
  /** Lowest score that still earns this label. */
  readonly from: number;
  /** Highest score in the band. */
  readonly to: number;
  readonly color: string;
}

/**
 * The five bands, found by asking the real function where its edges are.
 *
 * Walking 0…100 rather than writing `80 / 65 / 50 / 35` means the figure cannot
 * disagree with the product, and it also means the guard checking the figure is
 * checking something real instead of comparing two copies of the same literal.
 */
function discoverBands(): readonly TierBand[] {
  const bands: TierBand[] = [];
  for (let score = 0; score <= 100; score += 1) {
    const tier = tierFromScore(score);
    const last = bands[bands.length - 1];
    if (last && last.tier === tier) {
      bands[bands.length - 1] = { ...last, to: score };
    } else {
      bands.push({
        tier,
        label: OVERALL_LABELS[tier - 1]!,
        from: score,
        to: score,
        color: tierColorVar(tier),
      });
    }
  }
  // Strongest first, matching how the product lists them.
  return bands.reverse();
}

export const TIER_BANDS: readonly TierBand[] = discoverBands();

/** The three parts of the rating, in the order the product weights them. */
export const RATING_PARTS = [
  {
    key: 'health' as const,
    label: 'Financial Health',
    weight: RATING_WEIGHTS.health,
    asks: 'Is the business behind the share sound?',
  },
  {
    key: 'valuation' as const,
    label: 'Valuation',
    weight: RATING_WEIGHTS.valuation,
    asks: 'Where does today’s price sit inside this company’s own history of falls?',
  },
  {
    key: 'payoff' as const,
    label: 'Cycle Payoff',
    weight: RATING_WEIGHTS.payoff,
    asks: 'How reliable is that history, and how has the recovery compared with the fall?',
  },
] as const;

export const WEIGHT_TOTAL = RATING_PARTS.reduce((sum, p) => sum + p.weight, 0);

/**
 * A worked example, computed rather than asserted.
 *
 * ⚠️ The total is the weighted average of the three parts, exactly as
 * `calculate_overall_rating` does it — so the label printed beside it is earned
 * by the three numbers above it rather than chosen to make a point.
 */
export const EXAMPLE = { health: 74, valuation: 68, payoff: 55 } as const;

export const EXAMPLE_TOTAL =
  (EXAMPLE.health * RATING_WEIGHTS.health +
    EXAMPLE.valuation * RATING_WEIGHTS.valuation +
    EXAMPLE.payoff * RATING_WEIGHTS.payoff) /
  WEIGHT_TOTAL;

export const EXAMPLE_TIER = tierFromScore(Math.round(EXAMPLE_TOTAL));
export const EXAMPLE_LABEL = OVERALL_LABELS[EXAMPLE_TIER - 1]!;
