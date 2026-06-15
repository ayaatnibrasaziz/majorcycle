-- Security hardening surfaced by the Supabase advisor after the auth/RPC changes.

-- 1) Pin search_path on the price-bars RPC (linter: function_search_path_mutable).
create or replace function public.get_price_bars_json(p_ticker text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', date, 'open', open, 'high', high, 'low', low, 'close', close, 'volume', volume
      ) order by date
    ),
    '[]'::jsonb
  )
  from price_bars
  where ticker = p_ticker;
$$;

-- 2) Remove both functions from the public REST RPC surface. get_price_bars_json
--    is only called server-side with the service-role key; handle_new_user is a
--    trigger function only. The on_auth_user_created trigger keeps firing (the
--    trigger mechanism doesn't check EXECUTE on the inserting role). anon/
--    authenticated inherit EXECUTE via PUBLIC, so revoke from PUBLIC as well.
revoke execute on function public.get_price_bars_json(text) from anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
