'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cell,
  Legend,
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
import { OVERALL_LABELS, scoreColor, tierFromLabel } from '@/lib/ratings';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import type { OverallLabel } from '@/lib/types';
import type { ResultRow } from './columns';

// Opportunity Map — Financial Health (x) vs Valuation (y), bubble size = Overall
// Rating, faithfully reproducing the reference's quadrant scatter (built on
// Recharts, our locked chart stack). Bubbles are grouped by OUR tier so the legend
// lists the tiers and is click-to-toggle (same pattern as RelativePerformance).
// The four quadrants are tinted + labelled; the top-right (strong health +
// discounted) is the Opportunity Zone. Click a bubble → that stock's detail page.

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
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggle = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  // Only rows with a Financial Health score can be plotted.
  const plottable = rows.filter((r) => r.financialHealthScore != null);

  // Group into one series per tier so each gets a toggleable legend entry.
  const series = OVERALL_LABELS.map((label) => ({
    label,
    tier: tierFromLabel(label),
    points: plottable
      .filter((r) => r.overallLabel === label)
      .map<Point>((r) => ({
        ticker: r.ticker,
        symbol: tickerToUrlParts(r.ticker).symbol,
        name: r.name,
        health: r.financialHealthScore as number,
        valuation: r.valuationScore,
        overall: r.overallRating,
      })),
  })).filter((s) => s.points.length > 0);

  const openPoint = (d: unknown) => {
    const p = (d as { payload?: Point }).payload;
    if (p) router.push(tickerToPath(p.ticker));
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div className="card-title">
          Opportunity Map — Financial Health vs Valuation
          <InfoTip title="Opportunity Map">
            Each bubble is one analysed stock. The horizontal axis is Financial Health (further
            right = a stronger company); the vertical axis is the Valuation score (higher up = more
            discounted versus its own history). Bubble size reflects the Overall Rating, and colour
            is the rating tier. The top-right Opportunity Zone — healthy companies trading at a
            discount — is where the most cyclically attractive names cluster. Click a legend tier to
            show/hide it, or any bubble to open its full detail. Information only — not financial
            advice.
          </InfoTip>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Bubble size = Overall Rating · click a tier to toggle · click a bubble to open it
        </div>
      </div>
      <div className="card-body">
        {plottable.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-[var(--text-muted)]">
            No stocks with a Financial Health score to plot.
          </div>
        ) : (
          <div className="opp-map-wrap chart-h-lg">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 300 }}>
              <ScatterChart margin={{ top: 14, right: 18, bottom: 26, left: 6 }}>
                {/* Quadrant tints */}
                <ReferenceArea x1={SPLIT} x2={100} y1={SPLIT} y2={100} fill="#006400" fillOpacity={0.07} stroke="none"
                  label={{ value: 'Opportunity Zone', position: 'insideTopRight', fill: '#006400', fontSize: 10, fontWeight: 700 }} />
                <ReferenceArea x1={SPLIT} x2={100} y1={0} y2={SPLIT} fill="#D4A017" fillOpacity={0.06} stroke="none"
                  label={{ value: 'Healthy, fully priced', position: 'insideBottomRight', fill: 'rgba(154,112,16,.8)', fontSize: 9.5, fontWeight: 600 }} />
                <ReferenceArea x1={0} x2={SPLIT} y1={SPLIT} y2={100} fill="#1E5CB3" fillOpacity={0.05} stroke="none"
                  label={{ value: 'Weak but cheap', position: 'insideTopLeft', fill: 'rgba(30,92,179,.7)', fontSize: 9.5, fontWeight: 600 }} />
                <ReferenceArea x1={0} x2={SPLIT} y1={0} y2={SPLIT} fill="#B22222" fillOpacity={0.06} stroke="none"
                  label={{ value: 'Weak & expensive', position: 'insideBottomLeft', fill: 'rgba(178,34,34,.7)', fontSize: 9.5, fontWeight: 600 }} />
                <ReferenceLine x={SPLIT} stroke="rgba(138,151,168,.45)" strokeDasharray="4 4" />
                <ReferenceLine y={SPLIT} stroke="rgba(138,151,168,.45)" strokeDasharray="4 4" />

                <XAxis
                  type="number"
                  dataKey="health"
                  name="Financial Health"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 65, 75, 100]}
                  tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Financial Health →', position: 'insideBottom', offset: -14, fill: '#8A97A8', fontSize: 10 }}
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
                {/* Smaller bubble range so a 100–200 stock run doesn't crowd: with
                    lower opacity, overlapping points at the same grid cell read as a
                    denser/darker cluster rather than one giant blob. */}
                <ZAxis type="number" dataKey="overall" range={[18, 200]} domain={[0, 100]} />

                <Tooltip
                  cursor={false}
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
                          Overall {Math.round(p.overall)} · click to open
                        </div>
                      </div>
                    );
                  }}
                />

                <Legend
                  verticalAlign="top"
                  align="center"
                  wrapperStyle={{ fontSize: 10, fontFamily: 'Sora', paddingBottom: 8, cursor: 'pointer' }}
                  iconSize={9}
                  onClick={(data) => {
                    const v = (data as { value?: unknown }).value;
                    if (typeof v === 'string') toggle(v);
                  }}
                  formatter={(value) => {
                    const off = typeof value === 'string' && hidden.has(value);
                    return off ? (
                      <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{value}</span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
                    );
                  }}
                />

                {series.map((s) => (
                  <Scatter
                    key={s.label}
                    name={s.label}
                    data={s.points}
                    fill={scoreColor(tierMidScore(s.label))}
                    fillOpacity={0.55}
                    hide={hidden.has(s.label)}
                    onClick={openPoint}
                    activeShape={false}
                    isAnimationActive={false}
                  >
                    {s.points.map((p) => (
                      <Cell key={p.ticker} fill={scoreColor(p.overall)} fillOpacity={0.55} stroke={scoreColor(p.overall)} strokeWidth={1} />
                    ))}
                  </Scatter>
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// A representative score for a tier, so the legend swatch colour matches the tier.
function tierMidScore(label: OverallLabel): number {
  const mid: Record<OverallLabel, number> = {
    'High Conviction': 90,
    Constructive: 72,
    Neutral: 57,
    Cautious: 42,
    Bearish: 20,
  };
  return mid[label];
}
