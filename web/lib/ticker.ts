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

/**
 * Human country label for a market — US / AU / CA. We label by *country* rather
 * than exchange (ASX/TSX) so the whole app reads consistently: the Browse market
 * filter, per-stock badges, the detail-page tab title, and the Key Metrics "vs"
 * column all use this. (Index proper-nouns like "ASX 200" / "S&P/TSX 60" on the
 * Run baskets and the benchmark chart are deliberately kept — those name a
 * specific index, not a country.)
 *
 * THE single source of truth for the country code — badge components import
 * `marketLabel` from here rather than re-declaring their own map, so AU/CA can't
 * drift between pages.
 */
const MARKET_COUNTRY: Record<Market, string> = { us: 'US', au: 'AU', ca: 'CA' };

export function marketLabel(market: Market): string {
  return MARKET_COUNTRY[market];
}

/**
 * Display a stored ticker as "SYMBOL · COUNTRY" with NO `.AX`/`.TO` suffix —
 * e.g. `BHP.AX` → "BHP · AU", `SHOP.TO` → "SHOP · CA", `AAPL` → "AAPL · US".
 * Use this anywhere a ticker is shown to the user (titles, chart labels, legends)
 * so the country is named consistently instead of the raw storage suffix.
 */
export function tickerDisplay(stored: string): string {
  const { market, symbol } = tickerToUrlParts(stored);
  return `${symbol} · ${MARKET_COUNTRY[market]}`;
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
