'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';

import {
  createSyncSource,
  emitCrosshairSync,
  emitTimeRangeSync,
  subscribeCrosshairSync,
  subscribeTimeRangeSync,
  timeToMs,
} from '@/lib/chartSync';
import type { CycleAnalysis, PriceBar } from '@/lib/types';

type Mode = 'drawdown' | 'profit';

type DataPoint = { time: Time; value: number };

// The rolling window MUST match the preset the cycle was computed with
// (Short 63 / Medium 252 / Long 756 bars), otherwise the plotted curve sits on
// a different basis than the engine's Typical/Bound lines and Current stat that
// are overlaid on it. The window comes from cycle.params.lookbackBars.
function computeDrawdown(bars: PriceBar[], lookback: number): DataPoint[] {
  const result: DataPoint[] = [];
  for (let i = 0; i < bars.length; i++) {
    const start = Math.max(0, i - lookback + 1);
    let peak = -Infinity;
    for (let j = start; j <= i; j++) {
      const h = bars[j]!.high;
      if (h > peak) peak = h;
    }
    const b = bars[i]!;
    result.push({ time: b.date as Time, value: +((b.close - peak) / peak * 100).toFixed(2) });
  }
  return result;
}

function computeProfit(bars: PriceBar[], lookback: number): DataPoint[] {
  const result: DataPoint[] = [];
  for (let i = 0; i < bars.length; i++) {
    const start = Math.max(0, i - lookback + 1);
    let trough = Infinity;
    for (let j = start; j <= i; j++) {
      const l = bars[j]!.low;
      if (l < trough) trough = l;
    }
    const b = bars[i]!;
    result.push({ time: b.date as Time, value: +((b.close - trough) / trough * 100).toFixed(2) });
  }
  return result;
}

function findPivotLows(series: DataPoint[], left = 5, right = 5): DataPoint[] {
  const pivots: DataPoint[] = [];
  for (let i = left; i < series.length - right; i++) {
    const val = series[i]!.value;
    let ok = true;
    for (let j = 1; j <= left; j++) {
      if (series[i - j]!.value <= val) { ok = false; break; }
    }
    if (!ok) continue;
    for (let j = 1; j <= right; j++) {
      if (series[i + j]!.value <= val) { ok = false; break; }
    }
    if (ok) pivots.push({ time: series[i + right]!.time, value: val });
  }
  return pivots;
}

function findPivotHighs(series: DataPoint[], left = 5, right = 5): DataPoint[] {
  const pivots: DataPoint[] = [];
  for (let i = left; i < series.length - right; i++) {
    const val = series[i]!.value;
    let ok = true;
    for (let j = 1; j <= left; j++) {
      if (series[i - j]!.value >= val) { ok = false; break; }
    }
    if (!ok) continue;
    for (let j = 1; j <= right; j++) {
      if (series[i + j]!.value >= val) { ok = false; break; }
    }
    if (ok) pivots.push({ time: series[i + right]!.time, value: val });
  }
  return pivots;
}

function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}

interface Props {
  priceBars: PriceBar[];
  cycle: CycleAnalysis;
}

