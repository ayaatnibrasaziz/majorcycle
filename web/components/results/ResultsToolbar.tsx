'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Search, SlidersHorizontal } from 'lucide-react';

import { OVERALL_LABELS } from '@/lib/ratings';
import type { OverallLabel } from '@/lib/types';
import { VIEW_MODE_LABELS, type ViewMode } from './columns';
import type { FilterState } from './filters';

// Toolbar above the results table: search, tier + min-rating filters, a
// "Constructive or better" quick chip, the Advanced-filters toggle, the
// Simple/Analyst/Full view switch (reference parity), an Export dropdown and the
// live result count.

const MIN_RATING_OPTIONS = [
  { value: 0, label: 'Min Rating: Any' },
  { value: 50, label: 'Min Rating: 50+' },
  { value: 65, label: 'Min Rating: 65+' },
  { value: 80, label: 'Min Rating: 80+' },
];

const VIEW_ORDER: ViewMode[] = ['simple', 'analyst', 'full'];

export function ResultsToolbar({
  filter,
  patch,
  viewMode,
  onViewMode,
  advancedOpen,
  onToggleAdvanced,
  resultCount,
  onExport,
}: {
  filter: FilterState;
  patch: (p: Partial<FilterState>) => void;
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  resultCount: number;
  onExport: () => void;
}) {
  return (
    <div className="results-toolbar">
      <div className="search-box">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search ticker or company…"
          value={filter.query}
          onChange={(e) => patch({ query: e.target.value })}
          aria-label="Search results"
        />
      </div>

      <select
        className="filter-select"
        value={filter.tier}
        onChange={(e) => patch({ tier: e.target.value as OverallLabel | '' })}
        aria-label="Filter by rating tier"
      >
        <option value="">All Tiers</option>
        {OVERALL_LABELS.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>

      <select
        className="filter-select"
        value={filter.minRating}
        onChange={(e) => patch({ minRating: Number(e.target.value) })}
        aria-label="Minimum overall rating"
      >
        {MIN_RATING_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={`quick-chip${filter.quick === 'constructivePlus' ? ' active' : ''}`}
        onClick={() =>
          patch({ quick: filter.quick === 'constructivePlus' ? 'all' : 'constructivePlus' })
        }
      >
        Constructive or better
      </button>

      <button
        type="button"
        className={`quick-chip quick-chip--adv${advancedOpen ? ' active' : ''}`}
        onClick={onToggleAdvanced}
      >
        <SlidersHorizontal className="mr-1 inline h-3 w-3 align-[-1px]" />
        Advanced
      </button>

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

      <ExportMenu onExport={onExport} />

      <div className="result-count">
        {resultCount} result{resultCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}

function ExportMenu({ onExport }: { onExport: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  return (
    <div className={`export-wrap${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="export-btn export-trigger" onClick={() => setOpen((o) => !o)}>
        <Download className="h-3.5 w-3.5" />
        Export
        <ChevronDown className="ex-caret h-3 w-3" />
      </button>
      <div className="export-menu">
        <button
          type="button"
          className="export-opt"
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
        <div className="export-opt soon" aria-disabled="true">
          <FileSpreadsheet />
          <div>
            <div className="eo-title">
              Download Excel<span className="eo-tag">SOON</span>
            </div>
            <div className="eo-sub">Colour-coded report with styled rating cells</div>
          </div>
        </div>
      </div>
    </div>
  );
}
