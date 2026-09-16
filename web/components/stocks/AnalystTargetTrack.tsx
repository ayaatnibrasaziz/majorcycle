import type { CSSProperties } from 'react';

import { fmtPrice } from '@/lib/format';
import type { Currency, FundamentalsSnapshot, PriceBar } from '@/lib/types';
import { quoteMatchesHistory } from '@/lib/quoteBasis';
import { InfoTip } from '@/components/ui/InfoTip';
import { INK } from '@/lib/ink';

interface Props {
  fundamentals: FundamentalsSnapshot;
  currentClose: number;
  currency: Currency;
  /** ⚠️ REQUIRED, and not defaulted — audit 5A-125. This card plots the analyst
   *  range (a provider QUOTE) against `currentClose` (its price HISTORY), so it
   *  has the same split-basis exposure as the header's upside line and must be
   *  able to answer the same question. A default would let the next caller
   *  reintroduce the defect in silence; the type error is what makes an omission
   *  visible (the same reasoning as `fmtPerShare`'s currency, CLAUDE.md 11c-x). */
  priceBars: PriceBar[];
}

function signedPct(n: number, d = 1): string {
  const s = n.toFixed(d);
  return n > 0 ? `+${s}` : s;
}

function labelStyle(pct: number): CSSProperties {
  if (pct < 12) return { left: 0, textAlign: 'left' };
  if (pct > 88) return { right: 0, textAlign: 'right' };
  return { left: `${pct}%`, transform: 'translateX(-50%)', textAlign: 'center' };
}

