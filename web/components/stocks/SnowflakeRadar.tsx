'use client';

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
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  cycle: CycleAnalysis;
}

/**
 * Custom angle-axis tick. Recharts (unlike Chart.js) doesn't reserve space for
 * radar labels, so long side labels ("Balance Sheet", "Shareholder") overflow
 * the narrow 280px column. We anchor each label by its side — right labels grow
 * inward (end), left labels grow inward (start), top/bottom stay centred — so
 * they always fit within the container. We also push each label a few px
 * radially outward (away from the centre) so it clears the plotted shape; the
 * inward anchor keeps the wide side labels from clipping the container edge.
 */
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
  const off = 10; // push the label out along its spoke, off the plot
  const lx = x + (dx / len) * off;
  const ly = y + (dy / len) * off;
  const anchor = lx > cx + 6 ? 'end' : lx < cx - 6 ? 'start' : 'middle';
  return (
    <text
      x={lx}
      y={ly}
      textAnchor={anchor}
      dominantBaseline="central"
      fill="#4A5568"
      fontSize={10.5}
      fontFamily="Sora"
      fontWeight={600}
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
function tierColor(score: number): string {
  if (score >= 80) return '#006400'; // tier-1 High Conviction
  if (score >= 65) return '#228B22'; // tier-2 Constructive
  if (score >= 50) return '#D4A017'; // tier-3 Neutral
  if (score >= 35) return '#FF4500'; // tier-4 Cautious
  return '#B22222';                  // tier-5 Bearish
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
        <div className="card-title">
          Stock Scorecard
          <InfoTip title="Stock Scorecard">
            The company&apos;s financial health broken into five pillars, each scored
            0–100. The Health Score is their <strong>weighted</strong> average —
            Profitability 30%, Balance Sheet 25%, Growth 20%, Cash Flow 15%,
            Shareholder 10% — so the heavier pillars move it more (the % beside each
            bar is its weight). The further the shape stretches toward a corner, the
            stronger that pillar; bar colour reflects the score (green = strong →
            red = weak). Pillars without enough data are left out rather than
            guessed (common for banks &amp; REITs) and the rest are reweighted.
          </InfoTip>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {financialHealthScore !== null
            ? `Health Score ${Math.round(financialHealthScore)}/100 · Weighted average of the five pillars`
            : 'Not enough data to score financial health'}
        </div>
      </div>
      <div className="card-body">
        <div className="radar-grid">
          {/* Left: radar chart */}
          <div className="chart-canvas-wrap chart-h-radar" role="img" aria-label={radarAriaLabel}>
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
              <RadarChart data={data} outerRadius="68%" margin={{ top: 18, right: 24, bottom: 18, left: 24 }}>
                <PolarGrid gridType="polygon" stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={<AngleAxisTick />} />
                {/* Domain headroom (0–120, not 0–100) keeps even a maxed pillar's
                    vertex inside the grid so the corner labels sit clear of the
                    plotted shape (owner: labels away from the plot). */}
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 120]}
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
                    background: '#1A1A1B',
                    border: '1px solid #2E3347',
                    borderRadius: 6,
                    padding: '8px 12px',
                  }}
                  labelStyle={{ display: 'none' }}
                  itemStyle={{
                    color: '#94A3B8',
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
                      style={{ width: `${pct ?? 0}%`, background: barColor }}
                    />
                  </div>
                  <div
                    className="radar-axis-weight"
                    title={`${ax.label} carries ${ax.weight}% of the Health Score`}
                  >
                    {ax.weight}%
                  </div>
                  <div className="radar-axis-score" style={{ color: barColor }}>
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
