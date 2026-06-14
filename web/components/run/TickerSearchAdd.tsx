'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import type { Market } from '@/lib/types';

// "Search & add" — type a ticker or company name, pick from autocomplete to add
// it to the selection. Backed by /api/search over the light universe index.

interface SearchHit {
  ticker: string;
  name: string | null;
  market: Market;
}

const MARKET_BADGE: Record<Market, string> = { us: 'US', au: 'ASX', ca: 'TSX' };

export function TickerSearchAdd({
  selected,
  onAdd,
}: {
  selected: Set<string>;
  onAdd: (ticker: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search. The empty-query case is handled in onChange (an event
  // handler) so the effect never calls setState synchronously in its body.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { results?: SearchHit[] };
        setHits(json.results ?? []);
        setOpen(true);
      } catch {
        // Aborted or failed — leave previous hits.
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const add = (ticker: string) => {
    onAdd(ticker);
    setQuery('');
    setHits([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 focus-within:border-[var(--brand-bright)]">
        <Search className="h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (v.trim().length < 1) {
              setHits([]);
              setOpen(false);
            }
          }}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Search by ticker or company name…"
          className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </div>

      {open && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-[260px] w-full overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
          {hits.map((h) => {
            const already = selected.has(h.ticker);
            return (
              <li key={h.ticker}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => add(h.ticker)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[var(--bg-stripe)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)]">
                      {h.ticker}
                    </span>
                    <span className="truncate text-[12px] text-[var(--text-secondary)]">
                      {h.name ?? '—'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                    {already ? 'Added' : MARKET_BADGE[h.market]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
