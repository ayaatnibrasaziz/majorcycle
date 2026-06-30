'use client';

import type { FundamentalsSnapshot } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  fundamentals: FundamentalsSnapshot;
}

const GAUGE_MAX = 20;

// Colour ramp reuses the app's existing tier tokens: green → amber → orange-red,
// matching the reference short-interest bands (low / moderate / elevated).
function gaugeColor(pct: number): string {
  if (pct < 5)  return 'var(--c-tier-2)';
  if (pct < 15) return 'var(--c-tier-3)';
  return 'var(--c-tier-4)';
}

function signalInfo(pct: number): { label: string; color: string } {
  if (pct < 5)  return { label: 'Bullish', color: 'var(--c-tier-2)' };
  if (pct < 15) return { label: 'Neutral', color: 'var(--c-tier-3)' };
  return           { label: 'Bearish', color: 'var(--c-tier-4)' };
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
  // The value arc is always a portion of a 180° semicircle (span = 180·f degrees,
  // ≤ 180°), so it is NEVER a "large arc". Forcing large-arc-flag=1 when f>0.5 made
  // SVG draw the major arc the wrong way round — visibly broken for any stock whose
  // short interest exceeds half the gauge (>10% of float, e.g. ZS at 11.5%).
  const valD = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${x} ${y}`;

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

  // Short % of float drives the gauge and the Bullish/Neutral/Bearish signal.
  // When it's missing (some tickers report only the days-to-cover ratio), don't
  // paint a 0% gauge / "Bullish" — that's a false zero. Show "not reported"
  // instead and keep the Days-to-Cover stat.
  const hasPct = shortPct != null;
  const pct = shortPct ?? 0;
  const sig = signalInfo(pct);

  const statRows = [
    {
      label: 'Days to Cover',
      value: shortRatio != null ? shortRatio.toFixed(1) : '—',
      tipTitle: 'Days to Cover (Short Ratio)',
      tipBody: 'Short Interest ÷ Average Daily Volume — how many trading days it would take all short sellers to buy back their shares. Below 3 days = low risk · 3–7 days = moderate · above 7 days = high. A sudden price rise can trigger a "short squeeze" as shorts are forced to cover.',
      color: undefined as string | undefined,
    },
    {
      label: 'Signal',
      value: hasPct ? sig.label : '—',
      tipTitle: 'Short Interest Signal',
      tipBody: 'Derived from Short % of Float. Bullish = below 5% of the float shorted (low bearish pressure). Neutral = 5–15% (some caution warranted). Bearish = above 15% (significant short conviction) — though elevated short interest can also fuel a short-squeeze rally if positive news arrives.',
      color: hasPct ? sig.color : undefined,
    },
  ];

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">
          Market Sentiment — Short Interest
          <InfoTip title="Short Interest">
            Short sellers borrow shares and sell them, betting the price will fall.
            &quot;Short interest&quot; is the share of the float sold short — a high number
            signals bearish sentiment. &quot;Days to cover&quot; estimates how many trading
            days it would take shorts to buy back, based on normal volume.
          </InfoTip>
        </div>
      </div>
      <div className="card-body">
        <div className="si-grid">
          <div>
            <div className="si-arc-wrap">
              {hasPct ? (
                <ArcGauge pct={pct} />
              ) : (
                <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                  Short % of float not reported for this stock.
                </div>
              )}
            </div>
            <div className="ownership-stats">
              {statRows.map((row) => (
                <div key={row.label} className="ownership-stat-row">
                  <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {row.label}
                    <InfoTip title={row.tipTitle}>{row.tipBody}</InfoTip>
                  </span>
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
