import { NextResponse } from 'next/server';

import { isValidMarket, type RouteSearch } from '@/lib/horizon';
import { getViewerEntitlement } from '@/lib/entitlement.server';
import { buildReportData } from '@/lib/report-data';
import { StockReadError } from '@/lib/stocks';

type RouteParams = { market: string; ticker: string };

/**
 * EVERY response here varies by viewer — the 200 carries the full scorecard, and even
 * the 402 names the caller's own denial reason. A shared cache keys on the URL alone, so
 * one subscriber's report could be served from the edge to a free user at the same URL,
 * before this function runs (CLAUDE.md 11a — the exact bug `/api/cycle` shipped).
 *
 * The route sent NO Cache-Control at all until 2026-07-29, which left the payload's
 * safety resting on Vercel happening not to cache an uncacheable-looking response.
 * Found by the e2e test added when the report's preview page was deleted, leaving this
 * as the report's only surface.
 */
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/**
 * `GET /stocks/[market]/[ticker]/report` — the JSON payload behind the one-click
 * "Download Report" on the Stock Detail page. Returns the exact `buildReportData`
 * snapshot for (market, ticker, horizon); the client wraps it with the prebuilt
 * offline bundle into a single self-contained .html.
 *
 * Lived at `/report/data` until 2026-07-30. The `data` suffix existed only to sit
 * beside an on-screen `/report` PREVIEW PAGE — deleted 2026-07-29 when nothing was
 * found linking to it — so the suffix was naming a distinction that no longer
 * existed. Renamed at the owner's request. Next.js forbids a `page.tsx` and a
 * `route.ts` in one segment, so this deliberately forecloses re-adding a `/report`
 * page; the download is the report's only form.
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
    // Route handlers aren't wrapped by the (app) layout, so this gates itself —
    // and it must gate on ENTITLEMENT, not just a session. The report payload
    // contains the full scorecard, so an authenticated free user requesting this
    // URL directly would otherwise walk away with everything the paywall protects.
    // 402 Payment Required, distinct from the 401 a signed-out caller gets.
    const viewer = await getViewerEntitlement();
    if (!viewer.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: NO_STORE },
      );
    }
    // Deletion outranks billing, as it does on every page (requirePremiumPage sends a
    // deletion-scheduled reader to /reactivate before consulting entitlement). This
    // route checked only entitlement until live-check Session 3, so an account that had
    // just been deleted — signed out globally, and shown "your account is deactivated"
    // everywhere else — could still pull the full 3.2 MB paid report from this URL.
    // 403 rather than 402: offering to sell a plan answers the wrong question, and this
    // reader may well have paid already.
    if (viewer.deletionScheduled) {
      return NextResponse.json(
        { error: 'Account scheduled for deletion', reason: 'account_deleting' },
        { status: 403, headers: NO_STORE },
      );
    }
    if (!viewer.entitled) {
      return NextResponse.json(
        { error: 'Payment Required', reason: viewer.reason },
        { status: 402, headers: NO_STORE },
      );
    }
  }

  const { market, ticker } = await params;
  if (!isValidMarket(market)) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: NO_STORE },
    );
  }

  const sp = Object.fromEntries(
    new URL(request.url).searchParams.entries(),
  ) as RouteSearch;

  // A failed database read is NOT a missing stock. Until 2026-08-07 both arrived
  // here as `null`, so a subscriber hitting a transient Supabase error was told
  // their stock does not exist — a permanent answer to a temporary problem, on the
  // one surface they have paid for. 503 + Retry-After says "come back", which is
  // both true and actionable; 404 says "stop asking", which is neither.
  //
  // Caught rather than left to throw: an uncaught error in a route handler yields a
  // 500 whose headers we do not set, and every response from this route carries a
  // per-viewer reason and so must say `private, no-store` itself (CLAUDE.md 11a).
  let data;
  try {
    data = await buildReportData(market, ticker, sp);
  } catch (err) {
    if (err instanceof StockReadError) {
      return NextResponse.json(
        { error: 'Temporarily unavailable', reason: 'read_failed' },
        { status: 503, headers: { ...NO_STORE, 'Retry-After': '5' } },
      );
    }
    throw err;
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: NO_STORE },
    );
  }

  return NextResponse.json(data, { headers: NO_STORE });
}
