'use client';

import { Cell, Pie, PieChart, Tooltip } from 'recharts';

import type { FundamentalsSnapshot, TopHolder } from '@/lib/types';

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
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

const DONUT_COLORS = ['#2E7DE8', '#1E5CB3', '#2E3347'];

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

  const statRows: { label: string; value: string; tip: string }[] = [
    {
      label: 'Institutions',
      value: inst != null ? `${fmt(inst)}%` : '—',
      tip: 'Institutional Ownership %|The percentage of shares held by large professional investors: mutual funds, pension funds, ETFs, and hedge funds. High institutional ownership (60%+) signals that professional money trusts this company.',
    },
    {
      label: 'Insiders',
      value: insider != null ? `${fmt(insider)}%` : '—',
      tip: "Insider Ownership %|The percentage of shares held by company executives, directors, and major shareholders. High insider ownership (10%+) can be bullish — it means management has significant 'skin in the game'.",
    },
    {
      label: 'Public Float',
      value: float != null ? `${fmt(float)}%` : '—',
      tip: 'Public Float %|The percentage of shares available for ordinary investors to buy and sell on the open market. A larger float means more liquidity and less price volatility.',
    },
  ];

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Ownership Structure</div>
      </div>
      <div className="card-body">
        <div className="ownership-grid">
          {/* Left — donut + stat rows */}
          {hasDonut && (
            <div>
              <div className="chart-canvas-wrap chart-h-sm" style={{ display: 'flex', justifyContent: 'center' }}>
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
              <div className="ownership-stats">
                {statRows.map((row) => (
                  <div key={row.label} className="has-tip ownership-stat-row" data-tip={row.tip}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
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
                      <th className="num">Shares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holders.slice(0, 10).map((h, i) => (
                      <tr key={i} className={i % 2 === 1 ? 'stripe' : ''}>
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
