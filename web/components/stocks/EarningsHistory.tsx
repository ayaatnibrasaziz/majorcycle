'use client';

import { CANDLE, CHART_INK, CHART_TOOLTIP } from '@/lib/chartTheme';
import { useState } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_RIGHT_AXIS_WIDTH, fmtPerShare } from '@/lib/format';
import type { Currency, EarningsHistoryItem } from '@/lib/types';
import { INK } from '@/lib/ink';

interface Props {
  earningsHistory: EarningsHistoryItem[];
  /** EPS comes off the income statement, so it is in the REPORTING currency —
   *  pass `statementCurrency(fundamentals)`, never `fundamentals.currency`. */
  currency: Currency | string;
  /** From `reportingCurrencyNote(fundamentals)` — non-null only when the company
   *  reports in a currency other than the one its shares trade in. */
  currencyNote?: string | null;
}

function toQtrLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} '${String(d.getFullYear()).slice(2)}`;
}

interface ChartRow {
  label: string;
  est: number | null;
  act: number | null;
  surp: number | null;
  beat: boolean;
}

const TOOLTIP_DARK = {
  background: CHART_TOOLTIP.bg,
  border: `1px solid ${CHART_TOOLTIP.border}`,
  borderRadius: 6,
  padding: '8px 12px',
};

