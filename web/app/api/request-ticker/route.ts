import { NextResponse } from 'next/server';

import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import type { Market, TickerRequest } from '@/lib/types';

// Enqueue (POST) / list (GET) user-requested tickers. The daily cron drains the
// queue (architecture.md §8 Tier 4). The queue is GLOBAL — one row per symbol, so
// the same ticker is never requested twice and every user sees its status. Auth is
// enforced by proxy.ts; the locked-down tables are touched with the admin client.

export const dynamic = 'force-dynamic';

interface RawRequestRow {
  symbol: string;
  market: Market;
  status: TickerRequest['status'];
  requested_at: string;
  fetched_at: string | null;
  last_error: string | null;
}

const SELECT = 'symbol,market,status,requested_at,fetched_at,last_error';

function toTickerRequest(r: RawRequestRow): TickerRequest {
  return {
    symbol: r.symbol,
    market: r.market,
    status: r.status,
    requestedAt: r.requested_at,
    fetchedAt: r.fetched_at,
    lastError: r.last_error,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { symbol?: unknown } | null;
  const symbol = typeof body?.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Choose-only guard: the symbol MUST be a real, active US/AU/CA listing.
  const { data: listing } = await admin
    .from('listings')
    .select('symbol,market')
    .eq('symbol', symbol)
    .eq('is_active', true)
    .maybeSingle();
  if (!listing) {
    return NextResponse.json(
      { error: 'Not a known US/AU/CA listed stock' },
      { status: 404 },
    );
  }

  // Already analysable → nothing to queue.
  const { data: stock } = await admin
    .from('stocks')
    .select('ticker')
    .eq('ticker', symbol)
    .maybeSingle();
  if (stock) {
    return NextResponse.json({ error: 'Already in coverage' }, { status: 409 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Upsert (re)queues the symbol — a prior failed/unsupported row is reset to queued.
  const { data: upserted, error } = await admin
    .from('ticker_requests')
    .upsert(
      {
        symbol,
        market: listing.market,
        status: 'queued',
        requested_by: user?.id ?? null,
        requested_at: new Date().toISOString(),
        attempts: 0,
        last_attempt_at: null,
        fetched_at: null,
        last_error: null,
      },
      { onConflict: 'symbol' },
    )
    .select(SELECT)
    .maybeSingle();

  if (error || !upserted) {
    return NextResponse.json({ error: 'Could not queue request' }, { status: 500 });
  }
  return NextResponse.json({ request: toTickerRequest(upserted as RawRequestRow) });
}

export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('ticker_requests')
    .select(SELECT)
    .order('requested_at', { ascending: false })
    .limit(50);
  const requests = ((data ?? []) as RawRequestRow[]).map(toTickerRequest);
  return NextResponse.json({ requests });
}
