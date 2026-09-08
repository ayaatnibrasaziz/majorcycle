-- Screener perf, round two: the same bars in HALF the bytes, losslessly.
--
-- ── Why (measured 2026-09-08/09) ────────────────────────────────────────────
-- After 20260908000000 a 761-ticker screen fell from 1,529s to 173-302s. Profiled
-- again, almost none of what is left is computation:
--
--     gunzip + json + DataFrame + analyze_ticker      35.7 ms    3%
--     waiting on Supabase                          ~1,327 ms   97%
--
-- and inside the database side ONE call is 94% of it — `get_cycle_bars_json`,
-- 785 calls at 787 ms average during a real run (the project's own edge logs).
-- Postgres executes that function in 15-45 ms warm, so the rest is PostgREST
-- serialising, gzipping and shipping 785 KB per ticker. Cost tracks PAYLOAD:
-- in the same run `/rest/v1/stocks` (a single small row) averaged 47 ms against
-- that call's 787 ms, same client, same moment.
--
-- So the lever is bytes. This function sends the identical numbers in binary.
--
--     A  current (4 comma-joined text columns)   785,136 B     45.1 / 17.0 ms
--     B  base64 float8 prices + text dates       505,355 B     24.8 ms
--     D  all base64, dates as int4 epoch-days    441,642 B     21.3 ms   <- ships
--
--   whole 761-ticker run:   raw 469 MB -> 262 MB (-44%)
--                          gzip 167 MB -> 146 MB (-12%)
--
-- Raw is what PostgREST must build and gzip; compressed is what crosses the
-- wire. Both fall, so this helps whichever of the two is the binding constraint
-- — which matters, because the instruments here cannot separate them: Supabase's
-- `origin_time` includes delivery to the caller, so a reading taken from this
-- developer's machine measures that machine's bandwidth (11ay's footnote, the
-- same trap one layer along).
--
-- ── Why BINARY is exact where ROUNDING was not ──────────────────────────────
-- ⚠️ The obvious saving is not available and this is recorded so nobody retries
-- it. The prices are float32 artefacts stored at full width — `319.9700012207031`
-- for a real 319.97 — so 79% of the old payload is noise digits, and rounding to
-- 4 dp halves it while moving no price by more than 0.00005. It was MEASURED
-- across 26 tickers x 3 presets: 73 of 78 analyses changed, AAPL lost a pullback
-- event (662 -> 661) and its Valuation Score moved 29.7 -> 29.8. That is exactly
-- the silent drift CLAUDE.md 11c-iii forbids, so it is rejected on evidence.
--
-- `float8send` is not a rounding: `numeric -> float8` is the nearest double to the
-- stored decimal, which is the value the analysis has always wanted.
--
-- ⚠️ I FIRST WROTE THAT THE TWO ENCODINGS ARE BIT-IDENTICAL. THEY ARE NOT, and
-- checking rather than asserting it turned up a defect in the path that ships
-- TODAY. Compared over 21 tickers, every frame differed — by 1 to 14 ULP, ~2e-15
-- relative. The cause is not this function: `pd.to_numeric` is a FAST float
-- parser and is not correctly rounded. Given the stored text 0.09812240302562714
-- it returns 0.0981224030256271, while Python's `float()` returns the stored
-- value exactly; on AAPL's close column it disagrees with `float()` on 4,584 of
-- 11,525 values (40%).
--
-- That parser is in `_bars_to_df` AND `_columns_to_df`, so it predates the
-- 20260908 change and every reading the product has ever produced carries it.
-- The binary path parses no strings at all, so it is FASTER AND MORE ACCURATE:
-- the numbers move by ~1e-15, toward what is actually stored.
--
-- ⚠️ Note the difference in kind from the rejected rounding, because the two
-- look similar and are not. Rounding to 4 dp moved values by 5e-5 AWAY from the
-- stored figure and changed 73 of 78 analyses. This moves them by 2e-15 TOWARD
-- it and changed 0 of 63 (21 tickers x 3 presets, all fields of CycleAnalysis).
-- `analytics/tests/test_analyze_columns.py` pins both halves: that the decoder
-- equals a correctly-rounded parse, and that the analyses still agree.
--
-- ⚠️ A 4-BYTE float would be smaller again and is NOT safe. Every `close` in a
-- 123,395-row sample is exactly a float32 (0 failures) — but `high` fails 78% of
-- the time and `low` 78%, because the adjustment factor makes them true float64.
-- A per-column encoding would be a trap for the next person; float8 throughout.
--
-- ⚠️ THE DATES STAY REAL. `int4send(date - 1970-01-01)` is a compact encoding of
-- the actual calendar date, not a synthetic index. CLAUDE.md 11ay records the
-- rejected alternative — dropping dates and fabricating an index, worth another
-- ~63 KB per ticker — as the invisible way to be wrong. This keeps the visible one.
--
-- ── Byte layout ─────────────────────────────────────────────────────────────
--   n : bar count
--   d : base64, n x int32  big-endian, days since 1970-01-01
--   h : base64, n x float8 big-endian (IEEE 754), same for l and c
-- All four are ordered by date, and the length check in `_columns_to_df` is
-- load-bearing: four aggregates over one scan cannot disagree, but if they ever
-- did, numpy would hand back a short array and the frame would go quietly out of
-- alignment — a wrong number that looks like a right one.
--
-- ⚠️ NOT a replacement for `get_cycle_bars_json`, which stays as the fallback so
-- a deploy and a migration can land in either order without a broken window, and
-- NOT for `get_price_bars_json`, which still serves the Stock Detail chart and
-- genuinely needs open, volume and every date.
--
-- ── Security ────────────────────────────────────────────────────────────────
-- Same posture as its sibling: SECURITY INVOKER (the default) + STABLE + a pinned
-- search_path. `price_bars` has RLS on, no policies and no grants to anon /
-- authenticated, so an invoker-rights function cannot return a row to a caller who
-- could not already read it.
--
-- ⚠️ ALL THREE REVOKES ARE REQUIRED. `revoke ... from public` alone leaves
-- `anon=X/authenticated=X` in pg_proc.proacl, because Supabase's DEFAULT
-- PRIVILEGES grant EXECUTE on every new function in `public` to both roles and
-- `create or replace` re-applies them. That bit us on 20260908000000: the
-- migration claimed a least-privilege posture the database did not have, and only
-- reading the ACL back off the live database showed it (11y; F-024 one object over).

create or replace function public.get_cycle_bars_b64(p_ticker text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case
    when count(*) = 0 then null
    else jsonb_build_object(
      'n', count(*),
      'd', encode(string_agg(int4send((date - DATE '1970-01-01')), ''::bytea order by date), 'base64'),
      'h', encode(string_agg(float8send(high::float8),  ''::bytea order by date), 'base64'),
      'l', encode(string_agg(float8send(low::float8),   ''::bytea order by date), 'base64'),
      'c', encode(string_agg(float8send(close::float8), ''::bytea order by date), 'base64')
    )
  end
  from price_bars
  where ticker = p_ticker;
$$;

revoke execute on function public.get_cycle_bars_b64(text) from public;
revoke execute on function public.get_cycle_bars_b64(text) from anon;
revoke execute on function public.get_cycle_bars_b64(text) from authenticated;
grant  execute on function public.get_cycle_bars_b64(text) to service_role;

comment on function public.get_cycle_bars_b64(text) is
  'Binary High/Low/Close history for the screener (web/api/analyze.py). '
  'Returns {n, d, h, l, c}: d is base64 int32 epoch-days, h/l/c base64 float8, all big-endian, ordered by date. '
  'Same numbers as get_cycle_bars_json at 56% of the bytes, and MORE exact: no string parsing, so it avoids pd.to_numeric rounding (~2e-15). Not for the Stock Detail chart -- see get_price_bars_json.';
