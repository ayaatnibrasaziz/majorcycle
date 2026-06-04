'use client';

import { useMemo, useState } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { BENCHMARKS, type BenchmarkSeries } from '@/lib/benchmarks';
import type { Market, PriceBar } from '@/lib/types';

interface Props {
  ticker: string;
  market: Market;
  priceBars: PriceBar[];
  benchmarks: BenchmarkSeries;
}

type Range = '1y' | '3y' | 'max';
const RANGE_LABELS: Record<Range, string> = { '1y': '1Y', '3y': '3Y', 'max': 'Max' };

const STOCK_COLOR = '#1E5CB3';
const BENCH_COLOR: Record<string, string> = {
  '^GSPC': '#8A97A8',   // S&P 500 — neutral grey
  '^IXIC': '#7C3AED',   // Nasdaq — violet
  '^AXJO': '#D4A017',   // ASX 200 — gold
  '^GSPTSE': '#0E9F8E', // S&P/TSX — teal
};

function toTs(d: string): number {
  return new Date(d.includes('T') ? d : d + 'T00:00:00').getTime();
}

function fmtTick(ts: number, spanDays: number): string {
  const d = new Date(ts);
  if (spanDays > 730) return String(d.getUTCFullYear());
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]!);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]!);
  return out;
}

interface Row {
  ts: number;
  stock: number;
  [k: string]: number;
}

