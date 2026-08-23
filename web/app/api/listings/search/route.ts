import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/server';
import type { ListingHit, Market, RequestStatus } from '@/lib/types';

// Choose-only search over the `listings` "menu" (every US/AU/CA common stock, in
// yfinance format) for the Request-a-Ticker page. A single `search_listings` RPC
// does the trigram match, the `covered` (in `stocks`) + `requestStatus` (GLOBAL
// `ticker_requests`) annotation, and the prefix > contains ranking server-side in
// ONE round-trip. Auth is enforced by proxy.ts; the RPC is called with the
// service-role admin client (it's revoked from anon/authenticated). See
// data-contracts §5 + migration 20260620120000_search_listings_rpc.

export const dynamic = 'force-dynamic';

/**
 * These routes sit behind the sign-in gate (they are not in `PUBLIC_PATHS`), and Next
 * attaches NO `Cache-Control` to route handlers — a habit formed on pages does not carry
 * over (CLAUDE.md 11a). Measured on the wire 2026-08-23: the signed-OUT refusal was
 * correctly `private, no-store` because the proxy sets it on its own 307, while the
 * signed-IN 200 said nothing at all. Nothing was exposed, because Vercel shared-caches
 * only on `s-maxage` — which is precisely 11a's complaint: safe by someone else's
 * default rather than because we said so.
 */
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;


interface RawHit {
  symbol: string;
  name: string | null;
  exchange: string | null;
  market: Market;
  covered: boolean;
  request_status: RequestStatus | null;
}

export async function GET(request: Request) {
  const raw = (new URL(request.url).searchParams.get('q') ?? '').trim();
  // Strip characters meaningful to LIKE patterns before handing to the RPC.
  const q = raw.replace(/[%_*,()]/g, '').toLowerCase();
  if (q.length < 1) {
    return NextResponse.json({ results: [] satisfies ListingHit[] }, { headers: NO_STORE });
  }

  const { data, error } = await createAdminClient().rpc('search_listings', { p_q: q });
  if (error || !data) {
    return NextResponse.json({ results: [] satisfies ListingHit[] }, { headers: NO_STORE });
  }

  const results: ListingHit[] = (data as RawHit[]).map((r) => ({
    symbol: r.symbol,
    name: r.name,
    exchange: r.exchange,
    market: r.market,
    covered: r.covered,
    requestStatus: r.request_status,
  }));

  return NextResponse.json({ results }, { headers: NO_STORE });
}
