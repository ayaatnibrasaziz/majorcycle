'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { Search } from 'lucide-react';

import { InfoTip } from '@/components/ui/InfoTip';
import type { UniverseStock } from '@/lib/universe.server';
import { marketLabel, tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import type { Currency, Market } from '@/lib/types';
import { fmtCompact } from '@/lib/format';
import { useNumberDraft } from '@/lib/numberDraft';
import { boundError, CUSTOM_PARAM_BOUNDS } from '@/lib/presets';
import { matchesQuery, matchStrength } from '@/lib/stockSearch';
import { cn } from '@/lib/utils';

// Rows painted per step. ⚠️ Beta review E-2: this was a hard cap with no way past
// it, so 133 of the 253 ASX stocks could not be reached from the list at all. It is
// now a page size behind a "Show more" button — the first screen stays small for
// phones, and nothing is out of reach.
const PAGE_SIZE = 120;

type MarketFilter = 'all' | Market;

type SortKey = 'cap' | 'cap-asc' | 'ticker' | 'name' | 'sector';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'cap', label: 'Largest first' },
  { value: 'cap-asc', label: 'Smallest first' },
  { value: 'ticker', label: 'Ticker A–Z' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'sector', label: 'Sector A–Z' },
];

function isMarketFilter(v: string | null): v is MarketFilter {
  return v === 'all' || v === 'us' || v === 'au' || v === 'ca';
}
function isSortKey(v: string | null): v is SortKey {
  return SORTS.some((s) => s.value === v);
}

/** Missing values sort last whichever way the list runs. */
function byText(a: string | null, b: string | null): number {
  if (a == null || b == null) return (a == null ? 1 : 0) - (b == null ? 1 : 0);
  return a.localeCompare(b);
}
function byCap(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a == null || b == null) return (a == null ? 1 : 0) - (b == null ? 1 : 0);
  return (a - b) * dir;
}

const MARKET_FILTERS: { value: MarketFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'us', label: 'US' },
  { value: 'au', label: 'AU' },
  { value: 'ca', label: 'CA' },
];

// Major Cycle horizon chosen on the Browse page and carried into the opened
// stock via the query. Named presets go via ?preset=; Custom carries explicit
// pullback/profit/lookback (?preset=custom&pullback=…&profit=…&lookback=…),
// which the detail page + /api/cycle now compute directly.
type Horizon = 'short' | 'medium' | 'long' | 'custom';

const HORIZONS: { value: Horizon; label: string; hint: string }[] = [
  { value: 'short', label: 'Short', hint: '≈ 3 months' },
  { value: 'medium', label: 'Medium', hint: '≈ 1 year' },
  { value: 'long', label: 'Long', hint: '≈ 3 years' },
  { value: 'custom', label: 'Custom', hint: 'your own window' },
];

const HORIZON_STORAGE_KEY = 'mc:browse-horizon';
const CUSTOM_STORAGE_KEY = 'mc:browse-custom';

interface CustomParams {
  pullback: number;
  profit: number;
  lookback: number;
}
const CUSTOM_DEFAULT: CustomParams = { pullback: -5, profit: 5, lookback: 252 };

function isHorizon(value: string | null): value is Horizon {
  return (
    value === 'short' || value === 'medium' || value === 'long' || value === 'custom'
  );
}

/** Validate custom params against the documented bounds (data-contracts §7). */
function customValid(c: CustomParams): boolean {
  const b = CUSTOM_PARAM_BOUNDS;
  return (
    Number.isFinite(c.pullback) &&
    c.pullback >= b.pullbackThreshold.min &&
    c.pullback <= b.pullbackThreshold.max &&
    Number.isFinite(c.profit) &&
    c.profit >= b.profitThreshold.min &&
    c.profit <= b.profitThreshold.max &&
    Number.isInteger(c.lookback) &&
    c.lookback >= b.lookbackBars.min &&
    c.lookback <= b.lookbackBars.max
  );
}

