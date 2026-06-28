// The serializable payload that drives both the on-screen /report preview AND
// the offline interactive report file. Kept type-only (zero runtime imports) so
// it is safe to import from a client component, a server module, and the
// esbuild offline bundle alike — nothing here is ever emitted into JS.

import type { StockDetail } from '@/lib/stocks';
import type { BenchmarkSeries } from '@/lib/benchmarks';
import type { MedianTables } from '@/lib/medians.server';
import type { CycleAnalysis, Market } from '@/lib/types';

export interface ReportData {
  /** Full stock row + complete price history (every bar — the chart pans over it). */
  stock: StockDetail;
  /** Major Cycle analysis for the chosen horizon, or null when it can't be computed. */
  cycle: CycleAnalysis | null;
  /** Benchmark index series for the Relative Performance chart. */
  benchmarks: BenchmarkSeries;
  /** Sector/market medians for the Metrics table. */
  medians: MedianTables;
  market: Market;
  /** Display ticker e.g. "BHP.AX" formatted, and the bare URL symbol e.g. "BHP". */
  display: string;
  symbol: string;
  name: string;
  /** Human horizon label e.g. "Medium-term (≈ 1 year)". */
  horizonLabel: string;
  /** Localised generated date string. */
  generated: string;
  /** The brand logo inlined as a data: URL so the offline file needs no network. */
  logoDataUrl: string;
  /** Most recent close, or null when there are no price bars. */
  lastClose: number | null;
}
