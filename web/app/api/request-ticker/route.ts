import { NextResponse } from 'next/server';

import { reportIssue } from '@/lib/observability';
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchRecentRequests, REQUEST_SELECT, toTickerRequest, type RawRequestRow } from '@/lib/tickerRequests.server';

// Enqueue (POST) / list (GET) user-requested tickers. The daily cron drains the
// queue (architecture.md §8 Tier 4). The queue is GLOBAL — one row per symbol, so
// the same ticker is never requested twice and every user sees its status. Auth is
// enforced by proxy.ts; the locked-down tables are touched with the admin client.

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


// The row shape and the list query live in lib/tickerRequests.server.ts, shared with
// the /request page, which renders the recent list itself (2026-09-26).

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { symbol?: unknown } | null;
  const symbol = typeof body?.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400, headers: NO_STORE });
  }

  const admin = createAdminClient();

  // ⚠️ Both reads below check `error` BEFORE `data`, and the reason is CLAUDE.md
  // 11e: "I could not read it" and "it does not exist" must never share a return
  // value. Until 2026-08-23 both destructured only `data`, so a failed query was
  // indistinguishable from an absent row — and the two failures pointed opposite
  // ways. A `listings` error told a reader their real stock was "not a known
  // US/AU/CA listed stock", which is merely wrong. A `stocks` error was worse: it
  // fell through to the upsert and QUEUED A REQUEST for a ticker we already cover,
  // so the nightly cron would go and re-fetch it. Nothing errored, nothing logged,
  // and the row looked exactly like a genuine reader request.
  //
  // Found while writing this route's first tests: the 409 case failed once under
  // full-suite load and passed in isolation, which is what a swallowed transient
  // read error looks like from the outside.

  // Choose-only guard: the symbol MUST be a real, active US/AU/CA listing.
  const { data: listing, error: listingErr } = await admin
    .from('listings')
    .select('symbol,market')
    .eq('symbol', symbol)
    .eq('is_active', true)
    .maybeSingle();
  if (listingErr) {
    reportIssue('request-ticker: listings lookup failed', {
      cause: listingErr,
      tags: { symbol },
    });
    return NextResponse.json(
      { error: 'Could not check coverage right now' },
      { status: 503, headers: { ...NO_STORE, 'Retry-After': '5' } },
    );
  }
  if (!listing) {
    return NextResponse.json(
      { error: 'Not a known US/AU/CA listed stock' },
      { status: 404, headers: NO_STORE },
    );
  }

  // Already analysable → nothing to queue.
  const { data: stock, error: stockErr } = await admin
    .from('stocks')
    .select('ticker')
    .eq('ticker', symbol)
    .maybeSingle();
  if (stockErr) {
    reportIssue('request-ticker: stocks lookup failed', { cause: stockErr, tags: { symbol } });
    return NextResponse.json(
      { error: 'Could not check coverage right now' },
      { status: 503, headers: { ...NO_STORE, 'Retry-After': '5' } },
    );
  }
  if (stock) {
    return NextResponse.json({ error: 'Already in coverage' }, { status: 409, headers: NO_STORE });
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
    .select(REQUEST_SELECT)
    .maybeSingle();

  if (error || !upserted) {
    return NextResponse.json({ error: 'Could not queue request' }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ request: toTickerRequest(upserted as RawRequestRow) }, { headers: NO_STORE });
}

export async function GET() {
  const requests = await fetchRecentRequests();
  // Unreadable is not "none" (CLAUDE.md 11e) — until 2026-09-26 a failed read
  // answered an empty list, which a reader takes as the truth.
  if (requests === null) {
    return NextResponse.json(
      { error: 'Could not load recent requests' },
      { status: 503, headers: { ...NO_STORE, 'Retry-After': '5' } },
    );
  }
  return NextResponse.json({ requests }, { headers: NO_STORE });
}
