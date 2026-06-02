import type { CycleAnalysis } from '@/lib/types';

interface Props {
  cycle: CycleAnalysis;
}

function ratingColor(rating: number): string {
  if (rating >= 80) return '#006400';
  if (rating >= 65) return '#228B22';
  if (rating >= 50) return '#D4A017';
  if (rating >= 35) return '#FF4500';
  return '#B22222';
}

function drawdownColor(dd: number): string {
  if (dd <= -10) return '#006400';
  if (dd <= -5)  return '#228B22';
  if (dd <= -2)  return '#D4A017';
  return '#FF4500';
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

interface KpiCardProps {
  label: string;
  value: string;
  accentColor: string;
  tooltip: string;
}

function KpiCard({ label, value, accentColor, tooltip }: KpiCardProps) {
  return (
    <div
      className="kpi-card kpi-card--accent"
      style={{ '--kpi-accent': accentColor, '--kpi-value-color': accentColor } as React.CSSProperties}
      title={tooltip}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

/**
 * 4-card KPI accent strip below the header.
 * Visual parity with `.detail-kpi-grid` in /reference/original-design.html
 * (lines 2619-2624). Colours are data-driven via CSS custom properties.
 */
export function KpiStrip({ cycle }: Props) {
  const { overallRating, financialHealthScore, currentDrawdownPct, typicalDrawdown } = cycle;

  return (
    <div className="detail-kpi-grid">
      <KpiCard
        label="Overall Rating"
        value={`${overallRating}/100`}
        accentColor={ratingColor(overallRating)}
        tooltip={`Overall Rating (0–100) — Composite score: Financial Health (40%) + Valuation Zone (35%) + Cycle Payoff (25%). 80–100 = High Conviction · 65–79 = Constructive · 50–64 = Neutral · 35–49 = Cautious · 0–34 = Bearish. Higher is better.`}
      />
      <KpiCard
        label="Health Score"
        value={financialHealthScore != null ? `${fmt(financialHealthScore, 0)}/100` : '—'}
        accentColor={financialHealthScore != null ? ratingColor(financialHealthScore) : '#8A97A8'}
        tooltip="Health Score (0–100) — Measures financial strength across profitability, balance sheet safety, and cash generation. 80+ = Very Healthy · 60–79 = Adequate · Below 60 = Elevated Risk."
      />
      <KpiCard
        label="Current Drawdown"
        value={`${fmt(currentDrawdownPct, 1)}%`}
        accentColor={drawdownColor(currentDrawdownPct)}
        tooltip="Current Drawdown — How far the stock has fallen from its recent 252-day peak. A deeper negative number means a bigger pullback. Larger dips (near Typical Drawdown) often represent better entry opportunities."
      />
      <KpiCard
        label="Typical Drawdown"
        value={typicalDrawdown != null ? `${fmt(typicalDrawdown, 1)}%` : '—'}
        accentColor="#4A5568"
        tooltip="Typical Drawdown (Historical Average) — The average peak-to-trough decline this stock has experienced over its history. When Current Drawdown approaches this level, the stock is entering a historically attractive zone."
      />
    </div>
  );
}
