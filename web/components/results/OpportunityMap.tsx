'use client';

import { CHART_INK, CHART_TOOLTIP, OPPORTUNITY_ZONES } from '@/lib/chartTheme';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { OVERALL_LABELS, scoreColor, tierFromLabel } from '@/lib/ratings';
import { textWidth, whenFontsReady } from '@/lib/textWidth';
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

/** The in-chart zone labels' size, shared by the renderer and the fit test. */
const ZONE_FONT_PX = 9.5;

/** Breathing room a label must keep inside its own quadrant's edges. */
const ZONE_PAD_PX = 14;

/**
 * The four quadrants: where each sits, what tints it, and what names it.
 *
 * ⚠️ ONE table, read twice — once by the `<ReferenceArea>` that paints the tint
 * and once by the legend under the chart. Two lists would drift the moment a
 * threshold or a colour moved, and the colour is the ONLY thing tying a legend
 * row to the region it names (11c: one rule, one place).
 */
const ZONES = [
  {
    label: 'Opportunity Zone',
    x1: SPLIT, x2: 100, y1: SPLIT, y2: 100,
    fill: OPPORTUNITY_ZONES.zoneGood, fillOpacity: 0.07,
    ink: OPPORTUNITY_ZONES.zoneGood, strong: true,
    position: 'insideTopRight' as const, share: (100 - SPLIT) / 100,
  },
  {
    label: 'Weak but cheap',
    x1: 0, x2: SPLIT, y1: SPLIT, y2: 100,
    fill: OPPORTUNITY_ZONES.zoneCheapWash, fillOpacity: 0.05,
    ink: 'var(--brand-deep)', strong: false,
    position: 'insideTopLeft' as const, share: SPLIT / 100,
  },
  {
    label: 'Healthy, fully priced',
    x1: SPLIT, x2: 100, y1: 0, y2: SPLIT,
    fill: OPPORTUNITY_ZONES.zonePricedWash, fillOpacity: 0.06,
    ink: OPPORTUNITY_ZONES.zonePricedInk, strong: false,
    position: 'insideBottomRight' as const, share: (100 - SPLIT) / 100,
  },
  {
    label: 'Weak & expensive',
    x1: 0, x2: SPLIT, y1: 0, y2: SPLIT,
    fill: OPPORTUNITY_ZONES.zoneWorstWash, fillOpacity: 0.06,
    ink: 'var(--c-tier-5-ink)', strong: false,
    position: 'insideBottomLeft' as const, share: SPLIT / 100,
  },
] as const;





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

