'use client';

import type { FundamentalsSnapshot } from '@/lib/types';

interface Props {
  fundamentals: FundamentalsSnapshot;
}

const GAUGE_MAX = 20;

function gaugeColor(pct: number): string {
  if (pct < 5)  return 'var(--c-tier-2)';
  if (pct < 15) return 'var(--c-tier-4)';
  return 'var(--c-tier-5)';
}

function signalInfo(pct: number): { label: string; color: string } {
  if (pct < 5)  return { label: 'Bullish', color: 'var(--c-tier-2)' };
  if (pct < 15) return { label: 'Neutral', color: 'var(--c-tier-4)' };
  return           { label: 'Bearish', color: 'var(--c-tier-5)' };
}

function ArcGauge({ pct }: { pct: number }) {
  const R  = 70;
  const cx = 100;
  const cy = 88;
  const f  = Math.min(pct / GAUGE_MAX, 0.999);
  const color = gaugeColor(pct);

  const bgD = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;

  const angleRad = Math.PI * (1 - f);
  const x = cx + R * Math.cos(angleRad);
  const y = cy - R * Math.sin(angleRad);
  const largeArc = f > 0.5 ? 1 : 0;
  const valD = `M ${cx - R} ${cy} A ${R} ${R} 0 ${largeArc} 1 ${x} ${y}`;

  return (
    <svg viewBox="0 0 200 100" width="180" height="100" aria-label={`Short interest gauge: ${pct.toFixed(1)}%`}>
      <path d={bgD} fill="none" stroke="var(--border-strong)" strokeWidth={16} strokeLinecap="round" />
      {f > 0.01 && (
        <path d={valD} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />
      )}
      <text
        x={cx} y={cy - 10}
        textAnchor="middle"
        fill="var(--text-primary)"
        fontSize={22}
        fontWeight={700}
        fontFamily="'JetBrains Mono', monospace"
      >
        {pct.toFixed(2)}%
      </text>
      <text
        x={cx} y={cy + 6}
        textAnchor="middle"
        fill="var(--text-muted)"
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
  const sig = signalInfo(pct);

  const statRows = [
    {
      label: 'Days to Cover',
      value: shortRatio != null ? shortRatio.toFixed(1) : '—',
      tip: 'Days to Cover (Short Ratio)\nShort Interest ÷ Average Daily Volume. This tells you how many trading days it would take all short sellers to buy back their shares. Below 3 days = Low risk · 3–7 days = Moderate · Above 7 days = High — a sudden price rise could trigger a \'short squeeze\' as shorts are forced to cover.',
      color: undefined as string | undefined,
    },
    {
      label: 'Signal',
      value: sig.label,
      tip: 'Short Interest Signal\nDerived from Short % of Float and Days to Cover. Bullish = below 5% float shorted, low bearish pressure. Neutral = 5–15%, some caution warranted. Bearish = above 15%, significant short conviction — but elevated short interest can also fuel a short squeeze rally if positive news arrives.',
      color: sig.color,
    },
  ];

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Market Sentiment — Short Interest</div>
      </div>
      <div className="card-body">
        <div className="si-grid">
          <div>
            <div className="si-arc-wrap">
              <ArcGauge pct={pct} />
            </div>
            <div className="ownership-stats">
              {statRows.map((row) => (
                <div key={row.label} className="ownership-stat-row" title={row.tip}>
                  <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: row.color ?? 'var(--text-primary)' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              What does short interest mean?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Short interest measures what percentage of a company&apos;s available shares are currently
              being sold short — i.e. investors betting the price will fall. High short interest can
              signal bearish conviction from sophisticated traders, but can also create a short squeeze
              if the stock rises.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
