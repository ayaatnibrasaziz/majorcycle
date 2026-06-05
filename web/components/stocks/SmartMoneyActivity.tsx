'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';

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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}

/* ── Chart data builder (memoised) ───────────────────────────── */

type Kind = 'buy' | 'sell' | 'other' | 'analyst';
type KindMarker = SeriesMarker<Time> & { kind: Kind };

interface DayEvents { insiders: InsiderTransaction[]; analysts: AnalystUpgrade[] }

interface ChartModel {
  priceData: { time: Time; value: number }[];
  priceByTime: Map<string, number>;
  eventsByTime: Map<string, DayEvents>;
  markersAll: KindMarker[];
  lastTime: string | null;
}

function buildModel(priceBars: PriceBar[], txs: InsiderTransaction[], upgrades: AnalystUpgrade[]): ChartModel {
  const empty: ChartModel = { priceData: [], priceByTime: new Map(), eventsByTime: new Map(), markersAll: [], lastTime: null };
  if (!priceBars.length) return empty;

  // Deduplicate + sort price bars by date (ascending) — LWC requires this.
  const byDate = new Map<string, number>();
  for (const b of priceBars) {
    const d = b.date;
    const c = Number(b.close);
    if (d && !isNaN(c)) byDate.set(d, c);
  }
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return empty;

  const priceData = dates.map((d) => ({ time: d as Time, value: byDate.get(d)! }));
  const priceByTime = new Map(dates.map((d) => [d, byDate.get(d)!]));
  const lastTime = dates[dates.length - 1]!;

  // Snap an event date to the nearest trading day in `dates` so its marker sits
  // on the price line (events can fall on weekends/holidays).
  const dateMs = dates.map((d) => new Date(d + 'T00:00:00').getTime());
  function snap(dateStr: string): string | null {
    const t = new Date((dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr) + 'T00:00:00').getTime();
    if (isNaN(t)) return null;
    if (t <= dateMs[0]!) return dates[0]!;
    if (t >= dateMs[dateMs.length - 1]!) return lastTime;
    // binary search nearest
    let lo = 0, hi = dateMs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (dateMs[mid]! < t) lo = mid; else hi = mid;
    }
    return (t - dateMs[lo]!) <= (dateMs[hi]! - t) ? dates[lo]! : dates[hi]!;
  }

  const eventsByTime = new Map<string, DayEvents>();
  const bucket = (key: string): DayEvents => {
    let e = eventsByTime.get(key);
    if (!e) { e = { insiders: [], analysts: [] }; eventsByTime.set(key, e); }
    return e;
  };

  const markersAll: KindMarker[] = [];

  for (const t of txs) {
    const key = snap(t.date);
    if (!key) continue;
    bucket(key).insiders.push(t);
    if (t.type === 'Purchase') {
      markersAll.push({ kind: 'buy', time: key as Time, position: 'belowBar', color: '#006400', shape: 'arrowUp', size: 1 });
    } else if (t.type === 'Sale') {
      markersAll.push({ kind: 'sell', time: key as Time, position: 'aboveBar', color: '#B22222', shape: 'arrowDown', size: 1 });
    } else {
      markersAll.push({ kind: 'other', time: key as Time, position: 'inBar', color: INSIDER_STYLE[t.type].dot, shape: 'circle', size: 1 });
    }
  }
  for (const a of upgrades) {
    const key = snap(a.date);
    if (!key) continue;
    bucket(key).analysts.push(a);
    markersAll.push({ kind: 'analyst', time: key as Time, position: 'aboveBar', color: gradeColor(a.to_grade), shape: 'square', size: 1 });
  }

  // LWC requires markers sorted by time ascending (date strings sort chronologically).
  markersAll.sort((m1, m2) => String(m1.time).localeCompare(String(m2.time)));

  return { priceData, priceByTime, eventsByTime, markersAll, lastTime };
}

/* ── Lightweight-Charts chart (native pan/zoom + combined tooltip) ── */

interface Visibility { buy: boolean; sell: boolean; other: boolean; analyst: boolean }

function visibleMarkers(all: KindMarker[], v: Visibility): SeriesMarker<Time>[] {
  return all.filter((m) =>
    m.kind === 'buy' ? v.buy : m.kind === 'sell' ? v.sell : m.kind === 'other' ? v.other : v.analyst,
  );
}

