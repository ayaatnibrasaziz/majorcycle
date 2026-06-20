'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  label: OverallLabel;
}

// A pinned popover listing the stocks that share one (Health, Valuation) grid
// cell — the same disambiguation pattern as Smart Money Activity's day panel.
interface ClusterState {
  points: Point[];
  x: number; // viewport anchor (the click point)
  y: number;
}

const SPLIT = 65; // tier-2 (Constructive) threshold — the quadrant divider.

// Bubbles sit on a 0–100 grid; two stocks within the same integer cell visually
// overlap. We cluster by the rounded cell so a click on a stack opens a picker.
function cellKey(health: number, valuation: number): string {
  return `${Math.round(health)}|${Math.round(valuation)}`;
}

// Clamp the popover to stay fully inside the viewport (mirrors SmartMoneyActivity).
function clampClusterPos(x: number, y: number): { left: number; top: number } {
  if (typeof window === 'undefined') return { left: x, top: y };
  const PW = 260;
  const PH = Math.min(window.innerHeight * 0.5, 340);
  let left = x + 14;
  if (left + PW > window.innerWidth - 8) left = x - PW - 14;
  if (left < 8) left = 8;
  let top = y + 14;
  if (top + PH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - PH - 8);
  return { left, top };
}

export function OpportunityMap({ rows }: { rows: ResultRow[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [cluster, setCluster] = useState<ClusterState | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 }); // last click point, for popover anchoring

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
        label,
      })),
  })).filter((s) => s.points.length > 0);

  // Explicit legend order + colours, pinned to the rating-tier sequence (High
  // Conviction → … → Bearish) rather than Recharts' series-registration order.
  const legendPayload = series.map((s) => ({
    value: s.label,
    type: 'circle' as const,
    id: s.label,
    color: scoreColor(tierMidScore(s.label)),
  }));

  // Cluster the currently-visible points by grid cell so a click on a stack of
  // overlapping bubbles can offer a picker instead of guessing which one to open.
  const clusters = new Map<string, Point[]>();
  for (const s of series) {
    if (hidden.has(s.label)) continue;
    for (const p of s.points) {
      const key = cellKey(p.health, p.valuation);
      const list = clusters.get(key);
      if (list) list.push(p);
      else clusters.set(key, [p]);
    }
  }

  const openPoint = (d: unknown) => {
    const p = (d as { payload?: Point }).payload;
    if (!p) return;
    const group = clusters.get(cellKey(p.health, p.valuation)) ?? [p];
    if (group.length > 1) {
      // Overlapping bubbles → open the picker at the click point.
      const sorted = [...group].sort((a, b) => b.overall - a.overall);
      setCluster({ points: sorted, x: mouse.current.x, y: mouse.current.y });
    } else {
      router.push(tickerToPath(p.ticker));
    }
  };

  // Close the picker on Escape / outside-click / scroll / resize.
  useEffect(() => {
    if (!cluster) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCluster(null); };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // Clicks inside the picker, or on another bubble (handled by openPoint), don't close.
      if (popRef.current?.contains(t) || wrapRef.current?.contains(t)) return;
      setCluster(null);
    };
    const onScrollResize = () => setCluster(null);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [cluster]);

  const clusterPos = cluster ? clampClusterPos(cluster.x, cluster.y) : null;
  const isClient = typeof document !== 'undefined';

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div className="card-title">
          Opportunity Map — Financial Health vs Valuation
          <InfoTip title="Opportunity Map">
            Each bubble is one analysed stock. The horizontal axis is Financial Health (further
            right = a stronger company); the vertical axis is the Valuation score (higher up = more
            attractively valued for the company’s quality). Bubble size reflects the Overall Rating, and colour
            is the rating tier. The top-right Opportunity Zone — healthy companies trading at a
            discount — is where the most cyclically attractive names cluster. Click a legend tier to
            show/hide it, or any bubble to open its full detail. Information only — not financial
            advice.
          </InfoTip>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Bubble size = Overall Rating · click a tier to toggle · click a bubble (or a stack) to open
        </div>
      </div>
      <div className="card-body">
        {plottable.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-[var(--text-muted)]">
            No stocks with a Financial Health score to plot.
          </div>
        ) : (
          <div
            ref={wrapRef}
            className="opp-map-wrap chart-h-lg"
            onPointerDownCapture={(e) => {
              mouse.current = { x: e.clientX, y: e.clientY };
            }}
          >
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

                {/* Custom legend so the tier order is pinned (High Conviction → Bearish),
                    not left to Recharts' series-registration order. Click toggles a tier. */}
                <Legend
                  verticalAlign="top"
                  align="center"
                  wrapperStyle={{ paddingBottom: 8 }}
                  content={() => (
                    <ul className="opp-legend">
                      {legendPayload.map((e) => {
                        const off = hidden.has(e.value);
                        return (
                          <li key={e.id} className="opp-legend-item" onClick={() => toggle(e.value)}>
                            <span className="opp-legend-dot" style={{ background: e.color, opacity: off ? 0.4 : 1 }} />
                            <span style={{ color: off ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: off ? 'line-through' : 'none' }}>
                              {e.value}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
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

      {/* Cluster picker — pinned list of the stocks stacked on one grid cell. */}
      {isClient && cluster && clusterPos && createPortal(
        <div
          ref={popRef}
          className="opp-cluster"
          role="dialog"
          aria-label="Overlapping stocks at this point"
          style={{ left: clusterPos.left, top: clusterPos.top }}
        >
          <div className="opp-cluster-head">
            <div>
              <div className="opp-cluster-title">{cluster.points.length} stocks here</div>
              <div className="opp-cluster-sub">Same Health × Valuation — pick one to open</div>
            </div>
            <button type="button" className="opp-cluster-close" aria-label="Close" onClick={() => setCluster(null)}>×</button>
          </div>
          <div className="opp-cluster-body">
            {cluster.points.map((p) => (
              <button
                type="button"
                key={p.ticker}
                className="opp-cluster-row"
                onClick={() => router.push(tickerToPath(p.ticker))}
              >
                <span className="opp-cluster-dot" style={{ background: scoreColor(p.overall) }} />
                <span className="opp-cluster-sym">{p.symbol}</span>
                {p.name && <span className="opp-cluster-name">{p.name}</span>}
                <span className="opp-cluster-score">{Math.round(p.overall)}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
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
