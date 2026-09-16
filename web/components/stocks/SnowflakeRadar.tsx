'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import type { CycleAnalysis } from '@/lib/types';
import { RATING_TIER_HEX, tierFromScore } from '@/lib/ratings';
import { CHART_TOOLTIP } from '@/lib/chartTheme';
import { InfoTip } from '@/components/ui/InfoTip';
import { textWidth, whenFontsReady } from '@/lib/textWidth';

interface Props {
  cycle: CycleAnalysis;
}

/**
 * Custom angle-axis tick — each pillar named beside its own spoke.
 *
 * Recharts reserves no space for radar labels, so each is pushed radially
 * outward and anchored OUTWARD — right labels grow rightward, left leftward,
 * top and bottom centred — to sit in the margin beyond the grid ring.
 *
 * ⚠️ ONE LINE, ALWAYS. An earlier fix broke "Balance Sheet" across two lines to
 * make it fit; the owner rejected it (2026-09-16) and asked for the RING to give
 * way instead. That is the better trade anyway: a wrapped label changes the
 * card's typography at one width, while a slightly smaller ring changes nothing
 * a reader has to read. `SnowflakeRadar` now sizes `outerRadius` so these fit.
 */
const LABEL_PUSH_PX = 2;   // outward nudge off the ring
const LABEL_FONT_PX = 10.5;
const LABEL_WEIGHT = 600;

/**
 * Recharts places a tick slightly OUTSIDE the ring it belongs to — measured at
 * about 7px on this chart — so the ring's half-width is `(R + this) * cos(18deg)`
 * and the room left for a side label is what remains to the edge of the box.
 */
const TICK_GAP_PX = 7;

/**
 * The smallest ring RADIUS still worth labelling.
 *
 * ⚠️ THE TRADE HAS TWO SIDES AND ONLY ONE OF THEM IS "DOES IT FIT". Shrinking the
 * ring until the words fit works arithmetically at every width and looks wrong
 * well before it stops working: at 320px the ring came out 65px across beside
 * 10.5px labels, and the owner's read was that *"the radar chart is very small
 * compared to the text"* — the chart had become the caption's caption. At 360px
 * (ring 102px) the same layout reads fine.
 *
 * So below this the labels stand down and the ring goes back to its FULL size:
 * a proper radar with no words beats a tiny one with them, because the five
 * pillars are named with their scores in the bars directly underneath either way.
 *
 * ⚠️ This is a judgement, so it is written where it can be changed in one place
 * and its effect is asserted on screen rather than assumed.
 */
const MIN_LABELLED_RADIUS_PX = 46;

/**
 * A floor, so a pathological label can never collapse the chart to nothing.
 *
 * ⚠️ DELIBERATELY BELOW WHAT THE NARROWEST WIDTH NEEDS. At 34 the floor was the
 * binding constraint at 320px — the ring stopped shrinking before the label fit,
 * and the 2px of clearance that resulted was an accident of the measurement
 * being a shade generous rather than something the code arranged. Rename a
 * pillar one character longer and it would have overflowed again. At 28 the
 * formula governs at every width the product supports, so the margin is
 * constructed rather than lucky, and this is only a stop against absurdity.
 */
const MIN_RADIUS_PX = 28;

/**
 * Clearance the widest label keeps inside the chart box.
 *
 * ⚠️ NOT ZERO. Sizing the ring so the label ENDS at the edge measured the ink 1px
 * OUTSIDE it at 320-360px — a boundary, and the wrap clips, so the last stroke of
 * "Balance Sheet" was being shaved. This repo has been caught by a guard passing
 * with 1.1px to spare before (11i-b); a bound with no margin is not a bound. Four
 * pixels costs about 8px of ring width and puts the ink plainly inside.
 */
const LABEL_EDGE_PAD_PX = 4;

