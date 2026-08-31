'use client';

import { CHART_INK } from '@/lib/chartTheme';
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

import { CHART_RIGHT_AXIS_WIDTH } from '@/lib/format';
import type { PeHistoryItem } from '@/lib/types';
import { INK } from '@/lib/ink';

interface Props {
  peHistory: PeHistoryItem[];
  currentPe: number | null;
  /** From `peHistoryUnavailableReason(fundamentals)`. Non-null only when the
   *  series can never be built (the company reports in a different currency from
   *  the one its shares trade in), so the empty state must not say "building". */
  unavailableReason?: string | null;
}

function toMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const yr = String(d.getFullYear()).slice(2);
  const mo = d.toLocaleString('en', { month: 'short' });
  return `${mo} '${yr}`;
}

export function ValuationHistory({ peHistory, currentPe, unavailableReason }: Props) {
  // `unavailableReason` OUTRANKS the stored series rather than merely captioning
  // an empty one. Withholding at the source is a single control: it protects the
  // chart only for as long as no cross-currency series is ever written, and a
  // refresh running older code writes exactly that (the nightly job rewrites
  // rows wholesale — CLAUDE.md 14g). A stale 5-year series would then render as
  // a normal chart, because the reason is only consulted when the data runs out.
  // Checking the currency HERE means the wrong series cannot be drawn even if it
  // is present: two independent controls, as 11b requires of the paid surfaces.
  const hasEnoughHistory = !unavailableReason && peHistory.length >= 4;

  const allPe   = peHistory.map((p) => p.pe);
  const curr    = currentPe ?? allPe[allPe.length - 1] ?? null;

  // Append today's trailing P/E as a final "Now" point so the Current marker
  // line sits exactly on the end of the curve. Today's price ÷ trailing EPS is
  // the genuinely-current reading (more up to date than the last month-end) and
  // keeps the headline consistent with the Key Metrics trailing P/E.
  const baseData  = peHistory.map((p) => ({ label: toMonthLabel(p.date), pe: p.pe }));
  const chartData = currentPe !== null
    ? [...baseData, { label: 'Now', pe: currentPe }]
    : baseData;

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
    if (vsAvg > 15)  return INK.neutral;
    if (vsAvg < -10) return INK.up;
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
              {unavailableReason ??
                'P/E history is building — expanding as quarterly data accumulates over time.'}
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
                  margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="label"
                    tick={{ fill: CHART_INK, fontSize: 10, fontFamily: 'Sora' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    orientation="right"
                    tick={{
                      fill: CHART_INK,
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    tickFormatter={(v: number) => `${v.toFixed(0)}x`}
                    axisLine={false}
                    tickLine={false}
                    width={CHART_RIGHT_AXIS_WIDTH}
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
                      stroke={INK.neutral}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      label={{ value: `Avg ${avg}x`, position: 'insideBottomRight', fill: INK.neutral, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                    />
                  )}
                  {curr !== null && (
                    <ReferenceLine
                      y={curr}
                      stroke={INK.brand}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{ value: `Current ${curr.toFixed(1)}x`, position: 'insideTopRight', fill: INK.brand, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
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
                <div className="summary-strip-val" style={{ color: vsAvg !== null ? (vsAvg > 15 ? INK.neutral : vsAvg < -10 ? INK.up : 'var(--text-primary)') : 'var(--text-muted)' }}>
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
