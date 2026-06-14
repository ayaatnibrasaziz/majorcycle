'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import type { Market } from '@/lib/types';
import { tickerToUrlParts } from '@/lib/ticker';

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
      <div className="run-search-wrap">
        <Search className="h-[14px] w-[14px] flex-shrink-0 text-[var(--text-muted)]" strokeWidth={2} />
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
          placeholder="Search ticker or company…"
          aria-label="Search by ticker or company name"
          className="run-search-input"
        />
      </div>

      {open && hits.length > 0 && (
        <ul className="run-search-menu">
          {hits.map((h) => {
            const already = selected.has(h.ticker);
            return (
              <li key={h.ticker}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => add(h.ticker)}
                  className="run-search-opt"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-[var(--font-mono)] text-[12px] font-semibold text-[var(--text-primary)]">
                      {tickerToUrlParts(h.ticker).symbol}
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
