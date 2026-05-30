'use client';

import type { InsiderTransaction } from '@/lib/types';

interface Props {
  insiderTransactions?: InsiderTransaction[];
}

const TYPE_STYLES: Record<InsiderTransaction['type'], { label: string; bg: string; color: string }> = {
  Purchase: { label: 'Buy',   bg: 'rgba(34,139,34,.12)',  color: '#228B22' },
  Sale:     { label: 'Sell',  bg: 'rgba(178,34,34,.10)',  color: '#B22222' },
  Award:    { label: 'Award', bg: 'rgba(30,92,179,.12)',  color: '#2E7DE8' },
  Gift:     { label: 'Gift',  bg: 'rgba(30,92,179,.08)',  color: '#1E5CB3' },
  Other:    { label: 'Other', bg: 'rgba(138,151,168,.12)', color: '#8A97A8' },
};

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtValue(v: number | null): string {
  if (v == null || v === 0) return '—';
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3)  return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtShares(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString();
}

export function InsiderActivity({ insiderTransactions }: Props) {
  const txs = insiderTransactions ?? [];
  if (txs.length === 0) return null;

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Insider Activity</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last {txs.length} transactions</div>
      </div>
      <div className="card-body card-body--bleed">
        <div className="smart-timeline" style={{ padding: '0 18px 4px' }}>
          {txs.slice(0, 20).map((tx, i) => {
            const style = TYPE_STYLES[tx.type];
            return (
              <div key={i} className="smart-event">
                <div>
                  <div className="smart-event-head">
                    <span
                      className="smart-pill"
                      style={{
                        background: style.bg,
                        color: style.color,
                        border: `1px solid ${style.color}33`,
                      }}
                    >
                      {style.label}
                    </span>
                    <span className="smart-event-name" title={tx.insider}>{tx.insider}</span>
                    <span className="smart-event-title">{tx.position}</span>
                  </div>
                  <div className="smart-event-meta">
                    <span className="smart-event-meta-mono">{fmtShares(tx.shares)}</span>
                    {' '}shares
                    {tx.value ? <> · <span className="smart-event-meta-mono">{fmtValue(tx.value)}</span></> : null}
                  </div>
                </div>
                <div className="smart-event-date">{fmtDate(tx.date)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
