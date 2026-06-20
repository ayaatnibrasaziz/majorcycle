import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/server';
import { tickerToUrlParts } from '@/lib/ticker';
import type { ListingHit, RequestStatus } from '@/lib/types';

// Choose-only search over the `listings` "menu" (every US/AU/CA common stock, in
// yfinance format) for the Request-a-Ticker page. Trigram-backed ilike, ranked
// prefix > contains. Each hit is annotated with `covered` (already analysable, in
// `stocks`) and `requestStatus` (its row in the GLOBAL `ticker_requests` queue, if
// any) so the UI shows the right badge. Auth is enforced by proxy.ts; the locked-
// down tables are read with the service-role admin client. See data-contracts §5.

export const dynamic = 'force-dynamic';

const FETCH_LIMIT = 40;
const RESULT_LIMIT = 20;

export async function GET(request: Request) {
  const raw = (new URL(request.url).searchParams.get('q') ?? '').trim();
  // Strip characters that are meaningful to PostgREST `or`/ilike patterns.
  const q = raw.replace(/[%_*,()]/g, '').toLowerCase();
  if (q.length < 1) {
    return NextResponse.json({ results: [] satisfies ListingHit[] });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('listings')
    .select('symbol,name,exchange,market')
    .eq('is_active', true)
    .or(`symbol.ilike.${q}*,name.ilike.*${q}*`)
    .limit(FETCH_LIMIT);

  if (error || !data) {
    return NextResponse.json({ results: [] satisfies ListingHit[] });
  }

  // Rank: symbol-prefix > symbol-contains > name-contains.
  const prefix: typeof data = [];
  const symContains: typeof data = [];
  const nameContains: typeof data = [];
  for (const row of data) {
    const sym = row.symbol.toLowerCase();
    if (sym.startsWith(q)) prefix.push(row);
    else if (sym.includes(q)) symContains.push(row);
    else nameContains.push(row);
  }
  const ranked = [...prefix, ...symContains, ...nameContains].slice(0, RESULT_LIMIT);
  const symbols = ranked.map((r) => r.symbol);

  // Annotate with coverage + queue status (one round-trip each).
  const [coveredRes, reqRes] = await Promise.all([
    admin.from('stocks').select('ticker').in('ticker', symbols),
    admin.from('ticker_requests').select('symbol,status').in('symbol', symbols),
  ]);
  const covered = new Set((coveredRes.data ?? []).map((r) => r.ticker as string));
  const reqStatus = new Map(
    (reqRes.data ?? []).map((r) => [r.symbol as string, r.status as RequestStatus]),
  );

  const results: ListingHit[] = ranked.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    exchange: r.exchange,
    market: tickerToUrlParts(r.symbol).market,
    covered: covered.has(r.symbol),
    requestStatus: reqStatus.get(r.symbol) ?? null,
  }));

  return NextResponse.json({ results });
}
