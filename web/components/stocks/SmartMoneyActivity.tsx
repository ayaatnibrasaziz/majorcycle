'use client';

import { useMemo, useState } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { AnalystUpgrade, InsiderTransaction, PriceBar } from '@/lib/types';

type Range = '1y' | '3y' | 'all';
const RANGE_LABELS: Record<Range, string> = { '1y': '1Y', '3y': '3Y', 'all': 'All' };

interface Props {
  insiderTransactions?: InsiderTransaction[];
  analystUpgradesDowngrades?: AnalystUpgrade[];
  priceBars?: PriceBar[];
}

/* ── Helpers ─────────────────────────────────────────────────── */

const INSIDER_STYLE: Record<InsiderTransaction['type'], { pill: string; label: string; dot: string }> = {
  Purchase: { pill: 'is-buy',       label: 'Buy',   dot: '#006400' },
  Sale:     { pill: 'is-sell',      label: 'Sell',  dot: '#B22222' },
  Award:    { pill: 'is-reiterate', label: 'Award', dot: '#2E7DE8' },
  Gift:     { pill: 'is-reiterate', label: 'Gift',  dot: '#1E5CB3' },
  Other:    { pill: 'is-reiterate', label: 'Other', dot: '#8A97A8' },
};

function classifyAction(action: string): { pill: string; label: string } {
  const a = action.toLowerCase();
  if (a === 'up'   || a === 'upgrade')   return { pill: 'is-upgrade',   label: 'Upgrade'   };
  if (a === 'down' || a === 'downgrade') return { pill: 'is-downgrade', label: 'Downgrade' };
  if (a === 'init' || a === 'initiate')  return { pill: 'is-initiate',  label: 'Initiate'  };
  return                                        { pill: 'is-reiterate', label: 'Reiterate' };
}

function gradeColor(grade: string | undefined): string {
  const g = (grade ?? '').toLowerCase().trim().replace(/-/g, ' ');
  if (g.includes('strong buy') || g === 'buy' || g.includes('outperform') || g.includes('overweight') || g === 'accumulate' || g === 'add' || g === 'positive' || g === 'long term buy')
    return '#228B22';
  if (g.includes('sell') || g.includes('underperform') || g.includes('underweight') || g === 'reduce' || g === 'negative' || g === 'avoid')
    return '#B22222';
  if (g === 'neutral' || g === 'hold' || g.includes('market perform') || g.includes('equal weight') || g.includes('peer perform') || g.includes('sector perform') || g.includes('market weight') || g.includes('in line') || g.includes('fair value'))
    return '#D4A017';
  return '#1E5CB3';
}

function classifyGrade(grade: string | undefined): 'bull' | 'bear' | 'neut' {
  const g = (grade ?? '').toLowerCase().trim().replace(/-/g, ' ');
  if (g.includes('strong buy') || g === 'buy' || g.includes('outperform') || g.includes('overweight') || g === 'accumulate' || g === 'add' || g === 'positive' || g === 'long term buy')
    return 'bull';
  if (g.includes('sell') || g.includes('underperform') || g.includes('underweight') || g === 'reduce' || g === 'negative' || g === 'avoid')
    return 'bear';
  return 'neut';
}

function insiderSentiment(txs: InsiderTransaction[]): { label: string; color: string; bg: string } {
  const buys  = txs.filter(t => t.type === 'Purchase').reduce((s, t) => s + (t.value ?? 0), 0);
  const sells = txs.filter(t => t.type === 'Sale').reduce((s, t) => s + (t.value ?? 0), 0);
  if (buys > sells * 0.5) return { label: 'NET BUYER (Bullish)',  color: '#228B22', bg: 'rgba(34,139,34,.10)' };
  return                         { label: 'NET SELLER (Bearish)', color: '#B22222', bg: 'rgba(178,34,34,.08)' };
}

