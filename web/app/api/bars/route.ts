import { NextResponse } from 'next/server';

import { getViewerEntitlement } from '@/lib/entitlement.server';
import { recordFreeView } from '@/lib/freeViews';
import { barsVersion, packBars } from '@/lib/priceHistory';
import { createAdminClient } from '@/lib/supabase/server';
import { loadPriceBars, StockReadError } from '@/lib/stocks';

/**
 * A stock's FULL daily price history, for the Stock Detail page's charts.
 *
 * The page itself carries only the last two years (`lib/priceHistory.ts` says why:
 * the whole history was 1.77 MB of a 2 MB page). The charts ask here for the rest
 * right after the page arrives.
 *
 * Behind the sign-in gate in `proxy.ts` like every other `/api` route — price
 * history is free data, but free to signed-in readers, not to the world.
 *
 * ⚠️ The free-tier fence applies here exactly as it does to the page: a free reader
 * may open 25 new stocks a day, and this route must not become a way round that. It
 * records the view the same way the page does, which costs nothing for a stock the
 * reader has already opened today — and every legitimate call comes from a page that
 * just did.
 *
 * Caching (CLAUDE.md 11a): `private` always — the response may only live in this
 * reader's own browser, never a shared cache. With a `v` that matches the current
 * data (`barsVersion`, a fingerprint of every price) it may be kept for a day,
 * because any change to the data changes the URL. Anything else is `no-store`.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;
const KEEP_A_DAY = { 'Cache-Control': 'private, max-age=86400, immutable' } as const;
const TICKER = /^[A-Z0-9^][A-Z0-9.\-^]{0,19}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticker = (url.searchParams.get('ticker') ?? '').toUpperCase();
  if (!TICKER.test(ticker)) {
    return NextResponse.json({ error: 'bad ticker' }, { status: 400, headers: NO_STORE });
  }

  const viewer = await getViewerEntitlement();
  if (!viewer.userId) {
    return NextResponse.json({ error: 'sign in required' }, { status: 401, headers: NO_STORE });
  }
  if (!viewer.entitled) {
    const view = await recordFreeView(viewer.userId, ticker);
    if (!view.allowed) {
      return NextResponse.json({ error: 'daily view limit reached' }, { status: 429, headers: NO_STORE });
    }
  }

  let bars;
  try {
    bars = await loadPriceBars(createAdminClient(), ticker);
  } catch (err) {
    // Unreadable is not "no history" (CLAUDE.md 11e).
    // Caught here rather than thrown: an uncaught error becomes a 500 whose headers
    // we do not set, and every response from this route must state its caching.
    const transient = err instanceof StockReadError;
    return NextResponse.json(
      { error: 'could not read price history' },
      {
        status: transient ? 503 : 500,
        headers: transient ? { ...NO_STORE, 'Retry-After': '5' } : NO_STORE,
      },
    );
  }
  if (bars.length === 0) {
    return NextResponse.json({ error: 'no price history' }, { status: 404, headers: NO_STORE });
  }

  const current = url.searchParams.get('v') === barsVersion(bars);
  return NextResponse.json(packBars(bars), { headers: current ? KEEP_A_DAY : NO_STORE });
}
