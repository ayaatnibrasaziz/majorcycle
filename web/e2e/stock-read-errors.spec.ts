/**
 * A failed database read must never be reported as "this stock does not exist".
 *
 * THE BUG THIS GUARDS (fixed 2026-08-07). `web/lib/stocks.ts` funnelled all four
 * of its failure paths into the same `return null` that means "not in our
 * universe". Every caller then did the only thing that value permits:
 * `notFound()` on the Stock Detail page, `404 Not found` from the report route.
 * So a transient Supabase error reached a PAYING customer as a permanent-sounding
 * "Stock not found", with nothing logged, nothing to retry, and no way for the
 * owner — who cannot debug — to tell the two apart from the outside.
 *
 * It also blinded the test suite. An intermittent 404 on an *entitled* viewer's
 * report was read as an entitlement fault for a whole session, because the real
 * cause was being swallowed one layer below where anyone was looking. Same shape
 * as CLAUDE.md 14g: an instrument that reports "clean" when it actually means
 * "I could not measure".
 *
 * WHY THESE TESTS ARE PURE. They import the real `readStockRow` and
 * `loadPriceBars` and drive them with a stub client — no browser, no network, no
 * credential — so they run on a fork PR with no secrets and can never self-skip
 * (CLAUDE.md, Testing row). Both functions take their client as an argument
 * precisely so this is possible. Re-implementing the logic here would guard
 * nothing, the same trap `export-parity.spec.ts` records.
 */

import { expect, test } from '@playwright/test';

import { StockReadError, loadPriceBars, readStockRow } from '../lib/stocks';

const ERR = { message: 'canceling statement due to statement timeout', code: '57014' };

type Result = { data?: unknown; error?: unknown; count?: number | null };

/**
 * Minimal stand-in for the Supabase client, covering only the calls these two
 * functions make. Each builder method returns `this` so the real chains
 * (`.select().eq().order().range()`) resolve to the configured result.
 */
function stubClient(opts: {
  rpc?: Result;
  stocks?: Result;
  count?: Result;
  page?: Result;
}) {
  const table = { current: '' };
  const builder: Record<string, unknown> = {
    select(_cols: string, o?: { head?: boolean }) {
      // The count probe is the only `select` that passes `{ head: true }`.
      (builder as { _head?: boolean })._head = o?.head === true;
      return builder;
    },
    eq: () => builder,
    order: () => builder,
    maybeSingle: () => Promise.resolve(opts.stocks ?? { data: null, error: null }),
    range: () => Promise.resolve(opts.page ?? { data: [], error: null }),
    // `await`ing the builder itself is how the count probe resolves.
    then(onFulfilled: (v: Result) => unknown) {
      const res =
        table.current === 'price_bars' && (builder as { _head?: boolean })._head
          ? (opts.count ?? { count: 0, error: null })
          : (opts.page ?? { data: [], error: null });
      return Promise.resolve(res).then(onFulfilled);
    },
  };
  return {
    from(name: string) {
      table.current = name;
      (builder as { _head?: boolean })._head = false;
      return builder;
    },
    rpc: () => Promise.resolve(opts.rpc ?? { data: null, error: ERR }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test.describe('a failed read throws — it never masquerades as "not found"', () => {
  test('the stocks row read throws StockReadError', async () => {
    const supabase = stubClient({ stocks: { data: null, error: ERR } });
    await expect(readStockRow(supabase, 'AAPL')).rejects.toThrow(StockReadError);
  });

  test('the price_bars COUNT read throws StockReadError', async () => {
    const supabase = stubClient({
      rpc: { data: null, error: ERR },
      count: { count: null, error: ERR },
    });
    await expect(loadPriceBars(supabase, 'AAPL')).rejects.toThrow(StockReadError);
  });

  test('a price_bars PAGE read throws StockReadError', async () => {
    const supabase = stubClient({
      rpc: { data: null, error: ERR },
      count: { count: 1500, error: null },
      page: { data: null, error: ERR },
    });
    await expect(loadPriceBars(supabase, 'AAPL')).rejects.toThrow(StockReadError);
  });

  test('the originating database error is preserved as `cause`', async () => {
    // Without this the 503 is untraceable: the owner cannot debug, so the reason
    // the read failed has to survive into the Vercel logs intact.
    const supabase = stubClient({ stocks: { data: null, error: ERR } });
    const err = await readStockRow(supabase, 'AAPL').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StockReadError);
    expect((err as StockReadError).cause).toEqual(ERR);
    expect((err as StockReadError).message).toContain('AAPL');
  });
});

test.describe('the control — a genuine absence must still be null, not a throw', () => {
  // Without these, "throw on everything" would pass every test above while
  // turning every 404 into a 503. The distinction is the entire point.
  test('a ticker that is not in our universe returns null', async () => {
    const supabase = stubClient({ stocks: { data: null, error: null } });
    await expect(readStockRow(supabase, 'NOTREAL')).resolves.toBeNull();
  });

  test('a stock with genuinely no bars returns an empty array', async () => {
    const supabase = stubClient({
      rpc: { data: null, error: ERR },
      count: { count: 0, error: null },
    });
    await expect(loadPriceBars(supabase, 'NEWIPO')).resolves.toEqual([]);
  });

  test('the RPC fast path returns bars without touching the fallback', async () => {
    const bars = [{ date: '2026-01-02', open: 1, high: 2, low: 1, close: 2, volume: 10 }];
    const supabase = stubClient({
      rpc: { data: bars, error: null },
      // The fallback would throw if it ran — so resolving proves it did not.
      count: { count: null, error: ERR },
    });
    await expect(loadPriceBars(supabase, 'AAPL')).resolves.toEqual(bars);
  });
});
