'use client';

import { useRouter } from 'next/navigation';
import {
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import { InfoTip } from '@/components/ui/InfoTip';
import { scoreColor } from '@/lib/ratings';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import type { ResultRow } from './columns';

// Opportunity Map — Financial Health (x) vs Valuation (y), bubble size = Overall
// Rating. The top-right quadrant (strong health + discounted valuation) is the
// "Opportunity Zone". Click a bubble to open that stock's detail page. Built on
// Recharts (locked stack) rather than the reference's Chart.js canvas. Only rows
// with a Financial Health score can be plotted; the rest still appear in the table.

interface Point {
  ticker: string;
  symbol: string;
  name: string | null;
  health: number;
  valuation: number;
  overall: number;
}

const SPLIT = 65; // tier-2 (Constructive) threshold — the quadrant divider.

export function OpportunityMap({ rows }: { rows: ResultRow[] }) {
  const router = useRouter();

  const points: Point[] = rows
    .filter((r) => r.financialHealthScore != null)
    .map((r) => ({
      ticker: r.ticker,
      symbol: tickerToUrlParts(r.ticker).symbol,
      name: r.name,
      health: r.financialHealthScore as number,
      valuation: r.valuationScore,
      overall: r.overallRating,
    }));

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div className="card-title">
          Opportunity Map — Financial Health vs Valuation
          <InfoTip title="Opportunity Map">
            Each bubble is one analysed stock. The horizontal axis is Financial Health (further
            right = a stronger company); the vertical axis is the Valuation score (higher up = more
            discounted versus its own history). Bubble size reflects the Overall Rating. The
            top-right Opportunity Zone — healthy companies trading at a discount — is where the most
            cyclically attractive names cluster. Click any bubble to open its full detail.
            Information only — not financial advice.
          </InfoTip>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Bubble size = Overall Rating · click any bubble to open it
        </div>
      </div>
      <div className="card-body">
        {points.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-[var(--text-muted)]">
            No stocks with a Financial Health score to plot.
          </div>
        ) : (
          <div className="opp-map-wrap">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 340 }}>
              <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
                <ReferenceArea
                  x1={SPLIT}
                  x2={100}
                  y1={SPLIT}
                  y2={100}
                  fill="var(--c-tier-2)"
                  fillOpacity={0.07}
                  stroke="none"
                  label={{
                    value: 'Opportunity Zone',
                    position: 'insideTopRight',
                    fill: 'var(--c-tier-2)',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <ReferenceLine x={SPLIT} stroke="var(--border-strong)" strokeDasharray="4 4" />
                <ReferenceLine y={SPLIT} stroke="var(--border-strong)" strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  dataKey="health"
                  name="Financial Health"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 65, 75, 100]}
                  tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Financial Health →', position: 'insideBottom', offset: -16, fill: '#8A97A8', fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="valuation"
                  name="Valuation"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 65, 75, 100]}
                  tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                  label={{ value: 'Valuation →', angle: -90, position: 'insideLeft', fill: '#8A97A8', fontSize: 10 }}
                />
                <ZAxis type="number" dataKey="overall" range={[60, 420]} domain={[0, 100]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0]?.payload as Point | undefined;
                    if (!p) return null;
                    return (
                      <div style={{ background: '#1A1A1B', border: '1px solid #2E3347', borderRadius: 6, padding: '8px 12px' }}>
                        <div style={{ color: '#E8EAF0', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                          {p.symbol}
                          {p.name ? <span style={{ color: '#94A3B8', fontWeight: 400 }}> · {p.name}</span> : null}
                        </div>
                        <div style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.5 }}>
                          Health {Math.round(p.health)} · Valuation {Math.round(p.valuation)}
                          <br />
                          Overall {Math.round(p.overall)}
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={points}
                  onClick={(d: unknown) => {
                    const p = (d as { payload?: Point }).payload;
                    if (p) router.push(tickerToPath(p.ticker));
                  }}
                >
                  {points.map((p) => (
                    <Cell
                      key={p.ticker}
                      fill={scoreColor(p.overall)}
                      fillOpacity={0.62}
                      stroke={scoreColor(p.overall)}
                      strokeWidth={1}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
