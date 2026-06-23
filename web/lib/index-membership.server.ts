// Index-membership reader for the Run Analysis index baskets.
//
// The S&P 500 / ASX 200 / S&P/TSX 60 baskets resolve to the ACTUAL constituents we
// cover — the intersection of the index membership list with the universe. That
// membership lives in the `index_membership` table, refreshed nightly from official
// ETF holdings files by analytics/cron/refresh_index_membership.py. Reading it at
// request time (rather than from a committed file baked in at build) means a
// membership change goes live with NO redeploy.
//
// Light + server-only (service-role): we read just (index_id, ticker) for the
// active members, cache it for a day, and hand the plain arrays to the client.

import { unstable_cache } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/server';
import type { IndexId, IndexMembership } from '@/lib/types';

const EMPTY: IndexMembership = { sp500: [], asx200: [], tsx60: [] };

async function _fetchIndexMembership(): Promise<IndexMembership> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('index_membership')
    .select('index_id,ticker')
    .eq('is_active', true);

  // Graceful: on error (or before the table/seed exists) the index baskets simply
  // resolve to empty — the Top/Sector/Industry/Mag7 baskets are unaffected — rather
  // than throwing and breaking the Run page.
  if (error || !data) return EMPTY;

  const out: IndexMembership = { sp500: [], asx200: [], tsx60: [] };
  for (const row of data as { index_id: IndexId; ticker: string }[]) {
    (out[row.index_id] ??= []).push(row.ticker);
  }
  return out;
}

/**
 * Cached daily. Returns the active constituents of each index (yfinance tickers).
 * Safe to load from the /run Server Component and hand to the client.
 */
export const fetchIndexMembership = unstable_cache(
  _fetchIndexMembership,
  ['index-membership-v1'],
  { revalidate: 86400 },
);
