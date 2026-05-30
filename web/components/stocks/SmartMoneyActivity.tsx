'use client';

import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { AnalystUpgrade, InsiderTransaction, PriceBar } from '@/lib/types';

type Range = '1y' | '3y' | 'all';

interface Props {
  insiderTransactions?: InsiderTransaction[];
  analystUpgradesDowngrades?: AnalystUpgrade[];
  priceBars?: PriceBar[];
}

/* ── Helpers ─────────────────────────────────────────────────── */

const INSIDER_STYLE: Record<InsiderTransaction['type'], { pill: string; label: string; dot: string }> = {
  Purchase: { pill: 'is-buy',       label: 'Buy',   dot: '#228B22' },
  Sale:     { pill: 'is-sell',      label: 'Sell',  dot: '#B22222' },
  Award:    { pill: 'is-reiterate', label: 'Award', dot: '#2E7DE8' },
  Gift:     { pill: 'is-reiterate', label: 'Gift',  dot: '#1E5CB3' },
  Other:    { pill: 'is-reiterate', label: 'Other', dot: '#8A97A8' },
};

function classifyAction(action: string): { pill: string; label: string; dot: string } {
  const a = action.toLowerCase();
  if (a === 'up'   || a === 'upgrade')   return { pill: 'is-upgrade',   label: 'Upgrade',   dot: '#228B22' };
  if (a === 'down' || a === 'downgrade') return { pill: 'is-downgrade', label: 'Downgrade', dot: '#B22222' };
  if (a === 'init' || a === 'initiate')  return { pill: 'is-initiate',  label: 'Initiate',  dot: '#D97706' };
  return                                        { pill: 'is-reiterate', label: 'Reiterate', dot: '#1E5CB3' };
}

