// Ticker format conversion between URL routing and DB storage.
// This is the ONLY place this conversion happens — do not duplicate.

import type { Market } from '@/lib/types';

/**
 * Every exchange suffix we store, and the market it belongs to. THE list — a
 * second copy of this rule is how `.V` came to be mis-filed as US (see below).
 *
 * `keepSuffix` is the subtlety. `.AX`/`.TO` are dropped from the URL because a
 * market has exactly one of them, so `au` + `BHP` reconstructs `BHP.AX`
 * unambiguously. Canada has TWO (`.TO` = TSX, `.V` = TSX Venture), so dropping
 * `.V` would make `ABC.V` and `ABC.TO` collide on `/stocks/ca/ABC` and resolve
 * to the WRONG COMPANY. Venture symbols therefore keep their suffix in the URL:
 * `/stocks/ca/ABC.V`. That still satisfies locked decision #13
 * (`/stocks/[market]/[ticker]`) — the exchange rides in the ticker, not a new
 * path segment.
 */
const MARKET_SUFFIXES: readonly { suffix: string; market: Market; keepSuffix: boolean }[] = [
  { suffix: '.AX', market: 'au', keepSuffix: false },
  { suffix: '.TO', market: 'ca', keepSuffix: false },
  { suffix: '.V', market: 'ca', keepSuffix: true },
];

/** Convert a storage-format ticker to URL path parts. */
export function tickerToUrlParts(stored: string): {
  market: Market;
  symbol: string;
} {
  for (const { suffix, market, keepSuffix } of MARKET_SUFFIXES) {
    if (stored.endsWith(suffix)) {
      return { market, symbol: keepSuffix ? stored : stored.slice(0, -suffix.length) };
    }
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

/**
 * Convert URL path parts to a storage-format ticker — or `null` when the market
 * segment does not own that ticker.
 *
 * ⚠️ The null case closes audit 5A-034, and the defect was wider than the `.V`
 * case that exposed it. A kept-suffix symbol carries its own exchange, so the
 * branch below returns BEFORE `market` is ever consulted: `/stocks/us/AE.V` and
 * `/stocks/au/AE.V` both resolved to the Canadian company. `us` is also the
 * pass-through market, so any fully-qualified ticker resolved under it —
 * `/stocks/us/BHP.AX` served the Australian stock.
 *
 * Every OTHER cross-market URL 404s only by accident: the reconstruction happens
 * to build a ticker nobody owns (`/stocks/ca/AAPL` → `AAPL.TO` → absent). An
 * accident is not a rule, so the agreement is asserted instead — whatever we
 * build must map BACK to the market named in the URL. `tickerToUrlParts` is the
 * same table read the other way, so one ticker can be reached from exactly one
 * market and there is no second list to drift (CLAUDE.md 11c).
 */
export function urlPartsToTicker(market: Market, symbol: string): string | null {
  const upper = symbol.toUpperCase();
  // A kept suffix means the URL symbol IS already storage format — appending
  // the market's default would build `ABC.V.TO`, a ticker that doesn't exist.
  const kept = MARKET_SUFFIXES.some((s) => s.keepSuffix && upper.endsWith(s.suffix));
  let stored: string;
  if (kept) stored = upper;
  else if (market === 'au') stored = `${upper}.AX`;
  else if (market === 'ca') stored = `${upper}.TO`;
  else stored = upper;

  return tickerToUrlParts(stored).market === market ? stored : null;
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
