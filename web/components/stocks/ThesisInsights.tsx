import type { CycleAnalysis, FundamentalsSnapshot } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  cycle: CycleAnalysis;
  fundamentals: FundamentalsSnapshot;
  currency: string;
}

function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}

function fmtPrice(n: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

interface Bullet {
  text: string;
  strong: boolean;
  invalidation?: string;
}

/**
 * "Why Attractive" / "Key Risks" insight grid — third card of the Thesis
 * section, below the Verdict + Company Overview. Mirrors `buildAttractive`,
 * `buildRisks`, and `riskInvalidation` in /reference/original-design.html
 * (lines 2126–2178). Educational signals only — no Buy/Sell verbs in our copy.
 */
function buildAttractive(c: CycleAnalysis, f: FundamentalsSnapshot, currency: string): Bullet[] {
  const out: string[] = [];
  const dd = c.currentDrawdownPct;
  const tdd = c.typicalDrawdown;

  if (tdd != null && dd <= tdd)
    out.push(`Trading at or below its historical average dip (${fmt(tdd)}%) — historically attractive entry zone`);
  if (f.roe != null && f.roe >= 20)
    out.push(`Exceptional ROE of ${fmt(f.roe)}% — management creates strong shareholder value`);
  if (f.fcfYieldPct != null && f.fcfYieldPct >= 4)
    out.push(`Strong FCF yield of ${fmt(f.fcfYieldPct)}% — the business generates real cash`);
  if (f.revenueGrowthYoy != null && f.revenueGrowthYoy >= 15)
    out.push(`Accelerating revenue growth of ${fmt(f.revenueGrowthYoy)}% YoY`);
  if (f.debtToEquity != null && f.debtToEquity < 0.5)
    out.push(`Low D/E of ${fmt(f.debtToEquity, 2)} — fortress balance sheet`);
  if (f.peg != null && f.peg > 0 && f.peg < 1.5)
    out.push(`PEG of ${fmt(f.peg, 2)} — growing faster than the valuation implies`);
  if (c.totalPullbackEvents >= 10)
    out.push(`${c.totalPullbackEvents} confirmed pullback events — a well-calibrated signal`);
  if (f.analystRecommendation === 'Strong Buy' && f.analystTargetPrice != null)
    out.push(`Analyst consensus is Strong Buy, mean target ${fmtPrice(f.analystTargetPrice, currency)}`);

  if (out.length === 0)
    out.push(
      f.fcfYieldPct != null
        ? `FCF yield of ${fmt(f.fcfYieldPct)}% provides a solid return floor`
        : `Cash generation and balance-sheet position provide a reasonable floor`,
    );

  return out.slice(0, 6).map((text, i) => ({ text, strong: i < 2 }));
}

function riskInvalidation(c: CycleAnalysis, f: FundamentalsSnapshot): string | undefined {
  const dd = c.currentDrawdownPct;
  if (dd > -5 && c.typicalDrawdown != null)
    return `A pullback past ${fmt(c.typicalDrawdown)}% (the typical-dip level) would restore historical entry-zone characteristics.`;
  if (f.debtToEquity != null && f.debtToEquity >= 1.5)
    return `A reduction in D/E below 1.0 — via debt paydown or equity growth — would remove the rate-sensitivity flag.`;
  if (f.revenueGrowthYoy != null && f.revenueGrowthYoy < 0)
    return `A return to positive YoY revenue growth for at least two consecutive quarters would invalidate the contraction concern.`;
  if (f.currentRatio != null && f.currentRatio < 1)
    return `A move in current ratio above 1.2 would clear the short-term liquidity pressure.`;
  if (f.peg != null && f.peg > 3)
    return `Either an acceleration in EPS growth or a meaningful multiple compression would restore a defensible PEG.`;
  if (c.totalPullbackEvents < 8)
    return `As more cycles accumulate (target: 10+ events), the band statistics tighten and confidence improves.`;
  if (f.netMargin != null && f.netMargin < 5)
    return `Net margin expanding back to ≥8% would signal pricing power has returned.`;
  return `A demonstrated acceleration in top-line growth would offset multiple-compression risk.`;
}

function buildRisks(c: CycleAnalysis, f: FundamentalsSnapshot): Bullet[] {
  const out: string[] = [];
  const dd = c.currentDrawdownPct;

  if (dd > -5)
    out.push(`Near 252-day highs (drawdown ${fmt(dd)}%) — limited margin of safety`);
  if (f.debtToEquity != null && f.debtToEquity >= 1.5)
    out.push(`Elevated D/E of ${fmt(f.debtToEquity, 2)} — pressure if rates rise`);
  if (f.revenueGrowthYoy != null && f.revenueGrowthYoy < 0)
    out.push(`Revenue declining ${fmt(Math.abs(f.revenueGrowthYoy))}% YoY — needs monitoring`);
  if (f.currentRatio != null && f.currentRatio < 1)
    out.push(`Current ratio ${fmt(f.currentRatio, 2)} below 1.0 — liquidity concern`);
  if (f.peg != null && f.peg > 3)
    out.push(`PEG of ${fmt(f.peg, 2)} — valuation stretched vs growth`);
  if (c.totalPullbackEvents < 8)
    out.push(`Only ${c.totalPullbackEvents} pullback events — limited signal history`);
  if (f.netMargin != null && f.netMargin < 5)
    out.push(`Thin net margin of ${fmt(f.netMargin)}%`);
  if (out.length < 3)
    out.push(
      f.revenueGrowthYoy != null
        ? `Revenue growth of ${fmt(f.revenueGrowthYoy)}% is modest — valuation multiple at risk`
        : `Limited growth visibility — valuation multiple at risk`,
    );

  const inv = riskInvalidation(c, f);
  return out.slice(0, 6).map((text, i) => ({
    text,
    strong: i < 2,
    invalidation: i === 0 ? inv : undefined,
  }));
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="#228B22" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="#228B22" strokeOpacity={0.35} />
      <path d="m5 8 2 2 4-4" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="#B58800" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2 1.5 13.5h13L8 2Z" />
      <path d="M8 6.5v3.2" />
      <circle cx="8" cy="11.6" r="0.6" fill="#B58800" stroke="none" />
    </svg>
  );
}

