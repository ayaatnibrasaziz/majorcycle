'use client';

import { Cell, Pie, PieChart, Tooltip } from 'recharts';

import type { FundamentalsSnapshot, TopHolder } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  topHolders?: TopHolder[];
  fundamentals: FundamentalsSnapshot;
}

function fmt(v: number | null | undefined, dec = 2): string {
  if (v == null) return '—';
  return v.toFixed(dec);
}

function fmtShares(v: number | null | undefined): string {
  if (v == null) return '—';
  const m = v / 1e6;
  return `${m.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
}

const DONUT_COLORS = ['#1E5CB3', '#228B22', '#CBD5E1'];

export function OwnershipStructure({ topHolders, fundamentals }: Props) {
  const inst    = fundamentals.institutionOwnershipPct ?? null;
  const insider = fundamentals.insiderOwnershipPct    ?? null;
  const float   = inst != null && insider != null
    ? Math.max(0, 100 - inst - insider)
    : null;

  const hasDonut = inst != null || insider != null;
  const holders  = topHolders ?? [];

  if (!hasDonut && holders.length === 0) return null;

  const donutData = [
    { name: 'Institutions', value: inst    ?? 0 },
    { name: 'Insiders',     value: insider ?? 0 },
    { name: 'Public Float', value: float   ?? 0 },
  ];

  const statRows: { label: string; value: string; tipTitle: string; tipBody: string }[] = [
    {
      label: 'Institutions',
      value: inst != null ? `${fmt(inst)}%` : '—',
      tipTitle: 'Institutional Ownership %',
      tipBody: 'The percentage of shares held by large professional investors: mutual funds, pension funds, ETFs, hedge funds and insurance companies. High institutional ownership (60%+) signals that professional money trusts this company. Very low institutional ownership may indicate higher risk or limited analyst coverage.',
    },
    {
      label: 'Insiders',
      value: insider != null ? `${fmt(insider)}%` : '—',
      tipTitle: 'Insider Ownership %',
      tipBody: "The percentage of shares held by company executives, directors and major shareholders. High insider ownership (10%+) can be bullish — management has significant 'skin in the game' and is aligned with shareholders. Very high insider ownership may also limit liquidity.",
    },
    {
      label: 'Public Float',
      value: float != null ? `${fmt(float)}%` : '—',
      tipTitle: 'Public Float %',
      tipBody: 'The percentage of shares available for ordinary investors to buy and sell on the open market (total shares minus institutional and insider holdings). A larger float means more liquidity and is easier to trade without moving the price. A very small float can lead to higher volatility.',
    },
  ];

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">
          Ownership Structure
          <InfoTip title="Ownership Structure">
            Who owns the company&apos;s shares: large institutions (funds, pensions),
            company insiders, and the public &quot;float&quot; held by everyone else. Heavy
            institutional ownership can mean steadier, better-researched demand.
          </InfoTip>
        </div>
      </div>
      <div className="card-body">
        <div className="ownership-grid">
          {/* Left — donut + stat rows */}
          {hasDonut && (
            <div>
              <div
                style={{ display: 'flex', justifyContent: 'center' }}
                role="img"
                aria-label={`Ownership breakdown: Institutions ${fmt(inst)}%, Insiders ${fmt(insider)}%, Public Float ${fmt(float)}%`}
              >
                <PieChart width={160} height={160}>
                  <Pie
                    data={donutData}
                    cx={75}
                    cy={75}
                    innerRadius={48}
                    outerRadius={72}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]!;
                      return (
                        <div style={{ background: '#1A1A1B', border: '1px solid #2E3347', borderRadius: 6, padding: '6px 10px' }}>
                          <div style={{ color: '#E8EAF0', fontSize: 11, fontFamily: 'Sora' }}>{String(d.name)}</div>
                          <div style={{ color: '#94A3B8', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{Number(d.value).toFixed(1)}%</div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </div>
              {/* Colour legend */}
              <div style={{ display: 'flex', justifyContent: 'center', columnGap: 14, rowGap: 4, marginTop: 10, marginBottom: 0, flexWrap: 'wrap' }}>
                {donutData.map((entry, i) => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: DONUT_COLORS[i], display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Sora' }}>{entry.name}</span>
                  </div>
                ))}
              </div>
              <div className="ownership-stats">
                {statRows.map((row) => (
                  <div key={row.label} className="ownership-stat-row">
                    <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {row.label}
                      <InfoTip title={row.tipTitle}>{row.tipBody}</InfoTip>
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Right — top holders table */}
          {holders.length > 0 && (
            <div>
              <div className="table-section-label">Top Institutional Holders</div>
              <div className="table-wrapper">
                <table className="ownership-table">
                  <thead>
                    <tr>
                      <th>Holder</th>
                      <th className="num">% Out</th>
                      <th className="num">Shares (M)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holders.slice(0, 10).map((h, i) => (
                      <tr key={i}>
                        <td className="text-cell">{h.holder}</td>
                        <td className="num">
                          {h.pct_out != null ? `${(h.pct_out * 100).toFixed(2)}%` : '—'}
                        </td>
                        <td className="num">{fmtShares(h.shares)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