function insiderSentiment(txs: InsiderTransaction[]): { label: string; color: string; bg: string } {
  const buys  = txs.filter(t => t.type === 'Purchase').reduce((s, t) => s + (t.value ?? 0), 0);
  const sells = txs.filter(t => t.type === 'Sale').reduce((s, t) => s + (t.value ?? 0), 0);
  if (buys > sells * 0.5) return { label: 'NET BUYER',  color: '#228B22', bg: 'rgba(34,139,34,.10)' };
  return                         { label: 'NET SELLER', color: '#B22222', bg: 'rgba(178,34,34,.08)' };
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtValue(v: number | null): string {
  if (!v) return '';
  if (v >= 1e9) return ` · $${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return ` · $${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return ` · $${(v / 1e3).toFixed(0)}K`;
  return ` · $${v.toFixed(0)}`;
}

function toTs(d: string): number {
  return new Date(d.includes('T') ? d : d + 'T00:00:00').getTime();
}

function fmtTick(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/* ── Chart data builder ──────────────────────────────────────── */

interface PricePt { x: number; y: number; }
interface EventPt { x: number; y: number; color: string; tx?: InsiderTransaction; ac?: AnalystUpgrade; }

function useChartData(
  priceBars: PriceBar[],
  txs: InsiderTransaction[],
  upgrades: AnalystUpgrade[],
  range: Range,
) {
  return useMemo(() => {
    if (!priceBars.length) return { priceData: [], buyPts: [], sellPts: [], analystPts: [], domain: [0, 1] as [number, number] };

    // Use the last price bar as the reference point — more correct and avoids impure Date.now().
    const refTs = toTs(priceBars[priceBars.length - 1]!.date);
    let cutoff: number;
    if (range === '1y') {
      cutoff = refTs - 365 * 86400000;
    } else if (range === '3y') {
      cutoff = refTs - 3 * 365 * 86400000;
    } else {
      const allTs = [...txs.map(t => t.date), ...upgrades.map(a => a.date)]
        .map(toTs).filter(t => !isNaN(t) && t > 0);
      cutoff = allTs.length ? allTs.reduce((m, t) => (t < m ? t : m), Infinity) : refTs - 3 * 365 * 86400000;
    }

    const priceData: PricePt[] = priceBars
      .map(b => ({ x: toTs(b.date), y: Number(b.close) }))
      .filter(p => !isNaN(p.x) && p.x >= cutoff)
      .sort((a, b) => a.x - b.x);

    if (!priceData.length) return { priceData: [], buyPts: [], sellPts: [], analystPts: [], domain: [0, 1] as [number, number] };

    const first = priceData[0]!;
    const last  = priceData[priceData.length - 1]!;
    const firstX = first.x;
    const lastX  = last.x;

    function snap(dateStr: string): PricePt | null {
      const ts = toTs(dateStr);
      if (isNaN(ts)) return null;
      if (ts <= firstX) return first;
      if (ts >= lastX)  return last;
      let best: PricePt = first;
      let bestD = Math.abs(first.x - ts);
      for (const p of priceData) {
        const d = Math.abs(p.x - ts);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    }

    const inRange = (d: string) => { const t = toTs(d); return !isNaN(t) && (range === 'all' || t >= cutoff); };

    const buyPts: EventPt[] = txs
      .filter(t => t.type === 'Purchase' && inRange(t.date))
      .flatMap(t => { const s = snap(t.date); return s ? [{ x: s.x, y: s.y, color: '#228B22', tx: t }] : []; });

    const sellPts: EventPt[] = txs
      .filter(t => t.type === 'Sale' && inRange(t.date))
      .flatMap(t => { const s = snap(t.date); return s ? [{ x: s.x, y: s.y, color: '#B22222', tx: t }] : []; });

    const analystPts: EventPt[] = upgrades
      .filter(a => inRange(a.date))
      .flatMap(a => { const s = snap(a.date); return s ? [{ x: s.x, y: s.y, color: classifyAction(a.action).dot, ac: a }] : []; });

    const domain: [number, number] = [firstX, lastX];
    return { priceData, buyPts, sellPts, analystPts, domain };
  }, [priceBars, txs, upgrades, range]);
}

/* ── Custom scatter shapes ───────────────────────────────────── */

function BuyShape({ cx = 0, cy = 0 }: { cx?: number; cy?: number }) {
  return <polygon points={`${cx},${cy - 8} ${cx - 6},${cy + 4} ${cx + 6},${cy + 4}`} fill="#228B22" stroke="white" strokeWidth={1.5} />;
}

function SellShape({ cx = 0, cy = 0 }: { cx?: number; cy?: number }) {
  return <polygon points={`${cx},${cy + 8} ${cx - 6},${cy - 4} ${cx + 6},${cy - 4}`} fill="#B22222" stroke="white" strokeWidth={1.5} />;
}

function AnalystDot({ cx = 0, cy = 0, payload }: { cx?: number; cy?: number; payload?: EventPt }) {
  const color = payload?.color ?? '#1E5CB3';
  return <rect x={cx - 6} y={cy - 6} width={12} height={12} rx={3} fill={color} stroke="white" strokeWidth={1.5} />;
}

/* ── Chart tooltip ───────────────────────────────────────────── */

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: PricePt & Partial<EventPt> }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;

  let rows: React.ReactNode;
  if (d.tx) {
    const s = INSIDER_STYLE[d.tx.type];
    rows = (
      <>
        <div style={{ fontWeight: 700, color: s.dot }}>{s.label.toUpperCase()}: {d.tx.insider}</div>
        <div style={{ color: '#8A97A8' }}>{d.tx.position}</div>
        <div>{(d.tx.shares ?? 0).toLocaleString()} shares{fmtValue(d.tx.value)}</div>
        <div style={{ color: '#8A97A8', marginTop: 2 }}>{fmtDate(d.tx.date)}</div>
      </>
    );
  } else if (d.ac) {
    const cls = classifyAction(d.ac.action);
    const hasChange = d.ac.from_grade && d.ac.from_grade !== d.ac.to_grade;
    rows = (
      <>
        <div style={{ fontWeight: 700, color: cls.dot }}>{cls.label}: {d.ac.firm}</div>
        <div>
          {hasChange
            ? <>{d.ac.from_grade} → <span style={{ color: cls.dot }}>{d.ac.to_grade}</span></>
            : <span style={{ color: cls.dot }}>{d.ac.to_grade}</span>}
        </div>
        <div style={{ color: '#8A97A8', marginTop: 2 }}>{fmtDate(d.ac.date)}</div>
      </>
    );
  } else {
    rows = (
      <>
        <div style={{ color: '#8A97A8' }}>{fmtTick(d.x)}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>${d.y.toFixed(2)}</div>
      </>
    );
  }

  return (
    <div style={{ background: '#1A1A1B', border: '1px solid #2E3347', borderRadius: 6, padding: '8px 12px', fontFamily: 'Sora, sans-serif', fontSize: 11, color: '#E8EAF0' }}>
      {rows}
    </div>
  );
}

/* ── Inner chart component ───────────────────────────────────── */

function SmartChart({ priceBars, txs, upgrades, range }: { priceBars: PriceBar[]; txs: InsiderTransaction[]; upgrades: AnalystUpgrade[]; range: Range }) {
  const { priceData, buyPts, sellPts, analystPts, domain } = useChartData(priceBars, txs, upgrades, range);

  if (!priceData.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        No price data for this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart margin={{ top: 8, right: 52, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="x"
          type="number"
          scale="time"
          domain={domain}
          tickFormatter={fmtTick}
          tickCount={8}
          tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          orientation="right"
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<ChartTooltip />} />

        <Line
          data={priceData}
          dataKey="y"
          type="monotone"
          stroke="#1E5CB3"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: '#1E5CB3' }}
          isAnimationActive={false}
        />

        {buyPts.length > 0 && (
          <Scatter data={buyPts} isAnimationActive={false} shape={<BuyShape />} name="Insider Buy" />
        )}
        {sellPts.length > 0 && (
          <Scatter data={sellPts} isAnimationActive={false} shape={<SellShape />} name="Insider Sell" />
        )}
        {analystPts.length > 0 && (
          <Scatter data={analystPts} isAnimationActive={false} shape={<AnalystDot />} name="Analyst Event" />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export function SmartMoneyActivity({ insiderTransactions, analystUpgradesDowngrades, priceBars }: Props) {
  const [range, setRange] = useState<Range>('all');

  const txs      = insiderTransactions       ?? [];
  const upgrades = analystUpgradesDowngrades ?? [];
  const bars     = priceBars                 ?? [];

  if (txs.length === 0 && upgrades.length === 0) return null;

  const sentiment = txs.length > 0 ? insiderSentiment(txs) : null;

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Smart Money Activity</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
          {bars.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {(['1y', '3y', 'all'] as Range[]).map(r => (
                <button
                  key={r}
                  type="button"
                  className={`range-btn${range === r ? ' active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card-body">
        {bars.length > 0 && (
          <div className="chart-canvas-wrap chart-h-md" style={{ marginBottom: 16 }}>
            <SmartChart priceBars={bars} txs={txs} upgrades={upgrades} range={range} />
          </div>
        )}

        <div className="smart-money-grid">
          {/* Left — Insider Transactions */}
          <div>
            <div className="smart-section-head">
              <div className="smart-section-title">Insider Transactions</div>
              {sentiment && (
                <span className="smart-section-tag" style={{ color: sentiment.color, background: sentiment.bg }}>
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
                    <div key={i} className="smart-event" style={{ '--dot': s.dot } as React.CSSProperties}>
                      <div>
                        <div className="smart-event-head">
                          <span className={`smart-pill ${s.pill}`}>{s.label}</span>
                          <span className="smart-event-name" title={tx.insider}>{tx.insider}</span>
                          <span className="smart-event-title">{tx.position}</span>
                        </div>
                        <div className="smart-event-meta">
                          <span className="smart-event-meta-mono">{(tx.shares ?? 0).toLocaleString()}</span>
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
                    <div key={i} className="smart-event" style={{ '--dot': cls.dot } as React.CSSProperties}>
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
