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

async function _loadOneBenchmark(
  supabase: ReturnType<typeof createAdminClient>,
  ticker: string,
): Promise<BenchmarkBar[]> {
  // PostgREST caps each response at 1000 rows. ^GSPC alone is ~25 pages, so we
  // count once then pull all pages in parallel (mirrors web/lib/stocks.ts) —
  // sequential paging here cost ~14s of round-trip latency on a cold instance.
  const PAGE = 1000;
  const { count } = await supabase
    .from('price_bars')
    .select('date', { count: 'exact', head: true })
    .eq('ticker', ticker);

  const pageCount = Math.ceil((count ?? 0) / PAGE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      supabase
        .from('price_bars')
        .select('date,close')
        .eq('ticker', ticker)
        .order('date', { ascending: true })
        .range(i * PAGE, i * PAGE + PAGE - 1),
    ),
  );

  const bars: BenchmarkBar[] = [];
  for (const { data, error } of pages) {
    if (error || !data) continue;
    bars.push(...(data as BenchmarkBar[]));
  }
  return bars;
}

async function _loadAllBenchmarks(): Promise<BenchmarkSeries> {
  const supabase = createAdminClient();
  // Each index series is independent — load them all concurrently.
  const series = await Promise.all(
    BENCHMARKS.map((b) => _loadOneBenchmark(supabase, b.ticker)),
  );

  const out: BenchmarkSeries = {};
  BENCHMARKS.forEach((b, i) => {
    out[b.ticker] = series[i]!;
  });
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
