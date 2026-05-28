'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';

import type { PriceBar } from '@/lib/types';

type Range = '1y' | '3y' | 'max';

const SMA_50_COLOR  = '#1E5CB3';
const SMA_200_COLOR = '#D4A017';

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
      timeScale: { borderColor: '#E2E8F0', timeVisible: false, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false },
    });
    chartRef.current = chart;

    // All candlestick data — no date filtering
    chart.addCandlestickSeries({
      upColor: '#228B22', downColor: '#B22222',
      borderUpColor: '#006400', borderDownColor: '#8B0000',
      wickUpColor: '#006400', wickDownColor: '#8B0000',
      borderVisible: true, priceLineVisible: false,
    }).setData(
      priceBars.map((b) => ({
        time: b.date as Time, open: b.open, high: b.high, low: b.low, close: b.close,
      })),
    );

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
        color: SMA_200_COLOR, lineWidth: 2,
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

    return () => {
      ro.disconnect();
      sma50Ref.current  = null;
      sma200Ref.current = null;
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
    <section id="sec-cycle" className="scroll-mt-[120px] card card--stack-snug">
      <div className="card-header">
        <div className="card-title">Price Chart — {ticker}</div>
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
          <button
            className="chart-info-btn"
            title="Daily chart · Scroll to zoom · Drag to pan"
            aria-label="Chart navigation help"
          >
            i
          </button>
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