function useChartData(
  priceBars: PriceBar[],
  benchmarks: BenchmarkSeries,
  range: Range,
) {
  return useMemo(() => {
    const empty = { rows: [] as Row[], spanDays: 0, activeBenchTickers: [] as string[] };
    const bars = priceBars
      .map((b) => ({ ts: toTs(b.date), close: Number(b.close) }))
      .filter((b) => !isNaN(b.ts) && !isNaN(b.close) && b.close > 0)
      .sort((a, b) => a.ts - b.ts);
    if (bars.length < 2) return empty;

    const lastTs = bars[bars.length - 1]!.ts;
    const cutoff =
      range === '1y' ? lastTs - 365 * 86400000
      : range === '3y' ? lastTs - 3 * 365 * 86400000
      : -Infinity;

    const inRange = downsample(bars.filter((b) => b.ts >= cutoff), 180);
    if (inRange.length < 2) return empty;

    const startTs = inRange[0]!.ts;
    const stockBase = inRange[0]!.close;

    // Prepare each benchmark: sorted ts/close + a base close at/just-before start.
    const benchPrepared: Record<string, { pts: { ts: number; close: number }[]; base: number }> = {};
    const activeBenchTickers: string[] = [];
    for (const b of BENCHMARKS) {
      const raw = (benchmarks[b.ticker] ?? [])
        .map((p) => ({ ts: toTs(p.date), close: Number(p.close) }))
        .filter((p) => !isNaN(p.ts) && !isNaN(p.close) && p.close > 0)
        .sort((a, c) => a.ts - c.ts);
      if (raw.length < 2) continue;
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
  }, [priceBars, benchmarks, range]);
}

function fmtPct(v: number): string {
  const d = v - 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
}

export function RelativePerformance({ ticker, market, priceBars, benchmarks }: Props) {
  const [range, setRange] = useState<Range>('1y');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const { rows, spanDays, activeBenchTickers } = useChartData(priceBars, benchmarks, range);

  // Home-market index drives the summary strip (return / alpha).
  const homeMeta = BENCHMARKS.find((b) => b.market === market) ?? BENCHMARKS[0]!;
  const nameFor = (key: string) =>
    key === 'stock' ? ticker : (BENCHMARKS.find((b) => b.ticker === key)?.label ?? key);

  if (priceBars.length < 2) return null;

  const last = rows[rows.length - 1];
  const stockReturn = last ? last.stock - 100 : 0;
  const homeIdxReturn = last && typeof last[homeMeta.ticker] === 'number' ? last[homeMeta.ticker]! - 100 : null;
  const alpha = homeIdxReturn !== null ? stockReturn - homeIdxReturn : null;
  const outperf = alpha !== null ? alpha >= 0 : null;

  return (
    <div className="card card--stack-base fade-in">
      <div className="card-header">
        <div className="card-title">
          Relative Performance vs Benchmarks
          <InfoTip title="Relative Performance">
            How this stock&apos;s total return compares with major market indexes over
            the period. Every line starts at 100, so you can read out-/under-performance
            at a glance. &quot;Alpha&quot; is how many percentage points the stock beat (or
            lagged) its home-market index.
          </InfoTip>
        </div>
        <div className="chart-controls">
          {(['1y', '3y', 'max'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`range-btn${range === r ? ' active' : ''}`}
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
            Indexed to 100 at start of period
          </span>
        </div>
      </div>
      <div className="card-body">
        {rows.length < 2 ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Not enough price history for this range.
          </div>
        ) : (
          <div className="chart-canvas-wrap chart-h-sm">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 200 }}>
              <ComposedChart data={rows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#F0F4F8" vertical={false} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(ts: number) => fmtTick(ts, spanDays)}
                  tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: 'Sora' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  orientation="right"
                  width={48}
                  tickMargin={6}
                  tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  tickFormatter={(v: number) => `${v - 100 >= 0 ? '+' : ''}${(v - 100).toFixed(0)}%`}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const ts = payload[0]!.payload.ts as number;
                    return (
                      <div style={{ background: '#1A1A1B', border: '1px solid #2E3347', borderRadius: 6, padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                        <div style={{ color: '#8A97A8', marginBottom: 4 }}>
                          {new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        {payload
                          .filter((p) => typeof p.value === 'number')
                          .map((p) => (
                            <div key={String(p.dataKey)} style={{ color: p.color }}>
                              {nameFor(String(p.dataKey))}: {fmtPct(Number(p.value))}
                            </div>
                          ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, fontFamily: 'Sora', paddingTop: 4, cursor: 'pointer' }}
                  iconSize={10}
                  onClick={(data) => {
                    const key = (data as { dataKey?: unknown }).dataKey;
                    if (typeof key === 'string') toggle(key);
                  }}
                  formatter={(value, entry) => {
                    const key = (entry as { dataKey?: unknown }).dataKey;
                    const off = typeof key === 'string' && hidden.has(key);
                    return off ? (
                      <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{value}</span>
                    ) : (
                      <span>{value}</span>
                    );
                  }}
                />
                <Area
                  dataKey="stock"
                  name={ticker}
                  type="monotone"
                  stroke={STOCK_COLOR}
                  strokeWidth={2}
                  fill="rgba(30,92,179,0.08)"
                  dot={false}
                  isAnimationActive={false}
                  hide={hidden.has('stock')}
                />
                {activeBenchTickers.map((t) => (
                  <Line
                    key={t}
                    dataKey={t}
                    name={BENCHMARKS.find((b) => b.ticker === t)?.label ?? t}
                    type="monotone"
                    stroke={BENCH_COLOR[t] ?? '#8A97A8'}
                    strokeWidth={1.75}
                    strokeDasharray={t === '^GSPC' ? '5 4' : undefined}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                    hide={hidden.has(t)}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {rows.length >= 2 && (
          <div className="summary-strip">
            <div className="summary-strip-item" title="Stock Return (%) — how much this stock gained or lost over the selected period, indexed from 100.">
              <div className="summary-strip-label">Stock Return</div>
              <div className="summary-strip-val" style={{ color: stockReturn >= 0 ? '#228B22' : '#B22222' }}>
                {stockReturn >= 0 ? '+' : ''}{stockReturn.toFixed(1)}%
              </div>
            </div>
            <div className="summary-strip-item" title={`${homeMeta.label} Return (%) — the benchmark's return over the same period.`}>
              <div className="summary-strip-label">{homeMeta.label} Return</div>
              <div className="summary-strip-val" style={{ color: (homeIdxReturn ?? 0) >= 0 ? '#228B22' : '#B22222' }}>
                {homeIdxReturn !== null ? `${homeIdxReturn >= 0 ? '+' : ''}${homeIdxReturn.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="summary-strip-item" title="Alpha (%) — Stock Return minus benchmark Return. Positive = beat the market.">
              <div className="summary-strip-label">Alpha</div>
              <div className="summary-strip-val" style={{ color: (alpha ?? 0) >= 0 ? '#228B22' : '#B22222' }}>
                {alpha !== null ? `${alpha >= 0 ? '+' : ''}${alpha.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="summary-strip-item" title="Whether the stock outperformed or underperformed its home-market index over the period.">
              <div className="summary-strip-label">Verdict</div>
              <div className="summary-strip-val" style={{ color: outperf ? '#228B22' : '#B22222', fontSize: 13 }}>
                {outperf === null ? '—' : outperf ? '▲ Outperforming' : '▼ Underperforming'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
