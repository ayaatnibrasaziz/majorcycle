// Server-only: imports the admin Supabase client (next/headers). Never import
// this from a Client Component — use @/lib/benchmarks for shared constants/types.
import { cache } from 'react';

import {
  BENCHMARKS,
  benchmarkDataVersion,
  type BenchmarkBar,
  type BenchmarkSeries,
} from '@/lib/benchmarks';
import { createAdminClient } from '@/lib/supabase/server';

// Module-level cross-request cache. The full benchmark series is ~3MB, which
// exceeds Next.js's 2MB unstable_cache value limit (that threw an
// unhandledRejection on every render and gave zero caching benefit). We memoise
// in module scope instead: on Vercel Fluid Compute the instance is reused across
// requests, so this survives between page renders and re-fetches on a cold start
// or when the data changes. react.cache (below) dedupes within one render.
//
// ⚠️ KEYED TO THE DATA, not to a stopwatch. This was a flat 24-hour TTL measured
// from whenever the instance first happened to load the series — a duration with
// no relationship to when new closes arrive. An instance warmed at 09:00 UTC
// therefore served pre-cron data straight through the 22:30 refresh and on to
// 09:00 the next day, and the only reason that was survivable is that Vercel
// recycles instances often enough to hide it. That is "correct because of
// someone else's behaviour", which is the shape CLAUDE.md 11a keeps recording.
//
// It stopped being survivable when `/api/benchmarks` began letting browsers hold
// the same payload: a browser does not recycle, so the stale copy would have been
// reused reliably for a full day. Keyed to `benchmarkDataVersion()` the cache
// turns over twice a day, just after each cron, for the same number of reads a
// flat day cost.
let _cache: { version: string; data: BenchmarkSeries } | null = null;
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
 * page render — we cache them cross-request in module scope until the data itself
 * changes. A single in-flight promise is shared so concurrent first requests don't
 * each re-fetch. A transient empty result is not cached, so the chart recovers on
 * the next load.
 */
async function _fetchAllBenchmarks(): Promise<BenchmarkSeries> {
  const version = benchmarkDataVersion();
  if (_cache && _cache.version === version) return _cache.data;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const data = await _loadAllBenchmarks();
      if (Object.values(data).some((bars) => bars.length > 0)) {
        // Stamped with the version read AFTER the load, so a refresh that spans a
        // cron boundary is filed under the boundary it actually finished behind
        // rather than the one it started in — otherwise the next request would
        // consider that older data current.
        _cache = { version: benchmarkDataVersion(), data };
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
