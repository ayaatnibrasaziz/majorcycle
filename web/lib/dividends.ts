/**
 * The thresholds the Dividend History card reads a payment against.
 *
 * ⚠️ **Extracted 2026-08-20 because a Learn article now states them.** They lived
 * as literals inside `components/stocks/DividendHistory.tsx` — correct, and
 * correct in exactly one place, which was fine while only that card used them. A
 * public article that says "below 60% is comfortable" is a SECOND copy of the
 * same rule, written in English, invisible to TypeScript and to every guard we
 * own: retune the band and the article would not error, would not look stale and
 * would not stop rendering. It would simply become a confident, fluent, false
 * statement about our own product (CLAUDE.md 11c-v).
 *
 * So the card and the article now read the same constants, and `learn.spec.ts`
 * builds its assertion from these values rather than from the digits in the prose.
 */

/** Below this share of profit, a dividend has room to grow. */
export const PAYOUT_COMFORTABLE_MAX = 60;

/** Between the two, it is being funded with little left over. */
export const PAYOUT_STRAINED_MAX = 80;

/**
 * A trailing yield above this almost always means the share price has collapsed
 * rather than that the income is generous — the card flags it and drops the
 * reassuring colour rather than hiding the number.
 */
export const DISTRESS_YIELD_PCT = 20;

/** Above this the payout ratio is clamped for display, with the sign kept. */
export const PAYOUT_DISPLAY_CAP = 300;
