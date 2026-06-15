'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Search } from 'lucide-react';

import { InfoTip } from '@/components/ui/InfoTip';
import type { UniverseStock } from '@/lib/universe.server';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import type { Currency, Market } from '@/lib/types';
import { fmtCompact } from '@/lib/format';
import { CUSTOM_PARAM_BOUNDS } from '@/lib/presets';
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

const MARKET_BADGE: Record<Market, string> = { us: 'US', au: 'ASX', ca: 'TSX' };
function formatMarketCap(value: number | null, currency: Currency): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return fmtCompact(value, currency);
}

export function StockBrowser({ stocks }: { stocks: UniverseStock[] }) {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState<MarketFilter>('all');
  const [sector, setSector] = useState<string>('all');
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
      {/* Cycle horizon — chosen before opening a stock; carried into the
          detail page via ?preset=. Distinct from the list filters below. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap mb-3 px-3 py-2.5 bg-[var(--brand-light)] border border-[#bfdbfe] rounded-[var(--radius-sm)]">
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
          <div className="mt-1 flex w-full flex-wrap items-end gap-3">
            <CustomField
              label="Pullback %"
              value={custom.pullback}
              step={0.5}
              onChange={(n) => updateCustom({ pullback: n })}
            />
            <CustomField
              label="Profit %"
              value={custom.profit}
              step={0.5}
              onChange={(n) => updateCustom({ profit: n })}
            />
            <CustomField
              label="Lookback (bars)"
              value={custom.lookback}
              step={1}
              onChange={(n) => updateCustom({ lookback: Math.round(n) })}
            />
            {!customOk && (
              <span className="self-center text-[10px] font-semibold text-[var(--c-tier-5)]">
                Pullback −30…−1, Profit 1…30, Lookback 21…5040
              </span>
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
                  href={hrefFor(s.ticker)}
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

/** Compact numeric input for a Custom-horizon parameter. */
function CustomField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.5px] text-[var(--brand-mid)]">
        {label}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-[92px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-[5px] font-[var(--font-mono)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--brand-bright)]"
      />
    </label>
  );
}
