import { expect, test } from '@playwright/test';

import { matchesQuery, matchStrength, rankListingHits } from '../lib/stockSearch';
import type { ListingHit } from '../lib/types';

/**
 * Browse search and the Request page's order (beta review E-1 / E-6, owner-approved
 * 2026-09-29). Pure and credential-free. Every name is the one stored in `stocks` or
 * `listings` on that day.
 */

const stock = (ticker: string, name: string) => ({ ticker, name });

test.describe('Browse finds what the reader typed', () => {
  const cases: Array<[string, { ticker: string; name: string }]> = [
    ['Estee Lauder', stock('EL', 'The Estée Lauder Companies Inc.')],
    ['estée', stock('EL', 'The Estée Lauder Companies Inc.')],
    ['Johnson and Johnson', stock('JNJ', 'Johnson & Johnson')],
    ['Johnson & Johnson', stock('JNJ', 'Johnson & Johnson')],
    ['Toronto Dominion', stock('TD.TO', 'The Toronto-Dominion Bank')],
    ['toronto-dominion', stock('TD.TO', 'The Toronto-Dominion Bank')],
    ['BRK.B', stock('BRK-B', 'Berkshire Hathaway Inc.')],
    ['brk b', stock('BRK-B', 'Berkshire Hathaway Inc.')],
    ['bhp', stock('BHP.AX', 'BHP Group Limited')],
    ['BHP.AX', stock('BHP.AX', 'BHP Group Limited')],
    ['  commonwealth  bank ', stock('CBA.AX', 'Commonwealth Bank of Australia')],
  ];
  for (const [q, s] of cases) {
    test(`"${q}" finds ${s.ticker}`, () => expect(matchesQuery(s, q)).toBe(true));
  }

  test('CONTROL: it still excludes what does not match', () => {
    // "Forgiving" must not mean "matches everything" — that would pass every case above.
    expect(matchesQuery(stock('JNJ', 'Johnson & Johnson'), 'Estee Lauder')).toBe(false);
    expect(matchesQuery(stock('EL', 'The Estée Lauder Companies Inc.'), 'toronto')).toBe(false);
    expect(matchesQuery(stock('AAPL', 'Apple Inc.'), 'Google')).toBe(false); // nicknames: deliberately not supported
  });

  test('an empty search matches everything', () => {
    expect(matchesQuery(stock('AAPL', 'Apple Inc.'), '   ')).toBe(true);
  });

  test('an exact ticker outranks a longer one that merely starts the same', () => {
    expect(matchStrength('BHP.AX', 'bhp')).toBeGreaterThan(matchStrength('BHPX', 'bhp'));
    expect(matchStrength('BRK-B', 'BRK.B')).toBe(2);
    expect(matchStrength('AAPL', 'apple')).toBe(0);
  });
});

test.describe('the Request page puts the intended stock first', () => {
  const hit = (symbol: string, name: string, covered: boolean): ListingHit =>
    ({ symbol, name, exchange: null, market: 'us', covered, requestStatus: null }) as ListingHit;

  test('"CBA": Commonwealth Bank, not CBAK Energy', () => {
    // The live RPC's order on 2026-09-29.
    const db = [
      hit('CBAT', 'CBAK Energy Technology Limited', false),
      hit('CBAN', 'Colony Bankcorp, Inc.', false),
      hit('CBA.V', 'Champion Bear Resources Ltd.', false),
      hit('CBA.AX', 'COMMONWEALTH BANK OF AUSTRALIA.', true),
      hit('CBAR-P.V', 'Castlebar Capital Corp.', false),
    ];
    expect(rankListingHits(db, 'cba').map((h) => h.symbol)).toEqual(['CBA.AX', 'CBA.V', 'CBAT', 'CBAN', 'CBAR-P.V']);
  });

  test('"SHOP": the Shopify we cover before the one we do not', () => {
    const db = [hit('SHOP', 'Shopify Inc.', false), hit('SHOP.TO', 'Shopify Inc.', true), hit('BBW', 'Build-A-Bear', false)];
    expect(rankListingHits(db, 'shop').map((h) => h.symbol)).toEqual(['SHOP.TO', 'SHOP', 'BBW']);
  });

  test('CONTROL: with nothing to prefer, the database order stands', () => {
    const db = [hit('NBR', 'Nabors', false), hit('ACB', 'Aurora', false)];
    expect(rankListingHits(db, 'zzz').map((h) => h.symbol)).toEqual(['NBR', 'ACB']);
  });
});
