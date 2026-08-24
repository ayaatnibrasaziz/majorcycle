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
 * A read against Supabase FAILED. This is emphatically not the same thing as
 * "the ticker isn't in our universe", and conflating the two is the bug this
 * class exists to prevent.
 *
 * Until 2026-08-07 every read error in this file was funnelled into the same
 * `return null` that means "no such stock", so a database timeout reached a
 * paying customer as **"Stock not found"** — a permanent-sounding answer to a
 * transient problem, with nothing logged and nothing to retry. It also blinded
 * us: the e2e suite's intermittent 404 on an *entitled* viewer's report looked
 * like an entitlement bug for a whole session, because the real cause was being
 * swallowed one layer down. Same family as `check_invariants()` reporting zero
 * violations over a universe missing the field it reads (CLAUDE.md 14g):
 * **an unreadable answer must never be reported as a clean one.**
 *
 * Thrown, not returned, so a caller cannot ignore it by accident — the failure
 * has to be handled somewhere or it reaches an error boundary that says "try
 * again". The originating PostgREST error is attached as `cause` so it lands in
 * the Vercel logs intact.
 */
export class StockReadError extends Error {
  constructor(ticker: string, stage: string, cause: unknown) {
    super(`Failed to read ${stage} for ${ticker}`);
    this.name = 'StockReadError';
    this.cause = cause;
  }
}

/**
 * Is this ticker in our universe? One column, one row — deliberately the
 * cheapest question we can ask about a stock.
 *
 * ── Why a second, lighter read exists ───────────────────────────────────────
 * It runs in `stocks/[market]/[ticker]/layout.tsx`, which sits ABOVE the Suspense
 * boundary that `loading.tsx` creates. That position is the whole point: once a
 * boundary streams its fallback the response has begun, the status line is
 * already on the wire, and a later `notFound()` can no longer change it — which
 * is why an unknown ticker answered **200** until 2026-08-23 (audit F-011, and
 * CLAUDE.md 11r one floor up). Asking here answers before anything is sent.
 *
 * ⚠️ It reads the WHOLE row, and the first version of this did not — it selected
 * one column, reasoning that `select('*')` drags the fundamentals JSONB across
 * for a question whose answer is one bit. **That reasoning was about bytes, and
 * the cost is latency.** Measured from the owner's machine against the database
 * in `us-east-1`: `select ticker` (17 bytes) median **553 / 463 ms**, `select *`
 * (48,489 bytes) median **531 / 533 ms** — interleaved, so a network mood swing
 * hits both arms. The payload is free; the round trip is the entire cost.
 *
 * So the light read was not cheaper — it was a THIRD sequential cross-region
 * round trip on the heaviest page in the product, and it showed up as Lighthouse
 * performance **84 → 65** the day the layout landed (audit Layer 2). Sharing one
 * `cache()`d full-row read with `fetchStockDetail` puts it back to two, and the
 * 404 fix costs nothing at all. CLAUDE.md **14f**: a mechanism that is genuinely
 * present is not thereby the one responsible.
 *
 * ⚠️ `false` means **not in our universe**, and nothing else. A failed read
 * throws `StockReadError`, exactly as `readStockRow` does — collapsing the two
 * is the 11e bug, where a Supabase timeout reached a paying customer as a
 * permanent "Stock not found". A boolean makes that collapse very easy to write
 * by accident, which is why it is spelled out here.
 */
export const stockExists = async (ticker: string): Promise<boolean> =>
  (await cachedStockRow(ticker)) !== null;

/**
 * The one `stocks` row read per render, shared by the layout's existence check
 * and by `fetchStockDetail`.
 *
 * React's `cache()` memoises per request, so whichever asks first pays and the
 * other is free — the layout and the page cannot fall out of step, and cannot
 * pay twice. It memoises a rejection too, so a failed read is one failure with
 * one explanation rather than two racing ones.
 */
const cachedStockRow = cache(
  async (ticker: string): Promise<Record<string, unknown> | null> =>
    readStockRow(createAdminClient(), ticker),
);

/**
 * Read the canonical `stocks` row.
 *
 * `null` means the ticker is genuinely not in our universe — the ONE condition
 * that should ever produce a 404. A failed read throws instead.
 *
 * Exported for the same reason as `loadPriceBars`: so the stub-client spec can
 * prove the error path throws rather than reporting "no such stock".
 */
export async function readStockRow(
  supabase: AdminClient,
  ticker: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('stocks')
    .select('*')
    .eq('ticker', ticker)
    .maybeSingle();

  if (error) throw new StockReadError(ticker, 'stocks row', error);
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * Load a ticker's full daily history.
 *
 * Fast path: ONE request via the `get_price_bars_json` RPC, which returns the
 * whole history as a single jsonb value (bypassing PostgREST's 1000-row cap —
 * so a long-history ticker no longer needs ~12 cross-region round-trips).
 *
 * Falls back to parallel paginated reads if the RPC isn't deployed yet or errors,
 * so this is safe to ship before/after the migration.
 *
 * Throws `StockReadError` if the fallback ALSO fails. A ticker with genuinely no
 * bars returns `[]` — an empty history is a real answer, a failed read is not.
 *
 * Exported ONLY so `e2e/stock-read-errors.spec.ts` can drive the real function
 * with a stub client and prove each failure throws. It takes its client as an
 * argument precisely so that is possible without a network or a credential.
 */
export async function loadPriceBars(
  supabase: AdminClient,
  ticker: string,
): Promise<PriceBar[]> {
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
  if (countErr) throw new StockReadError(ticker, 'price_bars count', countErr);

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
    if (barsErr) throw new StockReadError(ticker, 'price_bars page', barsErr);
    if (page) priceBars.push(...(page as PriceBar[]));
  }
  return priceBars;
}

/**
 * Fetch a stock's full detail payload by storage-format ticker (e.g. `AAPL`,
 * `BHP.AX`, `SHOP.TO`).
 *
 * Returns `null` for EXACTLY ONE reason: the ticker isn't in our universe.
 * Every read failure throws `StockReadError` instead — see that class for why
 * the two must not share a return value.
 *
 * Cached per render so multiple components on the same page hit the DB once.
 * React's `cache()` memoises a rejection as well as a value, so the page and its
 * `generateMetadata` see one consistent outcome from one attempt.
 */
export const fetchStockDetail = cache(
  async (ticker: string): Promise<StockDetail | null> => {
    // ── Both reads START together (audit F-014) ─────────────────────────────
    // They never depended on each other: `loadPriceBars` needs the ticker, not
    // the row. They were sequential only because they were written that way, so
    // the caller paid two round trips end to end instead of one.
    //
    // The row is shared with the layout's existence check, so on the Stock Detail
    // page it is already resolved and free; this overlap is what the callers with
    // NO layout above them get — the report route and `generateMetadata`.
    //
    // ⚠️ Deliberately NOT hoisted into the layout as a speculative warm-up. That
    // would shave another round trip off the page, and it would also mean any
    // signed-in reader could make us run a price-history query for a ticker that
    // does not exist, simply by typing URLs. ~15ms in production — the round trip
    // is ~500ms from Australia but the functions run in `iad1`, beside the
    // database — is not worth handing someone a free amplifier.
    const [stockRow, priceBars] = await Promise.all([
      cachedStockRow(ticker),
      loadPriceBars(createAdminClient(), ticker),
    ]);
    if (!stockRow) return null;

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
