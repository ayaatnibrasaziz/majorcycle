'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FolderSearch, Loader2, SearchX } from 'lucide-react';

import { useAnalysis } from '@/lib/analysis';
import { horizonQueryFromRequest } from '@/lib/horizon';
import { downloadCsv, toCsv } from '@/lib/ratings';
import { downloadXlsx } from '@/lib/xlsx';
import type { Market, OverallLabel, SkippedStatus } from '@/lib/types';

import { InterruptedRunNotice } from '@/components/run/InterruptedRunNotice';

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
  onlyTier,
  sortRows,
  toggleTier,
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
  const { results, unavailable, params, runMeta, progress } = useAnalysis();

  const rows = useMemo(() => buildRows(results, lookup), [results, lookup]);

  // The horizon this run used, as a `?…` suffix for every detail-page link on
  // this surface — so opening a stock lands on the SAME Major Cycle window that
  // produced its row, not the page's Medium default.
  const horizonQuery = horizonQueryFromRequest(params);

  // Live status for the "couldn't be scored" tickers (in listings? covered?
  // already requested?) so the strip shows the right state up front. One batch
  // call when the unavailable set changes; setState only runs after the await.
  const [skippedStatus, setSkippedStatus] = useState<Record<string, SkippedStatus>>({});
  const unavailableKey = unavailable.join(',');
  useEffect(() => {
    if (unavailable.length === 0) return;
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/listings/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: unavailable }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { statuses?: Record<string, SkippedStatus> };
        setSkippedStatus(json.statuses ?? {});
      } catch {
        // aborted or non-fatal — strip falls back to a neutral state
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unavailableKey]);

  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Scroll target for the briefing's count pills — applying a quick filter from up
  // in the briefing should bring the (often below-the-fold) results table into view.
  const tableRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('analyst');
  const [sortKey, setSortKey] = useState('overall');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => applyFilters(rows, filter), [rows, filter]);
  // The map follows every filter EXCEPT the tier list, which it draws as its legend:
  // a tier switched off must still have a chip to switch it back on.
  const mapRows = useMemo(() => applyFilters(rows, { ...filter, hiddenTiers: [] }), [rows, filter]);
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
    setFilter((f) => ({ ...onlyTier(f, label), quick: 'all' }));

  const onToggleTier = (label: OverallLabel) => setFilter((f) => toggleTier(f, label));

  const onQuickFilter = (q: QuickFilter) => {
    setFilter((f) => ({ ...f, quick: f.quick === q ? 'all' : q, hiddenTiers: [] }));
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onAdvancedRules = (advRules: AdvRule[]) => patch({ rules: advRules });

  // Every download used to be called `majorcycle_results`, so a second screen saved
  // over (or beside, as "(1)") the first. The run's date and horizon tell them apart.
  const fileName = exportFileName(runMeta?.startedAt ?? null, params?.preset ?? null);
  const onExport = () => downloadCsv(`${fileName}.csv`, toCsv(sorted, CSV_COLUMNS));
  const onExportXlsx = () => {
    void downloadXlsx(`${fileName}.xlsx`, sorted, CSV_COLUMNS);
  };

  // ── Empty: no usable results ───────────────────────────────────────────────
  if (rows.length === 0) {
    const ran = runMeta != null || results.length > 0;
    return (
      <div>
        <InterruptedRunNotice showRunLink />
        {unavailable.length > 0 && (
          <SkippedTickers unavailable={unavailable} lookup={lookup} statusMap={skippedStatus} horizonQuery={horizonQuery} />
        )}
        <div className="results-empty">
          {progress.running ? (
            // ⚠️ This branch used to be reachable only as "finished": mid-run, before the
            // first batch came back, the page said "Your run finished — none scored"
            // about a run that was still going (beta review C-6).
            <>
              <Loader2 className="results-empty-icon animate-spin motion-reduce:animate-none" />
              <div className="results-empty-title">Your analysis is still running</div>
              <div className="results-empty-text">
                Results appear here as each batch comes back. You can follow it on the{' '}
                <Link href="/run" className="results-empty-link">
                  Run Analysis
                </Link>{' '}
                tab.
              </div>
            </>
          ) : ran ? (
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
      <InterruptedRunNotice showRunLink />
      {progress.running && (
        <div className="results-running" role="status">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Still running: {rows.length} of {runMeta?.tickerCount ?? rows.length} stocks scored so far. The
          table and map fill in as more come back.
        </div>
      )}
      <BriefingCard rows={rows} onQuickFilter={onQuickFilter} horizonQuery={horizonQuery} />
      <ProvenanceBar params={params} runMeta={runMeta} tickerCount={rows.length} />
      {unavailable.length > 0 && (
        <SkippedTickers unavailable={unavailable} lookup={lookup} statusMap={skippedStatus} horizonQuery={horizonQuery} />
      )}
      <OpportunityMap
        rows={mapRows}
        totalCount={rows.length}
        hiddenTiers={filter.hiddenTiers}
        onToggleTier={onToggleTier}
        horizonQuery={horizonQuery}
      />

      <div ref={tableRef} style={{ scrollMarginTop: 16 }}>
      <ResultsToolbar
        filter={filter}
        patch={patch}
        setFilter={setFilter}
        viewMode={viewMode}
        onViewMode={setViewMode}
        advancedOpen={advancedOpen}
        onToggleAdvanced={() => setAdvancedOpen((o) => !o)}
        resultCount={sorted.length}
        onExport={onExport}
        onExportXlsx={onExportXlsx}
        sortKey={sortKey}
        sortAsc={sortAsc}
        onSortKey={(key) => {
          // The same default as a desktop header click on a new column.
          setSortKey(key);
          setSortAsc(FIELD_BY_KEY[key]?.type === 'text');
        }}
        onSortDir={() => setSortAsc((a) => !a)}
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
          horizonQuery={horizonQuery}
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
    </div>
  );
}

/** `majorcycle_results_2026-10-02_medium` — the run's own date and horizon. */
function exportFileName(startedAt: string | null, preset: string | null): string {
  const d = startedAt ? new Date(startedAt) : new Date();
  const day = Number.isNaN(d.getTime())
    ? ''
    : `_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `majorcycle_results${day}${preset ? `_${preset}` : ''}`;
}