function readCustom(): CustomParams {
  if (typeof window === 'undefined') return CUSTOM_DEFAULT;
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<CustomParams>;
      return {
        pullback: Number(p.pullback ?? CUSTOM_DEFAULT.pullback),
        profit: Number(p.profit ?? CUSTOM_DEFAULT.profit),
        lookback: Number(p.lookback ?? CUSTOM_DEFAULT.lookback),
      };
    }
  } catch {
    // ignore corrupt/unavailable storage
  }
  return CUSTOM_DEFAULT;
}

function persistCustom(c: CustomParams): void {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(c));
  } catch {
    // non-fatal
  }
}

// Persist the horizon in localStorage and read it via useSyncExternalStore so
// the choice sticks across visits without a hydration mismatch (server snapshot
// is always 'medium'; the client re-syncs after hydration). `storage` only
// fires in other tabs, so selectHorizon dispatches it manually for this tab.
function subscribeHorizon(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function getHorizonSnapshot(): Horizon {
  try {
    const saved = localStorage.getItem(HORIZON_STORAGE_KEY);
    if (isHorizon(saved)) return saved;
  } catch {
    // localStorage unavailable (private mode etc.) — fall through to default.
  }
  return 'medium';
}

function getHorizonServerSnapshot(): Horizon {
  return 'medium';
}

function persistHorizon(value: Horizon): void {
  try {
    localStorage.setItem(HORIZON_STORAGE_KEY, value);
    window.dispatchEvent(new StorageEvent('storage', { key: HORIZON_STORAGE_KEY }));
  } catch {
    // Non-fatal — the choice just won't persist.
  }
}

function formatMarketCap(value: number | null, currency: Currency): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return fmtCompact(value, currency);
}

