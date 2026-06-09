import type { CycleAnalysis, FundamentalsSnapshot, OverallLabel, ValuationZone } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';
import { fmtCapped } from '@/lib/format';

interface Props {
  cycle: CycleAnalysis;
  fundamentals: FundamentalsSnapshot;
  currency: string;
}

// ── Colour theme ────────────────────────────────────────────────────────────
const COLOR_MAP: Record<OverallLabel, [string, string]> = {
  'High Conviction': ['#006400', '#003200'],
  'Constructive':    ['#228B22', '#0D5C0D'],
  'Neutral':         ['#D4A017', '#8A6710'],
  'Cautious':        ['#FF4500', '#A82E00'],
  'Bearish':         ['#B22222', '#6B1414'],
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function fmtPrice(n: number, curr: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: curr,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function confidenceTier(ev: number): string {
  if (ev >= 15) return 'High confidence';
  if (ev >= 10) return 'Solid confidence';
  if (ev >= 5)  return 'Moderate confidence';
  return 'Limited confidence';
}

// Mirror of reference buildVerdict sentence 1 logic — zone-aware narrative.
// Maps our ValuationZone labels to the original STRONG BUY/BUY/WATCH/HOLD narrative.
function sentence1(
  zone: ValuationZone,
  drawdownPct: number,
  typicalDrawdown: number | null,
  pullbackEvents: number,
  lookbackBars: number,
): string {
  const ddAbs  = fmt(Math.abs(drawdownPct), 1);
  const tddAbs = typicalDrawdown != null ? fmt(Math.abs(typicalDrawdown), 1) : '—';
  const ev     = pullbackEvents;
  if (zone === 'DEEP VALUE')
    return `Trading ${ddAbs}% below its ${lookbackBars}-day peak — beyond the ${tddAbs}% typical pullback seen across ${ev} prior cycles, a historically rich entry zone.`;
  if (zone === 'VALUE')
    return `Down ${ddAbs}% from the recent peak, approaching the ${tddAbs}% level where past cycles have found support across ${ev} pullback events.`;
  if (zone === 'FAIR')
    return `Off ${ddAbs}% from highs but still above the ${tddAbs}% typical dip — early in the cycle, with more downside historically available.`;
  return `Trading near 52-week highs (${ddAbs}% off peak) — limited cycle-based margin of safety against the ${tddAbs}% typical pullback.`;
}

// Mirror of reference bestStrength — picks the single strongest evidence point.
function bestStrength(f: FundamentalsSnapshot): string {
  if (f.roe != null && f.roe >= 25)
    return `an exceptional ${fmtCapped(f.roe, 300, 0)}% return on equity`;
  if (f.fcfYieldPct != null && f.fcfYieldPct >= 5)
    return `a strong ${fmtCapped(f.fcfYieldPct, 100, 1)}% free-cash-flow yield`;
  if (f.debtToEquity != null && f.debtToEquity < 0.4)
    return `a fortress balance sheet (D/E ${fmt(f.debtToEquity, 2)})`;
  if (f.grossMargin != null && f.grossMargin >= 60)
    return `gross margins of ${fmtCapped(f.grossMargin, 300, 0)}%`;
  if (f.revenueGrowthYoy != null && f.revenueGrowthYoy >= 20)
    return `accelerating revenue growth of ${fmtCapped(f.revenueGrowthYoy, 300, 0)}% YoY`;
  if (f.operatingMargin != null && f.operatingMargin >= 20)
    return `operating margins of ${fmtCapped(f.operatingMargin, 300, 0)}%`;
  if (f.netMargin != null)
    return `net margins of ${fmtCapped(f.netMargin, 300, 0)}%`;
  return 'a sound balance sheet';
}

// Mirror of reference topRisk — first match wins.
function topRisk(f: FundamentalsSnapshot, drawdownPct: number, pullbackEvents: number): string {
  if (drawdownPct > -5)
    return 'near 52-week highs with limited cycle-based margin of safety';
  if (f.debtToEquity != null && f.debtToEquity >= 1.5)
    return `elevated debt at ${fmtCapped(f.debtToEquity, 25, 1)}× equity — sensitive to higher rates`;
  if (f.revenueGrowthYoy != null && f.revenueGrowthYoy < 0)
    return `revenue declining ${fmtCapped(Math.abs(f.revenueGrowthYoy), 300, 1)}% YoY — execution risk`;
  if (f.currentRatio != null && f.currentRatio < 1)
    return 'current ratio below 1 — short-term liquidity pressure';
  if (f.peg != null && f.peg > 3)
    return `PEG of ${fmtCapped(f.peg, 25, 1)} — valuation stretched vs growth`;
  if (pullbackEvents < 8)
    return `only ${pullbackEvents} historical cycles — limited statistical confidence`;
  if (f.netMargin != null && f.netMargin < 5)
    return `thin net margin of ${fmtCapped(f.netMargin, 300, 1)}% leaves little buffer`;
  if (f.revenueGrowthYoy != null)
    return `revenue growth of ${fmtCapped(f.revenueGrowthYoy, 300, 1)}% is modest — multiple compression risk`;
  return 'limited data available for a full risk assessment';
}

// ── Band tile helpers ───────────────────────────────────────────────────────
interface BandTileProps {
  label: string;
  value: string;
  sub: string;
  active?: boolean;
  tooltip: string;
}

function BandTile({ label, value, sub, active, tooltip }: BandTileProps) {
  return (
    <div className={`verdict-band${active ? ' is-active' : ''}`} title={tooltip}>
      <div className="verdict-band-label">
        {active && <span className="verdict-band-dot" style={{ color: 'var(--c-tier-2)' }} />}
        {label}
      </div>
      <div className="verdict-band-val">{value}</div>
      <div className="verdict-band-sub">{sub}</div>
    </div>
  );
}

/**
 * Verdict hero card — Section 2 of the Stock Detail page.
 * Visual parity with `buildVerdict()` in /reference/original-design.html
 * (lines 2217–2371). Watermark and eyebrow updated to "MajorCycle".
 */
export function VerdictCard({ cycle, fundamentals, currency }: Props) {
  const {
    ticker, overallRating, overallLabel, valuationZone,
    currentDrawdownPct, currentClose, typicalDrawdown, lowerBound,
    totalPullbackEvents, financialHealthScore,
  } = cycle;

  const [cBright, cDeep] = COLOR_MAP[overallLabel] ?? ['#1E5CB3', '#1A3A6E'];

  // ── Score ring geometry ──────────────────────────────────────────────────
  const RING_R  = 34;
  const RING_C  = 2 * Math.PI * RING_R;
  const ringFill = RING_C * (1 - Math.min(100, Math.max(0, overallRating)) / 100);

  // ── Peak reconstruction + band prices ───────────────────────────────────
  const drawdownFrac = currentDrawdownPct / 100;
  const peak = Math.abs(1 + drawdownFrac) < 0.001
    ? currentClose
    : currentClose / (1 + drawdownFrac);
  const priceAt = (ddPct: number) => peak * (1 + ddPct / 100);

  const typDD       = typicalDrawdown ?? 0;
  const lb          = lowerBound ?? 0;
  const halfSpread  = Math.abs(lb - typDD) * 0.5;
  const bandUpper   = priceAt(typDD + halfSpread);
  const bandLower   = priceAt(typDD - halfSpread);
  const typicalPrice     = priceAt(typDD);
  const lowerBoundPrice  = priceAt(lb);
  const invalidationPrice = lowerBoundPrice * 0.95;

  const inEntryZone = currentClose <= bandUpper && currentClose >= bandLower;
  const belowEntry  = currentClose < bandLower;

  // ── Thesis sentences ─────────────────────────────────────────────────────
  const s1 = sentence1(valuationZone, currentDrawdownPct, typicalDrawdown, totalPullbackEvents, cycle.params.lookbackBars);

  let s2: string;
  const hs = financialHealthScore;
  if (hs == null)
    s2 = 'Financial health data is unavailable for this ticker.';
  else if (hs >= 85)
    s2 = `Financial health is exceptional at ${fmt(hs, 0)}/100, supported by ${bestStrength(fundamentals)}.`;
  else if (hs >= 70)
    s2 = `Financial health is solid at ${fmt(hs, 0)}/100, with ${bestStrength(fundamentals)}.`;
  else if (hs >= 50)
    s2 = `Financial health is adequate at ${fmt(hs, 0)}/100 — passable but not a standout balance-sheet story.`;
  else
    s2 = `Financial health is stressed at ${fmt(hs, 0)}/100 — elevated balance-sheet and profitability risks warrant caution.`;

  const s3 = `Primary risk: ${topRisk(fundamentals, currentDrawdownPct, totalPullbackEvents)}.`;

  // ── Band tiles ───────────────────────────────────────────────────────────
  let bandTiles: React.ReactNode;
  if (inEntryZone) {
    bandTiles = (
      <>
        <BandTile
          active
          label="Entry Zone · Active"
          value={`${fmtPrice(bandLower, currency)} – ${fmtPrice(bandUpper, currency)}`}
          sub={`Currently in zone · centre ${fmtPrice(typicalPrice, currency)}`}
          tooltip="Entry Zone (Active) — Historically attractive buy band, derived from the typical drawdown ±half the distance to the deepest historical drawdown. Current price is inside this band."
        />
        <BandTile
          label="Reload Level"
          value={fmtPrice(lowerBoundPrice, currency)}
          sub="Historical worst-case dip"
          tooltip="Reload Level — If the cycle plays out to the historical worst-case drawdown, this is roughly where the stock would trade. Historically the deepest discount available in this name."
        />
        <BandTile
          label="Invalidation Below"
          value={fmtPrice(invalidationPrice, currency)}
          sub="Cycle thesis breaks"
          tooltip="Invalidation Below — If the price falls 5% below the historical worst-case drawdown, the cycle pattern is broken. Re-evaluate the thesis before adding."
        />
      </>
    );
  } else if (belowEntry) {
    bandTiles = (
      <>
        <BandTile
          active
          label="Past Entry Zone"
          value={`${fmtPrice(bandLower, currency)} – ${fmtPrice(bandUpper, currency)}`}
          sub={`Now ${fmtPrice(currentClose, currency)} · below band`}
          tooltip="Below Entry Zone — Current price is below the historically attractive entry band — already deeper than typical pullbacks."
        />
        <BandTile
          label="Worst-Case Level"
          value={fmtPrice(lowerBoundPrice, currency)}
          sub={`${fmt(Math.abs(lb), 1)}% peak drawdown`}
          tooltip="Historical Worst-Case — The deepest drawdown ever recorded across all measured cycles."
        />
        <BandTile
          label="Invalidation Below"
          value={fmtPrice(invalidationPrice, currency)}
          sub="Cycle thesis breaks"
          tooltip="Invalidation Below — If the price falls 5% below the historical worst-case drawdown, the cycle pattern is broken."
        />
      </>
    );
  } else {
    // Above entry zone — waiting for pullback
    const premiumPct = ((currentClose - bandUpper) / bandUpper * 100).toFixed(1);
    bandTiles = (
      <>
        <BandTile
          label="Wait for Entry Zone"
          value={`${fmtPrice(bandLower, currency)} – ${fmtPrice(bandUpper, currency)}`}
          sub={`Centre ${fmtPrice(typicalPrice, currency)} · ${premiumPct}% below current`}
          tooltip="Target Entry Zone — The historically attractive buy band. Current price is above this zone — a pullback to here would historically offer better risk/reward."
        />
        <BandTile
          label="Typical Dip Price"
          value={fmtPrice(typicalPrice, currency)}
          sub={`${fmt(Math.abs(typDD), 1)}% pullback from peak`}
          tooltip="Typical Dip Price — The price the stock would trade at if it experienced its average historical pullback from the recent peak."
        />
        <BandTile
          label="Current Premium"
          value={`+${premiumPct}%`}
          sub="Above typical dip price"
          tooltip="Current Premium — How far above the typical-dip target the stock is currently trading. Larger = more cycle-extended price action."
        />
      </>
    );
  }

  return (
    <div
      className="card--verdict fade-in"
      style={{ '--verdict-color': cBright, '--verdict-color-deep': cDeep } as React.CSSProperties}
    >
      <div className="verdict-watermark">
        <span className="verdict-watermark-icon" aria-hidden="true" />
        MajorCycle
      </div>

      <div className="verdict-top">
        <div className="verdict-headline">
          <div className="verdict-eyebrow">
            MajorCycle Verdict · {ticker}
            <InfoTip title="MajorCycle Verdict">
              A plain-language read on where this stock sits in its historical
              dip-and-recover cycle, plus its financial health and main risk. The
              score and label are an algorithmic summary — information only, not advice.
            </InfoTip>
          </div>
          <div className="verdict-label">{overallLabel}</div>
          <div
            className="verdict-confidence"
            title="Confidence Tier — Derived from the number of distinct historical drawdown cycles detected. More cycles = larger statistical sample = higher confidence in the Typical and Bound levels. 15+ = High · 10–14 = Solid · 5–9 = Moderate · <5 = Limited."
          >
            <span className="verdict-confidence-dot" />
            {confidenceTier(totalPullbackEvents)} · {totalPullbackEvents} cycles
          </div>
        </div>

        <div
          className="verdict-score-block"
          title="Overall MajorCycle Rating (0–100) — Composite score: Financial Health (40%) + Valuation Zone (35%) + Cycle Payoff (25%). Higher is better."
        >
          <div className="verdict-score-ring">
            <svg viewBox="0 0 84 84" aria-hidden="true">
              <circle className="verdict-score-ring-bg" cx="42" cy="42" r={RING_R} />
              <circle
                className="verdict-score-ring-fg"
                cx="42" cy="42" r={RING_R}
                strokeDasharray={RING_C.toFixed(2)}
                strokeDashoffset={ringFill.toFixed(2)}
              />
            </svg>
            <div className="verdict-score-num">{overallRating}</div>
          </div>
          <div className="verdict-score-caption">Score / 100</div>
        </div>
      </div>

      <div className="verdict-thesis">
        <p><span className="verdict-thesis-num">1</span><span>{s1}</span></p>
        <p><span className="verdict-thesis-num">2</span><span>{s2}</span></p>
        <p><span className="verdict-thesis-num">3</span><span>{s3}</span></p>
      </div>

      <div className="verdict-bands">{bandTiles}</div>

      <div className="verdict-footnote">
        <span>
          Levels derived from {totalPullbackEvents} historical pullback cycles
          {' · '}peak {fmtPrice(peak, currency)}
        </span>
        <span className="verdict-footnote-divider" />
        <span>Information only — not financial advice</span>
      </div>
    </div>
  );
}
