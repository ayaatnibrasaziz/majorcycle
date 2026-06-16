-- Layer D perf: one-shot price-history fetch.
--
-- PostgREST caps every REST response at 1000 rows, so reading a stock's full
-- daily history (AAPL ≈ 11.5k bars) meant ~12 separate cross-region round-trips.
-- This function aggregates the whole history into a SINGLE jsonb value, so the
-- caller (web/api/analyze.py via supabase.rpc) gets it in ONE request — the row
-- cap doesn't apply to a scalar result. Server-side aggregate measured ~230ms
-- for AAPL; combined with co-locating the function region near this DB it turns
-- a ~5.6s sequential load into a few hundred ms.
--
-- STABLE + read-only. The server calls it with the service-role key. Returns the
-- same shape the paginated select returns (date as text, OHLC numeric, volume).

create or replace function public.get_price_bars_json(p_ticker text)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', date,
        'open', open,
        'high', high,
        'low', low,
        'close', close,
        'volume', volume
      )
      order by date
    ),
    '[]'::jsonb
  )
  from price_bars
  where ticker = p_ticker;
$$;
