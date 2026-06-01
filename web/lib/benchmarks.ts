// Client-safe benchmark metadata + types for the Relative Performance chart.
// The server-only fetch lives in benchmarks.server.ts so this module can be
// imported from Client Components without pulling in next/headers.

import type { Market } from '@/lib/types';

export interface BenchmarkMeta {
  ticker: string;
  label: string;
  market: Market;
}

/** Benchmark indices, in display order. `market` is the home market each one
 *  benchmarks; the stock's own home index drives the summary strip. S&P 500 is
 *  listed before Nasdaq so it stays the US home index for the Alpha calc. */
export const BENCHMARKS: readonly BenchmarkMeta[] = [
  { ticker: '^GSPC', label: 'S&P 500', market: 'us' },
  { ticker: '^IXIC', label: 'Nasdaq', market: 'us' },
  { ticker: '^AXJO', label: 'ASX 200', market: 'au' },
  { ticker: '^GSPTSE', label: 'S&P/TSX', market: 'ca' },
] as const;

export interface BenchmarkBar {
  date: string;
  close: number;
}

export type BenchmarkSeries = Record<string, BenchmarkBar[]>;
