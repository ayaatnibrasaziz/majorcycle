'use client';

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

interface Props {
  earningsHistory: EarningsHistoryItem[];
  currency: Currency;
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
  background: '#1A1A1B',
  border: '1px solid #2E3347',
  borderRadius: 6,
  padding: '8px 12px',
};

export function EarningsHistory({ earningsHistory, currency }: Props) {
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
        <div className="card-title">
          Earnings Performance
          <InfoTip title="Earnings Performance">
            Each quarter, companies report earnings per share (EPS) — profit divided
            by the number of shares. This compares the actual figure with what
            analysts expected: a green bar means the company beat expectations, red
            means it fell short.
          </InfoTip>
        </div>
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
                tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: 'Sora' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                orientation="right"
                tick={{
                  fill: '#8A97A8',
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
                          color: '#E8EAF0',
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
                            color: '#94A3B8',
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
                            color: row.surp >= 0 ? '#228B22' : '#B22222',
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
              <Legend
                wrapperStyle={{ fontSize: 10, fontFamily: 'Sora', paddingTop: 4, cursor: 'pointer' }}
                iconSize={10}
                onClick={(data) => {
                  const key = (data as { dataKey?: unknown }).dataKey;
                  if (typeof key === 'string') toggleSeries(key);
                }}
                formatter={(value, entry) => {
                  const key = (entry as { dataKey?: unknown }).dataKey;
                  const off = typeof key === 'string' && hidden.has(key);
                  // Only restyle hidden series; visible labels keep recharts'
                  // default series-coloured text.
                  return off ? (
                    <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                      {value}
                    </span>
                  ) : (
                    <span>{value}</span>
                  );
                }}
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
                    stroke={row.beat ? '#006400' : '#8B0000'}
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
                    ? '#228B22'
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
                style={{ color: avgSurp >= 0 ? '#228B22' : '#B22222' }}
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
                style={{ color: trending ? '#228B22' : '#B22222' }}
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
      </div>
    </div>
  );
}
