'use client';

import { CHART_INK, CHART_TOOLTIP } from '@/lib/chartTheme';
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
import { INK, REFERENCE_INK } from '@/lib/ink';

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

  /**
   * The verdict, and the ink it is printed in — from ONE set of thresholds.
   *
   * ⚠️ THE WORDS AND THE COLOUR USED TO CHANGE AT DIFFERENT NUMBERS, which is
   * this project's one-rule-two-places defect wearing a palette (CLAUDE.md 11c).
   * The words stepped at +20 / +5 / −5 / −15 and the colour at +15 / −10, so the
   * same phrase arrived in two different inks depending on where inside its own
   * band the reading fell: *Above Average* was plain black from +5% to +15% and
   * gold from +15% to +20%. Nothing was ever wrong on screen — every colour was
   * legible and every word was true — and no guard could have had an opinion,
   * because neither half was incorrect on its own. One function now returns both,
   * so they cannot part company again.
   *
   * ⚠️ AND THE PALETTE IS DELIBERATELY THE DIRECTION INK, NOT THE RATING TIERS
   * (owner, 2026-09-11). A five-tier ramp here would say our Overall Rating about
   * a stock that is merely priced above its own history, and the header already
   * spends the tiers on the Valuation Zone badge. So: two greens for the cheap
   * half, gold for the middle, two reds for the expensive half — five words, three
   * inks, the same three this card's neighbours use.
   */
  function verdictOf(v: number | null): { label: string; color: string } {
    if (v === null)  return { label: '—',                      color: 'var(--text-muted)' };
    if (v > 20)      return { label: 'Historically Expensive', color: INK.down };
    if (v > 5)       return { label: 'Above Average',          color: INK.down };
    if (v < -15)     return { label: 'Historically Cheap',     color: INK.up };
    if (v < -5)      return { label: 'Below Average',          color: INK.up };
    return             { label: 'Fair Value',                  color: INK.neutral };
  }

  const { label: verdictLabel, color: verdictInk } = verdictOf(vsAvg);

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <h3 className="card-title">
          Valuation History — P/E Ratio
          <InfoTip title="P/E Ratio history">
            P/E (price-to-earnings) is the share price divided by earnings per share —
            how many dollars investors pay for each dollar of profit. Higher = more
            expensive. Plotting it over time shows whether the stock looks cheap or
            pricey versus its own past.
          </InfoTip>
        </h3>
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
                            background: CHART_TOOLTIP.bg,
                            border: `1px solid ${CHART_TOOLTIP.border}`,
                            borderRadius: 6,
                            padding: '8px 12px',
                          }}
                        >
                          <div style={{ color: CHART_TOOLTIP.text, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            {label}
                          </div>
                          <div style={{ color: CHART_TOOLTIP.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                            P/E: {Number(payload[0]?.value ?? 0).toFixed(1)}x
                          </div>
                        </div>
                      );
                    }}
                  />
                  {avg !== null && (
                    <ReferenceLine
                      y={avg}
                      /* ⚠️ REFERENCE_INK, not INK.neutral. This rule IS the
                         historical average — a baseline, not a verdict — and
                         INK.neutral became the gold "middling verdict" on
                         2026-09-10. The verdict text below still uses it. */
                      stroke={REFERENCE_INK}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      label={{ value: `Avg ${avg}x`, position: 'insideBottomRight', fill: REFERENCE_INK, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
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
                {/* Reads the verdict's own ink, so the percentage and the word
                    beside it can never disagree about which band this is. */}
                <div className="summary-strip-val" style={{ color: verdictInk }}>
                  {vsAvg !== null ? `${vsAvg >= 0 ? '+' : ''}${vsAvg}%` : '—'}
                </div>
              </div>
              <div className="summary-strip-item" title="Valuation Verdict — plain-English summary based on P/E vs historical average.">
                <div className="summary-strip-label">Verdict</div>
                <div className="summary-strip-val" style={{ color: verdictInk }}>{verdictLabel}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
