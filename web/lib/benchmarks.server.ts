// Server-only: imports the admin Supabase client (next/headers). Never import
// this from a Client Component — use @/lib/benchmarks for shared constants/types.
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { BENCHMARKS, type BenchmarkBar, type BenchmarkSeries } from '@/lib/benchmarks';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Fetch the FULL close series for all benchmark indices. Cached cross-request
 * for a day — index data only changes once per trading day, and the series are
 * identical for every stock, so there's no reason to re-query Supabase on each
 * page render. Mirrors the pagination in web/lib/stocks.ts (PostgREST caps at
 * 1000 rows).
 */
const _fetchAllBenchmarks = unstable_cache(
  async (): Promise<BenchmarkSeries> => {
    const supabase = createAdminClient();
    const out: BenchmarkSeries = {};

    for (const b of BENCHMARKS) {
      const bars: BenchmarkBar[] = [];
      const PAGE = 1000;
      let from = 0;
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
  },
  ['benchmarks-all-v1'],
  { revalidate: 86400 },
);

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
