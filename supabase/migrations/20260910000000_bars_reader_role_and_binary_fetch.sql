-- A least-privilege Postgres login that can do ONE thing: fetch price bars.
--
-- ── Why a direct connection at all (measured 2026-09-08) ────────────────────
-- Three full 761-ticker runs on the live product, with `/rest/v1/stocks` (a tiny
-- query this work never touches) used as a control for how busy the instance was:
--
--     encoding / concurrency        price fetch   /stocks control   ratio
--     text JSON,   6 concurrent        787 ms          44 ms        17.9x
--     base64 JSON, 12 concurrent     3,330 ms         629 ms         5.3x
--     base64 JSON, 6 concurrent      1,244 ms         152 ms         8.2x
--
-- Postgres itself does the work in 16-23 ms in every case. The 700-1,200 ms is
-- the REST layer in front of it: PostgREST building JSON, then gzip. Published
-- measurements put gzip at up to 54% of CPU under load, and this instance is
-- 2 shared ARM cores — Micro, Small AND Medium are all "2-core shared" on
-- Supabase's own compute table, so paying for a bigger tier buys memory, not the
-- CPU this needs. Only Large has dedicated cores.
--
-- A direct connection removes that layer entirely. For AAPL:
--
--     text JSON        785,136 B   (+ gzip on the server)
--     base64 JSON      441,642 B   (+ gzip on the server)
--     raw binary       322,704 B   (no JSON, no base64, no compression)
--
-- ── Why NOT the `postgres` superuser ────────────────────────────────────────
-- ⚠️ The credential Supabase hands you for a direct connection is the `postgres`
-- password, and putting that in Vercel would give the web app full read/write on
-- every table — strictly MORE power than it has today through PostgREST, where
-- RLS applies. A performance change must not widen the blast radius.
--
-- `mc_bars_reader` can execute one function and nothing else. Verified on the
-- live database rather than asserted (the F-024 lesson: a permission held back by
-- one layer cannot be tested, so check the catalogue, not the intent):
--
--     rolsuper/rolcreatedb/rolcreaterole/rolbypassrls   all false
--     table grants                                      0
--     function grants                                   1  (get_cycle_bars_bin)
--     role memberships                                  0
--     has_table_privilege price_bars / profiles / stocks  false / false / false
--     has_function_privilege get_cycle_bars_bin           true
--
-- SECURITY DEFINER on the function is what makes that possible: `price_bars` has
-- RLS enabled with no policies, so an invoker-rights read returns zero rows for
-- any non-exempt role. Definer rights keep this a one-function grant instead of
-- needing BYPASSRLS on the role, which would be far broader.
--
-- ⚠️ NO PASSWORD IS SET HERE, deliberately. `pg_authid.rolpassword` is NULL, so
-- the role cannot authenticate at all until the owner sets one in the Supabase
-- SQL editor. The credential never passes through the assistant or this repo.
-- (Check it with pg_authid, not pg_roles — pg_roles masks every password as
-- '********', so `rolpassword is not null` there is true for every role and tells
-- you nothing.)

create or replace function public.get_cycle_bars_bin(p_ticker text)
returns bytea
language sql
stable
security definer
set search_path = public
as $$
  -- n (int32) | dates n*int32 epoch-days | high, low, close each n*float8
  -- All big-endian, ordered by date.
  select case when count(*) = 0 then null else
      int4send(count(*)::int)
   || string_agg(int4send((date - DATE '1970-01-01')), ''::bytea order by date)
   || string_agg(float8send(high::float8),  ''::bytea order by date)
   || string_agg(float8send(low::float8),   ''::bytea order by date)
   || string_agg(float8send(close::float8), ''::bytea order by date)
  end
  from price_bars
  where ticker = p_ticker;
$$;

revoke execute on function public.get_cycle_bars_bin(text) from public;
revoke execute on function public.get_cycle_bars_bin(text) from anon;
revoke execute on function public.get_cycle_bars_bin(text) from authenticated;
grant  execute on function public.get_cycle_bars_bin(text) to service_role;

comment on function public.get_cycle_bars_bin(text) is
  'Raw binary High/Low/Close history for the screener, over a DIRECT Postgres connection. '
  'Layout: int32 n | n*int32 epoch-days | 3 x n*float8, all big-endian, ordered by date. '
  'SECURITY DEFINER so mc_bars_reader needs no table grants. See web/api/analyze.py.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mc_bars_reader') then
    create role mc_bars_reader with login noinherit
      nosuperuser nocreatedb nocreaterole nobypassrls
      connection limit 20;
  end if;
end $$;

revoke all on schema public from mc_bars_reader;
grant usage on schema public to mc_bars_reader;
grant execute on function public.get_cycle_bars_bin(text) to mc_bars_reader;

comment on role mc_bars_reader is
  'Screener price-bar fetch over a direct Postgres connection. May EXECUTE get_cycle_bars_bin and nothing else.';
