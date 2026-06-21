import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/server';
import type { RequestStatus, SkippedStatus } from '@/lib/types';

// Batch status for the Results "couldn't be scored" strip: for each symbol the run
// returned as unavailable, report whether it's `covered` (in our analysed universe,
// just history-short this run), `inListings` (a recognised US/AU/CA stock that can
// be requested), and its `requestStatus` (its row in the GLOBAL ticker_requests
// queue, if any). This lets SkippedTickers show the right state up front — Request /
// Requested / Not supported / Not covered — instead of only discovering it on click.
// Auth via proxy.ts; locked-down tables read with the service-role admin client.

export const dynamic = 'force-dynamic';

const MAX_SYMBOLS = 200;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { symbols?: unknown } | null;
  const raw = Array.isArray(body?.symbols) ? body.symbols : [];
  const symbols = [
    ...new Set(
      raw
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  ].slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json({ statuses: {} as Record<string, SkippedStatus> });
  }

  const admin = createAdminClient();
  const [listRes, stockRes, reqRes] = await Promise.all([
    admin.from('listings').select('symbol').eq('is_active', true).in('symbol', symbols),
    admin.from('stocks').select('ticker').in('ticker', symbols),
    admin.from('ticker_requests').select('symbol,status').in('symbol', symbols),
  ]);

  const listed = new Set((listRes.data ?? []).map((r) => r.symbol as string));
  const covered = new Set((stockRes.data ?? []).map((r) => r.ticker as string));
  const reqStatus = new Map(
    (reqRes.data ?? []).map((r) => [r.symbol as string, r.status as RequestStatus]),
  );

  const statuses: Record<string, SkippedStatus> = {};
  for (const s of symbols) {
    statuses[s] = {
      inListings: listed.has(s),
      covered: covered.has(s),
      requestStatus: reqStatus.get(s) ?? null,
    };
  }

  return NextResponse.json({ statuses });
}
