// Server-only: imports the admin Supabase client (next/headers). Never import
// this from a Client Component — use @/lib/benchmarks for shared constants/types.
import { cache } from 'react';

import { BENCHMARKS, type BenchmarkBar, type BenchmarkSeries } from '@/lib/benchmarks';
import { createAdminClient } from '@/lib/supabase/server';

const BENCHMARKS_TTL_MS = 86_400_000; // 1 day — index data changes once per trading day.

// Module-level cross-request cache. The full benchmark series is ~3MB, which
// exceeds Next.js's 2MB unstable_cache value limit (that threw an
// unhandledRejection on every render and gave zero caching benefit). We memoise
// in module scope instead: on Vercel Fluid Compute the instance is reused across
// requests, so this survives between page renders and simply re-fetches after
// the TTL or on a cold start. react.cache (below) dedupes within one render.
let _cache: { at: number; data: BenchmarkSeries } | null = null;
let _inflight: Promise<BenchmarkSeries> | null = null;

async function _loadAllBenchmarks(): Promise<BenchmarkSeries> {
  const supabase = createAdminClient();
  const out: BenchmarkSeries = {};

  for (const b of BENCHMARKS) {
    const bars: BenchmarkBar[] = [];
    const PAGE = 1000;
    let from = 0;
    // Mirrors the pagination in web/lib/stocks.ts (PostgREST caps at 1000 rows).
    while (true) {
      const { data, error } = await supabase
        .from('price_bars')
        .select('date,close')
        .eq('ticker', b.ticker)
        .order('date', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      bars.push(...(data as BenchmarkBar[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    out[b.ticker] = bars;
  }

  return out;
}

/**
 * Fetch the FULL close series for all benchmark indices. The series are
 * identical for every stock, so there's no reason to re-query Supabase on each
 * page render — we cache them cross-request in module scope for a day. A single
 * in-flight promise is shared so concurrent first requests don't each re-fetch.
 * A transient empty result is not cached, so the chart recovers on the next load.
 */
async function _fetchAllBenchmarks(): Promise<BenchmarkSeries> {
  if (_cache && Date.now() - _cache.at < BENCHMARKS_TTL_MS) return _cache.data;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const data = await _loadAllBenchmarks();
      if (Object.values(data).some((bars) => bars.length > 0)) {
        _cache = { at: Date.now(), data };
      }
      return data;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/**
 * Benchmark close series, optionally limited to dates on or after `sinceDate`
 * (the stock's first bar date, so we never feed the chart index history the
 * stock doesn't span). The full series is fetched once per day and cached
 * cross-request; the per-stock slice is a cheap in-memory filter, deduped per
 * render via react.cache.
 */
export const fetchBenchmarks = cache(
  async (sinceDate?: string): Promise<BenchmarkSeries> => {
    const all = await _fetchAllBenchmarks();
    if (!sinceDate) return all;
    const out: BenchmarkSeries = {};
    for (const ticker of Object.keys(all)) {
      out[ticker] = (all[ticker] as BenchmarkBar[]).filter((bar) => bar.date >= sinceDate);
    }
    return out;
  },
);
