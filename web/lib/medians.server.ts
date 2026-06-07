// Sector- and market-median fundamentals, computed across the whole universe.
//
// The Key Metrics table compares a stock's metrics against the median of its
// sector and its home market (US / AU / CA). We already store every stock's
// fundamentals, so the medians are derived live — no extra tables (the DB is
// already over the free-tier storage limit) — and cached for a day so the
// 716-row scan runs at most once per day across all page requests.

import { unstable_cache } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/server';

/** Metrics where a cross-peer median comparison is meaningful. */
export type MetricKey =
  | 'pe'
  | 'evToEbitda'
  | 'fcfYieldPct'
  | 'grossMargin'
  | 'operatingMargin'
  | 'netMargin'
  | 'roe'
  | 'roa'
  | 'revenueGrowthYoy'
  | 'earningsGrowthYoy'
  | 'debtToEquity'
  | 'currentRatio'
  | 'peg';

// camelCase MetricKey -> snake_case field in the fundamentals JSONB payload
// (Python writes fundamentals in snake_case).
const DB_FIELD: Record<MetricKey, string> = {
  pe: 'pe',
  evToEbitda: 'ev_to_ebitda',
  fcfYieldPct: 'fcf_yield_pct',
  grossMargin: 'gross_margin',
  operatingMargin: 'operating_margin',
  netMargin: 'net_margin',
  roe: 'roe',
  roa: 'roa',
  revenueGrowthYoy: 'revenue_growth_yoy',
  earningsGrowthYoy: 'earnings_growth_yoy',
  debtToEquity: 'debt_to_equity',
  currentRatio: 'current_ratio',
  peg: 'peg',
};

export interface MedianStat {
  median: number;
  /** Number of peers with a non-null value for this metric. */
  n: number;
}

export type MetricMedians = Partial<Record<MetricKey, MedianStat>>;

export interface MedianTables {
  /** Keyed by sector name. */
  sector: Record<string, MetricMedians>;
  /** Keyed by market code (`us` / `au` / `ca`). */
  market: Record<string, MetricMedians>;
}

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
    const vals: number[] = [];
    for (const r of rows) {
      const v = r.fundamentals[field];
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
    }
    // Need a few data points for a median to mean anything.
    if (vals.length >= 3) out[key] = { median: median(vals), n: vals.length };
  }
  return out;
}

async function _fetchMetricMedians(): Promise<MedianTables> {
  const supabase = createAdminClient();
  // 716 non-index rows < PostgREST's 1000-row cap, so one select is enough.
  const { data, error } = await supabase
    .from('stocks')
    .select('market,sector,fundamentals')
    .neq('market', 'index');

  if (error || !data) return { sector: {}, market: {} };

  const bySector: Record<string, Row[]> = {};
  const byMarket: Record<string, Row[]> = {};
  for (const row of data as {
    market: string;
    sector: string | null;
    fundamentals: Record<string, unknown> | null;
  }[]) {
    if (!row.fundamentals) continue;
    const entry: Row = { fundamentals: row.fundamentals };
    if (row.sector) (bySector[row.sector] ??= []).push(entry);
    (byMarket[row.market] ??= []).push(entry);
  }

  const sector: Record<string, MetricMedians> = {};
  for (const [k, rows] of Object.entries(bySector)) sector[k] = computeGroup(rows);
  const market: Record<string, MetricMedians> = {};
  for (const [k, rows] of Object.entries(byMarket)) market[k] = computeGroup(rows);

  return { sector, market };
}

/**
 * Cached daily. Returns sector- and market-grouped medians for the comparison
 * metrics. Safe to call from any Server Component on the Stock Detail page.
 */
export const fetchMetricMedians = unstable_cache(
  _fetchMetricMedians,
  ['metric-medians-v2'],
  { revalidate: 86400 },
);
