import { RATING_WEIGHTS } from '@/lib/ratings';

/**
 * What the Overall Rating IS, in words — ONE definition for every surface that
 * explains it (owner, 2026-10-03; beta review D-15 / F-6).
 *
 * ⚠️ Until then it was described three different ways: the first-login screen listed
 * "Cycle Position" as one of its parts and never mentioned Cycle Payoff or a weight;
 * the paywall window called its third part "the historical payoff from buying at this
 * point", which is buy-framed; and the landing page gave the real three parts and
 * weights. A reader meeting all three could not tell what the number is made of.
 *
 * The weights are READ from `RATING_WEIGHTS` (which mirrors the Python scorer), and the
 * bands from `RATING_BANDS`, which `e2e/rating-definition.spec.ts` checks against the
 * real score-to-label rule — so the words cannot drift from the number (CLAUDE.md 11c-v).
 */
export const RATING_PARTS = [
  {
    key: 'health',
    name: 'Financial Health',
    weight: RATING_WEIGHTS.health,
    what: 'how strong the business is, from five pillars of its accounts',
  },
  {
    key: 'valuation',
    name: 'Valuation',
    weight: RATING_WEIGHTS.valuation,
    what: 'where today’s price sits in the stock’s own drawdown band, marked down when the business is weak',
  },
  {
    key: 'payoff',
    name: 'Cycle Payoff',
    weight: RATING_WEIGHTS.payoff,
    what: 'how far the stock’s typical recovery has gone past its typical fall, and how much history that rests on',
  },
] as const;

/** Lowest whole score for each label, strongest first. */
export const RATING_BANDS = [
  { min: 80, label: 'High Conviction' },
  { min: 65, label: 'Constructive' },
  { min: 50, label: 'Neutral' },
  { min: 35, label: 'Cautious' },
  { min: 0, label: 'Bearish' },
] as const;

/** "Financial Health (40%), Valuation (35%) and Cycle Payoff (25%)". */
export const RATING_PARTS_TEXT = RATING_PARTS.map((p) => `${p.name} (${p.weight}%)`)
  .join(', ')
  .replace(/, ([^,]+)$/, ' and $1');

/** The one-sentence definition. */
export const RATING_SUMMARY = `A single 0–100 score made of three parts: ${RATING_PARTS_TEXT}.`;

/** "80–100 High Conviction · 65–79 Constructive · … · 0–34 Bearish". */
export const RATING_BANDS_TEXT = RATING_BANDS.map((b, i) => {
  const top = i === 0 ? 100 : RATING_BANDS[i - 1]!.min - 1;
  return `${b.min}–${top} ${b.label}`;
}).join(' · ');

/**
 * Cycle Payoff — when each half reaches full marks (owner, 2026-10-10). These MIRROR
 * `PAYOFF_FULL_EVENTS` / `PAYOFF_FULL_RATIO` in `analytics/scoring/overall.py`, which is
 * what actually scores; `e2e/rating-definition.spec.ts` reads both files and fails if
 * they disagree, so an explanation cannot state a number the scorer no longer uses.
 *
 * Events are the low points plus high points in the record (~25 a year on every
 * horizon), so 250 is about ten years. The ratio is how many fall-sized climbs the
 * typical rise holds: ln(1 + rise) ÷ ln(1 ÷ (1 + fall)).
 */
export const PAYOFF_FULL_EVENTS = 250;
export const PAYOFF_FULL_RATIO = 2.5;

/**
 * Confidence on the Verdict, from the LOW POINTS in the record (owner, 2026-10-10). A
 * stock records ~12 low points a year on every horizon, so 125 / 60 / 25 are about
 * 10 / 5 / 2 years. It was 15 / 10 / 5 until then, which every stock in the universe
 * passed, including one with 1.3 years of history.
 */
export const CONFIDENCE_TIERS = [
  { min: 125, name: 'High', years: 10 },
  { min: 60, name: 'Solid', years: 5 },
  { min: 25, name: 'Moderate', years: 2 },
  { min: 0, name: 'Limited', years: 0 },
] as const;

export type ConfidenceName = (typeof CONFIDENCE_TIERS)[number]['name'];

export function confidenceTier(lowPoints: number): ConfidenceName {
  return CONFIDENCE_TIERS.find((t) => lowPoints >= t.min)!.name;
}

/** Below this many low points the history is too short to lean on: confidence reads Limited. */
export const LIMITED_HISTORY_BELOW = CONFIDENCE_TIERS[2].min;

/** At or above this many, confidence reads High. */
export const HIGH_CONFIDENCE_FROM = CONFIDENCE_TIERS[0].min;

/** "125+ (about 10 years) = High · 60–124 = Solid · 25–59 = Moderate · under 25 = Limited". */
export const CONFIDENCE_TIERS_TEXT = CONFIDENCE_TIERS.map((t, i) => {
  if (i === 0) return `${t.min}+ (about ${t.years} years) = ${t.name}`;
  if (t.min === 0) return `under ${CONFIDENCE_TIERS[i - 1]!.min} = ${t.name}`;
  return `${t.min}–${CONFIDENCE_TIERS[i - 1]!.min - 1} = ${t.name}`;
}).join(' · ');