function AngleAxisTick(props: {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: { value?: string };
}) {
  const { x = 0, y = 0, cx = 0, cy = 0, payload } = props;
  const dx = x - cx;
  const dy = y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const lx = x + (dx / len) * LABEL_PUSH_PX;
  const ly = y + (dy / len) * LABEL_PUSH_PX;
  const anchor = lx > cx + 6 ? 'start' : lx < cx - 6 ? 'end' : 'middle';

  return (
    <text
      x={lx}
      y={ly}
      textAnchor={anchor}
      dominantBaseline="central"
      fill="#4A5568"
      fontSize={LABEL_FONT_PX}
      fontFamily="Sora"
      fontWeight={LABEL_WEIGHT}
    >
      {payload?.value}
    </text>
  );
}

// The five pillars and the weight each carries in the composite Health Score
// (weights sum to 100; they renormalise when a pillar is withheld). Weights are
// surfaced in the UI so the headline score visibly follows from the bars.
const AXES = [
  {
    key:    'profitability' as const,
    label:  'Profitability',
    weight: 30,
    desc:   'How efficiently the company turns revenue into profit. Factors in Return on Equity, Gross Margin, Net Margin and operating leverage. Higher = a more profitable business model.',
  },
  {
    key:    'balanceSheet' as const,
    label:  'Balance Sheet',
    weight: 25,
    desc:   'Financial resilience and stability. Factors in Debt/Equity, Current Ratio and Interest Coverage. Higher = a stronger balance sheet with lower financial risk.',
  },
  {
    key:    'growth' as const,
    label:  'Growth',
    weight: 20,
    desc:   'How fast the company is expanding its revenues and earnings. Higher = faster-growing; 80+ indicates a high-growth company.',
  },
  {
    key:    'cashflow' as const,
    label:  'Cash Flow',
    weight: 15,
    desc:   'The quality and consistency of cash generation. Factors in Free Cash Flow yield, FCF margin and operating cash conversion. Higher = a more cash-generative business.',
  },
  {
    key:    'shareholder' as const,
    label:  'Shareholder',
    weight: 10,
    desc:   'How well the company returns value to shareholders. Factors in dividend yield, payout consistency, buybacks and share-count changes. Higher = more shareholder-friendly.',
  },
] as const;

/**
 * Colour a pillar score by the app's rating tiers (design-system §4) so colour
 * is *meaningful* — strong pillars green, weak pillars red — rather than the
 * reference's fixed identity colours (which left Shareholder red even at 100).
 */
// ⚠️ This restated BOTH the five hexes and the 80/65/50/35 thresholds until
// 2026-08-22 — a whole second copy of the rating ladder, in a file nobody would
// open to change a rating. Recharts needs a literal colour (an SVG `fill` cannot
// resolve a CSS variable through its props), which is why the hex comes from
// `RATING_TIER_HEX` rather than `scoreColor`; the THRESHOLDS have no such excuse
// and now come from `tierFromScore` (CLAUDE.md 11c).
function tierColor(score: number): string {
  return RATING_TIER_HEX[tierFromScore(score)];
}

/** Radar vertex dot, coloured by the pillar's score tier (matches the bars). */
function ScoreDot(props: { cx?: number; cy?: number; index?: number; payload?: { value?: number }; r?: number }) {
  const { cx = 0, cy = 0, index = 0, payload, r = 5 } = props;
  return (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={r}
      fill={tierColor(payload?.value ?? 0)}
      stroke="#fff"
      strokeWidth={2}
    />
  );
}