export function EarningsHistory({ earningsHistory, currency, currencyNote }: Props) {
  const items = earningsHistory.slice(-8);

  // Clickable legend — toggles each series (est / act) on and off.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggleSeries = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const LEGEND_ITEMS = [
    { label: 'Estimate', series: 'est', fill: 'rgba(139,157,168,.20)', stroke: 'rgba(139,157,168,.50)' },
    { label: 'Actual — beat', series: 'act', fill: '#228B22', stroke: CANDLE.up },
    { label: 'Actual — missed', series: 'act', fill: '#B22222', stroke: CANDLE.down },
  ];

  const data: ChartRow[] = items.map((item) => {
    const est = typeof item['epsestimate'] === 'number' ? (item['epsestimate'] as number) : null;
    const act = typeof item['epsactual'] === 'number' ? (item['epsactual'] as number) : null;
    // surprisepercent is stored as a decimal fraction (0.10 = 10%) — multiply × 100 for display
    const surpRaw = typeof item['surprisepercent'] === 'number'
      ? +((item['surprisepercent'] as number) * 100).toFixed(1)
      : null;
    return {
      label: toQtrLabel(item.date),
      est,
      act,
      surp: surpRaw,
      beat: act !== null && est !== null ? act >= est : false,
    };
  });

  if (data.length === 0) return null;

  // Some tickers carry earnings-history rows with no reported actual EPS (15 in the
  // current universe). "Earnings Performance" is a beat/miss chart, so with no
  // actuals to plot it would render bare axis labels + "0/N Qtrs". Hide the card
  // entirely instead — consistent with the no-rows case above (decision: a card
  // with nothing to show is hidden, not left half-empty).
  const hasActuals = data.some((d) => d.act !== null);
  if (!hasActuals) return null;

  const beats = data.filter((d) => d.beat).length;
  const surprises = data
    .filter((d) => d.surp !== null)
    .map((d) => d.surp as number);
  const avgSurp =
    surprises.length > 0
      ? +(surprises.reduce((s, v) => s + v, 0) / surprises.length).toFixed(1)
      : null;
  const actuals = data.filter((d) => d.act !== null).map((d) => d.act as number);
  const trending =
    actuals.length >= 3
      ? actuals[actuals.length - 1]! > actuals[actuals.length - 3]!
      : null;
  const lastEps = actuals.length > 0 ? (actuals[actuals.length - 1] ?? null) : null;

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <h3 className="card-title">
          Earnings Performance
          <InfoTip title="Earnings Performance">
            Each quarter, companies report earnings per share (EPS) — profit divided
            by the number of shares. This compares the actual figure with what
            analysts expected: a green bar means the company beat expectations, red
            means it fell short.
          </InfoTip>
        </h3>
        <div className="fin-tabs">
          <button className="fin-tab active" type="button">
            EPS
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="chart-canvas-wrap chart-h-sm">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 200 }}>
            <BarChart
              data={data}
              barGap={2}
              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fill: CHART_INK, fontSize: 10, fontFamily: 'Sora' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                orientation="right"
                tick={{
                  fill: CHART_INK,
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                tickFormatter={(v: number) => fmtPerShare(v, currency)}
                axisLine={false}
                tickLine={false}
                width={CHART_RIGHT_AXIS_WIDTH}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = data.find((d) => d.label === label);
                  return (
                    <div style={TOOLTIP_DARK}>
                      <div
                        style={{
                          color: CHART_TOOLTIP.text,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        {label}
                      </div>
                      {payload.map((p) => (
                        <div
                          key={String(p.dataKey)}
                          style={{
                            color: CHART_TOOLTIP.muted,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                          }}
                        >
                          {p.name}:{' '}
                          {p.value != null ? fmtPerShare(Number(p.value), currency) : '—'}
                        </div>
                      ))}
                      {row?.surp != null && (
                        <div
                          style={{
                            color: row.surp >= 0 ? INK.up : INK.down,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                          }}
                        >
                          Surprise: {row.surp >= 0 ? '+' : ''}
                          {row.surp.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {/* ⚠️ Drawn by hand since 2026-10-03 (beta review B-17): Recharts drew ONE
                  swatch for "Actual" in the series' default colour — black — while every
                  actual bar is green (beat) or red (missed). The key now shows the three
                  colours a reader actually sees; clicking either Actual entry toggles the
                  actual bars, as before. Labels keep readable ink: the Estimate fill is a
                  20% wash, which as text measured 1.19:1. */}
              <Legend
                content={() => (
                  <div className="earnings-legend">
                    {LEGEND_ITEMS.map((it) => {
                      const off = hidden.has(it.series);
                      return (
                        <span
                          key={it.label}
                          className="earnings-legend-item"
                          onClick={() => toggleSeries(it.series)}
                          style={{
                            color: off ? 'var(--text-muted)' : 'var(--text-secondary)',
                            textDecoration: off ? 'line-through' : 'none',
                          }}
                        >
                          <span
                            className="earnings-legend-swatch"
                            style={{ background: it.fill, borderColor: it.stroke }}
                            aria-hidden="true"
                          />
                          {it.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              />
              <Bar
                dataKey="est"
                name="Estimate"
                fill="rgba(139,157,168,.20)"
                stroke="rgba(139,157,168,.50)"
                strokeWidth={1}
                radius={[2, 2, 0, 0]}
                hide={hidden.has('est')}
              />
              <Bar dataKey="act" name="Actual" radius={[2, 2, 0, 0]} hide={hidden.has('act')}>
                {data.map((row, idx) => (
                  <Cell
                    key={idx}
                    fill={row.beat ? '#228B22' : '#B22222'}
                    stroke={row.beat ? CANDLE.up : CANDLE.down}
                    strokeWidth={1.5}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="summary-strip">
          <div
            className="summary-strip-item"
            title={`Beat Rate — ${beats} of the last ${data.length} quarters beat analyst estimates. 75%+ signals strong execution.`}
          >
            <div className="summary-strip-label">Beat Rate</div>
            <div
              className="summary-strip-val"
              style={{
                color:
                  beats >= Math.ceil(data.length * 0.75)
                    ? INK.up
                    : 'var(--text-primary)',
              }}
            >
              {beats}/{data.length} Qtrs
            </div>
          </div>

          {avgSurp !== null && (
            <div
              className="summary-strip-item"
              title="Average Surprise % — average % by which actual EPS exceeded or missed estimates. Positive = consistently beating."
            >
              <div className="summary-strip-label">Avg Surprise</div>
              <div
                className="summary-strip-val"
                style={{ color: avgSurp >= 0 ? INK.up : INK.down }}
              >
                {avgSurp >= 0 ? '+' : ''}
                {avgSurp}%
              </div>
            </div>
          )}

          {trending !== null && (
            <div
              className="summary-strip-item"
              title="Recent EPS Trend — compares the most recent quarter to two quarters ago. Accelerating = momentum is building."
            >
              <div className="summary-strip-label">Recent Trend</div>
              <div
                className="summary-strip-val"
                style={{ color: trending ? INK.up : INK.down }}
              >
                {trending ? '▲ Accelerating' : '▼ Decelerating'}
              </div>
            </div>
          )}

          {lastEps !== null && (
            <div
              className="summary-strip-item"
              title="Last EPS — profit the company earned per share in the most recently reported quarter."
            >
              <div className="summary-strip-label">Last EPS</div>
              <div className="summary-strip-val">{fmtPerShare(lastEps, currency)}</div>
            </div>
          )}
        </div>
        {currencyNote && (
          <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
            {currencyNote}
          </div>
        )}
      </div>
    </div>
  );
}
