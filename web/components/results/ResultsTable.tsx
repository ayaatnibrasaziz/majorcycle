'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  ZONE_DISPLAY,
  cyclePositionColor,
  ratingComposition,
  scoreColor,
  tierFromLabel,
  zoneColor,
} from '@/lib/ratings';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import type { OverallLabel } from '@/lib/types';
import {
  BAND_META,
  BAND_ORDER,
  columnsForBand,
  formatValue,
  type BandKey,
  type Field,
  type ResultRow,
} from './columns';

// The ranked results table. Desktop renders a banded, sortable table; below `md`
// it collapses to stacked cards (no horizontal scroll at 375px). A row click opens
// that stock's detail page; the Overall tier badge is clickable and filters the
// table by that tier instead of navigating.

function healthDescriptor(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Adequate';
  return 'At Risk';
}

function tipTitle(tip?: string): string | undefined {
  return tip ? tip.replace('|', ' — ') : undefined;
}

export function ResultsTable({
  rows,
  visibleBands,
  sortKey,
  sortAsc,
  onSort,
  onTierFilter,
}: {
  rows: ResultRow[];
  visibleBands: Set<BandKey>;
  sortKey: string;
  sortAsc: boolean;
  onSort: (key: string) => void;
  onTierFilter: (label: OverallLabel) => void;
}) {
  const router = useRouter();
  const bands = BAND_ORDER.filter((b) => visibleBands.has(b));
  const columns: Field[] = bands.flatMap((b) => columnsForBand(b));

  const open = (ticker: string) => router.push(tickerToPath(ticker));

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="results-table-wrap hidden md:block">
        <table className="results-table">
          <thead>
            <tr>
              {bands.map((b) => {
                const cols = columnsForBand(b);
                return (
                  <th
                    key={b}
                    className={`band ${BAND_META[b].cssClass}`}
                    colSpan={cols.length}
                    title={tipTitle(BAND_META[b].tip)}
                  >
                    {BAND_META[b].label}
                  </th>
                );
              })}
            </tr>
            <tr>
              {columns.map((col) => {
                const active = col.key === sortKey;
                const arrow = active ? (sortAsc ? '↑' : '↓') : '↕';
                return (
                  <th
                    key={col.key}
                    className={`${active ? 'sorted' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                    title={tipTitle(col.tip)}
                    onClick={() => onSort(col.key)}
                  >
                    {col.label} <span className="sort-arrow">{arrow}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.ticker}
                className={i % 2 === 1 ? 'stripe' : ''}
                onClick={() => open(r.ticker)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                    {renderCell(col, r, onTierFilter)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="results-cards flex flex-col gap-2.5 md:hidden">
        {rows.map((r) => (
          <ResultCard key={r.ticker} row={r} onOpen={() => open(r.ticker)} onTierFilter={onTierFilter} />
        ))}
      </div>
    </>
  );
}

// ── Cell renderers ────────────────────────────────────────────────────────────

function renderCell(col: Field, r: ResultRow, onTierFilter: (label: OverallLabel) => void): ReactNode {
  switch (col.cell) {
    case 'ticker':
      return <span className="ticker-cell">{tickerToUrlParts(r.ticker).symbol}</span>;
    case 'overall':
      return <OverallCell row={r} onTierFilter={onTierFilter} />;
    case 'valuation':
      return (
        <span className="score-cell">
          <ScoreNum value={r.valuationScore} />
          <span className="score-tag" style={{ color: zoneColor(r.valuationZone) }}>
            {ZONE_DISPLAY[r.valuationZone]}
          </span>
        </span>
      );
    case 'health':
      return r.financialHealthScore == null ? (
        <span className="text-[var(--text-muted)]">—</span>
      ) : (
        <span className="score-cell">
          <ScoreNum value={r.financialHealthScore} />
          <span className="score-tag" style={{ color: scoreColor(r.financialHealthScore) }}>
            {healthDescriptor(r.financialHealthScore)}
          </span>
        </span>
      );
    case 'cyclePos':
      return <CyclePosCell pos={r.cyclePos} />;
    default: {
      const raw = col.get(r);
      const text = formatValue(raw, col.fmt);
      if (col.fmt === 'score' && typeof raw === 'number') {
        return (
          <span className="score-num score-num--ghost" style={{ color: scoreColor(raw) }}>
            {text}
          </span>
        );
      }
      return text;
    }
  }
}

function ScoreNum({ value }: { value: number }) {
  return (
    <span className="score-num" style={{ background: scoreColor(value) }}>
      {Math.round(value)}
    </span>
  );
}

function OverallCell({ row, onTierFilter }: { row: ResultRow; onTierFilter: (label: OverallLabel) => void }) {
  const comp = ratingComposition(row);
  const total = comp.health + comp.valuation + comp.payoff || 1;
  const wH = (comp.health / total) * 100;
  const wV = (comp.valuation / total) * 100;
  const wP = (comp.payoff / total) * 100;
  const tier = tierFromLabel(row.overallLabel);
  return (
    <div className="score-stack">
      <div className="score-row">
        <ScoreNum value={row.overallRating} />
        <button
          type="button"
          className={`tier-badge tier-badge--${tier}`}
          title={`Filter to ${row.overallLabel}`}
          onClick={(e) => {
            e.stopPropagation();
            onTierFilter(row.overallLabel);
          }}
        >
          {row.overallLabel}
        </button>
      </div>
      <div
        className="micro-bar"
        title={`Composition: Health ${Math.round(comp.health)} (40%) + Valuation ${Math.round(comp.valuation)} (35%) + Cycle Payoff ${Math.round(comp.payoff)} (25%)`}
      >
        <div className="micro-seg" style={{ width: `${wH}%`, background: 'var(--brand-deep)' }} />
        <div className="micro-seg" style={{ width: `${wV}%`, background: 'var(--brand-mid)' }} />
        <div className="micro-seg" style={{ width: `${wP}%`, background: 'var(--brand-bright)' }} />
      </div>
    </div>
  );
}

function CyclePosCell({ pos }: { pos: number | null }) {
  if (pos == null) return <span className="text-[var(--text-muted)]">—</span>;
  const col = cyclePositionColor(pos);
  return (
    <div className="cyc-wrap">
      <div className="cyc-track">
        <div className="cyc-marker" style={{ left: `${pos.toFixed(0)}%`, background: col }} />
      </div>
      <span className="cyc-pct" style={{ color: col }}>
        {pos.toFixed(0)}
      </span>
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function ResultCard({
  row,
  onOpen,
  onTierFilter,
}: {
  row: ResultRow;
  onOpen: () => void;
  onTierFilter: (label: OverallLabel) => void;
}) {
  const { symbol } = tickerToUrlParts(row.ticker);
  const tier = tierFromLabel(row.overallLabel);
  return (
    <button type="button" className="result-card" onClick={onOpen}>
      <div className="result-card-head">
        <div className="min-w-0">
          <div className="result-card-ticker">{symbol}</div>
          {row.name && <div className="result-card-name">{row.name}</div>}
        </div>
        <div className="flex items-center gap-2">
          <ScoreNum value={row.overallRating} />
          <span
            role="button"
            tabIndex={0}
            className={`tier-badge tier-badge--${tier}`}
            onClick={(e) => {
              e.stopPropagation();
              onTierFilter(row.overallLabel);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onTierFilter(row.overallLabel);
              }
            }}
          >
            {row.overallLabel}
          </span>
        </div>
      </div>
      <div className="result-card-stats">
        <CardStat label="Valuation" value={ZONE_DISPLAY[row.valuationZone]} color={zoneColor(row.valuationZone)} />
        <CardStat
          label="Health"
          value={row.financialHealthScore == null ? '—' : String(Math.round(row.financialHealthScore))}
          color={scoreColor(row.financialHealthScore)}
        />
        <CardStat
          label="Cycle Pos"
          value={row.cyclePos == null ? '—' : String(Math.round(row.cyclePos))}
          color={cyclePositionColor(row.cyclePos)}
        />
        <CardStat label="Close" value={formatValue(row.currentClose, 'money')} />
      </div>
    </button>
  );
}

function CardStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="result-card-stat">
      <div className="result-card-stat-label">{label}</div>
      <div className="result-card-stat-val" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