// Computes overall analyst consensus from the most recent rating per firm.
function analystConsensus(upgrades: AnalystUpgrade[]): { label: string; color: string; bg: string } | null {
  if (!upgrades.length) return null;
  const latest = new Map<string, AnalystUpgrade>();
  for (const u of upgrades) {
    if (!latest.has(u.firm) || u.date > latest.get(u.firm)!.date) {
      latest.set(u.firm, u);
    }
  }
  let bull = 0, bear = 0, neut = 0;
  for (const u of latest.values()) {
    const cls = classifyGrade(u.to_grade);
    if (cls === 'bull') bull++;
    else if (cls === 'bear') bear++;
    else neut++;
  }
  if (!bull && !bear && !neut) return null;
  if (bull >= bear && bull > neut) return { label: 'BULLISH',  color: '#228B22', bg: 'rgba(34,139,34,.10)' };
  if (bear > bull  && bear > neut) return { label: 'BEARISH',  color: '#B22222', bg: 'rgba(178,34,34,.08)' };
  return                                   { label: 'NEUTRAL',  color: '#D4A017', bg: 'rgba(212,160,23,.10)' };
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

function fmtTickShort(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function fmtTickYearOnly(ts: number): string {
  return String(new Date(ts).getUTCFullYear());
}

function makeAxisTicks(firstX: number, lastX: number, n: number): number[] {
  if (n < 2 || lastX <= firstX) return [firstX];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.round(firstX + ((lastX - firstX) * i) / (n - 1)));
  }
  return out;
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
    const empty = { priceData: [], buyPts: [], sellPts: [], otherInsiderPts: [], analystPts: [], domain: [0, 1] as [number, number], ticks: [0, 1], spanYears: 0 };
    if (!priceBars.length) return empty;

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

    const seenX = new Set<number>();
    const priceData: PricePt[] = priceBars
      .map(b => ({ x: toTs(b.date), y: Number(b.close) }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y) && p.x >= cutoff)
      .sort((a, b) => a.x - b.x)
      .filter(p => { if (seenX.has(p.x)) return false; seenX.add(p.x); return true; });

    if (!priceData.length) return empty;

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
      .flatMap((t, i) => { const s = snap(t.date); return s ? [{ x: s.x + 60000 + i, y: s.y, color: '#006400', tx: t }] : []; });

    const sellPts: EventPt[] = txs
      .filter(t => t.type === 'Sale' && inRange(t.date))
      .flatMap((t, i) => { const s = snap(t.date); return s ? [{ x: s.x + 120000 + i, y: s.y, color: '#B22222', tx: t }] : []; });

    // Award / Gift / Other — plotted as circles using their timeline dot colour
    const otherInsiderPts: EventPt[] = txs
      .filter(t => (t.type === 'Award' || t.type === 'Gift' || t.type === 'Other') && inRange(t.date))
      .flatMap((t, i) => { const s = snap(t.date); return s ? [{ x: s.x + 180000 + i, y: s.y, color: INSIDER_STYLE[t.type].dot, tx: t }] : []; });

    const analystPts: EventPt[] = upgrades
      .filter(a => inRange(a.date))
      .flatMap((a, i) => { const s = snap(a.date); return s ? [{ x: s.x + 240000 + i, y: s.y, color: gradeColor(a.to_grade), ac: a }] : []; });

    const domain: [number, number] = [firstX, lastX];
    const spanYears = (lastX - firstX) / (365.25 * 86400000);
    const tickN = spanYears <= 1.2 ? 7 : spanYears <= 4 ? 7 : 8;
    const ticks = makeAxisTicks(firstX, lastX, tickN);
    return { priceData, buyPts, sellPts, otherInsiderPts, analystPts, domain, ticks, spanYears };
  }, [priceBars, txs, upgrades, range]);
}

/* ── Custom scatter shapes ───────────────────────────────────── */

function BuyShape({ cx = 0, cy = 0 }: { cx?: number; cy?: number }) {
  return <polygon points={`${cx},${cy - 8} ${cx - 7},${cy + 4} ${cx + 7},${cy + 4}`} fill="rgba(0,100,0,.85)" stroke="white" strokeWidth={1.5} />;
}

function SellShape({ cx = 0, cy = 0 }: { cx?: number; cy?: number }) {
  return <polygon points={`${cx},${cy + 8} ${cx - 7},${cy - 4} ${cx + 7},${cy - 4}`} fill="rgba(178,34,34,.85)" stroke="white" strokeWidth={1.5} />;
}

function OtherInsiderShape({ cx = 0, cy = 0, payload }: { cx?: number; cy?: number; payload?: EventPt }) {
  const color = payload?.color ?? '#1E5CB3';
  return <circle cx={cx} cy={cy} r={5} fill={color} fillOpacity={0.8} stroke="white" strokeWidth={1.5} />;
}

