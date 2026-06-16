// Server-side fetcher for the Stock Detail page.
// Pulls the canonical stocks row + full price history from Supabase, converts
// the row's top-level snake_case columns to camelCase, and deep-converts the
// fundamentals + news JSONB payloads (which Python writes in snake_case).
//
// Nested enriched JSONB content (income_statement_*, balance_sheet_*, holders,
// etc.) is left as-is — its type contract in `web/lib/types.ts` uses snake_case
// for those nested row identifiers, which matches the DB payload one-to-one.

import { cache } from 'react';

import { toCamel } from '@/lib/case';
import { normalizeAnalystRecommendation } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/server';
import type {
  FundamentalsSnapshot,
  NewsItem,
  PriceBar,
  StockRecord,
} from '@/lib/types';

export interface StockDetail extends StockRecord {
  priceBars: PriceBar[];
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function shallowCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Load a ticker's full daily history.
 *
 * Fast path: ONE request via the `get_price_bars_json` RPC, which returns the
 * whole history as a single jsonb value (bypassing PostgREST's 1000-row cap —
 * so a long-history ticker no longer needs ~12 cross-region round-trips).
 *
 * Falls back to parallel paginated reads if the RPC isn't deployed yet or errors,
 * so this is safe to ship before/after the migration. Returns `null` only on a
 * hard read failure (lets the caller 404 / degrade).
 */
async function loadPriceBars(
  supabase: AdminClient,
  ticker: string,
): Promise<PriceBar[] | null> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_price_bars_json', {
    p_ticker: ticker,
  });
  if (!rpcErr && Array.isArray(rpcData)) {
    return rpcData as unknown as PriceBar[];
  }

  // Fallback: get the count once, then pull every 1000-row page in parallel so
  // the whole history still arrives in ~2 round-trips instead of a dozen.
  const PAGE = 1000;
  const { count, error: countErr } = await supabase
    .from('price_bars')
    .select('date', { count: 'exact', head: true })
    .eq('ticker', ticker);
  if (countErr) return null;

  const pageCount = Math.ceil((count ?? 0) / PAGE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      supabase
        .from('price_bars')
        .select('date,open,high,low,close,volume')
        .eq('ticker', ticker)
        .order('date', { ascending: true })
        .range(i * PAGE, i * PAGE + PAGE - 1),
    ),
  );

  // Pages are date-ordered slices concatenated in order → globally date-ordered.
  const priceBars: PriceBar[] = [];
  for (const { data: page, error: barsErr } of pages) {
    if (barsErr) return null;
    if (page) priceBars.push(...(page as PriceBar[]));
  }
  return priceBars;
}

/**
 * Fetch a stock's full detail payload by storage-format ticker (e.g. `AAPL`,
 * `BHP.AX`, `SHOP.TO`). Returns `null` if the ticker isn't in our universe.
 *
 * Cached per render so multiple components on the same page hit the DB once.
 */
export const fetchStockDetail = cache(
  async (ticker: string): Promise<StockDetail | null> => {
    const supabase = createAdminClient();

    const { data: stockRow, error: stockErr } = await supabase
      .from('stocks')
      .select('*')
      .eq('ticker', ticker)
      .maybeSingle();

    if (stockErr || !stockRow) {
      return null;
    }

    const priceBars = await loadPriceBars(supabase, ticker);
    if (priceBars === null) return null;

    const camelRow = shallowCamel(stockRow as Record<string, unknown>);

    if (camelRow.fundamentals && typeof camelRow.fundamentals === 'object') {
      const f = toCamel<FundamentalsSnapshot>(camelRow.fundamentals as never);
      // yfinance stores the analyst consensus as a raw recommendationKey
      // (e.g. "strong_buy"); normalize to the Title-Case union so it displays
      // correctly and string comparisons against the union work.
      f.analystRecommendation = normalizeAnalystRecommendation(
        f.analystRecommendation as unknown as string,
      );
      camelRow.fundamentals = f;
    }
    if (Array.isArray(camelRow.news)) {
      camelRow.news = (camelRow.news as unknown[]).map((n) =>
        toCamel<NewsItem>(n as never),
      );
    }

    const record = camelRow as unknown as StockRecord;

    return { ...record, priceBars };
  },
);
