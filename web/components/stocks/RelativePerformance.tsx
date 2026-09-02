'use client';

import { CHART_INK } from '@/lib/chartTheme';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { BENCHMARKS, trimBenchmarks, type BenchmarkSeries } from '@/lib/benchmarks';
import { CHART_RIGHT_AXIS_WIDTH } from '@/lib/format';
import type { Market, PriceBar } from '@/lib/types';
import { tickerToUrlParts } from '@/lib/ticker';
import { INK, SERIES_TEAL } from '@/lib/ink';

interface Props {
  ticker: string;
  market: Market;
  priceBars: PriceBar[];
  /**
   * The index series, supplied directly.
   *
   * ⚠️ OPTIONAL, and the two callers differ deliberately — this is not drift.
   * The Stock Detail page omits it, so the chart fetches `/api/benchmarks` once
   * and the browser reuses that response on every other ticker page; embedding it
   * in the document instead cost 1,011 KB of HTML per page, a third of the whole
   * document, re-sent every time (audit F-019).
   *
   * `ReportDocument` still passes it, because it must: the offline report is an
   * esbuild bundle opened from a file with no server and no network behind it
   * (CLAUDE.md 11d). A fetch there would draw an empty chart in the one build
   * nobody watches.
   */
  benchmarks?: BenchmarkSeries;
  /**
   * How far back this stock's chart should reach. Only consulted when the series
   * is fetched — `/api/benchmarks` serves one shared window for cacheability, so
   * the per-stock trim the server used to do has to happen here instead. Ignored
   * when `benchmarks` is supplied, which is already trimmed.
   */
  benchSince?: string;
}

type Range = '1y' | '3y' | 'max';
const RANGE_LABELS: Record<Range, string> = { '1y': '1Y', '3y': '3Y', 'max': 'Max' };

const STOCK_COLOR = '#1E5CB3';
/* ⚠️ Recharts paints a legend entry in its series' OWN colour, so the line and
   the words naming it are one value by construction — which makes each of these
   a chart line AND 10px text at the same time. Two failed: the ASX gold measured
   2.38:1, under even the 3.0 a plain graphic owes, and the TSX teal cleared the
   graphic floor at 3.30 while failing as a label. Both now carry their ink value,
   so each legend entry still matches the line it names. The grey and the violet
   were already legible (5.70 for the violet) and are untouched. */
/* ⚠️ REWORKED 2026-09-02 — audit 5A-089 / 5A-090, and this was the site's one
   genuine WCAG 1.4.1 exposure. Three defects in four values:

     · `^GSPC` was CHART_INK — the token for axis ticks, legends and watermarks.
       The S&P 500 line and the chart's own furniture were the IDENTICAL colour
       (ΔE 0.0), so the benchmark could not be told from the grid labelling.
     · `^AXJO` was INK.neutral, and the comment beside it still said "gold" —
       that token stopped being gold in August. So two of the four series were
       grey: 8.8 apart in normal vision, 7.1 to a protanope.
     · `^AXJO` against `^GSPTSE` measured **2.6** to a protanope — indistinguishable.

   A line chart conveys series identity through colour and a legend cannot
   disambiguate two series that ARE the same colour. Four distinct hues now, none
   within 15 of the furniture — AND a distinct dash per series, so colour is never
   the only channel. The dash is the part that actually satisfies 1.4.1: the
   weakest colour pair here is still 5.9 (violet against the stock's brand blue to
   a protanope), and no five-line palette clears 16 everywhere without turning to
   mud. Give a new benchmark its own dash as well as its own hue. */
const BENCH_COLOR: Record<string, string> = {
  '^GSPC': '#6D28D9',      // S&P 500 — violet
  '^IXIC': '#A21C6B',      // Nasdaq — magenta
  '^AXJO': '#9A6A05',      // ASX 200 — amber
  '^GSPTSE': SERIES_TEAL,  // S&P/TSX — teal
};

