// Reading a whole table from PostgREST, without silently losing the tail of it.
//
// PostgREST caps every response at `db-max-rows`, which on this project is
// **exactly 1000** — verified against the live database, not assumed: an
// unpaginated `select` on `price_bars` (6.5M rows) returns 1000 rows, and one on
// `listings` (8,964 rows) returns 1000. There is no error, no warning and no
// truncation flag. The caller gets a short array and believes it is the whole
// table.
//
// That makes it a bug that arrives with GROWTH rather than with a code change.
// The universe auto-expands every time a reader requests a ticker (locked
// decision #12), so `stocks` walks toward the cap on its own — it was at 867 the
// day this was written. Nothing would have gone red on the day it crossed 1000;
// the peer medians would just quietly have been computed from an arbitrary
// subset, and the nightly refresh would quietly have stopped enriching whatever
// fell off the end.
//
// Use `selectAll` for any table that can outgrow 1000 rows. Direct `.select()`
// is still correct when the result is bounded by the query itself — a
// `.eq('ticker', …).maybeSingle()`, or an `.in('symbol', symbols)` whose input
// list is short. `web/scripts/check-pagination.mjs` fails the build if an
// unbounded read on a growing table appears anywhere.

/** PostgREST's hard row cap per response on this project. */
export const POSTGREST_MAX_ROWS = 1000;

/**
 * Drain a PostgREST query page by page until a short page proves the end.
 *
 * Pass a *factory* rather than a query: a PostgREST builder is single-use, so
 * each page needs a fresh one. The factory receives the half-open range for the
 * page it should fetch.
 *
 * ```ts
 * const rows = await selectAll((from, to) =>
 *   supabase.from('stocks').select('ticker,fundamentals').neq('market', 'index').range(from, to),
 * );
 * ```
 *
 * Ordering note: pass an `.order()` in the factory when the pages must not
 * overlap or skip rows. Without one, Postgres may return rows in a different
 * order between pages and a row can be seen twice or not at all.
 *
 * On error the pages fetched so far are returned rather than throwing, matching
 * the graceful-degradation posture of the callers (an empty peer median renders
 * "—", it does not break the page).
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize: number = POSTGREST_MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < pageSize) break; // a short page is the only proof of the end
  }
  return rows;
}
