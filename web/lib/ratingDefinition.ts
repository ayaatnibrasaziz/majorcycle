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
    what: 'how the stock’s typical recovery compares with its typical fall, and how much history that rests on',
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
