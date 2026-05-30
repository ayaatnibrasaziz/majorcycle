'use client';

import type { FundamentalsSnapshot } from '@/lib/types';

interface Props {
  fundamentals: FundamentalsSnapshot;
}

const GAUGE_MAX = 20; // 20%+ fills the gauge to 100%

function gaugeColor(pct: number): string {
  if (pct < 5)  return '#228B22';
  if (pct < 15) return '#D97706';
  return '#B22222';
}

function signal(pct: number): { label: string; color: string } {
  if (pct < 5)  return { label: 'Low',      color: '#228B22' };
  if (pct < 15) return { label: 'Moderate', color: '#D97706' };
  return           { label: 'High',     color: '#B22222' };
}

function ArcGauge({ pct }: { pct: number }) {
  const R  = 70;
  const cx = 100;
  const cy = 88;
  const f  = Math.min(pct / GAUGE_MAX, 0.999);
  const color = gaugeColor(pct);

  // Background: full half-circle left → right
  const bgD = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;

  // Value arc: sweep from left to f-fraction across the half-circle
  const angleRad = Math.PI * (1 - f);
  const x = cx + R * Math.cos(angleRad);
  const y = cy - R * Math.sin(angleRad);
  const largeArc = f > 0.5 ? 1 : 0;
  const valD = `M ${cx - R} ${cy} A ${R} ${R} 0 ${largeArc} 1 ${x} ${y}`;

  return (
    <svg viewBox="0 0 200 100" width="180" height="100" aria-label={`Short interest gauge: ${pct.toFixed(1)}%`}>
      <path d={bgD} fill="none" stroke="#2E3347" strokeWidth={16} strokeLinecap="round" />
      {f > 0.01 && (
        <path d={valD} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />
      )}
      <text
        x={cx} y={cy - 10}
        textAnchor="middle"
        fill="#E8EAF0"
        fontSize={22}
        fontWeight={700}
        fontFamily="'JetBrains Mono', monospace"
      >
        {pct.toFixed(2)}%
      </text>
      <text
        x={cx} y={cy + 6}
        textAnchor="middle"
        fill="#8A97A8"
        fontSize={10}
        fontFamily="Sora, sans-serif"
      >
        Short % of Float
      </text>
    </svg>
  );
}

export function ShortInterest({ fundamentals }: Props) {
  const shortPct   = fundamentals.shortPctOfFloat ?? null;
  const shortRatio = fundamentals.shortRatio      ?? null;

  if (shortPct == null && shortRatio == null) return null;

  const pct = shortPct ?? 0;
  const sig = signal(pct);

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Market Sentiment — Short Interest</div>
      </div>
      <div className="card-body">
        <div className="si-grid">
          <div className="si-arc-wrap">
            <ArcGauge pct={pct} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              What does short interest mean?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              Short interest measures what percentage of a company&apos;s available shares are currently
              sold short — investors betting the price will fall. High short interest can signal
              bearish conviction, but can also create a short squeeze if the stock rises.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                className="stat-pill has-tip"
                style={{ flex: 1 }}
                data-tip="Days to Cover (Short Ratio)|Short Interest ÷ Average Daily Volume. How many trading days it would take all short sellers to buy back their shares. Below 3 = Low · 3–7 = Moderate · Above 7 = High — a sudden price rise could trigger a short squeeze."
              >
                <div className="stat-pill-label">Days to Cover</div>
                <div className="stat-pill-val">
                  {shortRatio != null ? shortRatio.toFixed(1) : '—'}
                </div>
              </div>
              <div
                className="stat-pill has-tip"
                style={{ flex: 1 }}
                data-tip="Short Interest Signal|Derived from Short % of Float. Low = below 5%, low bearish pressure. Moderate = 5–15%, some caution warranted. High = above 15%, significant short conviction — but elevated short interest can also fuel a short squeeze rally."
              >
                <div className="stat-pill-label">Signal</div>
                <div className="stat-pill-val" style={{ color: sig.color }}>{sig.label}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
