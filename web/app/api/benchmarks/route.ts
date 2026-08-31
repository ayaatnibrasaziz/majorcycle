import { NextResponse } from 'next/server';

import { benchmarkFloorDate } from '@/lib/benchmarks';
import { fetchBenchmarks } from '@/lib/benchmarks.server';

/**
 * The four benchmark index close series for the Relative Performance chart.
 *
 * ── Why this route exists (audit F-019, 2026-08-24) ─────────────────────────
 * These series used to be fetched on the server and passed to the chart as a
 * prop, which baked them into the RSC payload of every Stock Detail page.
 * Measured on the production build, signed in:
 *
 *   /stocks/us/AAPL   page 3,019 KB — benchmarks 1,011 KB (33%)
 *   /stocks/au/BHP    page 2,675 KB — benchmarks 1,011 KB (38%)
 *   /stocks/us/ABNB   page   713 KB — benchmarks   285 KB (40%)
 *
 * AAPL's and BHP's figures are identical because the data is identical: the same
 * four indices, the same window, for every stock and every reader. It was being
 * re-sent with each page, inside the document, on the critical path — and the
 * chart downsamples to 180 points per line, so 20,126 points were shipped to draw
 * at most 720.
 *
 * Lighthouse's own score breakdown put 10.2 of the 16 points lost on
 * /stocks/us/AAPL on Largest Contentful Paint and Speed Index — both dominated by
 * how long the document takes to arrive — against 5.1 on Total Blocking Time. A
 * third of that document was this.
 *
 * ── Why ONE window rather than a per-stock slice ────────────────────────────
 * A `?since=` parameter would give every stock its own URL and therefore its own
 * cache entry, which defeats the entire point: the win is that the SECOND ticker
 * page a reader opens pays nothing. So this serves one fixed window at one URL,
 * and the chart trims client-side to the stock it is drawing. Same data reaching
 * the chart as before, trimmed a layer later (`trimBenchmarks`).
 *
 * ── The cache header, and why it is NOT `no-store` ──────────────────────────
 * ⚠️ Every other gated route here says `private, no-store`, and CLAUDE.md 11a is
 * emphatic about it. This one deliberately differs, and the difference is the
 * whole feature — `no-store` would re-download a megabyte on every ticker page.
 *
 * `private` is the load-bearing word. It forbids SHARED caches outright, so the
 * 11a failure mode — Vercel's edge keying on the URL alone and handing one
 * viewer's response to the next — cannot occur here. What `max-age` permits is the
 * reader's OWN browser reusing it, which is not a disclosure to anyone.
 *
 * And the payload carries nothing that varies by viewer and nothing premium: four
 * public stock-market indices, the same bytes for a free account, a subscriber and
 * an administrator. The Relative Performance chart is free-tier visible, so there
 * is no entitlement dimension to leak either. `pnpm check:entitlement-gates`
 * asserts this route stays `private`, and still forbids every shared-cache
 * directive — the carve-out is bounded to `max-age` alone.
 *
 * ⚠️ ONE HOUR, not one day, and the reason is the owner's question: what happens
 * tomorrow, when the stock has a new bar and so do the four indices? The nightly
 * crons write new closes at 08:00 and 22:30 UTC. A day-long browser cache would
 * hold yesterday's indices against today's stock price, and the chart would not
 * look broken — the index lines would simply run flat for the final day and the
 * alpha figure would compare today's stock against yesterday's market.
 *
 * So freshness is handled in two places, and each bounds the other:
 *   - the SERVER cache is keyed to `benchmarkDataVersion()`, turning over just
 *     after each cron rather than 24 hours after some instance happened to warm
 *     up (which is what it used to do — see benchmarks.server.ts);
 *   - this header bounds how long a browser can lag that, at one hour.
 *
 * An hour still costs nothing that matters: the win is a reader opening several
 * stocks in one sitting, and that whole session is inside the window.
 *
 * ⚠️ Auth is enforced by `proxy.ts` (this path is not in `PUBLIC_PATHS`), exactly
 * as for `/api/search`. That is the gate; nothing here should be read as making it
 * optional.
 */

export const dynamic = 'force-dynamic';

const CACHE = {
  'Cache-Control': 'private, max-age=3600',
} as const;

export async function GET() {
  const series = await fetchBenchmarks(benchmarkFloorDate());
  return NextResponse.json({ benchmarks: series }, { headers: CACHE });
}
