// Server-only: imports the admin Supabase client (next/headers). Never import
// this from a Client Component — use @/lib/benchmarks for shared constants/types.
import { cache } from 'react';

import { BENCHMARKS, type BenchmarkBar, type BenchmarkSeries } from '@/lib/benchmarks';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Fetch close series for all three benchmark indices, optionally limited to
 * dates on or after `sinceDate` (use the stock's first bar date to avoid
 * pulling decades of index history a stock doesn't span). Cached per render.
 * Mirrors the pagination in web/lib/stocks.ts (PostgREST caps at 1000 rows).
 */
export const fetchBenchmarks = cache(
  async (sinceDate?: string): Promise<BenchmarkSeries> => {
    const supabase = createAdminClient();
    const out: BenchmarkSeries = {};

    for (const b of BENCHMARKS) {
      const bars: BenchmarkBar[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        let q = supabase
          .from('price_bars')
          .select('date,close')
          .eq('ticker', b.ticker)
          .order('date', { ascending: true });
        if (sinceDate) q = q.gte('date', sinceDate);

        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        bars.push(...(data as BenchmarkBar[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      out[b.ticker] = bars;
    }

    return out;
  },
);
