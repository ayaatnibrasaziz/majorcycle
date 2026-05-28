'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type Time,
} from 'lightweight-charts';

import type { PriceBar } from '@/lib/types';

type Range = '1y' | '3y' | 'max';

function computeSMA(bars: PriceBar[], period: number): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j]!.close;
    result.push({ time: bars[i]!.date as Time, value: sum / period });
  }
  return result;
}

function filterByRange(bars: PriceBar[], range: Range): PriceBar[] {
  if (range === 'max') return bars;
  const cutoff = new Date();
  if (range === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);
  else cutoff.setFullYear(cutoff.getFullYear() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return bars.filter((b) => b.date >= cutoffStr);
}

interface Props {
  priceBars: PriceBar[];
  ticker: string;
}

export function PriceChart({ priceBars, ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<Range>('1y');

  useEffect(() => {
    const el = containerRef.current;
    if (!el || priceBars.length === 0) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch { /* ignore */ }
      chartRef.current = null;
    }

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
      timeScale: {
        borderColor: '#E2E8F0',
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false },
    });
    chartRef.current = chart;

    const filtered = filterByRange(priceBars, range);

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#228B22',
      downColor: '#B22222',
      borderUpColor: '#006400',
      borderDownColor: '#8B0000',
      wickUpColor: '#006400',
      wickDownColor: '#8B0000',
      borderVisible: true,
      priceLineVisible: false,
    });
    candleSeries.setData(
      filtered.map((b) => ({
        time: b.date as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );

    // SMAs computed over all available bars so values at range boundary are accurate
    const rangeStart = filtered.length > 0 ? filtered[0]!.date : '';

    const sma50 = computeSMA(priceBars, 50).filter((d) => (d.time as string) >= rangeStart);
    if (sma50.length > 0) {
      chart.addLineSeries({
        color: '#1E5CB3',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: '50D',
        crosshairMarkerVisible: false,
      }).setData(sma50);
    }

    const sma200 = computeSMA(priceBars, 200).filter((d) => (d.time as string) >= rangeStart);
    if (sma200.length > 0) {
      chart.addLineSeries({
        color: '#D4A017',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: '200D',
        crosshairMarkerVisible: false,
      }).setData(sma200);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chartRef.current.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch { /* ignore */ }
        chartRef.current = null;
      }
    };
  }, [priceBars, range]);

  return (
    <section id="sec-cycle" className="scroll-mt-[120px] card card--stack-snug">
      <div className="card-header">
        <div className="card-title">Price Chart — {ticker}</div>
        <div className="chart-controls">
          <button
            className={`range-btn${range === '1y' ? ' active' : ''}`}
            onClick={() => setRange('1y')}
          >
            1Y
          </button>
          <button
            className={`range-btn${range === '3y' ? ' active' : ''}`}
            onClick={() => setRange('3y')}
          >
            3Y
          </button>
          <button
            className={`range-btn${range === 'max' ? ' active' : ''}`}
            onClick={() => setRange('max')}
          >
            Max
          </button>
          <span
            className="chart-hint"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, border: '1px solid var(--border)', borderRadius: '50%',
              fontSize: 10, fontWeight: 600, fontFamily: "'Sora', sans-serif", marginLeft: 'auto',
              cursor: 'help', flexShrink: 0,
            }}
            title="Chart Navigation — Scroll to zoom, drag to pan. Blue line = 50-day MA · Amber line = 200-day MA."
            aria-label="Chart navigation info"
          >
            i
          </span>
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