export function DrawdownOverlay({ priceBars, cycle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const valueAtRef    = useRef<Map<string, number>>(new Map());
  const applyingRemoteRef = useRef(false);
  const applyingRemoteRangeRef = useRef(false);
  const syncSourceRef = useRef<symbol | null>(null);
  if (syncSourceRef.current === null) syncSourceRef.current = createSyncSource();
  const [mode, setMode] = useState<Mode>('drawdown');

  // Match the engine's window + pivot confirmation to the active preset so the
  // curve, its markers, and the overlaid Typical/Bound/Current values all agree.
  const lookback = cycle.params.lookbackBars;
  const pivotBars = cycle.params.pivotBars ?? 5;

  const ddSeries = useMemo(() => computeDrawdown(priceBars, lookback), [priceBars, lookback]);
  const prSeries = useMemo(() => computeProfit(priceBars, lookback),  [priceBars, lookback]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || priceBars.length === 0) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch { /* ignore */ }
      chartRef.current = null;
    }

    const isDD        = mode === 'drawdown';
    const series      = isDD ? ddSeries : prSeries;
    const lineColor   = isDD ? '#1E5CB3' : '#228B22';
    const topColor    = isDD ? 'rgba(178,34,34,.01)'  : 'rgba(34,139,34,.15)';
    const bottomColor = isDD ? 'rgba(178,34,34,.15)' : 'rgba(34,139,34,.01)';
    const boundColor  = isDD ? '#B22222' : '#006400';
    const typLine     = isDD ? cycle.typicalDrawdown  : cycle.typicalProfit;
    const boundLine   = isDD ? cycle.lowerBound       : cycle.upperBound;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 200,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8A97A8',
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: '#F0F4F8' },
        horzLines: { color: '#F0F4F8' },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: 'rgba(74,85,104,.6)', width: 1, style: 2, labelBackgroundColor: '#1A3A6E' },
        horzLine: { color: 'rgba(74,85,104,.6)', width: 1, style: 2, labelBackgroundColor: '#1A3A6E' },
      },
      rightPriceScale: { borderColor: '#E2E8F0', textColor: '#8A97A8' },
      // Pin both edges so this overlay (and the Price chart, which does the same)
      // can't scroll past the data into empty whitespace — that desynced the two
      // charts because setVisibleRange can't reproduce an out-of-data range.
      timeScale: { borderColor: '#E2E8F0', timeVisible: false, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false },
    });
    chartRef.current = chart;

    const mainSeries = chart.addAreaSeries({
      lineColor,
      lineWidth: 2,
      topColor,
      bottomColor,
      invertFilledArea: isDD,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
    });
    mainSeries.setData(series);
    mainSeriesRef.current = mainSeries;
    // Crosshair-sync lookup: trading day → drawdown/profit value.
    valueAtRef.current = new Map(series.map((p) => [String(p.time), p.value]));

    if (typLine !== null) {
      chart.addLineSeries({
        color: '#D4A017',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: true,
        title: `Avg ${fmt(typLine)}%`,
      }).setData(series.map(p => ({ time: p.time, value: typLine })));
    }

    if (boundLine !== null) {
      chart.addLineSeries({
        color: boundColor,
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        priceLineVisible: false,
        lastValueVisible: true,
        title: `${isDD ? 'Low' : 'High'} ${fmt(boundLine)}%`,
      }).setData(series.map(p => ({ time: p.time, value: boundLine })));
    }

    const pivots = isDD
      ? findPivotLows(series, pivotBars, pivotBars)
      : findPivotHighs(series, pivotBars, pivotBars);
    if (pivots.length > 0) {
      mainSeries.setMarkers(pivots.map(p => ({
        time: p.time,
        position: isDD ? ('belowBar' as const) : ('aboveBar' as const),
        color: isDD ? 'rgba(0,100,0,.85)' : 'rgba(30,92,179,.85)',
        shape: isDD ? ('arrowUp' as const) : ('arrowDown' as const),
        text: '',
        size: 0.8,
      })));
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chartRef.current.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    // ── Crosshair sync with the other date-axis chart (Price chart) ──
    const sourceId = syncSourceRef.current!;
    chart.subscribeCrosshairMove((param) => {
      if (applyingRemoteRef.current) return;
      emitCrosshairSync((param.time as Time) ?? null, sourceId);
    });
    const unsubSync = subscribeCrosshairSync((time, source) => {
      if (source === sourceId) return;
      const c = chartRef.current;
      const s = mainSeriesRef.current;
      if (!c || !s) return;
      applyingRemoteRef.current = true;
      try {
        if (time == null) {
          c.clearCrosshairPosition();
        } else {
          const v = valueAtRef.current.get(String(time));
          if (v != null) c.setCrosshairPosition(v, time, s);
          else c.clearCrosshairPosition();
        }
      } catch {
        /* sync is best-effort; never break the chart */
      } finally {
        applyingRemoteRef.current = false;
      }
    });

    // ── Visible date-range sync — adopt the Price chart's range ──
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (applyingRemoteRangeRef.current || !range) return;
      emitTimeRangeSync({ from: range.from, to: range.to }, sourceId);
    });
    const unsubRange = subscribeTimeRangeSync((range, source) => {
      if (source === sourceId) return;
      const c = chartRef.current;
      if (!c) return;
      // Skip if already roughly in sync (~2% tolerance) — absorbs the charts'
      // small margin differences so the sync settles in one step.
      const cur = c.timeScale().getVisibleRange();
      if (cur) {
        const span = Math.abs(timeToMs(range.to) - timeToMs(range.from)) || 1;
        const tol = span * 0.02;
        if (Math.abs(timeToMs(cur.from) - timeToMs(range.from)) < tol &&
            Math.abs(timeToMs(cur.to) - timeToMs(range.to)) < tol) return;
      }
      applyingRemoteRangeRef.current = true;
      try { c.timeScale().setVisibleRange(range); } catch { /* best effort */ }
      // Reset on the next frame so the (async) range-change event that
      // setVisibleRange triggers is also suppressed — prevents echo drift.
      requestAnimationFrame(() => { applyingRemoteRangeRef.current = false; });
    });

    return () => {
      ro.disconnect();
      unsubSync();
      unsubRange();
      mainSeriesRef.current = null;
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch { /* ignore */ }
        chartRef.current = null;
      }
    };
  }, [mode, priceBars, ddSeries, prSeries, cycle, pivotBars]);

  const isDD       = mode === 'drawdown';
  const currentVal = isDD ? cycle.currentDrawdownPct  : cycle.currentProfitPct;
  const typicalVal = isDD ? cycle.typicalDrawdown      : cycle.typicalProfit;
  const boundVal   = isDD ? cycle.lowerBound           : cycle.upperBound;
  const eventsVal  = isDD ? cycle.totalPullbackEvents  : cycle.totalProfitEvents;

  return (
    <div className="card card--stack-snug">
      <div className="card-header">
        <div className="card-title">
          {isDD ? 'Drawdown Analysis' : 'Profit Recovery'}
        </div>
        <div className="overlay-toggle">
          <button
            className={`ovl-btn${isDD ? ' active' : ''}`}
            onClick={() => setMode('drawdown')}
            aria-pressed={isDD}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1.5 2.5 6 7l2-2 2.5 2.5" />
              <path d="M10.5 5v3h-3" />
            </svg>
            Drawdown
          </button>
          <button
            className={`ovl-btn${!isDD ? ' active' : ''}`}
            onClick={() => setMode('profit')}
            aria-pressed={!isDD}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1.5 9.5 6 5l2 2 2.5-2.5" />
              <path d="M10.5 7V4h-3" />
            </svg>
            Profit
          </button>
        </div>
      </div>
      <div className="card-body card-body--chart">
        <div className="stats-row">
          <div
            className="stat-pill"
            title={isDD
              ? `Current Drawdown — How far the stock has fallen from its recent ${lookback}-day peak. A deeper negative number means a bigger pullback. Larger dips (near Typical) often represent better entry opportunities.`
              : `Current Profit Recovery — How far above the recent ${lookback}-day trough the stock is sitting right now. A larger number means more recovery has already occurred.`}
          >
            <div className="stat-pill-label">Current</div>
            <div className={`stat-pill-val ${isDD ? 'red' : 'green'}`}>{fmt(currentVal)}%</div>
          </div>
          <div
            className="stat-pill"
            title={isDD
              ? 'Typical Drawdown (Historical Average) — The average pullback depth across all historical cycles. When Current ≤ Typical, the stock is at or beyond its usual dip — historically an attractive entry zone.'
              : 'Typical Profit Recovery (Historical Average) — The average recovery gain across all historical profit cycles. When Current ≥ Typical, the stock may be nearing an exit zone.'}
          >
            <div className="stat-pill-label">Typical</div>
            <div className="stat-pill-val amber">{typicalVal !== null ? `${fmt(typicalVal)}%` : '—'}</div>
          </div>
          <div
            className="stat-pill"
            title={isDD
              ? 'Lower Bound — The deepest drawdown ever recorded for this stock across all historical cycles. Stocks rarely breach this level. If Current approaches Lower Bound, risk/reward is very favourable.'
              : 'Upper Bound — The highest profit recovery peak ever recorded across all historical cycles. If Current approaches Upper Bound, consider taking profits.'}
          >
            <div className="stat-pill-label">{isDD ? 'Lower Bound' : 'Upper Bound'}</div>
            <div className={`stat-pill-val ${isDD ? 'red' : 'green'}`}>{boundVal !== null ? `${fmt(boundVal)}%` : '—'}</div>
          </div>
          <div
            className="stat-pill"
            title="Cycle Events Count — The number of distinct drawdown or profit cycles identified in the full price history. More events means a larger sample size and higher confidence in the Typical and Bound levels. 10+ events is considered statistically reliable."
          >
            <div className="stat-pill-label">Events</div>
            <div className="stat-pill-val">{eventsVal}</div>
          </div>
        </div>
        <div className="chart-canvas-wrap chart-h-sm">
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}
