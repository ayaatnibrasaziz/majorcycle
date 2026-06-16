'use client';

import { Download, Search, SlidersHorizontal } from 'lucide-react';

import { OVERALL_LABELS } from '@/lib/ratings';
import type { OverallLabel } from '@/lib/types';
import { BAND_META, BAND_ORDER, type BandKey } from './columns';
import type { FilterState } from './filters';

// Toolbar above the results table: search, tier + min-rating filters, a
// "Constructive or better" quick chip, the Advanced-filters toggle, column-group
// toggles, an Export button and the live result count.

const MIN_RATING_OPTIONS = [
  { value: 0, label: 'Min Rating: Any' },
  { value: 50, label: 'Min Rating: 50+' },
  { value: 65, label: 'Min Rating: 65+' },
  { value: 80, label: 'Min Rating: 80+' },
];

export function ResultsToolbar({
  filter,
  patch,
  visibleBands,
  onToggleBand,
  advancedOpen,
  onToggleAdvanced,
  resultCount,
  onExport,
}: {
  filter: FilterState;
  patch: (p: Partial<FilterState>) => void;
  visibleBands: Set<BandKey>;
  onToggleBand: (band: BandKey) => void;
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

      <div className="view-switch" role="group" aria-label="Toggle column groups">
        {BAND_ORDER.map((band) => (
          <button
            key={band}
            type="button"
            className={`vs-btn${visibleBands.has(band) ? ' active' : ''}`}
            onClick={() => onToggleBand(band)}
            aria-pressed={visibleBands.has(band)}
          >
            {BAND_META[band].label}
          </button>
        ))}
      </div>

      <button type="button" className="export-btn" onClick={onExport}>
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </button>

      <div className="result-count">
        {resultCount} result{resultCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}
