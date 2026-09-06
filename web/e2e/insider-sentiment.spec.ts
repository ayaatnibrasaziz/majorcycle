import { expect, test } from '@playwright/test';

import { insiderSentiment } from '@/lib/insiderSentiment';
import type { InsiderTransaction } from '@/lib/types';

/**
 * A label about insider activity must be true of the filings underneath it.
 *
 * ── AUDIT 5A-127 ────────────────────────────────────────────────────────────
 * Both defects here were sentences that read perfectly and were not true, so
 * neither could be seen by looking at a page. They were found by counting across
 * the whole universe — the only instrument that can separate a plausible label
 * from a correct one.
 *
 *   · **45 of 820** stocks with insider filings had NO purchases and NO sales at
 *     all — only awards and transfers — and were told they were NET SELLERS.
 *   · **24 of 820** were called NET BUYER while their insiders sold more than
 *     they bought, because the test was `buys > sells * 0.5`.
 *
 * Pure and credential-free: no browser, no network, no secrets.
 */

const INK = { up: '#1B7A1B', down: '#B22222' };

function tx(type: InsiderTransaction['type'], value: number | null): InsiderTransaction {
  return {
    date: '2026-01-15',
    insider: 'A. Person',
    position: 'Director',
    type,
    shares: 100,
    value,
  } as InsiderTransaction;
}

test.describe('insider sentiment says only what the filings support', () => {
  test('awards and transfers alone are not selling', () => {
    // Bunge's real shape: 50 filings, every one an Award. Was "NET SELLER (Bearish)".
    const awardsOnly = Array.from({ length: 50 }, () => tx('Award', null));
    expect(insiderSentiment(awardsOnly, INK)).toBeNull();

    // Brookfield's: Awards mixed with "Other". Also not a direction.
    expect(insiderSentiment([tx('Award', null), tx('Other', null), tx('Gift', null)], INK)).toBeNull();
  });

  test('a purchase-and-sale pair is judged on which is larger', () => {
    // The 24-stock band: sold more than bought, and was called NET BUYER.
    const netSeller = insiderSentiment([tx('Purchase', 600_000), tx('Sale', 1_000_000)], INK);
    expect(netSeller?.label).toBe('NET SELLER (Bearish)');

    const netBuyer = insiderSentiment([tx('Purchase', 1_000_000), tx('Sale', 600_000)], INK);
    expect(netBuyer?.label).toBe('NET BUYER (Bullish)');
  });

  /**
   * ⚠️ THE CONTROL. "Return null when the filings are silent" is satisfied
   * perfectly by a function that returns null for everything — which would delete
   * the signal from all 820 stocks that have one, a far larger defect than the two
   * being fixed. These two assertions are what make the ones above mean something.
   */
  test('a real signal is still reported', () => {
    expect(insiderSentiment([tx('Purchase', 5_000_000)], INK)).not.toBeNull();
    expect(insiderSentiment([tx('Sale', 5_000_000)], INK)).not.toBeNull();
  });

  test('exactly balanced says nothing, because neither word would be true', () => {
    expect(insiderSentiment([tx('Purchase', 250_000), tx('Sale', 250_000)], INK)).toBeNull();
  });

  test('a filing with no value cannot swing the verdict', () => {
    // yfinance leaves `value` null on plenty of rows. A null must count as no
    // evidence, not as a zero that tips a comparison.
    expect(insiderSentiment([tx('Purchase', null), tx('Sale', null)], INK)).toBeNull();
    expect(insiderSentiment([tx('Purchase', null), tx('Sale', 400_000)], INK)?.label)
      .toBe('NET SELLER (Bearish)');
  });

  test('the colours come from the ink layer, not from literals', () => {
    // Value-sensitive: the tag's ink must be whatever the palette passes in, so a
    // palette change moves it (CLAUDE.md 11c-viii — a private colour table drifted
    // for a month because nothing tied it to the real one).
    expect(insiderSentiment([tx('Purchase', 1)], INK)?.color).toBe(INK.up);
    expect(insiderSentiment([tx('Sale', 1)], INK)?.color).toBe(INK.down);
  });
});
