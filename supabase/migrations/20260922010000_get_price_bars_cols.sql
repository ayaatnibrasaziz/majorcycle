-- The Stock Detail history, COLUMNAR — the same rows, a sixth of the database work.
--
-- ── Why (2026-09-22) ─────────────────────────────────────────────────────────
-- `get_price_bars_json` builds one jsonb OBJECT per bar — 11,535 of them for AAPL —
-- and CLAUDE.md 11ay already recorded that this construction, not the scan, is the
-- cost. It is the call behind every Stock Detail page (the candlesticks in
-- `lib/stocks.ts`, the cycle maths in `api/cycle.py`), and on 2026-09-22 it was the
-- query Postgres was cancelling under load: 44 "canceling statement due to statement
-- timeout" in one CI run, which made `cycle.py` fall back to paginated reads —
-- ~12 requests per ticker instead of 1 — and fed the overload that caused it.
--
-- Measured on the live database, interleaved (11ay: alternate the arms), AAPL:
--     get_price_bars_json   98.0 ms, 91.6 ms
--     this function         18.6 ms, 15.7 ms
--
-- ── The encoding, and why it is TEXT ─────────────────────────────────────────
-- Each column is the values joined with commas, in date order, as the numeric's own
-- TEXT — exact, for the reason 11ay/11az record: a float rendering loses the last
-- digits (94% of stored prices carry more than 15 significant digits), and a 1e-13
-- shift can in principle move a pullback across its threshold. The readers parse with
-- JavaScript's `Number()` and Python's `float()`, both correctly rounded.
--
-- NULL is the empty string, so a missing volume stays missing rather than becoming 0
-- (14b: an absent value must never read as a real one). No rows ⇒ n = 0.
--
-- ⚠️ `get_price_bars_json` is NOT dropped: `api/analyze.py` still names it as a late
-- fallback, and a function removed while a caller still names it fails at runtime, in
-- the quietest possible way — a degraded path nobody exercises until the day it runs.

create or replace function public.get_price_bars_cols(p_ticker text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'n', count(*),
    'd', string_agg(d, ','),
    'o', string_agg(o, ','),
    'h', string_agg(h, ','),
    'l', string_agg(l, ','),
    'c', string_agg(c, ','),
    'v', string_agg(v, ',')
  )
  from (
    select date::text                   as d,
           coalesce(open::text,   '')   as o,
           coalesce(high::text,   '')   as h,
           coalesce(low::text,    '')   as l,
           coalesce(close::text,  '')   as c,
           coalesce(volume::text, '')   as v
    from price_bars
    where ticker = p_ticker
    order by date
  ) s;
$$;

-- Same posture as every other bars RPC: the server role only. A reader's session must
-- never be able to pull a whole price history in one call.
revoke execute on function public.get_price_bars_cols(text) from public;
revoke execute on function public.get_price_bars_cols(text) from anon;
revoke execute on function public.get_price_bars_cols(text) from authenticated;
grant execute on function public.get_price_bars_cols(text) to service_role;

comment on function public.get_price_bars_cols(text) is
  'Columnar OHLCV history for one ticker: {n, d, o, h, l, c, v}, comma-joined TEXT in '
  'date order, NULL as the empty string. Six times cheaper than get_price_bars_json, '
  'which builds a jsonb object per bar. Readers: lib/stocks.ts, api/cycle.py.';
