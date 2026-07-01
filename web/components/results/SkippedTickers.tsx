'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Ban, Check, ChevronDown, Clock, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';

import type { Market, RequestStatus, SkippedStatus } from '@/lib/types';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';

// Compact, collapsible transparency for tickers the run couldn't score. Each
// ticker shows a SMART state derived from the live status map (covered? in our
// listings? already requested?), so the user sees the right action up front
// instead of finding out on click:
//   covered (in our universe, history short)   → "No data yet", links to detail
//   not covered, already requested/queued       → "Requested" (no re-request)
//   not covered, requested but unfetchable       → "Not supported"
//   not covered, a recognised listed stock       → one-click "Request"
//   not covered, not a recognised stock          → "Not covered" (nothing to request)
// See docs/architecture.md §8 Tier 4 + /api/listings/status.

interface ResolvedRow {
  ticker: string;
  covered: boolean;
  inListings: boolean;
  reqStatus: RequestStatus | null;
  known: boolean; // live status has loaded for this ticker
}

export function SkippedTickers({
  unavailable,
  lookup,
  statusMap,
  horizonQuery,
}: {
  unavailable: string[];
  lookup: Record<string, { name: string | null; sector: string | null; market: Market }>;
  statusMap: Record<string, SkippedStatus>;
  /** `?…` horizon suffix (from the run) so a skipped ticker opens the same window. */
  horizonQuery: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [localStatus, setLocalStatus] = useState<Record<string, RequestStatus>>({});

  if (unavailable.length === 0) return null;

  const resolved: ResolvedRow[] = unavailable.map((t) => {
    const st = statusMap[t];
    return {
      ticker: t,
      // Fall back to the universe lookup while the live status is still loading.
      covered: st ? st.covered : Boolean(lookup[t]),
      inListings: st?.inListings ?? false,
      reqStatus: localStatus[t] ?? st?.requestStatus ?? null,
      known: st != null,
    };
  });

  const coveredRows = resolved.filter((r) => r.covered);
  const otherRows = resolved.filter((r) => !r.covered);

  const requestTicker = async (t: string) => {
    setPending((p) => new Set(p).add(t));
    try {
      const res = await fetch('/api/request-ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: t }),
      });
      if (res.ok) setLocalStatus((s) => ({ ...s, [t]: 'queued' }));
      // A non-OK response (e.g. not a listed stock) leaves the ticker as-is — its
      // smart chip ("Not covered") already conveys that it can't be requested.
    } catch {
      // non-fatal
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(t);
        return n;
      });
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
          {coveredRows.length > 0 && (
            <div className="skipped-group">
              <span className="skipped-group-label">
                No data yet <span className="skipped-group-note">(in our coverage, history still building)</span>:
              </span>{' '}
              {coveredRows.map((r, i) => (
                <span key={r.ticker}>
                  <Link href={tickerToPath(r.ticker) + horizonQuery} className="skipped-tk skipped-tk--link">
                    {tickerToUrlParts(r.ticker).symbol}
                  </Link>
                  {i < coveredRows.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}
          {otherRows.length > 0 && (
            <div className="skipped-group">
              <span className="skipped-group-label">
                Not in our coverage <span className="skipped-group-note">(request a listed stock to add it — fetched in the next daily update)</span>:
              </span>{' '}
              <span className="skipped-req-list">
                {otherRows.map((r) => (
                  <SkippedItem
                    key={r.ticker}
                    row={r}
                    pending={pending.has(r.ticker)}
                    onRequest={() => requestTicker(r.ticker)}
                    horizonQuery={horizonQuery}
                  />
                ))}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SkippedItem({
  row,
  pending,
  onRequest,
  horizonQuery,
}: {
  row: ResolvedRow;
  pending: boolean;
  onRequest: () => void;
  horizonQuery: string;
}) {
  const sym = tickerToUrlParts(row.ticker).symbol;

  let action: ReactNode;
  if (row.reqStatus === 'fetched') {
    action = (
      <Link href={tickerToPath(row.ticker) + horizonQuery} className="skipped-pill skipped-pill--ok">
        <Check className="inline h-3 w-3" /> available
      </Link>
    );
  } else if (row.reqStatus === 'queued' || row.reqStatus === 'failed') {
    action = (
      <span className="skipped-pill skipped-pill--req">
        <Clock className="inline h-3 w-3" /> requested
      </span>
    );
  } else if (row.reqStatus === 'unsupported') {
    action = (
      <span className="skipped-pill skipped-pill--bad" title="We tried to fetch this, but no price data was available.">
        not supported
      </span>
    );
  } else if (!row.known) {
    // Live status still loading — neutral placeholder (resolves on next render).
    action = <span className="skipped-pill skipped-pill--muted">…</span>;
  } else if (row.inListings) {
    action = (
      <button type="button" className="skipped-req" disabled={pending} onClick={onRequest}>
        {pending ? <Loader2 className="inline h-3 w-3 animate-spin" /> : <Plus className="inline h-3 w-3" />} request
      </button>
    );
  } else {
    action = (
      <span className="skipped-pill skipped-pill--muted" title="Not a recognised US, Australian, or Canadian listed stock.">
        <Ban className="inline h-3 w-3" /> not covered
      </span>
    );
  }

  return (
    <span className="skipped-req-item">
      <span className="skipped-tk">{sym}</span>
      {action}
    </span>
  );
}
