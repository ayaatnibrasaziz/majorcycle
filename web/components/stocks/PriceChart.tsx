'use client';

import { useEffect, useRef, useState } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
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
import type { PriceBar } from '@/lib/types';

type Range = '1y' | '3y' | 'max';

// Per design-system §5: 50 DMA = brand-bright solid, 200 DMA = brand-deep dashed.
// (LWC line widths are integers, so the §5 "1.5px" renders as 2 — its closest value.)
const SMA_50_COLOR  = '#2E7DE8';
const SMA_200_COLOR = '#1A3A6E';

function computeSMA(bars: PriceBar[], period: number): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j]!.close;
    result.push({ time: bars[i]!.date as Time, value: sum / period });
  }
  return result;
}

function rangeStartDate(range: Range): string | null {
  if (range === 'max') return null;
  const d = new Date();
  if (range === '1y') d.setFullYear(d.getFullYear() - 1);
  else d.setFullYear(d.getFullYear() - 3);
  return d.toISOString().slice(0, 10);
}

interface Props {
  priceBars: PriceBar[];
  ticker: string;
}

export function PriceChart({ priceBars, ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const sma50Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200Ref    = useRef<ISeriesApi<'Line'> | null>(null);
  const candleRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const valueAtRef   = useRef<Map<string, number>>(new Map());
  const applyingRemoteRef = useRef(false);
  const applyingRemoteRangeRef = useRef(false);
  const syncSourceRef = useRef<symbol | null>(null);
  if (syncSourceRef.current === null) syncSourceRef.current = createSyncSource();

  const [range,   setRange]   = useState<Range>('1y');
  const [show50,  setShow50]  = useState(true);
  const [show200, setShow200] = useState(true);

  // ── Build chart once on mount (data never filtered — range only pans the view) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el || priceBars.length === 0) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch { /* ignore */ }
    }
    chartRef.current = null;
    sma50Ref.current  = null;
    sma200Ref.current = null;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 300,
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
      // fixLeftEdge/fixRightEdge stop scrolling past the first/last bar into
      // empty whitespace. The Drawdown overlay shares this exact date extent but
      // can't follow a range that runs into no-data space (setVisibleRange clamps
      // to the data edge), which desynced the two charts. Pinning both edges
      // keeps them locked together.
      timeScale: { borderColor: '#E2E8F0', timeVisible: false, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false },
    });
    chartRef.current = chart;

    // All candlestick data — no date filtering
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#228B22', downColor: '#B22222',
      borderUpColor: '#006400', borderDownColor: '#8B0000',
      wickUpColor: '#006400', wickDownColor: '#8B0000',
      borderVisible: true, priceLineVisible: false,
    });
    candleSeries.setData(
      priceBars.map((b) => ({
        time: b.date as Time, open: b.open, high: b.high, low: b.low, close: b.close,
      })),
    );
    candleRef.current = candleSeries;

    // Crosshair-sync lookup: trading day → close (the target price the synced
    // crosshair snaps its horizontal line to on this chart).
    valueAtRef.current = new Map(priceBars.map((b) => [b.date, b.close]));

    const sma50Data = computeSMA(priceBars, 50);
    if (sma50Data.length > 0) {
      sma50Ref.current = chart.addLineSeries({
        color: SMA_50_COLOR, lineWidth: 2,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      sma50Ref.current.setData(sma50Data);
    }

    const sma200Data = computeSMA(priceBars, 200);
    if (sma200Data.length > 0) {
      sma200Ref.current = chart.addLineSeries({
        color: SMA_200_COLOR, lineWidth: 2, lineStyle: LineStyle.Dashed,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      sma200Ref.current.setData(sma200Data);
    }

    // Set initial viewport to 1Y
    const fromStr = rangeStartDate('1y');
    const lastBar = priceBars[priceBars.length - 1]!;
    if (fromStr) {
      chart.timeScale().setVisibleRange({ from: fromStr as Time, to: lastBar.date as Time });
    } else {
      chart.timeScale().fitContent();
    }

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chartRef.current.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    // ── Crosshair sync with the other date-axis chart (Drawdown overlay) ──
    const sourceId = syncSourceRef.current!;
    chart.subscribeCrosshairMove((param) => {
      if (applyingRemoteRef.current) return;
      emitCrosshairSync((param.time as Time) ?? null, sourceId);
    });
    const unsubSync = subscribeCrosshairSync((time, source) => {
      if (source === sourceId) return;
      const c = chartRef.current;
      const s = candleRef.current;
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

    // ── Visible date-range sync (the Price chart is the initial authority) ──
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (applyingRemoteRangeRef.current || !range) return;
      emitTimeRangeSync({ from: range.from, to: range.to }, sourceId);
    });
    const unsubRange = subscribeTimeRangeSync((range, source) => {
      if (source === sourceId) return;
      const c = chartRef.current;
      if (!c) return;
      // Already roughly in sync? Skip. A tolerance (~2% of the span) absorbs the
      // small margin differences between the two charts, so the sync settles in
      // one step instead of drifting inward on every echo.
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
    // Broadcast the current (initial 1Y) range so the Drawdown overlay adopts it.
    const r0 = chart.timeScale().getVisibleRange();
    if (r0) emitTimeRangeSync({ from: r0.from, to: r0.to }, sourceId);

    return () => {
      ro.disconnect();
      unsubSync();
      unsubRange();
      sma50Ref.current  = null;
      sma200Ref.current = null;
      candleRef.current = null;
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch { /* ignore */ }
        chartRef.current = null;
      }
    };
  }, [priceBars]); // range / show* changes handled by dedicated effects below

  // ── Pan to selected range without rebuilding ──
  useEffect(() => {
    if (!chartRef.current || priceBars.length === 0) return;
    const lastBar = priceBars[priceBars.length - 1]!;
    const fromStr = rangeStartDate(range);
    if (fromStr) {
      chartRef.current.timeScale().setVisibleRange({ from: fromStr as Time, to: lastBar.date as Time });
    } else {
      chartRef.current.timeScale().fitContent();
    }
  }, [range, priceBars]);

  // ── Toggle MA visibility without rebuilding ──
  useEffect(() => {
    sma50Ref.current?.applyOptions({ visible: show50 });
  }, [show50]);

  useEffect(() => {
    sma200Ref.current?.applyOptions({ visible: show200 });
  }, [show200]);

  return (
    <section className="card card--stack-snug">
      <div className="card-header">
        <div className="card-title">
          Price Chart — {ticker}
          <InfoTip title="Price Chart">
            Daily price drawn as candlesticks: each candle shows the open, high,
            low and close for a day. Green = the price rose that day, red = it fell.
            Toggle the 50- and 200-day average lines to see the trend.
          </InfoTip>
        </div>
        <div className="chart-controls">
          <button
            className={`ma-pill ma-pill--50${show50 ? ' active' : ''}`}
            onClick={() => setShow50((v) => !v)}
            title="Toggle 50-day moving average"
            aria-pressed={show50}
          >
            <svg width="12" height="4" viewBox="0 0 12 4" aria-hidden="true">
              <line x1="0" y1="2" x2="12" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            50D
          </button>
          <button
            className={`ma-pill ma-pill--200${show200 ? ' active' : ''}`}
            onClick={() => setShow200((v) => !v)}
            title="Toggle 200-day moving average"
            aria-pressed={show200}
          >
            <svg width="12" height="4" viewBox="0 0 12 4" aria-hidden="true">
              <line x1="0" y1="2" x2="12" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            200D
          </button>
          <span className="chart-divider" aria-hidden="true" />
          <button className={`range-btn${range === '1y' ? ' active' : ''}`} onClick={() => setRange('1y')}>1Y</button>
          <button className={`range-btn${range === '3y' ? ' active' : ''}`} onClick={() => setRange('3y')}>3Y</button>
          <button className={`range-btn${range === 'max' ? ' active' : ''}`} onClick={() => setRange('max')}>Max</button>
        </div>
      </div>
      <div className="card-body card-body--chart">
        <div className="chart-canvas-wrap chart-h-lg">
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </section>
  );
}