/** The second channel. The stock's own line stays solid; every benchmark differs. */
const BENCH_DASH: Record<string, string> = {
  '^GSPC': '7 4',
  '^IXIC': '2 3',
  '^AXJO': '9 3 2 3',
  '^GSPTSE': '14 5',
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

/**
 * The index series, from whichever source this build has.
 *
 * ⚠️ A failed fetch resolves to `{}` rather than an error state, and that is the
 * SAME degradation as before this route existed: `_loadOneBenchmark` already
 * swallowed a per-index read failure and returned an empty array, which drops the
 * line from `activeBenchTickers`. So a benchmark that cannot be loaded has always
 * meant "one fewer line", and moving the fetch has not introduced a new way to
 * fail — it moved an existing one. The stock's own line is unaffected either way.
 */
function useBenchmarkSeries(
  supplied: BenchmarkSeries | undefined,
  since: string | undefined,
): { series: BenchmarkSeries; hostRef: React.RefObject<HTMLDivElement | null> } {
  const [fetched, setFetched] = useState<BenchmarkSeries | null>(null);
  const [armed, setArmed] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const needsFetch = supplied === undefined;

  /**
   * ⚠️ WAIT before asking for it. This payload is ~900 KB, and firing it from a
   * bare effect means it competes with the page the reader is actually waiting
   * on — the same argument `StockSubnav` makes for the report bundle.
   *
   * That is not a theory here, it is what happened: moving these series out of the
   * document and fetching them on mount made the document a third smaller and made
   * Largest Contentful Paint WORSE (1.7s → 2.2s), because the bytes had not gone
   * away, they had merely moved into the load. Speed Index improved at the same
   * time, which is the tell — the document really was lighter; the fetch was
   * spending the win.
   *
   * Whichever comes first:
   *   - the browser goes idle, or
   *   - the chart comes within 600px of the viewport (it sits well below the fold,
   *     so on most visits idle wins and the data is there long before anyone
   *     scrolls to it).
   */
  useEffect(() => {
    if (!needsFetch || armed) return;

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      setArmed(true);
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let cancelIdle: (() => void) | undefined;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(fire, { timeout: 5_000 });
      cancelIdle = () => w.cancelIdleCallback?.(id);
    } else {
      const t = setTimeout(fire, 2_000);
      cancelIdle = () => clearTimeout(t);
    }

    let io: IntersectionObserver | undefined;
    if (hostRef.current && typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) fire();
        },
        { rootMargin: '600px' },
      );
      io.observe(hostRef.current);
    }

    return () => {
      cancelIdle?.();
      io?.disconnect();
    };
  }, [needsFetch, armed]);

  useEffect(() => {
    if (!needsFetch || !armed) return;
    let cancelled = false;
    (async () => {
      let data: BenchmarkSeries = {};
      try {
        const res = await fetch('/api/benchmarks');
        if (res.ok) {
          const body = (await res.json()) as { benchmarks?: BenchmarkSeries };
          data = body.benchmarks ?? {};
        }
      } catch {
        // Left as {} — see the note above: one fewer line, never a broken chart.
      }
      if (!cancelled) setFetched(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [needsFetch, armed]);

  const series = useMemo(() => {
    if (supplied !== undefined) return supplied;
    return fetched === null ? {} : trimBenchmarks(fetched, since);
  }, [supplied, fetched, since]);

  return { series, hostRef };
}

export function RelativePerformance({
  ticker,
  market,
  priceBars,
  benchmarks,
  benchSince,
}: Props) {
  // Renders immediately with the stock's own line and draws the index lines when
  // they arrive. Deliberately NOT a skeleton: the chart box is a fixed height, so
  // lines appearing inside it shifts nothing, while swapping a placeholder for a
  // chart is exactly the kind of reflow that turns a CLS of 0 into a score.
  const { series, hostRef } = useBenchmarkSeries(benchmarks, benchSince);

  const [range, setRange] = useState<Range>('1y');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const { rows, spanDays, activeBenchTickers } = useChartData(priceBars, series, range);

  // Home-market index drives the summary strip (return / alpha).
  const homeMeta = BENCHMARKS.find((b) => b.market === market) ?? BENCHMARKS[0]!;
  const nameFor = (key: string) =>
    key === 'stock' ? tickerToUrlParts(ticker).symbol : (BENCHMARKS.find((b) => b.ticker === key)?.label ?? key);

  if (priceBars.length < 2) return null;

  const last = rows[rows.length - 1];
  const stockReturn = last ? last.stock - 100 : 0;
  const homeIdxReturn = last && typeof last[homeMeta.ticker] === 'number' ? last[homeMeta.ticker]! - 100 : null;
  const alpha = homeIdxReturn !== null ? stockReturn - homeIdxReturn : null;
  const outperf = alpha !== null ? alpha >= 0 : null;

  return (
    // `hostRef` is what the IntersectionObserver watches, so a reader who scrolls
    // straight here does not wait on the idle callback. Unused in the offline
    // report, which is handed its series directly and never observes anything.
    <div ref={hostRef} className="card card--stack-base fade-in">
      <div className="card-header">
        <div className="card-title">
          Relative Performance vs Benchmarks
          <InfoTip title="Relative Performance">
            How this stock&apos;s total return compares with major market indexes over
            the period. &quot;Alpha&quot; is how many percentage points the stock beat (or
            lagged) its home-market index.
          </InfoTip>
        </div>
        <div className="chart-controls" role="group" aria-label="Relative performance date range">
          {(['1y', '3y', 'max'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`range-btn${range === r ? ' active' : ''}`}
              aria-pressed={range === r}
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
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
              <ComposedChart data={rows} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#F0F4F8" vertical={false} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(ts: number) => fmtTick(ts, spanDays)}
                  tick={{ fill: CHART_INK, fontSize: 10, fontFamily: 'Sora' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  orientation="right"
                  width={CHART_RIGHT_AXIS_WIDTH}
                  tickMargin={6}
                  tick={{ fill: CHART_INK, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
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
                        <div style={{ color: CHART_INK, marginBottom: 4 }}>
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
                  name={tickerToUrlParts(ticker).symbol}
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
                    stroke={BENCH_COLOR[t] ?? CHART_INK}
                    strokeDasharray={BENCH_DASH[t]}
                    strokeWidth={1.75}
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
              <div className="summary-strip-val" style={{ color: stockReturn >= 0 ? INK.up : INK.down }}>
                {stockReturn >= 0 ? '+' : ''}{stockReturn.toFixed(1)}%
              </div>
            </div>
            <div className="summary-strip-item" title={`${homeMeta.label} Return (%) — the benchmark's return over the same period.`}>
              <div className="summary-strip-label">{homeMeta.label} Return</div>
              <div className="summary-strip-val" style={{ color: (homeIdxReturn ?? 0) >= 0 ? INK.up : INK.down }}>
                {homeIdxReturn !== null ? `${homeIdxReturn >= 0 ? '+' : ''}${homeIdxReturn.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="summary-strip-item" title="Alpha (%) — Stock Return minus benchmark Return. Positive = beat the market.">
              <div className="summary-strip-label">Alpha</div>
              <div className="summary-strip-val" style={{ color: (alpha ?? 0) >= 0 ? INK.up : INK.down }}>
                {alpha !== null ? `${alpha >= 0 ? '+' : ''}${alpha.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="summary-strip-item" title="Whether the stock outperformed or underperformed its home-market index over the period.">
              <div className="summary-strip-label">Verdict</div>
              <div className="summary-strip-val" style={{ color: outperf ? INK.up : INK.down, fontSize: 13 }}>
                {outperf === null ? '—' : outperf ? '▲ Outperforming' : '▼ Underperforming'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