export function StockBrowser({ stocks }: { stocks: UniverseStock[] }) {
  /* ⚠️ Beta review E-10: opening a stock and pressing Back wiped the search and every
     filter, because they lived only in component state. They now live in the web
     address (`?q=&market=&sector=&industry=&sort=&n=`), so Back restores them — and a
     filtered list can be shared. Read once on mount; written with `replaceState`, so
     typing does not stack up history entries. */
  const params = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [market, setMarketState] = useState<MarketFilter>(() => {
    const m = params.get('market');
    return isMarketFilter(m) ? m : 'all';
  });
  const [sector, setSector] = useState<string>(() => params.get('sector') ?? 'all');
  const [industry, setIndustryState] = useState<string>(() => params.get('industry') ?? 'all');
  const [sort, setSortState] = useState<SortKey>(() => {
    const v = params.get('sort');
    return isSortKey(v) ? v : 'cap';
  });
  const [limit, setLimit] = useState(() => {
    const n = Number(params.get('n'));
    return Number.isInteger(n) && n > PAGE_SIZE ? n : PAGE_SIZE;
  });

  // Any change to what is listed starts again from the first page.
  const search = (v: string) => {
    setQuery(v);
    setLimit(PAGE_SIZE);
  };
  const setMarket = (v: MarketFilter) => {
    setMarketState(v);
    setLimit(PAGE_SIZE);
  };
  const setIndustry = (v: string) => {
    setIndustryState(v);
    setLimit(PAGE_SIZE);
  };
  const setSort = (v: SortKey) => {
    setSortState(v);
    setLimit(PAGE_SIZE);
  };

  // Industry depends on the chosen sector: picking a sector narrows the industry
  // list to that sector's industries. Changing the sector resets a now-orphaned
  // industry back to "All".
  const selectSector = (value: string) => {
    setSector(value);
    setIndustryState('all');
    setLimit(PAGE_SIZE);
  };

  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    const put = (key: string, value: string, fallback: string) => {
      if (value && value !== fallback) next.set(key, value);
      else next.delete(key);
    };
    put('q', query.trim(), '');
    put('market', market, 'all');
    put('sector', sector, 'all');
    put('industry', industry, 'all');
    put('sort', sort, 'cap');
    put('n', String(limit), String(PAGE_SIZE));
    const qs = next.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', url);
    }
  }, [query, market, sector, industry, sort, limit]);
  const horizon = useSyncExternalStore(
    subscribeHorizon,
    getHorizonSnapshot,
    getHorizonServerSnapshot,
  );
  // Custom params are only rendered/used when horizon === 'custom', which itself
  // resolves post-hydration via useSyncExternalStore — so a lazy initializer
  // reading localStorage here can't cause an SSR mismatch.
  const [custom, setCustom] = useState<CustomParams>(() => readCustom());
  const customOk = customValid(custom);
  // Per-field validity for instant, field-local feedback (red border + note only
  // on the offending field; clears the moment the value is valid).
  const pullbackErr = boundError(custom.pullback, CUSTOM_PARAM_BOUNDS.pullbackThreshold);
  const profitErr = boundError(custom.profit, CUSTOM_PARAM_BOUNDS.profitThreshold);
  const lookbackErr = boundError(custom.lookback, CUSTOM_PARAM_BOUNDS.lookbackBars, true);
  const updateCustom = (patch: Partial<CustomParams>) =>
    setCustom((prev) => {
      const next = { ...prev, ...patch };
      persistCustom(next);
      return next;
    });

  // Medium is the default headline, so its links stay clean (no query param).
  function hrefFor(ticker: string): string {
    const path = tickerToPath(ticker);
    if (horizon === 'medium') return path;
    if (horizon === 'custom') {
      if (!customOk) return path; // invalid custom → fall back to the Medium default
      const qs = new URLSearchParams({
        preset: 'custom',
        pullback: String(custom.pullback),
        profit: String(custom.profit),
        lookback: String(custom.lookback),
      });
      return `${path}?${qs.toString()}`;
    }
    return `${path}?preset=${horizon}`;
  }

  // Distinct sectors, alphabetical — derived once from the index.
  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const s of stocks) if (s.sector) set.add(s.sector);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stocks]);

  // Industries available for the dropdown — narrowed to the chosen sector when
  // one is selected, otherwise the full list. Alphabetical.
  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const s of stocks) {
      if (sector !== 'all' && s.sector !== sector) continue;
      if (s.industry) set.add(s.industry);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stocks, sector]);

  const filtered = useMemo(() => {
    const rows = stocks.filter((s) => {
      if (market !== 'all' && s.market !== market) return false;
      if (sector !== 'all' && s.sector !== sector) return false;
      if (industry !== 'all' && s.industry !== industry) return false;
      return matchesQuery(s, query);
    });
    // The index arrives largest-first; every other order is applied here. On the
    // default order an exact ticker match comes first, so "BHP" leads with BHP.
    const q = query.trim();
    const order: Record<SortKey, (a: UniverseStock, b: UniverseStock) => number> = {
      cap: (a, b) =>
        (q ? matchStrength(b.ticker, q) - matchStrength(a.ticker, q) : 0) ||
        byCap(a.marketCap, b.marketCap, -1),
      'cap-asc': (a, b) => byCap(a.marketCap, b.marketCap, 1),
      ticker: (a, b) => a.ticker.localeCompare(b.ticker),
      name: (a, b) => byText(a.name, b.name) || a.ticker.localeCompare(b.ticker),
      sector: (a, b) => byText(a.sector, b.sector) || byCap(a.marketCap, b.marketCap, -1),
    };
    return rows.sort(order[sort]);
  }, [stocks, query, market, sector, industry, sort]);

  const shown = filtered.slice(0, limit);
  const hiddenCount = filtered.length - shown.length;

  return (
    <div>
      {/* Cycle horizon — chosen before opening a stock; carried into the
          detail page via ?preset=. Distinct from the list filters below. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap mb-3 px-3 py-2.5 bg-[var(--brand-light)] border border-[var(--brand-light-border)] rounded-[var(--radius-sm)]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[var(--brand-mid)]">
            Cycle horizon
          </span>
          <InfoTip title="Cycle horizon">
            Sets the Major Cycle window used when you open a stock. Short ≈ 3
            months, Medium ≈ 1 year, Long ≈ 3 years, or Custom to set your own
            pullback / profit / lookback.
          </InfoTip>
        </div>
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label="Major Cycle horizon"
        >
          {HORIZONS.map((h) => (
            <button
              key={h.value}
              type="button"
              onClick={() => persistHorizon(h.value)}
              aria-pressed={horizon === h.value}
              title={`${h.label} — ${h.hint}`}
              className={cn(
                'px-[10px] py-[5px] rounded-[var(--radius-sm)] border text-[11px] font-medium transition-all duration-150',
                horizon === h.value
                  ? 'bg-[var(--brand-mid)] border-[var(--brand-mid)] text-white'
                  : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--brand-mid)] hover:text-[var(--brand-mid)]'
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-[var(--text-muted)] sm:ml-1">
          Opens each stock with this Major Cycle window.
        </span>

        {horizon === 'custom' && (
          <div className="mt-1 flex w-full flex-wrap items-start gap-3">
            <CustomField
              label="Pullback %"
              tip="How deep a dip must be to count as a real pullback event in the cycle. More negative = only larger dips count."
              value={custom.pullback}
              step={0.5}
              error={pullbackErr}
              onChange={(n) => updateCustom({ pullback: n })}
            />
            <CustomField
              label="Profit %"
              tip="How large a rally must be to count as a real recovery event. Higher = only bigger rallies count."
              value={custom.profit}
              step={0.5}
              error={profitErr}
              onChange={(n) => updateCustom({ profit: n })}
            />
            <CustomField
              label="Lookback (bars)"
              tip="How far back the cycle engine scans for highs and lows. 1 bar = 1 trading day (~252 = 1 year)."
              value={custom.lookback}
              step={1}
              error={lookbackErr}
              // Not rounded: a rounded value would rewrite "252.5" under the cursor;
              // "Whole number only." says what is wrong instead (as on Run Analysis).
              onChange={(n) => updateCustom({ lookback: n })}
            />
            {/* ⚠️ An invalid Custom value used to be ignored in silence: the stock simply
                opened on Medium, so the reader thought their window was in use. Say so
                (owner, 2026-10-03: "when a wrong custom parameter is inputted it is
                acting properly"). The Run page blocks its button; Browse cannot block
                a list of stocks, so it states what will happen instead. */}
            {!customOk && (
              <p role="status" className="w-full text-[11px] font-semibold text-[var(--status-danger)]">
                Fix the value marked above. Until then, stocks open with the Medium horizon.
              </p>
            )}
          </div>
        )}
      </div>

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
            onChange={(e) => search(e.target.value)}
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
            onChange={(e) => selectSector(e.target.value)}
            className="browse-select"
          >
            <option value="all">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="industry-filter"
            className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[var(--text-muted)]"
          >
            Industry
          </label>
          <select
            id="industry-filter"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="browse-select max-w-[180px]"
          >
            <option value="all">All industries</option>
            {industries.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count — a live region so screen readers announce the new count
          as the user types/filters (mirrors the Results-tab toolbar). The sort
          control sits beside it rather than in the filter row, where it wrapped
          onto a line of its own at 1280px — and it stays OUTSIDE the live region,
          so changing the order is not announced as a new count. */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div
          className="text-[11px] text-[var(--text-muted)] font-[var(--font-mono)]"
          role="status"
          aria-live="polite"
        >
          {filtered.length} {filtered.length === 1 ? 'stock' : 'stocks'}
          {hiddenCount > 0 && <span> · showing {shown.length}</span>}
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="sort-order"
            className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[var(--text-muted)]"
          >
            Sort
          </label>
          <select
            id="sort-order"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="browse-select"
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <>
          {/* Column legend — aligns with the row layout below (same px-3.5 + gap-3
              + per-column widths) so beginners can read the Sector / Market Cap
              values. Hidden from a11y tree; the row links carry the real labels. */}
          <div
            className="flex items-center gap-3 px-3.5 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.5px] text-[var(--text-muted)]"
            aria-hidden="true"
          >
            <div className="min-w-0 flex-1">Stock</div>
            <div className="hidden sm:block flex-shrink-0 w-[160px]">Sector</div>
            <div className="flex-shrink-0 w-[72px] text-right">Market Cap</div>
          </div>
          <ul className="card divide-y divide-[var(--border)]" aria-label="Stocks">
          {shown.map((s) => {
            const { symbol } = tickerToUrlParts(s.ticker);
            return (
              <li key={s.ticker}>
                <Link
                  href={hrefFor(s.ticker)}
                  // Prefetch OFF (F3 Step 10, audit finding B5). next/link otherwise
                  // prefetches on hover/viewport, which RUNS the stock detail server
                  // component — so merely scrolling this list would record free-tier
                  // views the reader never asked for. The page is streamed and fast
                  // enough that losing the prefetch costs little.
                  prefetch={false}
                  className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--bg-hover)] transition-colors duration-150 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-mono)] font-semibold text-[13px] text-[var(--text-primary)] group-hover:text-[var(--brand-mid)]">
                        {symbol}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.5px] text-[var(--text-muted)] bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[4px] px-1.5 py-px flex-shrink-0">
                        {marketLabel(s.market)}
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
          {hiddenCount > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <button
                type="button"
                className="browse-more"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, hiddenCount)} more
              </button>
              <button
                type="button"
                className="browse-more"
                onClick={() => setLimit(filtered.length)}
              >
                Show all {filtered.length}
              </button>
            </div>
          )}
        </>
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
              We don&apos;t cover a stock matching{' '}
              <span className="font-[var(--font-mono)] text-[var(--text-secondary)]">
                &ldquo;{query.trim()}&rdquo;
              </span>{' '}
              yet. If it&apos;s a valid US, Australian or Canadian stock, request it
              and we&apos;ll fetch it in our next daily update (within ~24&nbsp;hours).
            </>
          ) : (
            'Try widening the market or sector filter.'
          )}
        </p>
        {query.trim() && (
          <Link
            href="/request"
            className="inline-flex items-center gap-1.5 bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] text-white text-[12px] font-semibold px-4 py-2 rounded-[var(--radius-sm)] shadow-[0_2px_8px_rgba(30,92,179,.25)] hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(30,92,179,.35)] transition-all"
          >
            Request a Ticker
          </Link>
        )}
      </div>
    </div>
  );
}