export function SnowflakeRadar({ cycle }: Props) {
  const { fhSubscores, financialHealthScore } = cycle;

  // Only plot pillars that actually have data — a missing pillar is omitted
  // (Proposal P3), never drawn as a misleading 0-spike. The right-hand bar list
  // still lists all five pillars, showing "—" for the ones without data.
  const availableAxes = AXES.filter((ax) => fhSubscores[ax.key] !== undefined);
  const data = availableAxes.map((ax) => ({
    subject: ax.label,
    value:   Math.round(fhSubscores[ax.key] as number),
  }));
  const hasScore = financialHealthScore !== null && data.length >= 3;

  /* The two pillars that land on the LEFT and RIGHT of the ring — the only ones
     whose room is tight, and therefore the ones the ring has to be sized for.
     Derived from the axis angles rather than hard-coded indices, so it stays
     right when a stock is missing a pillar and the radar draws four spokes.
     Recharts starts at the top and goes clockwise. */
  const sideSubjects = data
    .map((d, i) => ({
      subject: d.subject,
      horizontal: Math.abs(Math.cos(((90 - (i * 360) / data.length) * Math.PI) / 180)),
    }))
    .sort((a, b) => b.horizontal - a.horizontal)
    .slice(0, 2)
    .map((d) => d.subject);

  /**
   * How big the ring may be before its side labels run out of room.
   *
   * ⚠️ THE RING GIVES WAY, NOT THE WORDS (owner, 2026-09-16: *"I don't want you
   * to move 'Sheet' into the new line for Balance Sheet. Maybe slightly reduce
   * the size of the radar chart to fit it on the screen."*). Above ~375px this
   * changes nothing — the percentage radius is already the smaller of the two —
   * so the desktop chart is untouched and the reduction only appears where the
   * box is genuinely too narrow.
   *
   * ⚠️ Measured with a canvas, not estimated per character: an estimate already
   * put "hareholder" on screen once, and re-measured after the webfont lands so
   * it is the real face rather than the fallback (`lib/textWidth.ts`).
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [labelled, setLabelled] = useState(true);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    let alive = true;
    const measure = () => {
      if (!alive) return;
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;

      // What Recharts' own "52%" would give, so this can only ever shrink it.
      const inner = Math.min(width - 36, height - 36);
      const byPercent = (0.52 * inner) / 2;

      const widest = sideSubjects.reduce((w, t) => {
        const m = textWidth(t, { fontSize: LABEL_FONT_PX, fontWeight: LABEL_WEIGHT });
        return m === null ? w : Math.max(w, m);
      }, 0);
      // No measurement means no opinion — keep Recharts' own sizing (11e).
      if (!widest) { setLabelled(true); setRadius(null); return; }

      const byLabel =
        (width / 2 - widest - LABEL_PUSH_PX - LABEL_EDGE_PAD_PX) /
          Math.cos((18 * Math.PI) / 180) -
        TICK_GAP_PX;

      if (byLabel < MIN_LABELLED_RADIUS_PX) {
        // Not enough room to label a ring worth looking at. Keep the chart at
        // full size and let the bars underneath carry the names.
        setLabelled(false);
        setRadius(Math.max(MIN_RADIUS_PX, byPercent));
        return;
      }
      setLabelled(true);
      setRadius(Math.max(MIN_RADIUS_PX, Math.min(byPercent, byLabel)));
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    void whenFontsReady().then(measure);
    measure();
    return () => { alive = false; ro.disconnect(); };
    // `sideSubjects` is derived from `data` and stable for a given stock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);
  /* The names actually on the chart — the omitted pillars are not drawn, so a
     stock missing one must not be judged against a word that is not there. */
  const missingLabels = AXES
    .filter((ax) => fhSubscores[ax.key] === undefined)
    .map((ax) => ax.label);

  // Accessible summary of the chart (check #9 — every chart carries an aria-label).
  const radarAriaLabel = hasScore
    ? `Financial health scorecard radar. ${data
        .map((d) => `${d.subject} ${d.value} out of 100`)
        .join(', ')}.`
    : 'Financial health scorecard — not enough fundamental data to plot.';

  return (
    <section id="sec-scorecard" className="scroll-mt-[120px] card card--stack-base">
      <div className="card-header">
        <h3 className="card-title">
          Stock Scorecard
          <InfoTip title="Stock Scorecard">
            The company&apos;s financial health broken into five pillars, each scored
            0–100. The Health Score is their weighted average — Profitability 30%,
            Balance Sheet 25%, Growth 20%, Cash Flow 15%, Shareholder 10%. Pillars
            without enough data are left out rather than guessed (common for banks
            &amp; REITs) and the rest are reweighted.
          </InfoTip>
        </h3>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {financialHealthScore !== null
            ? `Health Score ${Math.round(financialHealthScore)}/100`
            : 'Not enough data to score financial health'}
        </div>
      </div>
      <div className="card-body">
        <div className="radar-grid">
          {/* Left: radar chart */}
          <div ref={wrapRef} className="chart-canvas-wrap chart-h-radar" role="img" aria-label={radarAriaLabel}>
            {!hasScore ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  padding: '0 16px',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                Not enough fundamental data to plot the scorecard.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 260 }}>
              <RadarChart data={data} outerRadius={radius ?? '52%'} margin={{ top: 18, right: 18, bottom: 18, left: 18 }}>
                <PolarGrid gridType="polygon" stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={labelled ? <AngleAxisTick /> : false} />
                {/* Full 0–100 scale (a maxed pillar reaches the outer grid ring);
                    the labels are placed in the margin beyond the ring via the
                    outward-anchored custom tick. */}
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                  tickCount={6}
                />
                <Radar
                  dataKey="value"
                  fill="rgba(30,92,179,.15)"
                  stroke="#1E5CB3"
                  strokeWidth={2}
                  dot={<ScoreDot />}
                  activeDot={<ScoreDot r={7} />}
                />
                <Tooltip
                  formatter={(value, _name, entry) =>
                    [`${value ?? 0}/100`, (entry as { payload?: { subject?: string } }).payload?.subject ?? 'Score']
                  }
                  contentStyle={{
                    background: CHART_TOOLTIP.bg,
                    border: `1px solid ${CHART_TOOLTIP.border}`,
                    borderRadius: 6,
                    padding: '8px 12px',
                  }}
                  labelStyle={{ display: 'none' }}
                  itemStyle={{
                    color: CHART_TOOLTIP.muted,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
            )}
          </div>

          {/* Right: axis bars */}
          <div>
            {AXES.map((ax) => {
              const score    = fhSubscores[ax.key];
              const pct      = score !== undefined ? Math.round(score) : null;
              const barColor = pct !== null ? tierColor(pct) : 'var(--border)';
              // ⚠️ ONE VALUE WAS DOING TWO JOBS, and only one of them was legible.
              // When a pillar cannot be computed the bar is an empty track — `--border`
              // is exactly right for that, a hairline the eye reads as "nothing here".
              // The em dash beside it was taking the SAME value and is a figure a
              // reader has to read: #E2E8F0 on white is 1.23:1, so the row looked
              // broken rather than saying "we don't have this one". Found 2026-09-12
              // on AE.V's Growth axis; owner asked for the muted grey (5.6:1).
              //
              // Same shape as CLAUDE.md 11bb — an ink that meant both "a middling
              // verdict" and "the average" could not satisfy either once they were
              // asked to differ. A track and a value are two jobs; give them two
              // values. The SCORED case is untouched: it still takes the tier colour,
              // because there the bar and the number really are saying one thing.
              const scoreColour = pct !== null ? barColor : 'var(--text-muted)';
              return (
                <div key={ax.key} className="radar-axis-row">
                  <div className="radar-axis-label">
                    {ax.label}
                    <InfoTip title={`${ax.label} (0–100)`} size={12}>
                      {ax.desc}
                    </InfoTip>
                  </div>
                  <div className="radar-axis-bar-track">
                    <div
                      className="radar-axis-bar-fill"
                      // `--fill` rather than `width`: the bar is drawn full-width and
                      // slid into place with a composited transform. See globals.css.
                      style={{ '--fill': `${pct ?? 0}%`, background: barColor } as React.CSSProperties}
                    />
                  </div>
                  <div className="radar-axis-score" style={{ color: scoreColour }}>
                    {pct !== null ? pct : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {hasScore && missingLabels.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
            {`Not scored: ${missingLabels.join(', ')} — not enough data (common for banks & REITs). The health score reflects the remaining pillars.`}
          </div>
        )}
      </div>
    </section>
  );
}
