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

    // Supabase's default page size is 1000 rows. AAPL has data from ~1980;
    // without a cutoff the query returns the oldest 1000 rows (split-adjusted
    // prices ~$0.08) instead of recent prices. Three years (~756 trading days)
    // is more than enough for chart sections.
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 3);
    const cutoff = cutoffDate.toISOString().slice(0, 10);

    const { data: barsRows, error: barsErr } = await supabase
      .from('price_bars')
      .select('date,open,high,low,close,volume')
      .eq('ticker', ticker)
      .gte('date', cutoff)
      .order('date', { ascending: true })
      .limit(1000);

    if (barsErr) {
      return null;
    }

    const camelRow = shallowCamel(stockRow as Record<string, unknown>);

    if (camelRow.fundamentals && typeof camelRow.fundamentals === 'object') {
      camelRow.fundamentals = toCamel<FundamentalsSnapshot>(
        camelRow.fundamentals as never,
      );
    }
    if (Array.isArray(camelRow.news)) {
      camelRow.news = (camelRow.news as unknown[]).map((n) =>
        toCamel<NewsItem>(n as never),
      );
    }

    const record = camelRow as unknown as StockRecord;
    const priceBars = (barsRows ?? []) as PriceBar[];

    return { ...record, priceBars };
  },
);
