'use client';

import { InfoTip } from '@/components/ui/InfoTip';
import {
  Area,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { PeHistoryItem } from '@/lib/types';

interface Props {
  peHistory: PeHistoryItem[];
  currentPe: number | null;
}

function toMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const yr = String(d.getFullYear()).slice(2);
  const mo = d.toLocaleString('en', { month: 'short' });
  return `${mo} '${yr}`;
}

export function ValuationHistory({ peHistory, currentPe }: Props) {
  const hasEnoughHistory = peHistory.length >= 4;

  const allPe   = peHistory.map((p) => p.pe);
  const curr    = currentPe ?? allPe[allPe.length - 1] ?? null;

  const chartData = peHistory.map((p) => ({ label: toMonthLabel(p.date), pe: p.pe }));

  const avg   = hasEnoughHistory
    ? +(allPe.reduce((s, v) => s + v, 0) / allPe.length).toFixed(1)
    : null;
  const vsAvg = avg !== null && curr !== null && avg !== 0
    ? +(((curr - avg) / Math.abs(avg)) * 100).toFixed(1)
    : null;

  function verdict(): string {
    if (vsAvg === null) return '—';
    if (vsAvg > 20) return 'Historically Expensive';
    if (vsAvg > 5)  return 'Above Average';
    if (vsAvg < -15) return 'Historically Cheap';
    if (vsAvg < -5)  return 'Below Average';
    return 'Fair Value';
  }

  function verdictColor(): string {
    if (vsAvg === null) return 'var(--text-muted)';
    if (vsAvg > 15)  return '#D4A017';
    if (vsAvg < -10) return '#228B22';
    return 'var(--text-primary)';
  }

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">
          Valuation History — P/E Ratio
          <InfoTip title="P/E Ratio history">
            P/E (price-to-earnings) is the share price divided by earnings per share —
            how many dollars investors pay for each dollar of profit. Higher = more
            expensive. Plotting it over time shows whether the stock looks cheap or
            pricey versus its own past.
          </InfoTip>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Is the stock cheap or expensive vs its own history?
        </div>
      </div>
      <div className="card-body">
        {!hasEnoughHistory ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.55 }}>
              P/E history is building — expanding as quarterly data accumulates over time.
              {curr !== null && (
                <span style={{ display: 'block', marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Current P/E: {curr.toFixed(1)}x
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="chart-canvas-wrap chart-h-sm">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 200 }}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: 'Sora' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    orientation="right"
                    tick={{
                      fill: '#8A97A8',
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    tickFormatter={(v: number) => `${v.toFixed(0)}x`}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div
                          style={{
                            background: '#1A1A1B',
                            border: '1px solid #2E3347',
                            borderRadius: 6,
                            padding: '8px 12px',
                          }}
                        >
                          <div style={{ color: '#E8EAF0', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            {label}
                          </div>
                          <div style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                            P/E: {Number(payload[0]?.value ?? 0).toFixed(1)}x
                          </div>
                        </div>
                      );
                    }}
                  />
                  {avg !== null && (
                    <ReferenceLine
                      y={avg}
                      stroke="#D4A017"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      label={{ value: `Avg ${avg}x`, position: 'insideBottomRight', fill: '#D4A017', fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                    />
                  )}
                  {curr !== null && (
                    <ReferenceLine
                      y={curr}
                      stroke="#B22222"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{ value: `Current ${curr.toFixed(1)}x`, position: 'insideTopRight', fill: '#B22222', fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                    />
                  )}
                  <Area
                    dataKey="pe"
                    name="P/E Ratio"
                    fill="rgba(30,92,179,.08)"
                    stroke="#1E5CB3"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#1E5CB3', stroke: 'white', strokeWidth: 2 }}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="summary-strip">
              <div className="summary-strip-item" title="Current P/E — Price ÷ EPS (trailing 12 months).">
                <div className="summary-strip-label">Current P/E</div>
                <div className="summary-strip-val">{curr !== null ? `${curr.toFixed(1)}x` : '—'}</div>
              </div>
              <div className="summary-strip-item" title="Historical Average P/E — your baseline for cheap/expensive judgements.">
                <div className="summary-strip-label">Hist Avg P/E</div>
                <div className="summary-strip-val">{avg !== null ? `${avg}x` : '—'}</div>
              </div>
              <div className="summary-strip-item" title="Current P/E vs Historical Average — negative = cheaper than usual.">
                <div className="summary-strip-label">vs Average</div>
                <div className="summary-strip-val" style={{ color: vsAvg !== null ? (vsAvg > 15 ? '#D4A017' : vsAvg < -10 ? '#228B22' : 'var(--text-primary)') : 'var(--text-muted)' }}>
                  {vsAvg !== null ? `${vsAvg >= 0 ? '+' : ''}${vsAvg}%` : '—'}
                </div>
              </div>
              <div className="summary-strip-item" title="Valuation Verdict — plain-English summary based on P/E vs historical average.">
                <div className="summary-strip-label">Verdict</div>
                <div className="summary-strip-val" style={{ color: verdictColor() }}>{verdict()}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