function SmartMoneyChart({ priceBars, txs, upgrades, range, visible }: {
  priceBars: PriceBar[]; txs: InsiderTransaction[]; upgrades: AnalystUpgrade[]; range: Range; visible: Visibility;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tipRef       = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const areaRef      = useRef<ISeriesApi<'Area'> | null>(null);

  const model = useMemo(() => buildModel(priceBars, txs, upgrades), [priceBars, txs, upgrades]);

  // Keep latest visibility readable inside the once-built crosshair handler.
  const visibleRef = useRef(visible);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  // ── Apply a preset range to the visible window (no rebuild) ──
  const applyRange = useCallback((r: Range) => {
    const chart = chartRef.current;
    if (!chart || !model.lastTime) return;
    if (r === 'all') { chart.timeScale().fitContent(); return; }
    const last = new Date(model.lastTime + 'T00:00:00');
    const from = new Date(last);
    from.setFullYear(from.getFullYear() - (r === '1y' ? 1 : 3));
    try {
      chart.timeScale().setVisibleRange({ from: from.toISOString().slice(0, 10) as Time, to: model.lastTime as Time });
    } catch { chart.timeScale().fitContent(); }
  }, [model]);

  // ── Build the chart once per data model ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el || model.priceData.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight || 220,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8A97A8',
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: { vertLines: { color: '#F0F4F8' }, horzLines: { color: '#F0F4F8' } },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: 'rgba(74,85,104,.6)', width: 1, style: 2, labelBackgroundColor: '#1A3A6E' },
        horzLine: { color: 'rgba(74,85,104,.6)', width: 1, style: 2, labelBackgroundColor: '#1A3A6E' },
      },
      rightPriceScale: { borderColor: '#E2E8F0', textColor: '#8A97A8' },
      timeScale: { borderColor: '#E2E8F0', timeVisible: false, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false },
    });
    chartRef.current = chart;

    const area = chart.addAreaSeries({
      lineColor: '#1E5CB3', lineWidth: 2,
      topColor: 'rgba(30,92,179,0.10)', bottomColor: 'rgba(30,92,179,0.0)',
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: true,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    area.setData(model.priceData);
    area.setMarkers(visibleMarkers(model.markersAll, visibleRef.current));
    areaRef.current = area;

    // Initial visible range is applied by the dedicated range effect below.

    // ── Combined tooltip: every event on the hovered day, plus the price ──
    chart.subscribeCrosshairMove((param) => {
      const tip = tipRef.current;
      if (!tip) return;
      const w = el.clientWidth, h = el.clientHeight;
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0 || param.point.x > w || param.point.y > h) {
        tip.style.display = 'none';
        return;
      }
      const key = String(param.time);
      const price = model.priceByTime.get(key);
      if (price == null) { tip.style.display = 'none'; return; }

      const v = visibleRef.current;
      const ev = model.eventsByTime.get(key);
      const insiders = ev ? ev.insiders.filter((t) =>
        t.type === 'Purchase' ? v.buy : t.type === 'Sale' ? v.sell : v.other) : [];
      const analysts = ev && v.analyst ? ev.analysts : [];

      let html = `<div class="smart-tip-date">${fmtDate(key)}</div>`
        + `<div class="smart-tip-price">$${price.toFixed(2)}</div>`;

      for (const t of insiders) {
        const s = INSIDER_STYLE[t.type];
        const glyph = t.type === 'Purchase' ? '▲' : t.type === 'Sale' ? '▼' : '●';
        const shares = (t.shares ?? 0).toLocaleString();
        html += `<div class="smart-tip-row"><span style="color:${s.dot}">${glyph}</span> `
          + `<b>${s.label}</b> · ${escapeHtml(t.insider)}`
          + `<span class="smart-tip-meta">${shares} sh${fmtValue(t.value)}</span></div>`;
      }
      for (const a of analysts) {
        const cls = classifyAction(a.action);
        const gc = gradeColor(a.to_grade);
        const change = a.from_grade && a.from_grade !== a.to_grade
          ? `${escapeHtml(a.from_grade)} → <span style="color:${gc}">${escapeHtml(a.to_grade)}</span>`
          : `<span style="color:${gc}">${escapeHtml(a.to_grade)}</span>`;
        html += `<div class="smart-tip-row"><span style="color:${gc}">■</span> `
          + `<b>${cls.label}</b> · ${escapeHtml(a.firm)}`
          + `<span class="smart-tip-meta">${change}</span></div>`;
      }

      tip.innerHTML = html;
      tip.style.display = 'block';
      // Position near the cursor, flipping/clamping to stay inside the pane.
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = param.point.x + 14;
      if (left + tw > w) left = param.point.x - tw - 14;
      if (left < 0) left = 4;
      let top = param.point.y + 14;
      if (top + th > h) top = Math.max(4, h - th - 4);
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    });

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight || 220 });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      areaRef.current = null;
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch { /* ignore */ }
        chartRef.current = null;
      }
    };
  }, [model]);

  // ── React to preset-range changes without rebuilding ──
  useEffect(() => { applyRange(range); }, [range, applyRange]);

  // ── React to series-visibility toggles without rebuilding ──
  useEffect(() => {
    areaRef.current?.setMarkers(visibleMarkers(model.markersAll, visible));
  }, [visible, model]);

  if (model.priceData.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        No price data available.
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div ref={tipRef} className="smart-chart-tip" style={{ display: 'none' }} />
    </>
  );
}

/* ── Bottom legend (clickable, toggles event series) ─────────── */

function LegendChip({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
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
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '6px 0 2px', flexWrap: 'wrap' }}>
      <LegendChip active={visible.buy} onClick={() => toggle('buy')} icon={
        <span style={{ color: '#006400', fontSize: 11 }}>▲</span>
      }>Insider Buy</LegendChip>
      <LegendChip active={visible.sell} onClick={() => toggle('sell')} icon={
        <span style={{ color: '#B22222', fontSize: 11 }}>▼</span>
      }>Insider Sell</LegendChip>
      <LegendChip active={visible.other} onClick={() => toggle('other')} icon={
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2E7DE8' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8A97A8' }} />
        </span>
      }>Award / Other</LegendChip>
      <LegendChip active={visible.analyst} onClick={() => toggle('analyst')} icon={
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <span style={{ width: 7, height: 7, background: '#228B22' }} />
          <span style={{ width: 7, height: 7, background: '#D4A017' }} />
          <span style={{ width: 7, height: 7, background: '#B22222' }} />
        </span>
      }>Analyst Event</LegendChip>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export function SmartMoneyActivity({ insiderTransactions, analystUpgradesDowngrades, priceBars }: Props) {
  const [range, setRange] = useState<Range>('1y');
  const [visible, setVisible] = useState<Visibility>({ buy: true, sell: true, other: true, analyst: true });
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
            Hover any point on the chart to see what happened that day. Drag to pan,
            scroll to zoom. Insider buying can signal confidence; selling has many
            causes. Information, not advice.
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
              <SmartMoneyChart priceBars={bars} txs={txs} upgrades={upgrades} range={range} visible={visible} />
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
