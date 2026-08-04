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
});
