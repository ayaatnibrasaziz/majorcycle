import { CHART_INK } from '@/lib/chartTheme';
import { isFullCycle, type CycleAnalysis, type CycleAnalysisFree } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';
import { RATING_TIER_HEX, tierFromScore } from '@/lib/ratings';
import { PremiumLockKpi } from '@/components/stocks/PremiumLock';
import { INK } from '@/lib/ink';

interface Props {
  cycle: CycleAnalysis | CycleAnalysisFree;
  /**
   * The viewer's entitlement, checked INDEPENDENTLY of whether premium fields
   * happen to be present in `cycle`. Both must hold before a score renders.
   *
   * `/api/cycle` strips premium keys for an unentitled viewer, so in a healthy
   * system the type guard alone would be enough. This is the second lock: B1
   * proved a single control can fail open (a shared-cache directive served the
   * full paid payload before the function ever ran), and these two tiles are
   * the product. The Verdict and Scorecard have always required both — this
   * brings the rating and health score up to the same standard.
   */
  entitled: boolean;
}

// ⚠️ A third copy of the rating ladder — hexes AND thresholds — until 2026-08-22.
// Now derived, so the KPI strip cannot disagree with the chip, the badge, the
// radar or the workbook about what a 62 looks like.
function ratingColor(rating: number): string {
  return RATING_TIER_HEX[tierFromScore(rating)];
}

// ⚠️ NOT a rating, despite sharing four of the same hexes: this ranks how DEEP a
// drawdown is, and deeper is more cyclically favourable. It keeps its own
// thresholds and its own tokens for that reason — reaching for RATING_TIER_HEX
// here would say something about our judgement of the stock that we do not mean.
//
// ⚠️ THESE ARE TEXT. `accentColor` lands on `--kpi-value-color`, which globals.css
// uses as `color:` on `.kpi-value`, at 22px/600. WCAG counts "large text" from
// 24px, or 18.66px at weight **700**; 600 is not bold, so the floor is the full
// 4.5 and three of the four rungs were under it on --bg-page:
//
//     dd <= -10  #006400  6.73  ✓  unchanged
//     dd <=  -5  #228B22  3.97  ✗  → INK.up       4.80
//     dd <=  -2  #D4A017  2.15  ✗  → INK.neutral  4.82   ← every view, every stock
//     else       #FF4500  3.11  ✗  → INK.warn     4.81
//
// I wrote "every one of these clears 4.5" in this comment before measuring it, and
// it was wrong by a factor of two. Fixed 2026-08-22 with the owner's approval of
// the ink layer; the ramp's DIRECTION is untouched, only its legibility.
//
// ⚠️ The bottom rung is here because it is the same ramp, not because anything
// measured it: a stock has to be within 2% of its high to render #FF4500, and the
// page this was audited on sat 24.6% down. Three rungs measured, one reasoned —
// leaving the fourth illegible because the sample stock happened not to show it
// would be the same mistake one level down (CLAUDE.md 14g).
function drawdownColor(dd: number): string {
  if (dd <= -10) return '#006400';
  if (dd <= -5)  return INK.up;
  if (dd <= -2)  return INK.neutral;
  return INK.warn;
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
export function KpiStrip({ cycle, entitled }: Props) {
  const { currentDrawdownPct, typicalDrawdown } = cycle;
  const lookback = cycle.params.lookbackBars;
  // The paywall runs straight through this strip: cards 1–2 are our judgement and
  // lock; cards 3–4 are observed price facts and stay free. Deliberately kept
  // side-by-side rather than hiding the locked pair — two working tiles next to two
  // locked ones is the clearest statement of what a subscription adds.
  const scored = entitled && isFullCycle(cycle) ? cycle : null;

  return (
    <div className="detail-kpi-grid">
      {scored ? (
        <KpiCard
          label="Overall Rating"
          value={`${scored.overallRating}/100`}
          accentColor={ratingColor(scored.overallRating)}
          tipBody="Our single 0–100 summary of the stock, combining Financial Health (40%), Valuation Zone (35%) and Cycle Payoff (25%). 80–100 = High Conviction · 65–79 = Constructive · 50–64 = Neutral · 35–49 = Cautious · 0–34 = Bearish. Higher is more favourable. Information only — not advice."
          note={
            scored.financialHealthScore == null
              ? 'Cycle-only — excludes Financial Health'
              : undefined
          }
        />
      ) : (
        <PremiumLockKpi label="Overall Rating" />
      )}
      {scored ? (
        <KpiCard
          label="Health Score"
          value={
            scored.financialHealthScore != null
              ? `${fmt(scored.financialHealthScore, 0)}/100`
              : '—'
          }
          accentColor={
            scored.financialHealthScore != null
              ? ratingColor(scored.financialHealthScore)
              : CHART_INK
          }
          tipBody="How financially strong the business is (0–100), based on profitability, a safe balance sheet, and steady cash generation. 80+ = very healthy · 60–79 = adequate · below 60 = elevated risk."
        />
      ) : (
        <PremiumLockKpi label="Health Score" />
      )}
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
