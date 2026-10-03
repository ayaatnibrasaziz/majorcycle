import type { CycleAnalysis, Currency, FundamentalsSnapshot, OverallLabel, ValuationZone } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';
import { fmtPrice } from '@/lib/format';
import { OVERALL_LABELS, RATING_TIER_HEX, tierFromLabel } from '@/lib/ratings';
import { healthSentence, topRisk } from '@/lib/thesisText';
import { tickerToUrlParts } from '@/lib/ticker';
import { RATING_SUMMARY } from '@/lib/ratingDefinition';

interface Props {
  cycle: CycleAnalysis;
  fundamentals: FundamentalsSnapshot;
  currency: Currency;
}

// ── Colour theme ────────────────────────────────────────────────────────────
//
// ⚠️ Ten hand-typed hexes until 2026-08-22, and the reason it mattered is that
// `--verdict-color` is used as TEXT (globals.css `.verdict-*`), not only as a
// gradient: a Neutral verdict rendered its heading and its big score numeral in
// #D4A017 on white, which measures **2.38** against a 4.5 floor. The Verdict card
// is a premium surface on the Stock Detail page, and no guard had ever walked a
// signed-in route, so it had failed since the day it was built.
//
// Both halves are now DERIVED. The bright end is the shared rating palette, so
// this card can never drift from the screener's chips or the workbook's fills.
// The deep end is the bright end scaled toward black — the five pairs were
// already doing roughly this by hand (ratios ranged 0.50…0.66), and pinning the
// rule matters more than preserving each accident: with brights darkened, the
// old literal deep for Neutral (#8A6710) had come within a hair of its own bright
// and the gradient would have rendered flat.
//
// White text sits on the gradient, and its LIGHT end is the bright one, so the
// worst case is exactly the 4.6+ the palette now guarantees.
const DEEP_SCALE = 0.62;

function deepen(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.round(v * DEEP_SCALE).toString(16).padStart(2, '0'))
    .join('');
  return `#${ch}`;
}

const COLOR_MAP: Record<OverallLabel, [string, string]> = Object.fromEntries(
  OVERALL_LABELS.map((label) => {
    const bright = RATING_TIER_HEX[tierFromLabel(label)];
    return [label, [bright, deepen(bright)]];
  }),
) as Record<OverallLabel, [string, string]>;

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
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
  return `Trading near its ${lookbackBars}-day highs (${ddAbs}% off peak) — limited cycle-based margin of safety against the ${tddAbs}% typical pullback.`;
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
        {/* ⚠️ Hard-set to `--c-tier-2` until 2026-09-02 — Constructive green in
            every state, including on a Bearish card (audit 5A-065). It was the
            one element on the card that did not follow the verdict the card
            exists to state. `--verdict-color` is already set on the card root
            from RATING_TIER_HEX, so the dot now cannot drift from it. */}
        {active && <span className="verdict-band-dot" style={{ color: 'var(--verdict-color)' }} />}
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
  // Entry-zone band: from the typical-dip price (top) down to 85% of the DISTANCE
  // toward the worst-case lower bound (owner spec — not the full range). lb < typDD
  // (lower bound is the deeper level), so the bottom is always deeper than the top;
  // the Reload Level (lowerBound) stays distinctly below the band.
  const bandUpper   = priceAt(typDD);
  const bandLower   = priceAt(typDD + 0.85 * (lb - typDD));
  const typicalPrice     = priceAt(typDD);
  const lowerBoundPrice  = priceAt(lb);
  const invalidationPrice = lowerBoundPrice * 0.95;

  const inEntryZone = currentClose <= bandUpper && currentClose >= bandLower;
  const belowEntry  = currentClose < bandLower;

  // ── Thesis sentences ─────────────────────────────────────────────────────
  const s1 = sentence1(valuationZone, currentDrawdownPct, typicalDrawdown, totalPullbackEvents, cycle.params.lookbackBars);

  // Names only scorecard areas the scorecard itself calls weak (lib/thesisText.ts).
  const s2 = healthSentence(financialHealthScore, fundamentals, cycle.fhSubscores);

  const s3 = `Primary risk: ${topRisk(fundamentals, totalPullbackEvents)}.`;

  // ── Band tiles ───────────────────────────────────────────────────────────
  let bandTiles: React.ReactNode;
  /**
   * ⚠️ THE ENTRY-ZONE TOOLTIPS ARE A MATCHED PAIR — change one, change both.
   *
   * Both described the same band and, until 2026-08-31 (audit F-001), both did it as
   * advice: "Historically attractive buy band" and "a pullback to here would
   * historically offer better risk/reward". The second is a recommendation to buy and
   * the first says "buy" outright, which decision #16 bans in our own outputs and
   * non-negotiable #12 / decision #24 rule out generally.
   *
   * They now state only what the number IS, in one voice, so the same band cannot end
   * up described two different ways depending on where the price happens to sit — which
   * is the drift CLAUDE.md 11c is about, and it very nearly happened here: the fix was
   * first scoped to the "waiting" tile alone because that was the one reported.
   *
   * Guarded by `e2e/no-advice-copy.spec.ts`, which reads these strings out of the
   * source. Nothing else does — a tooltip lives in a `title`/prop, so it is invisible
   * to screenshots, to visual review, and to every other check we own.
   */
  if (inEntryZone) {
    bandTiles = (
      <>
        <BandTile
          active
          label="Entry Zone · Active"
          value={`${fmtPrice(bandLower, currency)} – ${fmtPrice(bandUpper, currency)}`}
          sub={`Currently in zone · top ${fmtPrice(typicalPrice, currency)}`}
          tooltip="Entry Zone — Built from this stock's typical historical drawdown. Current price sits inside it."
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
    // How far the zone's top sits BELOW today's price is a share of TODAY's price. It
    // reused `premiumPct` (a share of the zone top) until 2026-09-28, so AAPL read
    // "31.1% below current" where $260.22 is 23.7% below $341.07 (beta review B-2).
    const belowCurrentPct = ((currentClose - bandUpper) / currentClose * 100).toFixed(1);
    bandTiles = (
      <>
        <BandTile
          label="Wait for Entry Zone"
          value={`${fmtPrice(bandLower, currency)} – ${fmtPrice(bandUpper, currency)}`}
          sub={`Top ${fmtPrice(typicalPrice, currency)} · ${belowCurrentPct}% below current`}
          tooltip="Target Entry Zone — Built from this stock's typical historical drawdown. Current price sits above it, by the percentage shown."
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
            MajorCycle Verdict · {tickerToUrlParts(ticker).symbol}
            <InfoTip title="MajorCycle Verdict">
              A plain-language read on where this stock sits in its historical
              dip-and-recover cycle, plus its financial health and main risk. The
              score and label are an algorithmic summary — information only, not advice.
            </InfoTip>
            {financialHealthScore == null && (
              <span
                className="verdict-cycleonly"
                title="Financial Health data is unavailable for this stock, so this Overall reflects price cycle and valuation only."
              >
                Cycle-only
              </span>
            )}
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
          title={`Overall MajorCycle Rating — ${RATING_SUMMARY} Higher is more favourable.`}
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