function StrengthTag({ kind }: { kind: 'attr' | 'risk' }) {
  const label = kind === 'attr' ? 'Strong' : 'Severe';
  const tip =
    kind === 'attr'
      ? 'Strongest signal — one of the strongest supportive signals firing on this stock; heavily weighted in the Verdict above.'
      : 'Most severe risk — one of the most material risks identified for this stock; reflected in the primary-risk line of the Verdict above.';
  return (
    <span className={`insight-strength is-${kind}`} title={tip}>
      <span className="insight-strength-label">{label}</span>★★★
    </span>
  );
}

export function ThesisInsights({ cycle, fundamentals, currency }: Props) {
  const attractive = buildAttractive(cycle, fundamentals, currency);
  const risks = buildRisks(cycle, fundamentals);

  return (
    <div className="insight-grid fade-in">
      <div className="card">
        <div className="card-header card-header--accent-buy">
          <div className="card-title">
            Why Attractive
            <InfoTip title="Why Attractive">
              Plain-language reasons the current setup looks favourable, generated
              from the cycle position and the financial-health pillars. Observations,
              not a recommendation to buy.
            </InfoTip>
          </div>
        </div>
        <div className="card-body">
          {attractive.map((b, i) => (
            <div key={i} className="insight-item">
              <div className="insight-icon"><CheckIcon /></div>
              <div className="insight-text">
                {b.text}
                {b.strong && <StrengthTag kind="attr" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header card-header--accent-hold">
          <div className="card-title">
            Key Risks
            <InfoTip title="Key Risks">
              Things that could undermine the thesis — weak spots in the financials
              or a cycle read that may not repeat. Worth weighing before acting.
            </InfoTip>
          </div>
        </div>
        <div className="card-body">
          {risks.map((b, i) => (
            <div key={i} className="insight-item">
              <div className="insight-icon"><WarnIcon /></div>
              <div className="insight-text">
                {b.text}
                {b.strong && <StrengthTag kind="risk" />}
                {b.invalidation && (
                  <div className="insight-invalidation">
                    <span className="insight-invalidation-icon" aria-hidden="true">
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 8.5 5 5.5l2 2 3-3" />
                        <path d="M8 2.5h2v2" />
                      </svg>
                    </span>
                    <div>
                      <strong>What would invalidate this risk:</strong> {b.invalidation}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
