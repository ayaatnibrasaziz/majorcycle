'use client';

import { X } from 'lucide-react';

import { tickerToUrlParts } from '@/lib/ticker';

// The shared selection list — every source (baskets, search, CSV) feeds this.
// Showing exactly what will run (with a live count + per-chip remove) gives the
// user transparency and control before they commit to a run.

export function SelectedTickers({
  tickers,
  onRemove,
  onClear,
}: {
  tickers: string[];
  onRemove: (ticker: string) => void;
  onClear: () => void;
}) {
  if (tickers.length === 0) {
    return (
      <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-stripe)] px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
        No stocks selected yet. Pick a basket, search and add, or import a CSV
        above to build your list.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
          {tickers.length} selected
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-semibold text-[var(--brand-mid)] underline hover:text-[var(--brand-bright)]"
        >
          Clear all
        </button>
      </div>
      <div className="flex max-h-[180px] flex-wrap gap-1.5 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-stripe)] p-2.5">
        {tickers.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] py-1 pl-2 pr-1 font-mono text-[11px] text-[var(--text-primary)]"
          >
            {tickerToUrlParts(t).symbol}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => onRemove(t)}
              className="rounded-sm p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-stripe)] hover:text-[var(--c-tier-5)]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
