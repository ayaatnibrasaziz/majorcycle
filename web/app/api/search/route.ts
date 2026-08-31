import { NextResponse } from 'next/server';

import { fetchUniverseIndex } from '@/lib/universe.server';
import type { Market } from '@/lib/types';

// Autocomplete ticker search for the Run Analysis tab's "Search & add" input.
// Reads the light, day-cached universe index (never the heavy fundamentals
// JSONB) and matches the query against ticker + company name. Auth is enforced
// by proxy.ts (this path is not in PUBLIC_PATHS).

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


const RESULT_LIMIT = 10;

interface SearchHit {
  ticker: string;
  name: string | null;
  market: Market;
}

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase();
  if (q.length < 1) {
    return NextResponse.json({ results: [] satisfies SearchHit[] }, { headers: NO_STORE });
  }

  const universe = await fetchUniverseIndex();

  // Rank: ticker-prefix > ticker-contains > name-contains. Stable within a tier
  // because the index is already market-cap-descending (biggest names first).
  const prefix: SearchHit[] = [];
  const tickerContains: SearchHit[] = [];
  const nameContains: SearchHit[] = [];

  for (const s of universe) {
    const tickerLc = s.ticker.toLowerCase();
    const nameLc = (s.name ?? '').toLowerCase();
    const hit: SearchHit = { ticker: s.ticker, name: s.name, market: s.market };
    if (tickerLc.startsWith(q)) prefix.push(hit);
    else if (tickerLc.includes(q)) tickerContains.push(hit);
    else if (nameLc.includes(q)) nameContains.push(hit);
    if (prefix.length >= RESULT_LIMIT) break;
  }

  const results = [...prefix, ...tickerContains, ...nameContains].slice(0, RESULT_LIMIT);
  return NextResponse.json({ results }, { headers: NO_STORE });
}
