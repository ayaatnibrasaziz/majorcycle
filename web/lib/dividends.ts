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

/**
 * Consecutive years of increases at which the growth streak turns green.
 *
 * ⚠️ EXTRACTED 2026-09-11 because the tile's own tooltip disagreed with it. The
 * colour changed at five while the words said *"10+ years signals exceptional
 * financial discipline"*, so a reader with a six-year streak saw a green figure
 * under a sentence naming ten as the mark. Neither number was wrong; they were
 * answering different questions and only one of them was written down.
 *
 * Both survive, and the tooltip is now built FROM this constant rather than
 * restating it — five is where we call a record established, ten is still the
 * higher bar and is described as such (CLAUDE.md 11c-v: a sentence that states a
 * constant IS a copy of that constant).
 */
export const STREAK_GREEN_YEARS = 5;

/** The longer record the copy calls exceptional. Never changes a colour. */
export const STREAK_EXCEPTIONAL_YEARS = 10;

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

/**
 * Complete calendar years of dividends, with the years NOTHING was paid filled in as 0.
 *
 * ⚠️ Beta review B-18, 2026-10-03. The provider lists only years with a payment, so a
 * company that paid in 1995 and again from 2012 drew 1995 beside 2012 as neighbours,
 * and the growth streak counted the resumption as a year of growth. Filling the gap
 * makes the chart and the streak see it. The series runs to LAST year, so a company
 * that stopped paying ends on zeros rather than on its last payment: 39 stocks (Boeing,
 * Adobe, Intel…) were showing a "current yield" built from a dividend they no longer pay.
 *
 * The current year is left out: it holds only the payments made so far.
 */
export function annualDividendSeries(
  history: ReadonlyArray<{ year: number; amount: number }>,
  currentYear: number,
): Array<{ year: number; amount: number }> {
  const complete = history.filter((d) => d.year < currentYear);
  if (complete.length === 0) return [];
  const byYear = new Map(complete.map((d) => [d.year, d.amount]));
  const first = Math.min(...complete.map((d) => d.year));
  const out: Array<{ year: number; amount: number }> = [];
  for (let y = first; y < currentYear; y++) out.push({ year: y, amount: byYear.get(y) ?? 0 });
  return out;
}

/** Consecutive latest years in which the dividend rose; a resumption after a gap is not a rise. */
export function dividendStreak(series: ReadonlyArray<{ year: number; amount: number }>): number {
  let streak = 0;
  for (let i = series.length - 1; i > 0; i--) {
    const prev = series[i - 1]!.amount;
    if (prev > 0 && series[i]!.amount > prev) streak++;
    else break;
  }
  return streak;
}

/** The last year anything was paid, or null. */
export function lastDividendYear(series: ReadonlyArray<{ year: number; amount: number }>): number | null {
  for (let i = series.length - 1; i >= 0; i--) if (series[i]!.amount > 0) return series[i]!.year;
  return null;
}
