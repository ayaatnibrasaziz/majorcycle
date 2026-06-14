'use client';

import { X } from 'lucide-react';

import { tickerToUrlParts } from '@/lib/ticker';

// The shared selection list — every source (baskets, search, CSV) feeds this.
// Showing exactly what will run (live count + per-chip remove) gives the user
// transparency and control before they commit to a run.

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
      <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-stripe)] px-4 py-5 text-center text-[12px] text-[var(--text-muted)]">
        No stocks selected yet. Pick a basket, search and add, or import a CSV
        above to build your list.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
          <span className="font-[var(--font-mono)] text-[var(--text-primary)]">
            {tickers.length}
          </span>{' '}
          selected
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-bright)]"
        >
          Clear all
        </button>
      </div>
      <div className="tk-tray">
        {tickers.map((t) => (
          <span key={t} className="tk-chip">
            {tickerToUrlParts(t).symbol}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => onRemove(t)}
              className="tk-chip-x"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
