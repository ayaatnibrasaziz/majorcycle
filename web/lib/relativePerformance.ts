/**
 * The Relative Performance chart's rows — pure, so the date rule can be tested
 * without rendering a chart (components/stocks/RelativePerformance.tsx draws them).
 */
import { BENCHMARKS, type BenchmarkSeries } from '@/lib/benchmarks';
import type { PriceBar } from '@/lib/types';

export type Range = '1y' | '3y' | 'max';

export function toTs(d: string): number {
  return new Date(d.includes('T') ? d : d + 'T00:00:00').getTime();
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]!);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]!);
  return out;
}

export interface Row {
  ts: number;
  stock: number;
  [k: string]: number;
}

export function relativeRows(
  priceBars: PriceBar[],
  benchmarks: BenchmarkSeries,
  range: Range,
): { rows: Row[]; spanDays: number; activeBenchTickers: string[] } {
  const empty = { rows: [] as Row[], spanDays: 0, activeBenchTickers: [] as string[] };
  const bars = priceBars
    .map((b) => ({ ts: toTs(b.date), close: Number(b.close) }))
    .filter((b) => !isNaN(b.ts) && !isNaN(b.close) && b.close > 0)
    .sort((a, b) => a.ts - b.ts);
  if (bars.length < 2) return empty;

  const lastTs = bars[bars.length - 1]!.ts;

  // Every index series with enough points to draw.
  const benchRaw: Record<string, { ts: number; close: number }[]> = {};
  for (const b of BENCHMARKS) {
    const raw = (benchmarks[b.ticker] ?? [])
      .map((p) => ({ ts: toTs(p.date), close: Number(p.close) }))
      .filter((p) => !isNaN(p.ts) && !isNaN(p.close) && p.close > 0)
      .sort((a, c) => a.ts - c.ts);
    if (raw.length >= 2) benchRaw[b.ticker] = raw;
  }

  // ⚠️ Every line starts on ONE date: the latest of the range's own start, the
  // stock's first bar and each index's first bar (owner's rule, 2026-09-28). "Max"
  // started at the stock's listing until then, while the index series cover 20
  // years — so AAPL read +347,496% since 1980 against the S&P 500's +479% since
  // 2006, an "alpha" of +347,017% measured over two different periods (beta review
  // B-12). An index line that starts later than the stock is not a comparison.
  const rangeStart =
    range === '1y' ? lastTs - 365 * 86400000
    : range === '3y' ? lastTs - 3 * 365 * 86400000
    : -Infinity;
  const cutoff = Math.max(rangeStart, ...Object.values(benchRaw).map((raw) => raw[0]!.ts));

  const inRange = downsample(bars.filter((b) => b.ts >= cutoff), 180);
  if (inRange.length < 2) return empty;

  const startTs = inRange[0]!.ts;
  const stockBase = inRange[0]!.close;

  // Each benchmark's base close at/just-before start.
  const benchPrepared: Record<string, { pts: { ts: number; close: number }[]; base: number }> = {};
  const activeBenchTickers: string[] = [];
  for (const b of BENCHMARKS) {
    const raw = benchRaw[b.ticker];
    if (!raw) continue;
    // base = last close on/before startTs, else first close after
    let base = raw.find((p) => p.ts > startTs)?.close ?? null;
    for (const p of raw) { if (p.ts <= startTs) base = p.close; else break; }
    if (!base) continue;
    benchPrepared[b.ticker] = { pts: raw, base };
    activeBenchTickers.push(b.ticker);
  }

  // Walk benchmark pointers in date order (rows are monotonic in ts).
  const ptr: Record<string, number> = {};
  for (const t of activeBenchTickers) ptr[t] = 0;

  const rows: Row[] = inRange.map((bar) => {
    const row: Row = { ts: bar.ts, stock: (bar.close / stockBase) * 100 };
    for (const t of activeBenchTickers) {
      const { pts, base } = benchPrepared[t]!;
      let i = ptr[t]!;
      while (i + 1 < pts.length && pts[i + 1]!.ts <= bar.ts) i++;
      ptr[t] = i;
      const c = pts[i]!.close;
      if (pts[i]!.ts <= bar.ts) row[t] = (c / base) * 100;
    }
    return row;
  });

  const spanDays = (lastTs - startTs) / 86400000;
  return { rows, spanDays, activeBenchTickers };
}
