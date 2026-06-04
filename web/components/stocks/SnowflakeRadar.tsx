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
 * they always fit within the container.
 */
function AngleAxisTick(props: {
  x?: number;
  y?: number;
  cx?: number;
  payload?: { value?: string };
}) {
  const { x = 0, y = 0, cx = 0, payload } = props;
  const anchor = x > cx + 6 ? 'end' : x < cx - 6 ? 'start' : 'middle';
  return (
    <text
      x={x}
      y={y}
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

const AXES = [
  {
    key:   'profitability' as const,
    label: 'Profitability',
    color: '#D4A017',
    tip:   'Profitability Score (0–100) — Measures how efficiently the company converts revenue into profit. Factors in Return on Equity, Gross Margin, Net Margin, and operating leverage. Higher = more profitable business model.',
  },
  {
    key:   'balanceSheet' as const,
    label: 'Balance Sheet',
    color: '#006400',
    tip:   'Balance Sheet Score (0–100) — Measures financial resilience and stability. Factors in Debt/Equity, Current Ratio, and Interest Coverage. Higher = stronger balance sheet with lower financial risk.',
  },
  {
    key:   'growth' as const,
    label: 'Growth',
    color: '#228B22',
    tip:   'Growth Score (0–100) — Measures how fast the company is expanding its revenues and earnings. Higher = faster-growing business. A score of 80+ indicates a high-growth company.',
  },
  {
    key:   'cashflow' as const,
    label: 'Cash Flow',
    color: '#1E5CB3',
    tip:   'Cash Flow Score (0–100) — Measures the quality and consistency of cash generation. Factors in Free Cash Flow yield, FCF margin, and operating cash conversion. Higher = more cash-generative business.',
  },
  {
    key:   'shareholder' as const,
    label: 'Shareholder',
    color: '#B22222',
    tip:   'Shareholder Score (0–100) — Measures how well the company returns value to shareholders. Factors in dividend yield, payout consistency, buyback activity, and share count changes. Higher = more shareholder-friendly.',
  },
] as const;

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

  return (
    <section id="sec-scorecard" className="scroll-mt-[120px] card card--stack-base">
      <div className="card-header">
        <div className="card-title">
          Stock Scorecard
          <InfoTip title="Stock Scorecard">
            The company&apos;s financial health broken into five pillars, each scored
            0–100. The further the shape stretches toward a corner, the stronger
            that pillar. Pillars without enough data are left out rather than guessed
            (common for banks &amp; REITs).
          </InfoTip>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {financialHealthScore !== null
            ? `Health Score ${Math.round(financialHealthScore)}/100 · Each axis scored 0–100`
            : 'Not enough data to score financial health'}
        </div>
      </div>
      <div className="card-body">
        <div className="radar-grid">
          {/* Left: radar chart */}
          <div className="chart-canvas-wrap chart-h-radar">
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
              <RadarChart data={data} outerRadius="72%" margin={{ top: 14, right: 18, bottom: 14, left: 18 }}>
                <PolarGrid gridType="polygon" stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={<AngleAxisTick />} />
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
                  dot={{ r: 5, fill: '#1E5CB3', stroke: 'white', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#1E5CB3', stroke: 'white', strokeWidth: 2 }}
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
              const score = fhSubscores[ax.key];
              const pct   = score !== undefined ? Math.round(score) : null;
              return (
                <div key={ax.key} className="radar-axis-row" title={ax.tip}>
                  <div className="radar-axis-label">{ax.label}</div>
                  <div className="radar-axis-bar-track">
                    <div
                      className="radar-axis-bar-fill"
                      style={{ width: `${pct ?? 0}%`, background: ax.color }}
                    />
                  </div>
                  <div className="radar-axis-score" style={{ color: ax.color }}>
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
