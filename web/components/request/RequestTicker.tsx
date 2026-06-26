'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Check, Clock, Loader2, X } from 'lucide-react';

import { marketLabel, tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import type { ListingHit, RequestStatus, TickerRequest } from '@/lib/types';

// "Request a Ticker" — choose-only search over the full US/AU/CA listings menu.
// Pick a stock we don't cover yet → it's queued for the next daily cron, then
// appears site-wide. The queue is global, so a ticker someone else already
// requested shows "Requested" for everyone (no double-requests). See
// docs/architecture.md §8 Tier 4.

const STATUS_META: Record<RequestStatus, { label: string; cls: string }> = {
  queued: { label: 'Requested', cls: 'req-pill--queued' },
  failed: { label: 'Retrying', cls: 'req-pill--queued' },
  fetched: { label: 'Available now', cls: 'req-pill--ok' },
  unsupported: { label: 'Not supported', cls: 'req-pill--bad' },
};

export function RequestTicker() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ListingHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<TickerRequest[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Plain helper (called from event handlers, not an effect) — refreshes the
  // recent list after a request. setState runs only after the await.
  const loadRecent = async () => {
    try {
      const res = await fetch('/api/request-ticker');
      if (!res.ok) return;
      const json = (await res.json()) as { requests?: TickerRequest[] };
      setRecent(json.requests ?? []);
    } catch {
      // non-fatal
    }
  };

  // Load recent requests on mount — setState only after the await, never
  // synchronously in the effect body.
  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/request-ticker', { signal: ctrl.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { requests?: TickerRequest[] };
        setRecent(json.requests ?? []);
      } catch {
        // aborted or non-fatal
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Debounced search. The empty-query case is handled in the input's onChange so
  // the effect never calls setState synchronously in its body.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/listings/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { results?: ListingHit[] };
        setHits(json.results ?? []);
      } catch {
        // aborted or failed — keep previous hits
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const request = async (symbol: string) => {
    setPending((p) => new Set(p).add(symbol));
    setNotice(null);
    try {
      const res = await fetch('/api/request-ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      if (res.ok) {
        // Optimistically flip the hit to "Requested" and refresh the recent list.
        setHits((hs) =>
          hs.map((h) => (h.symbol === symbol ? { ...h, requestStatus: 'queued' } : h)),
        );
        setNotice(
          `${tickerToUrlParts(symbol).symbol} requested — it’ll be available after our next daily update (within ~24h).`,
        );
        void loadRecent();
      } else {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setNotice(json?.error ?? 'Could not queue that ticker. Please try again.');
      }
    } catch {
      setNotice('Could not queue that ticker. Please try again.');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(symbol);
        return n;
      });
    }
  };

  return (
    <div className="req-page">
      <h1 className="sr-only">Request a Ticker</h1>
      <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-[var(--text-muted)]">
        Search every listed US, Australian, and Canadian stock. If we don’t cover one yet,
        request it — it’s fetched in our next daily update (within ~24&nbsp;hours), then
        appears across MajorCycle.
      </p>

      <div className="req-search-card">
        <div className="run-search-wrap">
          <Search className="h-[14px] w-[14px] shrink-0 text-[var(--text-muted)]" strokeWidth={2} />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (v.trim().length < 1) {
                setHits([]);
                setSearching(false);
              }
            }}
            placeholder="Search by ticker or company name…"
            aria-label="Search by ticker or company name"
            className="run-search-input"
          />
          {searching && <Loader2 className="h-[14px] w-[14px] shrink-0 animate-spin text-[var(--text-muted)]" />}
        </div>

        {/* Screen-reader announcement of the live search results (the visible list
            updates as you type; this gives non-visual users the same feedback). */}
        <p className="sr-only" role="status" aria-live="polite">
          {searching
            ? 'Searching…'
            : query.trim().length === 0
              ? ''
              : hits.length === 0
                ? 'No matching US, Australian, or Canadian stock.'
                : `${hits.length} matching stock${hits.length === 1 ? '' : 's'}.`}
        </p>

        {notice && (
          <div className="req-notice" role="status">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>{notice}</span>
            <button type="button" className="req-notice-x" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {query.trim().length > 0 && hits.length === 0 && !searching && (
          <p className="req-empty">No matching US, Australian, or Canadian stock.</p>
        )}

        {hits.length > 0 && (
          <ul className="req-results">
            {hits.map((h) => (
              <li key={h.symbol} className="req-row">
                <span className="req-id">
                  <span className="req-sym">{tickerToUrlParts(h.symbol).symbol}</span>
                  <span className="req-name">{h.name ?? '—'}</span>
                </span>
                <span className="req-meta">
                  <span className="req-exch">{h.exchange ?? marketLabel(h.market)}</span>
                  {h.covered ? (
                    <Link href={tickerToPath(h.symbol)} className="req-pill req-pill--ok">
                      <Check className="h-3 w-3" /> Covered
                    </Link>
                  ) : h.requestStatus ? (
                    <span className={`req-pill ${STATUS_META[h.requestStatus].cls}`}>
                      <Clock className="h-3 w-3" /> {STATUS_META[h.requestStatus].label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="req-add"
                      disabled={pending.has(h.symbol)}
                      onClick={() => request(h.symbol)}
                    >
                      {pending.has(h.symbol) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Request
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="req-recent">
        <h2 className="req-recent-title">Recent requests</h2>
        {recent.length === 0 ? (
          <p className="req-empty">No tickers requested yet.</p>
        ) : (
          <ul className="req-recent-list">
            {recent.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <li key={r.symbol} className="req-recent-row">
                  <span className="req-sym">{tickerToUrlParts(r.symbol).symbol}</span>
                  <span className="req-recent-mkt">{marketLabel(r.market)}</span>
                  {r.status === 'fetched' ? (
                    <Link href={tickerToPath(r.symbol)} className={`req-pill ${meta.cls}`}>
                      <Check className="h-3 w-3" /> {meta.label}
                    </Link>
                  ) : (
                    <span className={`req-pill ${meta.cls}`} title={r.lastError ?? undefined}>
                      {meta.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
