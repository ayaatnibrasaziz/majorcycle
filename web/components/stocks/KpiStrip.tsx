import type { CycleAnalysis } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';

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
  tipBody: string;
  note?: string;
}

function KpiCard({ label, value, accentColor, tipBody, note }: KpiCardProps) {
  return (
    <div
      className="kpi-card kpi-card--accent"
      style={{ '--kpi-accent': accentColor, '--kpi-value-color': accentColor } as React.CSSProperties}
    >
      <div className="kpi-label">
        {label}
        <InfoTip title={label}>{tipBody}</InfoTip>
      </div>
      <div className="kpi-value">{value}</div>
      {note && (
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>
          {note}
        </div>
      )}
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
  const lookback = cycle.params.lookbackBars;

  return (
    <div className="detail-kpi-grid">
      <KpiCard
        label="Overall Rating"
        value={`${overallRating}/100`}
        accentColor={ratingColor(overallRating)}
        tipBody="Our single 0–100 summary of the stock, combining Financial Health (40%), Valuation Zone (35%) and Cycle Payoff (25%). 80–100 = High Conviction · 65–79 = Constructive · 50–64 = Neutral · 35–49 = Cautious · 0–34 = Bearish. Higher is more favourable. Information only — not advice."
        note={financialHealthScore == null ? 'Cycle-only — excludes Financial Health' : undefined}
      />
      <KpiCard
        label="Health Score"
        value={financialHealthScore != null ? `${fmt(financialHealthScore, 0)}/100` : '—'}
        accentColor={financialHealthScore != null ? ratingColor(financialHealthScore) : '#8A97A8'}
        tipBody="How financially strong the business is (0–100), based on profitability, a safe balance sheet, and steady cash generation. 80+ = very healthy · 60–79 = adequate · below 60 = elevated risk."
      />
      <KpiCard
        label="Current Drawdown"
        value={`${fmt(currentDrawdownPct, 1)}%`}
        accentColor={drawdownColor(currentDrawdownPct)}
        tipBody={`How far the price has fallen from its highest point over the last ${lookback} trading days. A bigger negative number means a deeper dip. Dips approaching the Typical Drawdown have historically been better entry zones for this stock.`}
      />
      <KpiCard
        label="Typical Drawdown"
        value={typicalDrawdown != null ? `${fmt(typicalDrawdown, 1)}%` : '—'}
        accentColor="#4A5568"
        tipBody="The average dip this stock has fallen through in its past cycles. It's the yardstick for the Current Drawdown: when today's dip nears this figure, the stock is in a historically attractive zone."
      />
    </div>
  );
}
