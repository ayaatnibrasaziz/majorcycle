'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import type { UniverseStock } from '@/lib/universe.server';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import type { Currency, Market } from '@/lib/types';
import { cn } from '@/lib/utils';

// Cap how many rows we paint at once. The list is market-cap-descending, so the
// first slice is the most recognisable names — a beginner browsing without a
// query sees the giants first, and search/filters narrow to the rest. Keeping
// the DOM small protects the Lighthouse 90+ target on mobile.
const RENDER_LIMIT = 120;

type MarketFilter = 'all' | Market;

const MARKET_FILTERS: { value: MarketFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'us', label: 'US' },
  { value: 'au', label: 'ASX' },
  { value: 'ca', label: 'TSX' },
];

const MARKET_BADGE: Record<Market, string> = { us: 'US', au: 'ASX', ca: 'TSX' };
const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  AUD: 'A$',
  CAD: 'C$',
};

function formatMarketCap(value: number | null, currency: Currency): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sym = CURRENCY_SYMBOL[currency] ?? '$';
  if (value >= 1e12) return `${sym}${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${sym}${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${sym}${(value / 1e6).toFixed(0)}M`;
  return `${sym}${value.toFixed(0)}`;
}

export function StockBrowser({ stocks }: { stocks: UniverseStock[] }) {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState<MarketFilter>('all');
  const [sector, setSector] = useState<string>('all');

  // Distinct sectors, alphabetical — derived once from the index.
  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const s of stocks) if (s.sector) set.add(s.sector);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stocks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stocks.filter((s) => {
      if (market !== 'all' && s.market !== market) return false;
      if (sector !== 'all' && s.sector !== sector) return false;
      if (q) {
        const inTicker = s.ticker.toLowerCase().includes(q);
        const inName = (s.name ?? '').toLowerCase().includes(q);
        if (!inTicker && !inName) return false;
      }
      return true;
    });
  }, [stocks, query, market, sector]);

  const shown = filtered.slice(0, RENDER_LIMIT);
  const hiddenCount = filtered.length - shown.length;

  return (
    <div>
      {/* Toolbar: search + market pills + sector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap mb-4">
        <div className="flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-[7px] flex-1 min-w-0 sm:min-w-[200px] sm:max-w-[340px] focus-within:border-[var(--brand-bright)] transition-colors">
          <Search
            className="w-[14px] h-[14px] flex-shrink-0 text-[var(--text-muted)]"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker or company…"
            aria-label="Search by ticker or company name"
            className="border-none outline-none bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] w-full"
          />
        </div>

        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label="Filter by market"
        >
          {MARKET_FILTERS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMarket(m.value)}
              aria-pressed={market === m.value}
              className={cn(
                'px-[10px] py-[5px] rounded-[var(--radius-sm)] border text-[11px] font-[var(--font-mono)] font-medium transition-all duration-150',
                market === m.value
                  ? 'bg-[var(--brand-mid)] border-[var(--brand-mid)] text-white'
                  : 'bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand-mid)] hover:text-[var(--brand-mid)]'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="sector-filter"
            className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[var(--text-muted)]"
          >
            Sector
          </label>
          <select
            id="sector-filter"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-sm)] px-2.5 py-[6px] text-[12px] text-[var(--text-secondary)] outline-none focus:border-[var(--brand-bright)] transition-colors cursor-pointer"
          >
            <option value="all">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count */}
      <div className="text-[11px] text-[var(--text-muted)] mb-2 font-[var(--font-mono)]">
        {filtered.length} {filtered.length === 1 ? 'stock' : 'stocks'}
        {hiddenCount > 0 && (
          <span> · showing first {shown.length} — refine to see the rest</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <ul className="card divide-y divide-[var(--border)]" aria-label="Stocks">
          {shown.map((s) => {
            const { symbol } = tickerToUrlParts(s.ticker);
            return (
              <li key={s.ticker}>
                <Link
                  href={tickerToPath(s.ticker)}
                  className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--bg-hover)] transition-colors duration-150 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-mono)] font-semibold text-[13px] text-[var(--text-primary)] group-hover:text-[var(--brand-mid)]">
                        {symbol}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.5px] text-[var(--text-muted)] bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[4px] px-1.5 py-px flex-shrink-0">
                        {MARKET_BADGE[s.market]}
                      </span>
                    </div>
                    <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">
                      {s.name ?? '—'}
                    </div>
                  </div>
                  <div className="hidden sm:block text-[11px] text-[var(--text-muted)] flex-shrink-0 w-[160px] truncate">
                    {s.sector ?? '—'}
                  </div>
                  <div className="font-[var(--font-mono)] text-[12px] text-[var(--text-secondary)] flex-shrink-0 w-[72px] text-right">
                    {formatMarketCap(s.marketCap, s.currency)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="card flex items-center justify-center py-14">
      <div className="text-center max-w-sm px-4">
        <div className="w-11 h-11 mx-auto mb-3.5 rounded-full bg-[var(--bg-stripe)] border border-[var(--border)] flex items-center justify-center">
          <Search
            className="w-5 h-5 text-[var(--text-muted)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
        <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1.5">
          {query.trim() ? 'No matching stock' : 'No stocks match these filters'}
        </h2>
        <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mb-4">
          {query.trim() ? (
            <>
              We don&apos;t have a stock matching{' '}
              <span className="font-[var(--font-mono)] text-[var(--text-secondary)]">
                &ldquo;{query.trim()}&rdquo;
              </span>{' '}
              in our universe yet. If it&apos;s a valid ticker, run it in Run
              Analysis — we&apos;ll fetch it live and add it.
            </>
          ) : (
            'Try widening the market or sector filter.'
          )}
        </p>
        <Link
          href="/run"
          className="inline-flex items-center gap-1.5 bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] text-white text-[12px] font-semibold px-4 py-2 rounded-[var(--radius-sm)] shadow-[0_2px_8px_rgba(30,92,179,.25)] hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(30,92,179,.35)] transition-all"
        >
          Run Analysis
        </Link>
      </div>
    </div>
  );
}
