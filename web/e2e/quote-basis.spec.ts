import { expect, test } from '@playwright/test';

import { quoteMatchesHistory } from '@/lib/quoteBasis';
import type { PriceBar } from '@/lib/types';

/**
 * A figure that MIXES the provider's quote with the provider's history must not be
 * published when those two are on different bases.
 *
 * ── AUDIT 5A-125 ────────────────────────────────────────────────────────────
 * AvalonBay split 2.793-for-1 on 2026-08-17. The provider re-based its price
 * *history* and left its *quote* alone, so on 2026-09-04 it was simultaneously
 * telling us the price was **$184.06** with a 52-week high of **$185.62** and a
 * target of **$201.71**, and serving a price series whose last bar was **$68.14**.
 * Every figure the page builds from both then went wrong at once:
 *
 *     "+196.0% upside to target"      "Near low · 63.3% off high"
 *
 * on a stock that was roughly flat. Nothing errored. Both numbers are arithmetic
 * that a reviewer would check and find correct — the inputs simply did not belong
 * together, and there is no way to see that by looking at the page.
 *
 * ⚠️ **The fix withholds; it never corrects.** Owner's rule, set the same day on
 * the VMRK naming defect: where the provider is wrong we do not hand-patch, because
 * the next nightly write overwrites the patch, and once the provider fixes itself
 * the patch stops being overwritten and OUR wrong value lives forever.
 *
 * Pure and credential-free — no browser, no network, no secrets — so it runs on a
 * fork PR and can never self-skip.
 */

/** Bars ending at `last`, with the highest high at `high`. */
function bars(high: number, last: number, n = 260): PriceBar[] {
  const out: PriceBar[] = [];
  for (let i = 0; i < n; i += 1) {
    const isPeak = i === Math.floor(n / 2);
    const close = isPeak ? high * 0.99 : last;
    out.push({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      open: close,
      high: isPeak ? high : last * 1.01,
      low: close * 0.99,
      close,
      volume: 1_000,
    });
  }
  return out;
}

test.describe('a quoted figure is withheld when it disagrees with our history', () => {
  test('AvalonBay after its split — withheld', () => {
    // The real numbers: our series peaked near $71 in the last year; the quote
    // still claims a 52-week high of $185.62. That is the split factor, not a market.
    expect(quoteMatchesHistory(bars(71.5, 68.14), 185.62)).toBe(false);
  });

  /**
   * ⚠️ THE CONTROL, and the load-bearing half. "Withhold when they disagree" is
   * satisfied perfectly by a function that returns `false` for everything — which
   * would silently strip the 52-week gauge and the analyst target from all 864
   * stocks, a far bigger defect than the one being fixed.
   *
   * The gap between a quoted 52-week high and our own highest high is NORMAL: the
   * quote is an intraday extreme over a rolling 52 weeks, ours is the highest high
   * in 252 stored sessions, and the windows do not align to the day. CLAUDE.md 14f
   * measured that ordinary spread at roughly 0-4%.
   */
  test('an ordinary stock keeps its figures', () => {
    // Apple on the day this was written: our 252-bar high 344.27, quote 344.27.
    expect(quoteMatchesHistory(bars(344.27, 324.96), 344.27)).toBe(true);
    // And with the ordinary intraday-vs-stored spread at each end of 14f's range.
    expect(quoteMatchesHistory(bars(100, 95), 100.5)).toBe(true);
    expect(quoteMatchesHistory(bars(100, 95), 104)).toBe(true);
    expect(quoteMatchesHistory(bars(100, 95), 96)).toBe(true);
  });

  test('the boundary is where it says it is', () => {
    // 25% either side: inside passes, outside is withheld. Asserted so that moving
    // the threshold is a deliberate act with a red test, not a quiet edit.
    expect(quoteMatchesHistory(bars(100, 95), 124)).toBe(true);
    expect(quoteMatchesHistory(bars(100, 95), 126)).toBe(false);
    expect(quoteMatchesHistory(bars(100, 95), 76)).toBe(true);
    expect(quoteMatchesHistory(bars(100, 95), 74)).toBe(false);
  });

  /**
   * Unknown must read as ordinary. Withholding whenever the question cannot be
   * answered would strip real figures from every stock with an incomplete record —
   * 317 have no short interest, 100 have no P/E — which is the larger harm.
   */
  test('an unanswerable question shows the figures', () => {
    expect(quoteMatchesHistory(bars(100, 95), null)).toBe(true);
    expect(quoteMatchesHistory(bars(100, 95), undefined)).toBe(true);
    expect(quoteMatchesHistory(bars(100, 95), 0)).toBe(true);
    expect(quoteMatchesHistory([], 185.62)).toBe(true);
  });

  /**
   * The window is a trading year, matching the quote's own. Without the slice a
   * five-year history would be compared against a 52-week figure and every stock
   * that has ever doubled would lose its gauge.
   */
  test('only the last trading year is compared', () => {
    const old = bars(500, 95, 40); // an ancient peak, well outside 252 bars
    const recent = bars(100, 95, 260);
    expect(quoteMatchesHistory([...old, ...recent], 100)).toBe(true);
  });
});
