'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Search, SlidersHorizontal } from 'lucide-react';

import { OVERALL_LABELS } from '@/lib/ratings';
import { marketLabel } from '@/lib/ticker';
import type { Market, OverallLabel } from '@/lib/types';
import { FIELD_BY_KEY, VIEW_MODES, VIEW_MODE_LABELS, columnsForBand, type ViewMode } from './columns';
import { onlyTier, shownTiers, type FilterState } from './filters';

// Toolbar above the results table: search, tier / market / min-rating filters, a
// "Constructive or better" quick chip, the Advanced-filters toggle, the
// Simple/Analyst/Full view switch (reference parity), an Export dropdown and the
// live result count — plus, on a phone only, a Sort control (the desktop table
// sorts from its column headers, and a phone card has none).

const MIN_RATING_OPTIONS = [
  { value: 0, label: 'Min Rating: Any' },
  { value: 50, label: 'Min Rating: 50+' },
  { value: 65, label: 'Min Rating: 65+' },
  { value: 80, label: 'Min Rating: 80+' },
];

const VIEW_ORDER: ViewMode[] = ['simple', 'analyst', 'full'];

const MIXED = '__mixed';

const MARKETS: Market[] = ['us', 'au', 'ca'];

export function ResultsToolbar({
  filter,
  patch,
  setFilter,
  viewMode,
  onViewMode,
  advancedOpen,
  onToggleAdvanced,
  resultCount,
  onExport,
  onExportXlsx,
  sortKey,
  sortAsc,
  onSortKey,
  onSortDir,
}: {
  filter: FilterState;
  patch: (p: Partial<FilterState>) => void;
  setFilter: (f: FilterState) => void;
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  resultCount: number;
  onExport: () => void;
  onExportXlsx: () => void;
  /** The phone's Sort control; the desktop table sorts from its column headers. */
  sortKey: string;
  sortAsc: boolean;
  onSortKey: (key: string) => void;
  onSortDir: () => void;
}) {
  // The dropdown names ONE tier or all of them. When the map's legend has switched off
  // some other mix, it says how many are showing, and choosing anything replaces it.
  const shown = shownTiers(filter);
  const tierValue =
    shown.length === OVERALL_LABELS.length ? '' : shown.length === 1 ? shown[0]! : MIXED;

  // The phone sorts by exactly the columns the desktop table shows in this view. A key
  // picked in a wider view stays listed, so the box never claims an order it isn't using.
  const sortFields = VIEW_MODES[viewMode].flatMap((b) => columnsForBand(b));
  const current = FIELD_BY_KEY[sortKey];
  if (current && !sortFields.some((f) => f.key === sortKey)) sortFields.unshift(current);
  const isText = current?.type === 'text';
  const dirLabel = isText ? (sortAsc ? 'A to Z' : 'Z to A') : sortAsc ? 'Low to high' : 'High to low';

  /*
   * ⚠️ ONE set of controls for every width (owner-approved design, 2026-10-02). On a
   * desktop this is the same single wrapping row it always was; below 768px the CSS
   * turns it into the two-column grid of the approved phone design and shows a label
   * above each box. The labels are real <label>s at every width (visually hidden on a
   * desktop), so each box is named by the words a phone reader sees. A second copy of
   * the controls per width would be two of every filter to keep in step (11c).
   */
  return (
    <div className="results-toolbar">
      <div className="search-box rt-search">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search ticker or company…"
          value={filter.query}
          onChange={(e) => patch({ query: e.target.value })}
          aria-label="Search results"
        />
      </div>

      <div className="rt-field">
        <label htmlFor="rt-tier" className="rt-label">
          Rating tier
        </label>
        <select
          id="rt-tier"
          className="filter-select"
          value={tierValue}
          onChange={(e) => setFilter(onlyTier(filter, e.target.value as OverallLabel | ''))}
        >
          <option value="">All Tiers</option>
          {tierValue === MIXED && (
            <option value={MIXED} disabled>
              {shown.length} of {OVERALL_LABELS.length} tiers
            </option>
          )}
          {OVERALL_LABELS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="rt-field">
        <label htmlFor="rt-market" className="rt-label">
          Market
        </label>
        <select
          id="rt-market"
          className="filter-select"
          value={filter.market}
          onChange={(e) => patch({ market: e.target.value as Market | '' })}
        >
          <option value="">All markets</option>
          {MARKETS.map((m) => (
            <option key={m} value={m}>
              {marketLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="rt-field">
        <label htmlFor="rt-min" className="rt-label">
          Min rating
        </label>
        <select
          id="rt-min"
          className="filter-select"
          value={filter.minRating}
          onChange={(e) => patch({ minRating: Number(e.target.value) })}
        >
          {MIN_RATING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rt-field rt-sort">
        <label htmlFor="rt-sort" className="rt-label">
          Sort by
        </label>
        <div className="rt-sort-row">
          <select
            id="rt-sort"
            className="filter-select"
            value={sortKey}
            onChange={(e) => onSortKey(e.target.value)}
          >
            {sortFields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <button type="button" className="filter-select rt-sort-dir" onClick={onSortDir}>
            <span aria-hidden="true">{sortAsc ? '↑' : '↓'}</span>
            <span className="sr-only">{dirLabel}</span>
          </button>
        </div>
      </div>

      <div className="rt-chips">
        <button
          type="button"
          className={`quick-chip${filter.quick === 'constructivePlus' ? ' active' : ''}`}
          aria-pressed={filter.quick === 'constructivePlus'}
          onClick={() =>
            patch({ quick: filter.quick === 'constructivePlus' ? 'all' : 'constructivePlus' })
          }
        >
          Constructive or better
        </button>

        <button
          type="button"
          className={`quick-chip quick-chip--adv${advancedOpen ? ' active' : ''}`}
          aria-pressed={advancedOpen}
          aria-expanded={advancedOpen}
          onClick={onToggleAdvanced}
        >
          <SlidersHorizontal className="mr-1 inline h-3 w-3 align-[-1px]" />
          Advanced
        </button>
      </div>

      <div className="rt-view">
        <span className="rt-label" aria-hidden="true">
          Detail level
        </span>
        <div className="view-switch" role="group" aria-label="Detail level">
          {VIEW_ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`vs-btn${viewMode === mode ? ' active' : ''}`}
              onClick={() => onViewMode(mode)}
              aria-pressed={viewMode === mode}
            >
              {VIEW_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <div className="rt-foot">
        <ExportMenu onExport={onExport} onExportXlsx={onExportXlsx} />

        <div className="result-count" role="status" aria-live="polite">
          {resultCount} result{resultCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}

function ExportMenu({ onExport, onExportXlsx }: { onExport: () => void; onExportXlsx: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`export-wrap${open ? ' open' : ''}`} ref={ref}>
      <button
        type="button"
        className="export-btn export-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Download className="h-3.5 w-3.5" />
        Export
        <ChevronDown className="ex-caret h-3 w-3" />
      </button>
      <div className="export-menu" role="menu">
        <button
          type="button"
          className="export-opt"
          role="menuitem"
          onClick={() => {
            onExport();
            setOpen(false);
          }}
        >
          <FileText />
          <div>
            <div className="eo-title">Download CSV</div>
            <div className="eo-sub">Raw results — opens in any spreadsheet app</div>
          </div>
        </button>
        <button
          type="button"
          className="export-opt"
          role="menuitem"
          onClick={() => {
            onExportXlsx();
            setOpen(false);
          }}
        >
          <FileSpreadsheet />
          <div>
            <div className="eo-title">Download Excel</div>
            <div className="eo-sub">Colour-coded report with styled rating cells</div>
          </div>
        </button>
      </div>
    </div>
  );
}
