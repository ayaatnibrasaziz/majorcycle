import { NextResponse } from 'next/server';

import { isValidMarket, type RouteSearch } from '@/lib/horizon';
import { buildReportData } from '@/lib/report-data';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type RouteParams = { market: string; ticker: string };

/**
 * JSON payload that powers the one-click "Download Report" on the Stock Detail
 * page. Returns the exact `buildReportData` snapshot for (market, ticker, horizon)
 * — the client wraps it together with the prebuilt offline bundle into a single
 * self-contained .html.
 *
 * Route handlers aren't wrapped by the (app) layout, so this gates auth itself,
 * mirroring app/(app)/layout.tsx (including the same NODE_ENV-guarded
 * DEV_BYPASS_AUTH escape for local verification). Read-only — nothing persisted.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<NextResponse> {
  const bypass =
    process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true';
  if (!bypass) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { market, ticker } = await params;
  if (!isValidMarket(market)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sp = Object.fromEntries(
    new URL(request.url).searchParams.entries(),
  ) as RouteSearch;

  const data = await buildReportData(market, ticker, sp);
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
