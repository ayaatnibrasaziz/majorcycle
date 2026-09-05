import { expect, test } from '@playwright/test';

import { tickerToUrlParts, urlPartsToTicker } from '@/lib/ticker';

/**
 * Storage ticker <-> URL round-trip. Pure logic, no browser.
 *
 * Why this exists: the ticker->market rule lived in four places, and two of them
 * only knew `.AX` and `.TO`. TSX Venture (`.V`) is Canadian, so it was silently
 * filed as US — wrong country badge, wrong benchmark, wrong Browse filter.
 *
 * The sharp edge is Canada having TWO suffixes. If `.V` were stripped from the
 * URL like `.TO` is, `ABC.V` and `ABC.TO` would both live at /stocks/ca/ABC and
 * one would resolve to the other company's data. That collision is the case
 * worth guarding, not the label.
 */

const ROUND_TRIP: [stored: string, market: 'us' | 'au' | 'ca', symbol: string][] = [
  ['AAPL', 'us', 'AAPL'],
  ['BRK-B', 'us', 'BRK-B'],
  ['BHP.AX', 'au', 'BHP'],
  ['29M.AX', 'au', '29M'],
  ['SHOP.TO', 'ca', 'SHOP'],
  ['GIB-A.TO', 'ca', 'GIB-A'],
  ['ABC.V', 'ca', 'ABC.V'],
  ['XYZ-A.V', 'ca', 'XYZ-A.V'],
];

test.describe('ticker <-> URL routing', () => {
  for (const [stored, market, symbol] of ROUND_TRIP) {
    test(`${stored} maps to /stocks/${market}/${symbol} and back`, async () => {
      expect(tickerToUrlParts(stored)).toEqual({ market, symbol });
      expect(urlPartsToTicker(market, symbol)).toBe(stored);
    });
  }

  test('TSX Venture and TSX cannot collide on the same URL', async () => {
    const tsx = tickerToUrlParts('ABC.TO');
    const venture = tickerToUrlParts('ABC.V');

    expect(tsx.market).toBe('ca');
    expect(venture.market).toBe('ca');
    // Same market, same base name — the URL symbol MUST still differ.
    expect(venture.symbol).not.toBe(tsx.symbol);

    // And each must resolve back to its own company, not the other's.
    expect(urlPartsToTicker('ca', tsx.symbol)).toBe('ABC.TO');
    expect(urlPartsToTicker('ca', venture.symbol)).toBe('ABC.V');
  });

  test('a lowercase URL symbol still resolves', async () => {
    expect(urlPartsToTicker('ca', 'abc.v')).toBe('ABC.V');
    expect(urlPartsToTicker('au', 'bhp')).toBe('BHP.AX');
  });

  /**
   * Audit 5A-034 — owner-reported: a `.V` stock answered on ALL THREE markets.
   *
   * The mechanism: a kept-suffix symbol carries its own exchange, so the
   * conversion returned before `market` was consulted. The same hole existed for
   * any fully-qualified ticker under `us`, which is the pass-through market.
   *
   * ⚠️ Every OTHER cross-market URL 404s by ACCIDENT rather than by rule — the
   * reconstruction builds a ticker nobody owns. The positive controls below are
   * the load-bearing half: a conversion that refused everything would satisfy
   * every refusal here and break the entire product.
   */
  test('a ticker is reachable from exactly ONE market', async () => {
    // The reported defect, all three markets named explicitly.
    expect(urlPartsToTicker('ca', 'AE.V')).toBe('AE.V');
    expect(urlPartsToTicker('us', 'AE.V')).toBeNull();
    expect(urlPartsToTicker('au', 'AE.V')).toBeNull();

    // Wider than `.V`: `us` passes a symbol straight through, so a fully
    // qualified AU/CA ticker used to resolve under it.
    expect(urlPartsToTicker('us', 'BHP.AX')).toBeNull();
    expect(urlPartsToTicker('us', 'SHOP.TO')).toBeNull();

    // CONTROL — the ordinary paths must all still work, or this guard is
    // passing because nothing resolves at all.
    expect(urlPartsToTicker('us', 'AAPL')).toBe('AAPL');
    expect(urlPartsToTicker('au', 'BHP')).toBe('BHP.AX');
    expect(urlPartsToTicker('ca', 'SHOP')).toBe('SHOP.TO');
    expect(urlPartsToTicker('us', 'BRK-B')).toBe('BRK-B');
  });

  test('every stored ticker resolves from its own market and no other', async () => {
    const MARKETS = ['us', 'au', 'ca'] as const;
    for (const [stored, market, symbol] of ROUND_TRIP) {
      for (const m of MARKETS) {
        const got = urlPartsToTicker(m, symbol);
        if (m === market) expect(got, `${symbol} under /${m}/`).toBe(stored);
        else expect(got, `${symbol} must not resolve under /${m}/`).not.toBe(stored);
      }
    }
  });
});