function AnalystDot({ cx = 0, cy = 0, payload }: { cx?: number; cy?: number; payload?: EventPt }) {
  const color = payload?.color ?? '#1E5CB3';
  return <rect x={cx - 7} y={cy - 7} width={14} height={14} rx={3} fill={color} stroke="white" strokeWidth={1.5} />;
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
    const gc  = gradeColor(d.ac.to_grade);
    const hasChange = d.ac.from_grade && d.ac.from_grade !== d.ac.to_grade;
    rows = (
      <>
        <div style={{ fontWeight: 700, color: gc }}>{cls.label}: {d.ac.firm}</div>
        <div>
          {hasChange
            ? <>{d.ac.from_grade} → <span style={{ color: gc }}>{d.ac.to_grade}</span></>
            : <span style={{ color: gc }}>{d.ac.to_grade}</span>}
        </div>
        <div style={{ color: '#8A97A8', marginTop: 2 }}>{fmtDate(d.ac.date)}</div>
      </>
    );
  } else {
    rows = (
      <>
        <div style={{ color: '#8A97A8' }}>{fmtTickShort(d.x)}</div>
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

interface Visibility { price: boolean; buy: boolean; sell: boolean; other: boolean; analyst: boolean }

function SmartChart({ priceBars, txs, upgrades, range, visible }: { priceBars: PriceBar[]; txs: InsiderTransaction[]; upgrades: AnalystUpgrade[]; range: Range; visible: Visibility }) {
  const { priceData, buyPts, sellPts, otherInsiderPts, analystPts, domain, ticks, spanYears } = useChartData(priceBars, txs, upgrades, range);
  const xTickFormatter = spanYears > 5 ? fmtTickYearOnly : fmtTickShort;

  if (!priceData.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        No price data for this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 220 }}>
      <ComposedChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="x"
          type="number"
          scale="time"
          domain={domain}
          ticks={ticks}
          tickFormatter={xTickFormatter}
          tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
          axisLine={false}
          tickLine={false}
          allowDataOverflow={false}
        />
        <YAxis
          orientation="right"
          axisLine={false}
          tickLine={false}
          width={48}
          tickMargin={6}
          tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
        />
        <CartesianGrid stroke="#F0F4F8" vertical={true} horizontal={true} />
        <Tooltip content={<ChartTooltip />} />

        {visible.price && (
          <Area
            data={priceData}
            dataKey="y"
            type="monotone"
            stroke="#1E5CB3"
            strokeWidth={1.5}
            fill="rgba(30,92,179,0.06)"
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 3, fill: '#1E5CB3' }}
            isAnimationActive={false}
          />
        )}

        {visible.buy && buyPts.length > 0 && (
          <Scatter data={buyPts} isAnimationActive={false} shape={<BuyShape />} name="Insider Buy" />
        )}
        {visible.sell && sellPts.length > 0 && (
          <Scatter data={sellPts} isAnimationActive={false} shape={<SellShape />} name="Insider Sell" />
        )}
        {visible.other && otherInsiderPts.length > 0 && (
          <Scatter data={otherInsiderPts} isAnimationActive={false} shape={<OtherInsiderShape />} name="Insider Award/Other" />
        )}
        {visible.analyst && analystPts.length > 0 && (
          <Scatter data={analystPts} isAnimationActive={false} shape={<AnalystDot />} name="Analyst Event" />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ── Bottom legend (clickable, toggles series) ──────────────── */

function LegendChip({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: 'none', background: 'transparent', cursor: 'pointer',
        padding: '4px 8px', fontFamily: 'Sora, sans-serif', fontSize: 10,
        color: 'var(--text-secondary)', letterSpacing: 0.2,
        opacity: active ? 1 : 0.4,
        textDecoration: active ? 'none' : 'line-through',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function ChartLegend({ visible, toggle }: { visible: Visibility; toggle: (k: keyof Visibility) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '6px 0 2px' }}>
      <LegendChip active={visible.buy} onClick={() => toggle('buy')} icon={
        <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(0,100,0,.85)' }} />
      }>Insider Buy</LegendChip>
      <LegendChip active={visible.sell} onClick={() => toggle('sell')} icon={
        <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(178,34,34,.85)' }} />
      }>Insider Sell</LegendChip>
      <LegendChip active={visible.other} onClick={() => toggle('other')} icon={
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <span style={{ width: 7, height: 10, borderRadius: 5, background: '#2E7DE8' }} />
          <span style={{ width: 7, height: 10, borderRadius: 5, background: '#8A97A8' }} />
        </span>
      }>Award / Other</LegendChip>
      <LegendChip active={visible.analyst} onClick={() => toggle('analyst')} icon={
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <span style={{ width: 6, height: 10, borderRadius: 1, background: '#228B22' }} />
          <span style={{ width: 6, height: 10, borderRadius: 1, background: '#D4A017' }} />
          <span style={{ width: 6, height: 10, borderRadius: 1, background: '#B22222' }} />
        </span>
      }>Analyst Event</LegendChip>
      <LegendChip active={visible.price} onClick={() => toggle('price')} icon={
        <span style={{ width: 10, height: 10, borderRadius: 2, border: '1.5px solid #1E5CB3', background: 'transparent' }} />
      }>Price</LegendChip>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export function SmartMoneyActivity({ insiderTransactions, analystUpgradesDowngrades, priceBars }: Props) {
  const [range, setRange] = useState<Range>('all');
  const [visible, setVisible] = useState<Visibility>({ price: true, buy: true, sell: true, other: true, analyst: true });
  const toggleSeries = (k: keyof Visibility) => setVisible(v => ({ ...v, [k]: !v[k] }));

  const txs      = insiderTransactions       ?? [];
  const upgrades = analystUpgradesDowngrades ?? [];
  const bars     = priceBars                 ?? [];

  if (txs.length === 0 && upgrades.length === 0) return null;

  const sentiment  = txs.length      > 0 ? insiderSentiment(txs)       : null;
  const consensus  = upgrades.length  > 0 ? analystConsensus(upgrades)  : null;

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">
          Smart Money Activity
          <InfoTip title="Smart Money Activity">
            Recent buying and selling by company insiders (executives and directors)
            and rating changes by Wall Street analysts, plotted against the price.
            Insider buying can signal confidence; selling has many causes. Information,
            not advice.
          </InfoTip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="smart-legend">
            <span className="smart-legend-chip" style={{ '--lg': '#006400' } as React.CSSProperties}>
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
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card-body">
        {bars.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="chart-canvas-wrap chart-h-md">
              <SmartChart priceBars={bars} txs={txs} upgrades={upgrades} range={range} visible={visible} />
            </div>
            <ChartLegend visible={visible} toggle={toggleSeries} />
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
                {txs.slice(0, 10).map((tx, i) => {
                  const s = INSIDER_STYLE[tx.type];
                  const shares = tx.shares ?? 0;
                  const val = tx.value ?? 0;
                  const sz = (shares >= 100000 || val >= 1e8) ? 'dot-lg' : (shares < 10000 && val < 2e6) ? 'dot-sm' : '';
                  return (
                    <div key={i} className={`smart-event${sz ? ` ${sz}` : ''}`} style={{ '--dot': s.dot } as React.CSSProperties}>
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
              {consensus && (
                <span className="smart-section-tag" style={{ color: consensus.color, background: consensus.bg }}>
                  {consensus.label}
                </span>
              )}
            </div>
            {upgrades.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No rating changes available.</div>
            ) : (
              <div className="smart-timeline">
                {upgrades.slice(0, 10).map((ac, i) => {
                  const cls = classifyAction(ac.action);
                  const gc  = gradeColor(ac.to_grade);
                  const hasChange = ac.from_grade && ac.from_grade !== ac.to_grade;
                  const acLower = (ac.action ?? '').toLowerCase();
                  const acSz = acLower === 'upgrade' || acLower === 'downgrade' ? 'dot-lg' : '';
                  return (
                    <div key={i} className={`smart-event${acSz ? ` ${acSz}` : ''}`} style={{ '--dot': gc } as React.CSSProperties}>
                      <div>
                        <div className="smart-event-head">
                          <span className={`smart-pill ${cls.pill}`}>{cls.label}</span>
                          <span className="smart-event-name" title={ac.firm}>{ac.firm}</span>
                        </div>
                        <div className="smart-event-meta">
                          {hasChange
                            ? <>{ac.from_grade}{' → '}<span className="smart-event-meta-mono" style={{ color: gc }}>{ac.to_grade}</span></>
                            : <span className="smart-event-meta-mono" style={{ color: gc }}>{ac.to_grade}</span>
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
