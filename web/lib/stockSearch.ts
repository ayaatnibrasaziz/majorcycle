/**
 * Search matching and ranking for Browse and the Request page — pure, so it can be
 * driven by a credential-free spec (e2e/stock-search.spec.ts).
 *
 * ⚠️ Beta review E-1 / E-6 (owner-approved 2026-09-29). Browse matched a plain
 * lower-case substring, so "Estee Lauder" missed "The Estée Lauder Companies",
 * "Johnson and Johnson" missed "Johnson & Johnson", "Toronto Dominion" missed "The
 * Toronto-Dominion Bank" and "BRK.B" missed "BRK-B" — and then told the reader we did
 * not cover them. Accents, "&" and punctuation are now ignored on BOTH sides.
 *
 * Deliberately NOT here (owner, same day): nicknames ("Google", "CommBank", "RBC" —
 * a hand-kept list, and "RBC" is itself a US ticker) and typo tolerance (confident
 * wrong matches).
 */

import type { ListingHit } from '@/lib/types';

/** Lower-case, accents removed, "&" read as "and", punctuation as spaces. */
export function searchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Letters and digits only — how a ticker is compared ("BRK.B" = "BRK-B" = "brkb"). */
export function compactTicker(s: string): string {
  return searchText(s).replace(/ /g, '');
}

export interface Searchable {
  ticker: string;
  name: string | null;
}

/** Does the reader's query find this stock, by ticker or by name? Empty matches all. */
export function matchesQuery(stock: Searchable, query: string): boolean {
  const words = searchText(query);
  if (!words) return true;
  if (compactTicker(stock.ticker).includes(words.replace(/ /g, ''))) return true;
  return searchText(stock.name ?? '').includes(words);
}

/**
 * How strongly a stock matches, for ordering search results (higher first). An exact
 * ticker — with or without its exchange suffix — beats a ticker that merely starts
 * with the query, which beats everything else. Ties keep the caller's order.
 */
export function matchStrength(ticker: string, query: string): number {
  const q = compactTicker(query);
  if (!q) return 0;
  const full = compactTicker(ticker);
  const root = compactTicker(ticker.split('.')[0] ?? ticker);
  if (full === q || root === q) return 2;
  if (root.startsWith(q)) return 1;
  return 0;
}

/**
 * The Request page's order: an exact ticker first, then the stocks we already cover,
 * then the database's own order. "CBA" put CBAK Energy, Colony Bankcorp and Champion
 * Bear above Commonwealth Bank; "SHOP" put the US Shopify listing we do not cover
 * above SHOP.TO, which we do.
 */
export function rankListingHits(hits: ListingHit[], query: string): ListingHit[] {
  return hits
    .map((h, i) => ({ h, i, s: matchStrength(h.symbol, query) }))
    .sort((a, b) => b.s - a.s || Number(b.h.covered) - Number(a.h.covered) || a.i - b.i)
    .map((x) => x.h);
}
