'use client';

import type { AnalystUpgrade, InsiderTransaction } from '@/lib/types';

interface Props {
  insiderTransactions?: InsiderTransaction[];
  analystUpgradesDowngrades?: AnalystUpgrade[];
}

/* ── Insider helpers ─────────────────────────────────────────── */

const INSIDER_STYLE: Record<InsiderTransaction['type'], { pill: string; label: string; dot: string }> = {
  Purchase: { pill: 'is-buy',    label: 'Buy',   dot: '#228B22' },
  Sale:     { pill: 'is-sell',   label: 'Sell',  dot: '#B22222' },
  Award:    { pill: 'is-reiterate', label: 'Award', dot: '#2E7DE8' },
  Gift:     { pill: 'is-reiterate', label: 'Gift',  dot: '#1E5CB3' },
  Other:    { pill: 'is-reiterate', label: 'Other', dot: '#8A97A8' },
};

function insiderSentiment(txs: InsiderTransaction[]): { label: string; color: string; bg: string } {
  const buys  = txs.filter(t => t.type === 'Purchase').reduce((s, t) => s + (t.value ?? 0), 0);
  const sells = txs.filter(t => t.type === 'Sale').reduce((s, t) => s + (t.value ?? 0), 0);
  if (buys > sells * 0.5) return { label: 'NET BUYER',  color: '#228B22', bg: 'rgba(34,139,34,.10)' };
  return                         { label: 'NET SELLER', color: '#B22222', bg: 'rgba(178,34,34,.08)' };
}

/* ── Analyst helpers ─────────────────────────────────────────── */

function classifyAction(action: string): { pill: string; label: string; dot: string } {
  const a = action.toLowerCase();
  if (a === 'up'   || a === 'upgrade')   return { pill: 'is-upgrade',   label: 'Upgrade',   dot: '#228B22' };
  if (a === 'down' || a === 'downgrade') return { pill: 'is-downgrade', label: 'Downgrade', dot: '#B22222' };
  if (a === 'init' || a === 'initiate')  return { pill: 'is-initiate',  label: 'Initiate',  dot: '#D97706' };
  return                                        { pill: 'is-reiterate', label: 'Reiterate', dot: '#1E5CB3' };
}

/* ── Shared formatting ───────────────────────────────────────── */

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtValue(v: number | null): string {
  if (v == null || v === 0) return '';
  if (v >= 1e9)  return ` · $${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return ` · $${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3)  return ` · $${(v / 1e3).toFixed(0)}K`;
  return ` · $${v.toFixed(0)}`;
}

/* ── Component ───────────────────────────────────────────────── */

export function SmartMoneyActivity({ insiderTransactions, analystUpgradesDowngrades }: Props) {
  const txs      = insiderTransactions         ?? [];
  const upgrades = analystUpgradesDowngrades   ?? [];

  if (txs.length === 0 && upgrades.length === 0) return null;

  const sentiment = txs.length > 0 ? insiderSentiment(txs) : null;

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Smart Money Activity</div>
        <div className="smart-legend">
          <span className="smart-legend-chip" style={{ '--lg': '#228B22' } as React.CSSProperties}>
            <span className="smart-legend-chip-dot" />Buy / Upgrade
          </span>
          <span className="smart-legend-chip" style={{ '--lg': '#B22222' } as React.CSSProperties}>
            <span className="smart-legend-chip-dot" />Sell / Downgrade
          </span>
          <span className="smart-legend-chip" style={{ '--lg': '#1E5CB3' } as React.CSSProperties}>
            <span className="smart-legend-chip-dot" />Reiterate
          </span>
        </div>
      </div>

      <div className="card-body">
        <div className="smart-money-grid">

          {/* Left — Insider Transactions */}
          <div>
            <div className="smart-section-head">
              <div className="smart-section-title">Insider Transactions</div>
              {sentiment && (
                <span
                  className="smart-section-tag"
                  style={{ color: sentiment.color, background: sentiment.bg }}
                >
                  {sentiment.label}
                </span>
              )}
            </div>
            {txs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No transactions available.</div>
            ) : (
              <div className="smart-timeline">
                {txs.slice(0, 15).map((tx, i) => {
                  const s = INSIDER_STYLE[tx.type];
                  return (
                    <div
                      key={i}
                      className="smart-event"
                      style={{ '--dot': s.dot } as React.CSSProperties}
                    >
                      <div>
                        <div className="smart-event-head">
                          <span className={`smart-pill ${s.pill}`}>{s.label}</span>
                          <span className="smart-event-name" title={tx.insider}>{tx.insider}</span>
                          <span className="smart-event-title">{tx.position}</span>
                        </div>
                        <div className="smart-event-meta">
                          <span className="smart-event-meta-mono">{tx.shares?.toLocaleString() ?? '—'}</span>
                          {' '}shares{fmtValue(tx.value)}
                        </div>
                      </div>
                      <div className="smart-event-date">{fmtDate(tx.date)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right — Analyst Rating Changes */}
          <div>
            <div className="smart-section-head">
              <div className="smart-section-title">Analyst Rating Changes</div>
              <span className="smart-section-tag" style={{ color: 'var(--text-muted)' }}>
                {upgrades.length} recent
              </span>
            </div>
            {upgrades.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No rating changes available.</div>
            ) : (
              <div className="smart-timeline">
                {upgrades.slice(0, 15).map((ac, i) => {
                  const cls = classifyAction(ac.action);
                  const hasChange = ac.from_grade && ac.from_grade !== ac.to_grade;
                  return (
                    <div
                      key={i}
                      className="smart-event"
                      style={{ '--dot': cls.dot } as React.CSSProperties}
                    >
                      <div>
                        <div className="smart-event-head">
                          <span className={`smart-pill ${cls.pill}`}>{cls.label}</span>
                          <span className="smart-event-name" title={ac.firm}>{ac.firm}</span>
                        </div>
                        <div className="smart-event-meta">
                          {hasChange
                            ? <><span className="smart-event-meta-mono">{ac.from_grade}</span>{' → '}<span className="smart-event-meta-mono" style={{ color: cls.dot }}>{ac.to_grade}</span></>
                            : <span className="smart-event-meta-mono" style={{ color: cls.dot }}>{ac.to_grade}</span>
                          }
                        </div>
                      </div>
                      <div className="smart-event-date">{fmtDate(ac.date)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
