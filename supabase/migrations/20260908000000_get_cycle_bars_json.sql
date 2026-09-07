-- Screener perf: a LEAN price-history fetch for the batch analysis endpoint.
--
-- ── The measurement that prompted it (2026-09-08) ────────────────────────────
-- A 761-ticker run took 1,529s, against ~200s for the same-sized run through
-- June and July (`analysis_runs`, which stores started_at/finished_at). Timed on
-- the live database, `get_price_bars_json('AAPL')` costs:
--
--     Execution Time: 825.827 ms      -- shared hit=1141 read=161
--
-- while the identical scan aggregated WITHOUT building a jsonb object per row is
--
--     Execution Time:  18.133 ms      -- count(*), max(high), min(low), max(close)
--
-- i.e. the index scan and the heap reads are not the cost at all: ~98% of the
-- time is `jsonb_build_object` running once per bar, 11,525 times for AAPL. At
-- 761 tickers that is ~630 seconds of database CPU for one screen — more than
-- the whole run used to take.
--
-- ── What this function does differently ─────────────────────────────────────
--   1. COLUMNAR, not row objects. Four delimited strings instead of 11,525
--      objects, so the six JSON keys are written once rather than once per bar.
--   2. ONLY the columns the screener reads. `calculate_cycle_metrics` uses High,
--      Low and Close and nothing else; `open` and `volume` were fetched, parsed
--      into the DataFrame and never touched.
--
--     get_price_bars_json('AAPL')    826 ms   1,809,324 bytes
--     get_cycle_bars_json('AAPL')     15 ms     785,322 bytes   (57% smaller)
--
-- ── Why the values are TEXT and not float8 ──────────────────────────────────
-- ⚠️ THIS IS THE PART THAT MATTERS, and the first draft got it wrong. The
-- obvious encoding is `array_agg(high::float8)` — smaller and faster still. But
-- Postgres renders a float8 at 15 significant digits by default
-- (`extra_float_digits = 0` on this instance), so 328.92999267578125 comes back
-- as 328.929992675781: every price ~1e-13 away from the stored numeric. A
-- comparison across 25 tickers matched **zero** of them. Two encodings of one
-- price history that "share a spec and still part company" is exactly CLAUDE.md
-- 11c-iii, and a 1e-13 shift can in principle flip a pullback event across its
-- threshold and change a published rating.
--
-- Four encodings were measured. Aggregating the numeric's OWN TEXT is both
-- exact by construction and the fastest of them, and joining with `string_agg`
-- rather than boxing each value in a jsonb array halves it again:
--
--     float8, 15 digits (default)   121 ms   801,531 bytes   NOT exact
--     float8, 17 digits             448 ms   854,466 bytes   exact
--     jsonb array of text            33 ms   923,618 bytes   exact
--     string_agg, comma-joined       15 ms   785,322 bytes   exact  <- ships
--
-- Verified across 40 random tickers: every date, high, low and close is a
-- byte-identical string to what `get_price_bars_json` emits. The 15-digit run
-- that matched 0 of 25 is kept as the control proving that check can fail (11p).
-- The Python side already coerces with `pd.to_numeric`, so strings cost nothing.
--
-- ⚠️ THE DATES ARE REAL. Only `df.index[-1]` is ever read (for `as_of`), so
-- sending the last date alone would be another ~107 MB smaller per run — and it
-- would mean handing the engine a fabricated index. Of two ways to be wrong,
-- prefer the visible one (11aa); a synthetic date index is the invisible one.
--
-- ⚠️ NOT a replacement for `get_price_bars_json`. That one still serves the
-- Stock Detail page (web/api/cycle.py, web/lib/stocks.ts), which draws a
-- candlestick chart and genuinely needs open, volume and every date. Two
-- readers, two different needs.
--
-- ── Security ────────────────────────────────────────────────────────────────
-- SECURITY INVOKER (the default) + STABLE + a pinned search_path, matching the
-- function it sits beside. `price_bars` has RLS enabled, NO policies and no
-- grants to `anon`/`authenticated`, so an invoker-rights function cannot return
-- a row to a caller who could not already read it.
--
-- EXECUTE is nonetheless revoked from PUBLIC and granted only to `service_role`
-- — tighter than `get_price_bars_json`, which still carries the PUBLIC default.
-- That is the least-privilege posture of `record_free_view`, and it follows the
-- rule from audit F-024: a permission held back by only ONE layer cannot be
-- tested, because its refusal is indistinguishable from silence (11y).
--
-- Guarded by analytics/tests/test_analyze_columns.py, which drives the real
-- `_bars_to_df` and `_columns_to_df` and asserts the full CycleAnalysis comes
-- out identical, with a control proving the comparison can fail.

create or replace function public.get_cycle_bars_json(p_ticker text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case
    when count(*) = 0 then null
    else jsonb_build_object(
      'n', count(*),
      'd', string_agg(date::text,  ',' order by date),
      'h', string_agg(high::text,  ',' order by date),
      'l', string_agg(low::text,   ',' order by date),
      'c', string_agg(close::text, ',' order by date)
    )
  end
  from price_bars
  where ticker = p_ticker;
$$;

-- ⚠️ ALL THREE REVOKES, and the two role-specific ones are not belt-and-braces.
-- `revoke ... from public` alone left this function reading
--   anon=X | authenticated=X | service_role=X
-- in pg_proc.proacl, because Supabase's DEFAULT PRIVILEGES grant EXECUTE on every
-- new function in `public` to both roles, and `create or replace` re-applies them.
-- The migration therefore claimed a least-privilege posture the database did not
-- have — found by reading the ACL back off the live database, which is the only
-- place that could have said so (11y: a permission held back by one layer cannot
-- be tested; F-024 is the same defect one object over).
--
-- Verified on the wire after applying, both directions:
--   anon key          -> HTTP 401, 42501 "permission denied for function"
--   service_role key  -> HTTP 200, the full history
-- The refusal is VISIBLE rather than an empty result, which is what makes it
-- testable at all.
revoke execute on function public.get_cycle_bars_json(text) from public;
revoke execute on function public.get_cycle_bars_json(text) from anon;
revoke execute on function public.get_cycle_bars_json(text) from authenticated;
grant execute on function public.get_cycle_bars_json(text) to service_role;

comment on function public.get_cycle_bars_json(text) is
  'Columnar High/Low/Close history for the screener (web/api/analyze.py). '
  'Returns {n, d, h, l, c} as comma-joined TEXT, or NULL when the ticker has no bars. '
  'Not for the Stock Detail chart -- that needs open/volume, see get_price_bars_json.';
