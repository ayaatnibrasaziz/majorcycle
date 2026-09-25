// Industry-, sector- and market-median fundamentals, computed across the whole
// universe.
//
// The Key Metrics table compares a stock's metrics against the median of its
// industry, its sector, and its home market (US / AU / CA). We already store
// every stock's fundamentals, so the medians are derived live — no extra tables
// (the DB is already over the free-tier storage limit) — and cached for a day so
// the 719-row scan runs at most once per day across all page requests.
//
// Industries are small (~126 across the universe, so a few stocks each), and a
// "median" over 1–2 peers is noise. We therefore require a minimum group size
// (INDUSTRY_PEER_FLOOR) before computing industry medians at all — below it the
// industry group is omitted and the table's "vs Industry" cells render the
// graceful "—" (na) state rather than a misleading figure.

import { unstable_cache } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/server';
import { selectAll } from '@/lib/supabase/paginate';

import { KEY_METRICS, type MetricKey } from '@/lib/keyMetrics';

export type { MetricKey };

// camelCase MetricKey -> snake_case field in the fundamentals JSONB payload
// (Python writes fundamentals in snake_case). Derived from the ONE definition in
// lib/keyMetrics.ts, so a row added there is a median computed here.
const DB_FIELD = Object.fromEntries(KEY_METRICS.map((m) => [m.key, m.dbField])) as Record<
  MetricKey,
  string
>;

// Some metrics explode when their denominator is near zero — e.g. earnings going
// from $0.01 to $3 reads as +30,000%, or P/E on near-zero EPS reads as 3,500x.
// Such values are technically real but would skew the peer median, so anything
// beyond the metric's DISPLAY CAP is left out of the median pool. It is the same
// number, read from the same place (`MetricDef.cap`), so the cell text and the
// median it is compared with cannot disagree. (This was a second hand-kept list
// "mirroring" the caps until 2026-09-25.)
const OUTLIER_BOUND = Object.fromEntries(
  KEY_METRICS.filter((m) => m.cap !== undefined).map((m) => [m.key, m.cap]),
) as Partial<Record<MetricKey, number>>;

export interface MedianStat {
  median: number;
  /** Number of peers with a non-null value for this metric. */
  n: number;
}

export type MetricMedians = Partial<Record<MetricKey, MedianStat>>;

export interface MedianTables {
  /** Keyed by industry name. Only industries with ≥ INDUSTRY_PEER_FLOOR stocks are present. */
  industry: Record<string, MetricMedians>;
  /** Keyed by sector name. */
  sector: Record<string, MetricMedians>;
  /** Keyed by market code (`us` / `au` / `ca`). */
  market: Record<string, MetricMedians>;
}

// Minimum number of stocks in an industry before we trust its median. Industries
// are the smallest peer group; below this, "vs Industry" shows "—" instead of a
// noisy one- or two-peer median.
const INDUSTRY_PEER_FLOOR = 5;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

type Row = { fundamentals: Record<string, unknown> };

function computeGroup(rows: Row[]): MetricMedians {
  const out: MetricMedians = {};
  for (const key of Object.keys(DB_FIELD) as MetricKey[]) {
    const field = DB_FIELD[key];
    const bound = OUTLIER_BOUND[key];
    const vals: number[] = [];
    for (const r of rows) {
      const v = r.fundamentals[field];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (bound !== undefined && Math.abs(v) > bound) continue; // skip explosive outliers
      vals.push(v);
    }
    // Need a few data points for a median to mean anything.
    if (vals.length >= 3) out[key] = { median: median(vals), n: vals.length };
  }
  return out;
}

async function _fetchMetricMedians(): Promise<MedianTables> {
  const supabase = createAdminClient();
  // Paginated, NOT one select. This used to read the table in a single request
  // under a comment saying "719 non-index rows < PostgREST's 1000-row cap" — a
  // true statement with an expiry date on it. The universe auto-expands whenever
  // a reader requests a ticker, and at 1001 stocks PostgREST would have started
  // returning an arbitrary 1000 of them with no error, so every "vs Sector"
  // median on the site would have been computed from a silently truncated pool.
  const data = await selectAll<{
    market: string;
    sector: string | null;
    industry: string | null;
    fundamentals: Record<string, unknown> | null;
  }>((from, to) =>
    supabase
      .from('stocks')
      .select('market,sector,industry,fundamentals')
      .neq('market', 'index')
      // Delisted companies are excluded from every peer median. Their
      // fundamentals are frozen at the day they stopped trading, so leaving them
      // in would quietly drag a live sector's median toward a snapshot of the
      // past — a wrong number that looks entirely ordinary.
      .eq('is_active', true)
      .order('ticker', { ascending: true })
      .range(from, to),
  );

  if (data.length === 0) return { industry: {}, sector: {}, market: {} };

  const byIndustry: Record<string, Row[]> = {};
  const bySector: Record<string, Row[]> = {};
  const byMarket: Record<string, Row[]> = {};
  for (const row of data as {
    market: string;
    sector: string | null;
    industry: string | null;
    fundamentals: Record<string, unknown> | null;
  }[]) {
    if (!row.fundamentals) continue;
    const entry: Row = { fundamentals: row.fundamentals };
    if (row.industry) (byIndustry[row.industry] ??= []).push(entry);
    if (row.sector) (bySector[row.sector] ??= []).push(entry);
    (byMarket[row.market] ??= []).push(entry);
  }

  // Industries below the peer floor are dropped entirely — too few peers for a
  // meaningful median (the table falls back to "—" for them).
  const industry: Record<string, MetricMedians> = {};
  for (const [k, rows] of Object.entries(byIndustry)) {
    if (rows.length < INDUSTRY_PEER_FLOOR) continue;
    industry[k] = computeGroup(rows);
  }
  const sector: Record<string, MetricMedians> = {};
  for (const [k, rows] of Object.entries(bySector)) sector[k] = computeGroup(rows);
  const market: Record<string, MetricMedians> = {};
  for (const [k, rows] of Object.entries(byMarket)) market[k] = computeGroup(rows);

  return { industry, sector, market };
}

/**
 * Cached daily. Returns industry-, sector- and market-grouped medians for the
 * comparison metrics. Safe to call from any Server Component on the Stock Detail
 * page.
 */
export const fetchMetricMedians = unstable_cache(
  _fetchMetricMedians,
  // ⚠️ BUMP THIS KEY whenever KEY_METRICS gains a row. A cached entry from before
  // the change has no median for the new metric, so for up to a day after deploy
  // its every comparison would read "—" while looking entirely deliberate.
  // v6: H6a, twelve new rows (2026-09-25).
  ['metric-medians-v6'],
  { revalidate: 86400 },
);
