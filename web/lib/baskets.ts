// Ready-made ticker baskets for the Run Analysis tab.
//
// Baskets solve the "blank canvas" problem for a beginner who lands on Run
// Analysis without a ticker list of their own — one click fills the selection.
// Every basket here resolves from the light, day-cached universe index
// (UniverseStock[]) the page already loads — no new data or tables.
//
// REGISTRY by design: a future "My Watchlist" basket (Phase 2, once watchlists
// exist) drops in as one more entry, resolved against the user's saved tickers
// instead of the universe.

import { INDEX_MEMBERS, type IndexId } from '@/lib/index-membership';
import type { UniverseStock } from '@/lib/universe.server';

// "Magnificent Seven" — the one lightly-curated themed basket. Stored in
// yfinance/native format; intersected with the universe so a name we don't
// cover is silently dropped rather than failing the run.
export const MAG7 = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'] as const;

/** A selectable basket. `resolve` returns storage-format tickers, deduped. */
export interface Basket {
  id: string;
  label: string;
  description: string;
  resolve: (universe: UniverseStock[]) => string[];
}

// Index baskets resolve to the ACTUAL index constituents we cover — the
// intersection of the membership list (committed `index-membership.ts`, generated
// from analytics/universe/*.csv) with the universe. This is deliberately NOT
// "every <market> equity we cover": that would silently absorb Request-a-Ticker
// additions into "S&P 500" etc. A constituent we don't cover just doesn't appear.
function byIndex(indexId: IndexId): (u: UniverseStock[]) => string[] {
  const members = INDEX_MEMBERS[indexId];
  return (universe) => universe.filter((s) => members.has(s.ticker)).map((s) => s.ticker);
}

export const INDEX_BASKETS: Basket[] = [
  {
    id: 'sp500',
    label: 'S&P 500',
    description: 'S&P 500 constituents we cover',
    resolve: byIndex('sp500'),
  },
  {
    id: 'asx200',
    label: 'ASX 200',
    description: 'ASX 200 constituents we cover',
    resolve: byIndex('asx200'),
  },
  {
    id: 'tsx60',
    label: 'S&P/TSX 60',
    description: 'S&P/TSX 60 constituents we cover',
    resolve: byIndex('tsx60'),
  },
];

// Top-by-market-cap — a friendly, low-risk default. The universe index is
// already market-cap-descending, so this is just a slice.
export const TOP_BASKETS: Basket[] = [
  {
    id: 'top50',
    label: 'Top 50 largest',
    description: 'The 50 biggest companies by market cap',
    resolve: (universe) => universe.slice(0, 50).map((s) => s.ticker),
  },
  {
    id: 'top100',
    label: 'Top 100 largest',
    description: 'The 100 biggest companies by market cap',
    resolve: (universe) => universe.slice(0, 100).map((s) => s.ticker),
  },
];

export const THEME_BASKETS: Basket[] = [
  {
    id: 'mag7',
    label: 'Magnificent Seven',
    description: 'The seven mega-cap US tech leaders',
    resolve: (universe) => {
      const known = new Set(universe.map((s) => s.ticker));
      return MAG7.filter((t) => known.has(t));
    },
  },
];

/** All non-sector quick baskets, in display order. */
export const QUICK_BASKETS: Basket[] = [...INDEX_BASKETS, ...TOP_BASKETS, ...THEME_BASKETS];

/** Distinct sectors present in the universe, alphabetical. Powers "By sector ▾". */
export function sectorsFromUniverse(universe: UniverseStock[]): string[] {
  const set = new Set<string>();
  for (const s of universe) if (s.sector) set.add(s.sector);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Tickers in a given sector (all markets). */
export function tickersInSector(universe: UniverseStock[], sector: string): string[] {
  return universe.filter((s) => s.sector === sector).map((s) => s.ticker);
}

/** Tickers in a given industry (all markets). */
export function tickersInIndustry(universe: UniverseStock[], industry: string): string[] {
  return universe.filter((s) => s.industry === industry).map((s) => s.ticker);
}

/**
 * Industries grouped under their sector, for the Run "By industry ▾" dropdown's
 * native <optgroup>s. There are ~126 industries across 11 sectors, so a flat
 * list is unwieldy — grouping keeps it navigable in one control. A stock with an
 * industry but no sector is filed under "Other". Sectors and the industries
 * within each are alphabetical.
 */
export interface IndustryGroup {
  sector: string;
  industries: string[];
}

export function industriesBySector(universe: UniverseStock[]): IndustryGroup[] {
  const map = new Map<string, Set<string>>();
  for (const s of universe) {
    if (!s.industry) continue;
    const sector = s.sector ?? 'Other';
    (map.get(sector) ?? map.set(sector, new Set()).get(sector)!).add(s.industry);
  }
  return [...map.entries()]
    .map(([sector, set]) => ({
      sector,
      industries: [...set].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.sector.localeCompare(b.sector));
}
