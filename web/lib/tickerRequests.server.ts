import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import type { Market, TickerRequest } from '@/lib/types';

/**
 * The Request-a-Ticker queue, read in ONE place — the `/request` page renders the
 * recent list on the server and `GET /api/request-ticker` refreshes it after a
 * request, and both must show the same rows in the same shape.
 *
 * ⚠️ Why the page reads it at all (2026-09-26): the list used to arrive only after
 * the page did, from a second browser→US round trip — measured 0.55 s on top of a
 * 0.6 s page, so the recent requests popped in at ~1.4 s. Rendering it with the page
 * removes that trip.
 */

export interface RawRequestRow {
  symbol: string;
  market: Market;
  status: TickerRequest['status'];
  requested_at: string;
  fetched_at: string | null;
  last_error: string | null;
}

export const REQUEST_SELECT = 'symbol,market,status,requested_at,fetched_at,last_error';

export function toTickerRequest(r: RawRequestRow): TickerRequest {
  return {
    symbol: r.symbol,
    market: r.market,
    status: r.status,
    requestedAt: r.requested_at,
    fetchedAt: r.fetched_at,
    lastError: r.last_error,
  };
}

/**
 * The 50 most recent GENUINE user requests (`requested_by` set — cron-originated
 * universe additions are not requests and never appear).
 *
 * `null` means "could not read", never "there are none" (CLAUDE.md 11e): the page
 * then lets the browser try again, and the route answers 503 rather than an empty
 * list a reader would take as the truth.
 */
export async function fetchRecentRequests(): Promise<TickerRequest[] | null> {
  const { data, error } = await createAdminClient()
    .from('ticker_requests')
    .select(REQUEST_SELECT)
    .not('requested_by', 'is', null)
    .order('requested_at', { ascending: false })
    .limit(50);
  if (error) return null;
  return ((data ?? []) as RawRequestRow[]).map(toTickerRequest);
}
