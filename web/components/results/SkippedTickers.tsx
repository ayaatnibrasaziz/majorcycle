'use client';

import { Link2Off } from 'lucide-react';

import type { Market } from '@/lib/types';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import Link from 'next/link';

// Transparency for tickers the user selected that couldn't be scored. The analyze
// function returns these in `unavailable` for two reasons: the ticker isn't in our
// coverage, or it lacks enough price history for the cycle math. We infer which by
// checking the cached universe index (a ticker we know but couldn't score = history
// gap; a ticker we don't know = outside coverage) and show both groups explicitly —
// the user asked to see exactly which were skipped, not just a count.

export function SkippedTickers({
  unavailable,
  lookup,
}: {
  unavailable: string[];
  lookup: Record<string, { name: string | null; sector: string | null; market: Market }>;
}) {
  if (unavailable.length === 0) return null;

  const known: string[] = [];
  const unknown: string[] = [];
  for (const t of unavailable) {
    if (lookup[t]) known.push(t);
    else unknown.push(t);
  }

  return (
    <div className="card skipped-card">
      <div className="card-header">
        <div className="card-title">
          <Link2Off className="mr-1.5 inline h-4 w-4 align-[-3px] text-[var(--text-muted)]" />
          {unavailable.length} ticker{unavailable.length === 1 ? '' : 's'} skipped
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">Not included in the ranking below</div>
      </div>
      <div className="card-body space-y-3">
        {known.length > 0 && (
          <SkippedGroup
            heading="Insufficient price history"
            note="In our coverage, but without enough confirmed cycles for a reliable Major Cycle reading."
            tickers={known}
            linkable
          />
        )}
        {unknown.length > 0 && (
          <SkippedGroup
            heading="Outside our coverage"
            note="Not currently in the MajorCycle universe. Live fetching of new tickers is coming soon."
            tickers={unknown}
            linkable={false}
          />
        )}
      </div>
    </div>
  );
}

function SkippedGroup({
  heading,
  note,
  tickers,
  linkable,
}: {
  heading: string;
  note: string;
  tickers: string[];
  linkable: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold text-[var(--text-secondary)]">{heading}</div>
      <div className="mb-2 text-[10.5px] text-[var(--text-muted)]">{note}</div>
      <div className="flex flex-wrap gap-1.5">
        {tickers.map((t) => {
          const { symbol } = tickerToUrlParts(t);
          return linkable ? (
            <Link key={t} href={tickerToPath(t)} className="skipped-chip skipped-chip--link">
              {symbol}
            </Link>
          ) : (
            <span key={t} className="skipped-chip">
              {symbol}
            </span>
          );
        })}
      </div>
    </div>
  );
}
