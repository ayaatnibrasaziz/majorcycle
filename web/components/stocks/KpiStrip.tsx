import { CHART_INK } from '@/lib/chartTheme';
import { isFullCycle, type CycleAnalysis, type CycleAnalysisFree } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';
import { RATING_TIER_HEX, tierFromScore } from '@/lib/ratings';
import { PremiumLockKpi } from '@/components/stocks/PremiumLock';

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

/*
 * ⚠️ THE DRAWDOWN RAMP IS GONE — owner decision, 2026-09-02, and it closes the
 * biggest inconsistency the P2 sweep found.
 *
 * `drawdownColor()` ranked how DEEP a fall is and painted it green for deeper,
 * because deeper is more cyclically favourable. That is a defensible reading and
 * it is the argument this product makes. The problem was never this ramp on its
 * own — it was that a SECOND, opposite convention shipped alongside it. The same
 * −5.6% rendered GREEN here in the header and RED three screens down in Drawdown
 * Analysis, and blue again in the Learn article teaching a reader what a drawdown
 * is (audit 5A-041 / 5A-051 / 5A-062). Both conventions are defensible; together
 * they are not, because nothing tells the reader which one a given colour belongs
 * to.
 *
 * The rule now: **a raw market number is never coloured by our opinion of it.**
 * The fall is a measured fact; whether a given fall is good news is the Valuation
 * score, which is the paid analysis. Colour is reserved for our ratings, for
 * status and warnings, and for identifying a line on a chart.
 *
 * ⚠️ The historic note is kept because it cost something to learn: three of the
 * four rungs were illegible on --bg-page (3.97 / 2.15 / 3.11 against a 4.5 floor)
 * and the comment here had claimed they all cleared it, unmeasured. If a ramp
 * ever comes back to this strip, measure every rung including the one the sample
 * stock happens not to show.
 */

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

interface KpiCardProps {
  label: string;
  value: string;
  /**
   * Optional since 2026-09-02. A card WITHOUT one states a measured fact and is
   * deliberately uncoloured (Current Drawdown, Typical Drawdown); a card WITH one
   * is showing our own judgement, and the colour is part of that judgement.
   * Leaving it off falls back to the ordinary text colour and the neutral rule.
   */
  accentColor?: string;
  tipBody: string;
  note?: string;
}

function KpiCard({ label, value, accentColor, tipBody, note }: KpiCardProps) {
  return (
    <div
      className={`kpi-card${accentColor ? ' kpi-card--accent' : ''}`}
      style={
        accentColor
          ? ({ '--kpi-accent': accentColor, '--kpi-value-color': accentColor } as React.CSSProperties)
          : undefined
      }
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
