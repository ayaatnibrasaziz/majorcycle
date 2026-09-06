import type { PriceBar } from '@/lib/types';

/**
 * Are the provider's QUOTED figures on the same basis as its own price HISTORY?
 *
 * ── Why this exists (audit 5A-125, 2026-09-04) ──────────────────────────────
 * `week52Low`/`week52High`/`analystTargetPrice` come from one provider snapshot;
 * the bars come from another endpoint. They are normally the same basis and the
 * question never arises. After a stock split they can part company, and when they
 * do the page divides one by the other and prints a number that is not merely
 * imprecise — it is an order of magnitude wrong, and it looks like a finding.
 *
 * Measured on AvalonBay (AVB) on 2026-09-04, after a 2.793-for-1 split:
 *   · provider quote:   price $184.06 · 52-week high $185.62 · target $201.71
 *   · provider history: last bar $68.14 (its own series, post-split)
 * so the page rendered **"+196.0% upside to target"** and **"Near low · 63.3% off
 * high"** on a stock that was roughly flat. Both are arithmetic on inputs that do
 * not belong together.
 *
 * ⚠️ **This is not ours to correct, and that is the whole design.** The owner's
 * rule, set on the VMRK naming defect the same day: where the provider is wrong,
 * we do not hand-patch the value — a manual edit is overwritten by the next
 * nightly write, and it silently stops being overwritten once the provider fixes
 * itself, leaving OUR wrong value in place forever. So this withholds the derived
 * figure instead of inventing a corrected one. Same rule as the cross-currency
 * ratios in `lib/stocks.ts`: publish nothing rather than publish it wrong.
 *
 * ⚠️ **And it deliberately does NOT reach the cycle analysis.** The Major Cycle
 * runs on the price history alone, which is internally consistent, so the drawdown,
 * the rating and the score are unaffected and stay on screen. Only the two figures
 * that MIX the two sources are withheld.
 *
 * The comparison is against our own bars because that is the answerable question.
 * "Does the provider agree with a fresh pull?" is not — on 2026-09-04 Amphenol's
 * stored history was correct and the provider's own history was the half-adjusted
 * one, so a rule trusting the provider would have hidden figures that were right.
 */

/**
 * How far the quoted 52-week high may sit from the highest high in our own bars
 * before the two are treated as different bases.
 *
 * ⚠️ A gap is NORMAL and must not trip this. The quoted high is an *intraday*
 * extreme taken over a rolling 52 weeks, ours is the highest high in the last 252
 * stored sessions, and the windows do not line up to the day — CLAUDE.md 14f
 * measured the ordinary spread at roughly 0-4%. A split produces 2x, 3x or more.
 * 25% is comfortably outside the first and nowhere near the second, so the rule
 * cannot fire on an ordinary stock and cannot miss a split.
 */
const MAX_BASIS_GAP = 0.25;

/** Bars to compare against — one trading year, matching the quote's own window. */
const WINDOW = 252;

/**
 * `false` when the quoted 52-week high cannot be reconciled with our own highest
 * high over the same window.
 *
 * ⚠️ **THE threshold lives here and nowhere else.** Two surfaces need this rule and
 * they hold the inputs differently — the Stock Detail page has the price bars, a
 * screener row has only numbers the Python backend put there. A rule that is an
 * ALGORITHM drifts when it is stated twice even if both copies start from the same
 * spec (CLAUDE.md 11c-iii), so the backend ships the two NUMBERS and this function
 * remains the only thing that decides what counts as a disagreement.
 *
 * Returns `true` — figures shown — whenever the question cannot be answered. **Unknown
 * must read as ordinary**, because the alternative is withholding real figures from
 * every stock whose data is merely incomplete, which is a much larger harm than the
 * case being guarded.
 */
export function quoteBasisAgrees(
  ourHigh: number | null | undefined,
  week52High: number | null | undefined,
): boolean {
  if (week52High == null || !(week52High > 0)) return true;
  if (ourHigh == null || !(ourHigh > 0)) return true;
  return Math.abs(week52High / ourHigh - 1) <= MAX_BASIS_GAP;
}

/** The same question, for a caller that holds the bars rather than a summary. */
export function quoteMatchesHistory(
  priceBars: PriceBar[],
  week52High: number | null | undefined,
): boolean {
  if (!priceBars.length) return true;

  const recent = priceBars.slice(-WINDOW);
  let ourHigh = 0;
  // reduce()-style loop, not Math.max(...arr) — non-negotiable #6. This slice is 252
  // long, but it comes off a full history that runs to five figures.
  for (const bar of recent) if (bar.high > ourHigh) ourHigh = bar.high;

  return quoteBasisAgrees(ourHigh, week52High);
}
