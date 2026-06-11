import type { CSSProperties } from 'react';

import { fmtPrice } from '@/lib/format';
import type { Currency, FundamentalsSnapshot } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  fundamentals: FundamentalsSnapshot;
  currentClose: number;
  currency: Currency;
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

export function AnalystTargetTrack({ fundamentals, currentClose, currency }: Props) {
  const {
    analystTargetPrice,
    analystLowPrice,
    analystHighPrice,
    numAnalystOpinions,
  } = fundamentals;

  if (
    analystTargetPrice === null ||
    analystLowPrice    === null ||
    analystHighPrice   === null ||
    numAnalystOpinions === null
  ) {
    return null;
  }

  const rawRange = analystHighPrice - analystLowPrice;
  const padding  = rawRange * 0.18;
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
  const upsideColor  = upside >= 0 ? '#228B22' : '#B22222';
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
        <div className="card-title">
          Analyst Price Target Range
          <InfoTip title="Analyst Price Target Range">
            Where professional Wall Street analysts think the price could trade over
            the next 12 months — their lowest, average and highest targets. This is
            third-party analyst data, shown as-is — not MajorCycle&apos;s view.
          </InfoTip>
        </div>
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
              background: 'rgba(0,0,0,.15)', borderRadius: 2,
            }} />
            <div style={{
              position: 'absolute', left: `${bullPosLeft}%`,
              top: -6, width: 2, height: 24,
              background: 'rgba(0,0,0,.15)', borderRadius: 2,
            }} />

            {/* Consensus marker (gold, smaller) */}
            <div
              className="target-marker"
              style={{ left: `${meanPos}%`, background: '#D4A017', width: 14, height: 14, zIndex: 3 }}
              title="Consensus Target — mean 12-month analyst estimate"
            >
              <div className="target-label" style={{ ...labelStyle(meanPos), color: '#9A7010' }}>
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

          {/* Bear / Bull edge labels */}
          <div style={{ position: 'relative', height: 16, marginTop: 4 }}>
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
          <div style={{ fontSize: 10, textAlign: 'center', marginTop: 4, color: '#B22222' }}>
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
            <div className="target-stat-val" style={{ color: '#B22222' }}>
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
            <div className="target-stat-val" style={{ color: '#D4A017' }}>
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
            <div className="target-stat-val" style={{ color: '#228B22' }}>
              {fmtPrice(analystHighPrice, currency)}
            </div>
            <div style={{ fontSize: 10, color: '#228B22', marginTop: 2 }}>
              {bullVsCurrent}% vs current
            </div>
            <div className="target-stat-caption">Most optimistic analyst view</div>
          </div>
        </div>
      </div>
    </div>
  );
}
