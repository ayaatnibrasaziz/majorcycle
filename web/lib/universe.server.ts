// Lightweight universe index for the /stocks Browse & Search page.
//
// The Browse page lets a user search and filter the whole ~720-stock universe.
// To keep it fast (and never ship the heavy `fundamentals` JSONB to the client),
// we load only the handful of columns the list needs — ticker, market, name,
// sector, industry, currency, market_cap — for every non-index equity, cache it
// for a day, and let the client filter/sort the small payload in memory.
//
// The 720 equities are well under PostgREST's 1000-row cap, so one select is
// enough. `market='index'` rows are benchmarks (^GSPC etc.) and are excluded.

import { unstable_cache } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/server';
import type { Currency, Market } from '@/lib/types';

/** One row of the searchable universe — light, client-safe. */
export interface UniverseStock {
  ticker: string;
  market: Market;
  name: string | null;
  sector: string | null;
  industry: string | null;
  currency: Currency;
  marketCap: number | null;
}

async function _fetchUniverseIndex(): Promise<UniverseStock[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('stocks')
    .select('ticker,market,name,sector,industry,currency,market_cap')
    .neq('market', 'index')
    .order('market_cap', { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  return (
    data as {
      ticker: string;
      market: Market;
      name: string | null;
      sector: string | null;
      industry: string | null;
      currency: Currency;
      // `market_cap` is a Postgres `numeric`, which PostgREST serialises as a
      // string to preserve precision — coerce to a number for the client.
      market_cap: string | number | null;
    }[]
  ).map((row) => ({
    ticker: row.ticker,
    market: row.market,
    name: row.name,
    sector: row.sector,
    industry: row.industry,
    currency: row.currency,
    marketCap:
      row.market_cap == null || row.market_cap === ''
        ? null
        : Number(row.market_cap),
  }));
}

/**
 * Cached daily. Returns the light, market-cap-descending index of every
 * non-index equity in our universe. Safe to load from the /stocks Server
 * Component and hand to the client browser.
 */
export const fetchUniverseIndex = unstable_cache(
  _fetchUniverseIndex,
  ['universe-index-v1'],
  { revalidate: 86400 },
);