export function OpportunityMap({
  rows,
  horizonQuery,
}: {
  rows: ResultRow[];
  /** `?…` horizon suffix (from the run) so a bubble opens the same Major Cycle window. */
  horizonQuery: string;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [cluster, setCluster] = useState<ClusterState | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  /**
   * Do the four zone names still fit INSIDE their own quadrants?
   *
   * ⚠️ The names belong in the chart — that is where they read best, and the
   * desktop layout is not to change (owner, 2026-09-16). They only move to a
   * legend underneath *"when the screen size becomes small and the text is
   * overlapping / away from its own quadrant"*, which is a measurement, not a
   * breakpoint: the quadrants are 65% and 35% of the plot, so the right-hand two
   * are the tight ones and "Opportunity Zone" is the longest thing in them.
   *
   * ⚠️ Measured with a canvas rather than estimated per character — an estimate
   * already shipped a cut label once (see `lib/textWidth.ts`) — and re-taken
   * once the webfont is in, because before that it measures the fallback face.
   */
  const [namesFitInside, setNamesFitInside] = useState(true);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    let alive = true;
    const measure = () => {
      if (!alive) return;
      // The plot is the wrap minus the axis gutters; the ReferenceArea labels are
      // positioned within it, so its width is what the quadrants divide up.
      const plot = el.querySelector('.recharts-cartesian-grid')?.getBoundingClientRect().width
        ?? el.getBoundingClientRect().width;
      if (!plot) return;
      const fits = ZONES.every((z) => {
        const w = textWidth(z.label, {
          fontSize: ZONE_FONT_PX,
          fontWeight: z.strong ? 700 : 600,
        });
        // `null` is "could not measure", not "zero wide" — keep the labels where
        // they are rather than silently rearranging the chart on a guess (11e).
        return w === null || w + ZONE_PAD_PX <= plot * z.share;
      });
      setNamesFitInside(fits);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    void whenFontsReady().then(measure);
    measure();
    return () => { alive = false; ro.disconnect(); };
  }, []);
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
  // Count in the top-right Opportunity Zone (healthy + attractively valued) for the
  // screen-reader summary.
  const oppZoneCount = plottable.filter(
    (r) => (r.financialHealthScore as number) >= SPLIT && r.valuationScore >= SPLIT,
  ).length;

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
      router.push(tickerToPath(p.ticker) + horizonQuery);
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
          <>
          <div
            ref={wrapRef}
            className="opp-map-wrap chart-h-lg"
            onPointerDownCapture={(e) => {
              mouse.current = { x: e.clientX, y: e.clientY };
            }}
          >
            {/* Text alternative for the scatter (SR-only — `role="img"` on the wrap
                would hide the interactive legend inside it). The results table below
                carries the full per-stock values. */}
            <p className="sr-only">
              {`Opportunity map: ${plottable.length} stock${plottable.length === 1 ? '' : 's'} plotted by Financial Health (horizontal axis) versus Valuation score (vertical axis); larger bubbles are higher Overall ratings. ${oppZoneCount} ${oppZoneCount === 1 ? 'sits' : 'sit'} in the top-right Opportunity Zone — healthy companies trading at a discount. Full per-stock values are in the results table below.`}
            </p>
            {/* ⚠️ THE LEGEND IS ORDINARY DOM, ABOVE THE PLOT — it used to be a
                Recharts `<Legend verticalAlign="top">`, and at 320px the chips
                wrapped to a second row while the chart had reserved height for
                one. The result was the word "Neutral" printed INSIDE the plot,
                across "Weak but cheap" and "Opportunity Zone" (measured: 21x6
                and 16x6 of shared ink at 320, 11x6 and 6x6 at 340).

                ⚠️ And the run that found it had only THREE tiers on screen. The
                legend lists a chip per tier PRESENT, so a screen spanning all
                five is ~430px of chips and wraps at roughly 490px — a far
                commoner width than 320. The narrow phone is where it was seen;
                it is not where the defect ends.

                Taking the list out of the SVG makes the overlap impossible
                rather than unlikely: wrapped chips now push the plot down
                instead of covering it, whatever the tier count or the width.
                The position on screen is unchanged — `verticalAlign="top"` put
                it here anyway (11u: make the agreement structural). */}
            <ul className="opp-legend">
              {legendPayload.map((e) => {
                const off = hidden.has(e.value);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="opp-legend-item"
                      aria-pressed={!off}
                      // No aria-label: the accessible name is the visible tier
                      // name, and `aria-pressed` alone carries shown/hidden. It
                      // used to be `${off ? 'Show' : 'Hide'} ${e.value}`, which
                      // announced "Hide Bearish, pressed" - an action and a state
                      // pulling opposite ways, and the ARIA practice for a toggle
                      // is explicit that the label must not change with the state
                      // (audit 5A-109).
                      onClick={() => toggle(e.value)}
                    >
                      <span className="opp-legend-dot" style={{ background: e.color, opacity: off ? 0.4 : 1 }} />
                      <span style={{ color: off ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: off ? 'line-through' : 'none' }}>
                        {e.value}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="opp-map-plot">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 300 }}>
              <ScatterChart margin={{ top: 14, right: 18, bottom: 26, left: 6 }}>
                {/* Quadrant tints.
                    ⚠️ The four LABELS are solid ink, not a tinted colour at 70–80%
                    alpha as they were until 2026-08-22. Fading a label is the
                    instinctive way to say "this is background furniture", and it
                    measured 3.15 / 3.40 / 3.81 against a 4.5 floor on the paid
                    screener. The AREA fills still carry their alpha — they are
                    decoration and have no contrast duty. Recede with a colour,
                    never with transparency (CLAUDE.md 11q): a token can be
                    measured, an alpha silently dilutes whatever it is given. */}
                {/* ⚠️ THE TINTS STAY, THE WORDS MOVE OUT (owner, 2026-09-16:
                    *"why don't you put the 4 zone text as a legend down instead of
                    putting it inside the 4 quadrants? This will make it look
                    cleaner"*). Four fixed-size labels inside four shrinking
                    quadrants is the whole reason they collided at 320px — a
                    legend underneath has the card's full width and cannot run
                    into the plot at any size. The colour is what ties each
                    legend row to its quadrant, so the fills keep their tokens
                    and the swatches read the SAME constants (11c). */}
                {ZONES.map((z) => (
                  <ReferenceArea
                    key={z.label}
                    x1={z.x1} x2={z.x2} y1={z.y1} y2={z.y2}
                    fill={z.fill} fillOpacity={z.fillOpacity} stroke="none"
                    label={
                      namesFitInside
                        ? {
                            value: z.label, position: z.position, fill: z.ink,
                            fontSize: ZONE_FONT_PX, fontWeight: z.strong ? 700 : 600,
                          }
                        : undefined
                    }
                  />
                ))}
                <ReferenceLine x={SPLIT} stroke={OPPORTUNITY_ZONES.split} strokeDasharray="4 4" />
                <ReferenceLine y={SPLIT} stroke={OPPORTUNITY_ZONES.split} strokeDasharray="4 4" />

                <XAxis
                  type="number"
                  dataKey="health"
                  name="Financial Health"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 65, 75, 100]}
                  tick={{ fill: CHART_INK, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Financial Health →', position: 'insideBottom', offset: -14, fill: CHART_INK, fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="valuation"
                  name="Valuation"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 65, 75, 100]}
                  tick={{ fill: CHART_INK, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                  label={{ value: 'Valuation →', angle: -90, position: 'insideLeft', fill: CHART_INK, fontSize: 10 }}
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
                      <div style={{ background: CHART_TOOLTIP.bg, border: `1px solid ${CHART_TOOLTIP.border}`, borderRadius: 6, padding: '8px 12px' }}>
                        <div style={{ color: CHART_TOOLTIP.text, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                          {p.symbol}
                          {p.name ? <span style={{ color: CHART_TOOLTIP.muted, fontWeight: 400 }}> · {p.name}</span> : null}
                        </div>
                        <div style={{ color: CHART_TOOLTIP.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.5 }}>
                          Health {Math.round(p.health)} · Valuation {Math.round(p.valuation)}
                          <br />
                          Overall {Math.round(p.overall)} · click to open
                        </div>
                      </div>
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
          </div>

            {/* The four zones, named under the chart instead of inside it.
                ⚠️ OUTSIDE `.opp-map-wrap`, which is a FIXED-HEIGHT box. Putting
                the list inside it made the three children share that height and
                squashed the plot to a thin strip — the chart lost most of its
                vertical range while every label was perfectly placed.
                A `<ul>`, because it IS a list of four things, and the swatch is
                `aria-hidden` — the colour is a pointer to the region, not
                information a screen reader needs twice. */}
            {!namesFitInside && (
              <ul className="opp-zones" aria-label="What the four shaded regions mean">
                {ZONES.map((z) => (
                  <li key={z.label} className="opp-zone">
                    <span
                      className="opp-zone-swatch"
                      aria-hidden="true"
                      style={{ background: z.fill, opacity: z.fillOpacity * 9 }}
                    />
                    <span
                      className="opp-zone-name"
                      style={{ color: z.ink, fontWeight: z.strong ? 700 : 600 }}
                    >
                      {z.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
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
                onClick={() => router.push(tickerToPath(p.ticker) + horizonQuery)}
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
