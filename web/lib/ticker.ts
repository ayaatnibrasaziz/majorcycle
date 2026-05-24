// Ticker format conversion between URL routing and DB storage.
// This is the ONLY place this conversion happens — do not duplicate.

import type { Market } from '@/lib/types';

/** Convert a storage-format ticker to URL path parts. */
export function tickerToUrlParts(stored: string): {
  market: Market;
  symbol: string;
} {
  if (stored.endsWith('.AX')) {
    return { market: 'au', symbol: stored.slice(0, -3) };
  }
  if (stored.endsWith('.TO')) {
    return { market: 'ca', symbol: stored.slice(0, -3) };
  }
  return { market: 'us', symbol: stored };
}

/** Convert URL path parts to a storage-format ticker. */
export function urlPartsToTicker(market: Market, symbol: string): string {
  const upper = symbol.toUpperCase();
  if (market === 'au') return `${upper}.AX`;
  if (market === 'ca') return `${upper}.TO`;
  return upper;
}

/** Build the canonical URL path for a stock detail page. */
export function stockPath(market: Market, symbol: string): string {
  return `/stocks/${market}/${symbol.toUpperCase()}`;
}

/** Build a stock path from a storage-format ticker. */
export function tickerToPath(stored: string): string {
  const { market, symbol } = tickerToUrlParts(stored);
  return stockPath(market, symbol);
}
