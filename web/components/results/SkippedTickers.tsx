'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import Link from 'next/link';

import type { Market } from '@/lib/types';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';

// Compact, collapsible transparency for tickers the run couldn't score. Designed
// to stay a single line even when many are skipped (no stacked cards). Collapsed
// by default; expanding splits them into "no data yet" (in our coverage, history
// gap) vs "outside coverage" (unknown ticker), inferred from the universe index.
// With the run reconciliation pass, this is usually absent entirely.

export function SkippedTickers({
  unavailable,
  lookup,
}: {
  unavailable: string[];
  lookup: Record<string, { name: string | null; sector: string | null; market: Market }>;
}) {
  const [open, setOpen] = useState(false);
  if (unavailable.length === 0) return null;

  const known: string[] = [];
  const unknown: string[] = [];
  for (const t of unavailable) {
    if (lookup[t]) known.push(t);
    else unknown.push(t);
  }

  return (
    <div className={`skipped-strip${open ? ' is-open' : ''}`}>
      <button type="button" className="skipped-summary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--c-tier-3)]" />
        <span>
          {unavailable.length} ticker{unavailable.length === 1 ? '' : 's'} couldn’t be scored
        </span>
        <span className="skipped-toggle">
          {open ? 'hide' : 'show'} <ChevronDown className={`inline h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="skipped-detail">
          {known.length > 0 && (
            <SkippedGroup
              label="No data yet"
              note="in our coverage, history still building"
              tickers={known}
              linkable
            />
          )}
          {unknown.length > 0 && (
            <SkippedGroup
              label="Outside coverage"
              note="not yet in the MajorCycle universe"
              tickers={unknown}
              linkable={false}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SkippedGroup({
  label,
  note,
  tickers,
  linkable,
}: {
  label: string;
  note: string;
  tickers: string[];
  linkable: boolean;
}) {
  return (
    <div className="skipped-group">
      <span className="skipped-group-label">
        {label} <span className="skipped-group-note">({note})</span>:
      </span>{' '}
      {tickers.map((t, i) => {
        const { symbol } = tickerToUrlParts(t);
        return (
          <span key={t}>
            {linkable ? (
              <Link href={tickerToPath(t)} className="skipped-tk skipped-tk--link">
                {symbol}
              </Link>
            ) : (
              <span className="skipped-tk">{symbol}</span>
            )}
            {i < tickers.length - 1 ? ', ' : ''}
          </span>
        );
      })}
    </div>
  );
}