export function AnalystTargetTrack({
  fundamentals,
  currentClose,
  currency,
  priceBars,
}: Props) {
  const {
    analystTargetPrice,
    analystLowPrice,
    analystHighPrice,
    numAnalystOpinions,
  } = fundamentals;

  // Every figure below is a distance between the quote and the history. When a
  // split has left those on different bases the card cannot say anything true, so
  // it renders nothing rather than a dramatic wrong picture — AvalonBay would have
  // drawn today's price far below an analyst range 2.8x away. See lib/quoteBasis.ts.
  if (!quoteMatchesHistory(priceBars, fundamentals.week52High)) return null;

  if (
    analystTargetPrice === null ||
    analystLowPrice    === null ||
    analystHighPrice   === null ||
    numAnalystOpinions === null
  ) {
    return null;
  }

  const rawRange = analystHighPrice - analystLowPrice;
  // When every analyst lands on the same number (low == high), rawRange is 0 →
  // a 0-width domain would make every marker position NaN. Fall back to a small
  // synthetic span around the value so the markers render (stacked at centre).
  const padBase  = rawRange > 0 ? rawRange : Math.max(Math.abs(analystTargetPrice), 1);
  const padding  = padBase * 0.18;
  const domLow   = analystLowPrice  - padding;
  const domHigh  = analystHighPrice + padding;
  const domRange = domHigh - domLow;

  function pos(v: number): number {
    return Math.max(2, Math.min(98, ((v - domLow) / domRange) * 100));
  }

  const pricePos  = pos(currentClose);
  const meanPos   = pos(analystTargetPrice);
  const upside    = ((analystTargetPrice - currentClose) / currentClose) * 100;
  const upsideStr = signedPct(upside);
  const upsideColor  = upside >= 0 ? INK.up : INK.down;
  const upsideLabel  = upside >= 0
    ? `${upsideStr}% upside to Consensus Target`
    : `${Math.abs(upside).toFixed(1)}% above Consensus Target`;

  const bearVsCurrent = signedPct(((analystLowPrice  - currentClose) / currentClose) * 100);
  const bullVsCurrent = signedPct(((analystHighPrice - currentClose) / currentClose) * 100);

  const bearPosLeft = pos(analystLowPrice);
  const bullPosLeft = pos(analystHighPrice);

  let outOfRange: string | null = null;
  if (currentClose < analystLowPrice) {
    outOfRange = 'Current price is below the Bear Case Target — already pricing in significant downside.';
  } else if (currentClose > analystHighPrice) {
    outOfRange = 'Current price exceeds the Bull Case Target — pricing in upside beyond what analysts forecast.';
  }

  return (
    <div className="card card--stack-snug">
      <div className="card-header">
        <h3 className="card-title">
          Analyst Price Target Range
          <InfoTip title="Analyst Price Target Range">
            Where professional Wall Street analysts think the price could trade over
            the next 12 months — their lowest, average and highest targets. This is
            third-party analyst data, shown as-is — not MajorCycle&apos;s view.
          </InfoTip>
        </h3>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {numAnalystOpinions} analysts covering
        </div>
      </div>
      <div className="card-body">
        <div className="target-track-wrap">
          <div className="target-track">
            {/* Bear / Bull boundary ticks */}
            <div style={{
              position: 'absolute', left: `${bearPosLeft}%`,
              top: -6, width: 2, height: 24,
              background: 'var(--track-tick)', borderRadius: 2,
            }} />
            <div style={{
              position: 'absolute', left: `${bullPosLeft}%`,
              top: -6, width: 2, height: 24,
              background: 'var(--track-tick)', borderRadius: 2,
            }} />

            {/* Consensus marker (gold, smaller).
                ⚠️ The dot was the hard literal `#D4A017` — the PRE-AUGUST gold,
                in no palette — while its own label was grey. So the one marker
                and the words under it disagreed, and the same figure again in
                "Consensus Target" below was grey too. All three now read the
                same token (owner, 2026-09-10). */}
            <div
              className="target-marker"
              style={{ left: `${meanPos}%`, background: 'var(--c-neutral-ink)', width: 14, height: 14, zIndex: 3 }}
              title="Consensus Target — mean 12-month analyst estimate"
            >
              <div className="target-label" style={{ ...labelStyle(meanPos), color: INK.neutral }}>
                {fmtPrice(analystTargetPrice, currency)}<br />
                <span style={{ fontSize: 9 }}>Consensus</span>
              </div>
            </div>

            {/* Current price marker (blue) */}
            <div
              className="target-marker"
              style={{ left: `${pricePos}%`, background: 'var(--brand-mid)', zIndex: 4 }}
              title="Current price"
            >
              <div className="target-label-top" style={{ ...labelStyle(pricePos), color: 'var(--brand-mid)' }}>
                {fmtPrice(currentClose, currency)}<br />
                <span style={{ fontSize: 9 }}>Current</span>
              </div>
            </div>
          </div>

          {/* Bear / Bull edge labels.
              ⚠️ `marginTop` was 4, and the Consensus label above is TWO lines —
              its price, then the word "Consensus" — so its second line reached
              down into this row. Measured on EA at 375px: "Consensus" printed
              across "$210.00", 24px of shared ink, and the vertical overlap is a
              constant 6px at every width from 320 to 800 because both rows are
              fixed; only whether they meet horizontally depends on the data.

              ⚠️ It is a DATA defect wearing a layout, which is why no width sweep
              found it and AAPL looks perfect. The Consensus marker only sits over
              a Bear/Bull tick when the consensus target is near one end of the
              analyst range: measured across the universe, **15 of 837 stocks
              (1.8%)** collide at 375px and 2 still collide at 1280px. Rare enough
              to survive review forever, common enough that a customer meets it.

              ⚠️ THE NUMBER IS MEASURED, NOT GUESSED, and my first two attempts at
              it were wrong for the same reason twice: I edited the source, re-ran,
              and got byte-identical geometry from 18, 24 and 30 — three different
              values producing the same pixels, which is not a threshold, it is a
              stale build answering (11i). The reading that settled it changes the
              margin IN THE PAGE, where no compiler sits between the cause and the
              measurement: 36px is where they stop touching and 44px clears by 8.

              44, not 36: a bound that passes at exactly zero is the boundary, not a
              margin, and this repo has been caught by a guard clearing by 1.1px
              (11i-b). The mechanism is plain once the boxes are read — the
              Consensus label is 31px tall and hangs about 31px below the track it
              is anchored to, so the row simply has to start below that. */}
          <div style={{ position: 'relative', height: 16, marginTop: 44 }}>
            <span style={{
              position: 'absolute', left: `${bearPosLeft}%`, transform: 'translateX(-50%)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)',
            }}>
              {fmtPrice(analystLowPrice, currency)}
            </span>
            <span style={{
              position: 'absolute', left: `${bullPosLeft}%`, transform: 'translateX(-50%)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)',
            }}>
              {fmtPrice(analystHighPrice, currency)}
            </span>
          </div>
        </div>

        {outOfRange && (
          <div style={{ fontSize: 10, textAlign: 'center', marginTop: 4, color: INK.down }}>
            {outOfRange}
          </div>
        )}

        <div style={{
          textAlign: 'center', fontSize: 13, fontWeight: 700,
          color: upsideColor, margin: '10px 0 14px',
        }}>
          {upsideLabel}
        </div>

        <div className="target-stats">
          <div
            className="target-stat"
            title={`Bear Case Target — The lowest 12-month price target across the ${numAnalystOpinions} analysts covering this stock. Represents the most cautious view — typically reflects concerns about execution, valuation, or sector headwinds.`}
          >
            <div className="target-stat-label">Bear Case Target</div>
            <div className="target-stat-val" style={{ color: INK.down }}>
              {fmtPrice(analystLowPrice, currency)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              {bearVsCurrent}% vs current
            </div>
            <div className="target-stat-caption">Most cautious analyst view</div>
          </div>

          <div
            className="target-stat"
            title={`Consensus Target — The mean 12-month price target across all ${numAnalystOpinions} analysts covering this stock. This is the central case — what Wall Street collectively expects.`}
          >
            <div className="target-stat-label">Consensus Target</div>
            <div className="target-stat-val" style={{ color: INK.neutral }}>
              {fmtPrice(analystTargetPrice, currency)}
            </div>
            <div style={{ fontSize: 10, color: upsideColor, marginTop: 2 }}>
              {upsideStr}% vs current
            </div>
            <div className="target-stat-caption">Central Wall Street view</div>
          </div>

          <div
            className="target-stat"
            title={`Bull Case Target — The highest 12-month price target across the ${numAnalystOpinions} analysts covering this stock. Represents the most optimistic view — typically reflects upside from a specific catalyst, market expansion, or margin acceleration.`}
          >
            <div className="target-stat-label">Bull Case Target</div>
            <div className="target-stat-val" style={{ color: INK.up }}>
              {fmtPrice(analystHighPrice, currency)}
            </div>
            <div style={{ fontSize: 10, color: INK.up, marginTop: 2 }}>
              {bullVsCurrent}% vs current
            </div>
            <div className="target-stat-caption">Most optimistic analyst view</div>
          </div>
        </div>
      </div>
    </div>
  );
}