/** Compact numeric input for a Custom-horizon parameter. Shows a field-local
 *  error (red border + inline note) that clears the moment the value is valid. */
function CustomField({
  label,
  tip,
  value,
  step,
  error,
  onChange,
}: {
  label: string;
  tip: string;
  value: number;
  step: number;
  error: string | null;
  onChange: (n: number) => void;
}) {
  // Link the inline error to the input so a screen reader announces the reason
  // (not just `aria-invalid`) — mirrors the C-R3 deep-a11y bar.
  const errorId = useId();
  // The box keeps what was typed and refuses a leading zero — the same rules as the
  // Run Analysis horizon (lib/numberDraft.ts), so the two pages cannot disagree.
  const draft = useNumberDraft(value, onChange);
  const shown = draft.typingError ?? error;
  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex items-center gap-0.5 text-[9.5px] font-semibold uppercase tracking-[0.5px] text-[var(--brand-mid)]">
        {label}
        <InfoTip title={label} size={11}>{tip}</InfoTip>
      </span>
      <input
        type="number"
        value={draft.inputValue}
        step={step}
        aria-invalid={shown !== null}
        aria-describedby={shown ? errorId : undefined}
        onChange={draft.onInput}
        className={cn(
          'w-[92px] rounded-[var(--radius-sm)] border bg-[var(--bg-surface)] px-2 py-[5px] font-[var(--font-mono)] text-[12px] text-[var(--text-primary)] outline-none',
          shown
            ? 'border-[var(--status-danger)] focus:border-[var(--status-danger)]'
            : 'border-[var(--border)] focus:border-[var(--brand-bright)]'
        )}
      />
      {shown && (
        <span id={errorId} className="text-[9.5px] font-semibold text-[var(--status-danger)]">
          {shown}
        </span>
      )}
    </label>
  );
}
