'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { InfoTip } from '@/components/ui/InfoTip';
import {
  compositionRamp,
  cyclePositionColor,
  fmtAnalyst,
  healthColor,
  healthRatingLabel,
  metricTintColor,
  ratingComposition,
  scoreColor,
  tierFromLabel,
  valuationAppealLabel,
} from '@/lib/ratings';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import type { OverallLabel } from '@/lib/types';
import {
  BAND_META,
  VIEW_MODES,
  columnsForBand,
  formatValue,
  type Field,
  type ResultRow,
  type ViewMode,
} from './columns';

// The ranked results table. Desktop renders a banded, sortable table driven by the
// active view mode (Simple / Analyst / Full); below `md` it collapses to stacked
// cards (no horizontal scroll at 375px). A row click opens that stock's detail
// page; the Overall tier badge is clickable and filters by that tier instead of
// navigating. Labels are our compliant tiers/zones — only the Analyst column shows
// the Wall-Street consensus verbatim (third-party, CLAUDE.md #17).

function tipTitle(tip?: string): string | undefined {
  return tip ? tip.replace('|', ' — ') : undefined;
}

/** Split a "Title|body" tip string into its parts for an InfoTip. */
function tipParts(tip: string): { title: string; body: string } {
  const i = tip.indexOf('|');
  return i === -1 ? { title: tip, body: tip } : { title: tip.slice(0, i), body: tip.slice(i + 1) };
}

export function ResultsTable({
  rows,
  viewMode,
  sortKey,
  sortAsc,
  onSort,
  onTierFilter,
}: {
  rows: ResultRow[];
  viewMode: ViewMode;
  sortKey: string;
  sortAsc: boolean;
  onSort: (key: string) => void;
  onTierFilter: (label: OverallLabel) => void;
}) {
  const router = useRouter();
  const bands = VIEW_MODES[viewMode];
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
                const parts = col.tip ? tipParts(col.tip) : null;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`${active ? 'sorted' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                    aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                    tabIndex={0}
                    onClick={() => onSort(col.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSort(col.key);
                      }
                    }}
                  >
                    {col.label}
                    {parts && (
                      <span
                        className="th-info"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <InfoTip title={parts.title}>{parts.body}</InfoTip>
                      </span>
                    )}{' '}
                    <span className="sort-arrow">{arrow}</span>
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
      // A real link gives keyboard users a focusable, announced way into the detail
      // page while the row's mouse onClick stays for convenience. stopPropagation
      // avoids a double navigation (link + row).
      return (
        <Link
          href={tickerToPath(r.ticker)}
          className="ticker-cell"
          onClick={(e) => e.stopPropagation()}
        >
          {tickerToUrlParts(r.ticker).symbol}
        </Link>
      );
    case 'overall':
      return <OverallCell row={r} onTierFilter={onTierFilter} />;
    case 'valuation':
      // The Valuation score is health-gated; its label (Compelling…Expensive) is
      // derived from the SAME score tier that colours it, so the number and word
      // always agree. The Deep Value…Stretched cycle-position zone lives on the
      // Cycle Position column instead (it's a pure cycle-position reading).
      return (
        <span className="score-cell">
          <ScoreNum value={r.valuationScore} />
          <span className="score-tag" style={{ color: scoreColor(r.valuationScore) }}>
            {valuationAppealLabel(r.valuationScore)}
          </span>
        </span>
      );
    case 'health':
      return r.financialHealthScore == null ? (
        <span className="text-[var(--text-muted)]">—</span>
      ) : (
        <span className="score-cell">
          <ScoreNum value={r.financialHealthScore} color={healthColor(r.financialHealthScore)} />
          <span className="score-tag" style={{ color: healthColor(r.financialHealthScore) }}>
            {healthRatingLabel(r.financialHealthScore)}
          </span>
        </span>
      );
    case 'cyclePos':
      return <CyclePosCell pos={r.cyclePos} />;
    case 'analyst':
      return <span className="analyst-cell">{fmtAnalyst((col.get(r) as string | null) ?? null)}</span>;
    default: {
      const raw = col.get(r);
      const text = formatValue(raw, col.fmt, col.cap);
      const color =
        col.tint && typeof raw === 'number' ? metricTintColor(col.tint, raw) : null;
      if (color) return <span style={{ color, fontWeight: 600 }}>{text}</span>;
      return text;
    }
  }
}

function ScoreNum({ value, color }: { value: number; color?: string }) {
  return (
    <span className="score-num" style={{ background: color ?? scoreColor(value) }}>
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
  const ramp = compositionRamp(row.overallRating);
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
        {row.financialHealthScore == null && (
          <span
            className="cycle-only-badge"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            Cycle-only
            <InfoTip title="Cycle-only rating">
              Financial Health data isn’t available for this stock, so this Overall reflects
              price cycle and valuation only — it isn’t directly comparable to fully-scored names,
              and it’s ranked below them.
            </InfoTip>
          </span>
        )}
      </div>
      <div
        className="micro-bar"
        title={`Composition: Health ${Math.round(comp.health)} (40%) + Valuation ${Math.round(comp.valuation)} (35%) + Cycle Payoff ${Math.round(comp.payoff)} (25%)`}
      >
        <div className="micro-seg" style={{ width: `${wH}%`, background: ramp[0] }} />
        <div className="micro-seg" style={{ width: `${wV}%`, background: ramp[1] }} />
        <div className="micro-seg" style={{ width: `${wP}%`, background: ramp[2] }} />
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
      {row.financialHealthScore == null && (
        <div className="result-card-cycleonly">Cycle-only rating — excludes Financial Health</div>
      )}
      <div className="result-card-stats">
        <CardStat label="Valuation" value={valuationAppealLabel(row.valuationScore)} color={scoreColor(row.valuationScore)} />
        <CardStat
          label="Health"
          value={row.financialHealthScore == null ? '—' : String(Math.round(row.financialHealthScore))}
          color={healthColor(row.financialHealthScore)}
        />
        <CardStat
          label="Cycle Pos"
          value={row.cyclePos == null ? '—' : String(Math.round(row.cyclePos))}
          color={cyclePositionColor(row.cyclePos)}
        />
        <CardStat label="Close" value={formatValue(row.currentClose, 'money2')} />
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
