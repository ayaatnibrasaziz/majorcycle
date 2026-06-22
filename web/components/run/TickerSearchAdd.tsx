'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import type { Market } from '@/lib/types';
import { marketLabel, tickerToUrlParts } from '@/lib/ticker';
import { cn } from '@/lib/utils';

// "Search & add" — type a ticker or company name, pick from autocomplete to add
// it to the selection. Backed by /api/search over the light universe index.

interface SearchHit {
  ticker: string;
  name: string | null;
  market: Market;
}

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
  // Index of the keyboard-highlighted option (-1 = none). Drives the combobox
  // arrow-key navigation + aria-activedescendant.
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const LISTBOX_ID = 'run-search-listbox';
  const optionId = (i: number) => `run-search-opt-${i}`;
  const listOpen = open && hits.length > 0;

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
        setActiveIndex(-1);
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
    setActiveIndex(-1);
    setOpen(false);
  };

  // Combobox keyboard navigation: ↓/↑ move the highlight, Enter adds the
  // highlighted hit, Esc closes the list. Mouse/touch still work unchanged.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!listOpen) {
      if (e.key === 'ArrowDown' && hits.length > 0) {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? hits.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      const h = hits[activeIndex];
      if (h && !selected.has(h.ticker)) {
        e.preventDefault();
        add(h.ticker);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
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
              setActiveIndex(-1);
              setOpen(false);
            }
          }}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search ticker or company…"
          aria-label="Search by ticker or company name"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={
            listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          className="run-search-input"
        />
      </div>

      {listOpen && (
        <ul className="run-search-menu" role="listbox" id={LISTBOX_ID}>
          {hits.map((h, i) => {
            const already = selected.has(h.ticker);
            return (
              <li key={h.ticker} role="option" id={optionId(i)} aria-selected={i === activeIndex}>
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={already}
                  onClick={() => add(h.ticker)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={already ? 'run-search-opt' : cn('run-search-opt', i === activeIndex && 'run-search-opt--active')}
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
                    {already ? 'Added' : marketLabel(h.market)}
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
