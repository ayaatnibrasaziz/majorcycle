'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, Check, Plus, Loader2 } from 'lucide-react';
import Link from 'next/link';

import type { Market } from '@/lib/types';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';

// Compact, collapsible transparency for tickers the run couldn't score. Collapsed
// by default; expanding splits them into "no data yet" (in our coverage, history
// gap) vs "outside coverage" (unknown ticker). The "outside coverage" group gets a
// one-click Request button that queues the ticker for the next daily cron (the
// Request-a-Ticker queue — see docs/architecture.md §8 Tier 4).

type ReqState = 'idle' | 'pending' | 'done' | 'error';

export function SkippedTickers({
  unavailable,
  lookup,
}: {
  unavailable: string[];
  lookup: Record<string, { name: string | null; sector: string | null; market: Market }>;
}) {
  const [open, setOpen] = useState(false);
  const [reqState, setReqState] = useState<Record<string, ReqState>>({});

  if (unavailable.length === 0) return null;

  const known: string[] = [];
  const unknown: string[] = [];
  for (const t of unavailable) {
    if (lookup[t]) known.push(t);
    else unknown.push(t);
  }

  const requestTicker = async (t: string) => {
    setReqState((s) => ({ ...s, [t]: 'pending' }));
    try {
      const res = await fetch('/api/request-ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: t }),
      });
      setReqState((s) => ({ ...s, [t]: res.ok ? 'done' : 'error' }));
    } catch {
      setReqState((s) => ({ ...s, [t]: 'error' }));
    }
  };

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
            <div className="skipped-group">
              <span className="skipped-group-label">
                No data yet <span className="skipped-group-note">(in our coverage, history still building)</span>:
              </span>{' '}
              {known.map((t, i) => (
                <span key={t}>
                  <Link href={tickerToPath(t)} className="skipped-tk skipped-tk--link">
                    {tickerToUrlParts(t).symbol}
                  </Link>
                  {i < known.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}
          {unknown.length > 0 && (
            <div className="skipped-group">
              <span className="skipped-group-label">
                Outside coverage <span className="skipped-group-note">(not yet in the MajorCycle universe — request to add)</span>:
              </span>{' '}
              <span className="skipped-req-list">
                {unknown.map((t) => {
                  const state = reqState[t] ?? 'idle';
                  return (
                    <span key={t} className="skipped-req-item">
                      <span className="skipped-tk">{tickerToUrlParts(t).symbol}</span>
                      <button
                        type="button"
                        className={`skipped-req${state === 'done' ? ' is-done' : ''}`}
                        onClick={() => requestTicker(t)}
                        disabled={state === 'pending' || state === 'done'}
                      >
                        {state === 'done' ? (
                          <><Check className="inline h-3 w-3" /> requested</>
                        ) : state === 'pending' ? (
                          <Loader2 className="inline h-3 w-3 animate-spin" />
                        ) : state === 'error' ? (
                          'not found'
                        ) : (
                          <><Plus className="inline h-3 w-3" /> request</>
                        )}
                      </button>
                    </span>
                  );
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
