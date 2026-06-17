'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FolderSearch, SearchX } from 'lucide-react';

import { useAnalysis } from '@/lib/analysis';
import { downloadCsv, toCsv } from '@/lib/ratings';
import type { Market, OverallLabel } from '@/lib/types';

import { BriefingCard } from './BriefingCard';
import { ProvenanceBar } from './ProvenanceBar';
import { OpportunityMap } from './OpportunityMap';
import { ResultsToolbar } from './ResultsToolbar';
import { AdvancedFilters } from './AdvancedFilters';
import { ResultsTable } from './ResultsTable';
import { SkippedTickers } from './SkippedTickers';
import { CSV_COLUMNS, FIELD_BY_KEY, buildRows, type ViewMode } from './columns';
import {
  INITIAL_FILTER,
  applyFilters,
  sortRows,
  type AdvRule,
  type FilterState,
  type QuickFilter,
} from './filters';

export type ResultsLookup = Record<string, { name: string | null; sector: string | null; market: Market }>;

// Results orchestrator. Reads the SAME in-memory results as the Run tab via
// useAnalysis() (which itself hydrates from the sessionStorage snapshot), so
// navigating Run → Results and back, or a soft reload, keeps the run with no
// recompute. Ratings are DERIVED here from those results — never read from or
// written to the DB (CLAUDE.md #15). `lookup` (company name / sector / market)
// comes from the cached light universe index, passed by the server page.

export function Results({ lookup }: { lookup: ResultsLookup }) {
  const { results, unavailable, params, runMeta } = useAnalysis();

  const rows = useMemo(() => buildRows(results, lookup), [results, lookup]);

  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('analyst');
  const [sortKey, setSortKey] = useState('overall');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => applyFilters(rows, filter), [rows, filter]);
  const sorted = useMemo(() => sortRows(filtered, sortKey, sortAsc), [filtered, sortKey, sortAsc]);

  const patch = (p: Partial<FilterState>) => setFilter((f) => ({ ...f, ...p }));
  const clearFilters = () => setFilter(INITIAL_FILTER);

  const onSort = (key: string) => {
    if (key === sortKey) {
      setSortAsc((a) => !a);
    } else {
      setSortKey(key);
      // Text columns read better ascending; scores/numbers best-first (desc).
      setSortAsc(FIELD_BY_KEY[key]?.type === 'text');
    }
  };

  const onTierFilter = (label: OverallLabel) =>
    setFilter((f) => ({ ...f, tier: f.tier === label ? '' : label, quick: 'all' }));

  const onQuickFilter = (q: QuickFilter) =>
    setFilter((f) => ({ ...f, quick: f.quick === q ? 'all' : q, tier: '' }));

  const onAdvancedRules = (advRules: AdvRule[]) => patch({ rules: advRules });

  const onExport = () => downloadCsv('majorcycle_results.csv', toCsv(sorted, CSV_COLUMNS));

  // ── Empty: no usable results ───────────────────────────────────────────────
  if (rows.length === 0) {
    const ran = runMeta != null || results.length > 0;
    return (
      <div>
        {unavailable.length > 0 && <SkippedTickers unavailable={unavailable} lookup={lookup} />}
        <div className="results-empty">
          {ran ? (
            <>
              <SearchX className="results-empty-icon" />
              <div className="results-empty-title">No stocks could be scored</div>
              <div className="results-empty-text">
                Your run finished, but none of the selected tickers produced a Major Cycle reading.
                See the skipped list above, then{' '}
                <Link href="/run" className="results-empty-link">
                  run a new analysis
                </Link>
                .
              </div>
            </>
          ) : (
            <>
              <FolderSearch className="results-empty-icon" />
              <div className="results-empty-title">No analysis run yet</div>
              <div className="results-empty-text">
                Pick some stocks in the{' '}
                <Link href="/run" className="results-empty-link">
                  Run Analysis
                </Link>{' '}
                tab and your ranked results will appear here.
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Populated ──────────────────────────────────────────────────────────────
  return (
    <div className="results-layout">
      <h1 className="sr-only">Analysis Results</h1>
      <BriefingCard rows={rows} onQuickFilter={onQuickFilter} />
      <ProvenanceBar params={params} runMeta={runMeta} tickerCount={rows.length} />
      {unavailable.length > 0 && <SkippedTickers unavailable={unavailable} lookup={lookup} />}
      <OpportunityMap rows={rows} />

      <ResultsToolbar
        filter={filter}
        patch={patch}
        viewMode={viewMode}
        onViewMode={setViewMode}
        advancedOpen={advancedOpen}
        onToggleAdvanced={() => setAdvancedOpen((o) => !o)}
        resultCount={sorted.length}
        onExport={onExport}
      />

      {advancedOpen && (
        <AdvancedFilters rows={rows} rules={filter.rules} onChange={onAdvancedRules} />
      )}

      {sorted.length > 0 ? (
        <ResultsTable
          rows={sorted}
          viewMode={viewMode}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={onSort}
          onTierFilter={onTierFilter}
        />
      ) : (
        <div className="results-empty">
          <SearchX className="results-empty-icon" />
          <div className="results-empty-title">No stocks match your filters</div>
          <div className="results-empty-text">
            Your analysis ran successfully, but nothing matches the current search or filters. Try
            widening them or{' '}
            <button type="button" className="results-empty-link" onClick={clearFilters}>
              clear all filters
            </button>
            .
          </div>
        </div>
      )}
    </div>
  );
}
