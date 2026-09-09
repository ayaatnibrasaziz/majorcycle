-- Per-ticker DATA VERSION — the stale-proofing behind the screener's shared cache.
--
-- ── Why a counter and not a webhook ──────────────────────────────────────────
-- The screener's results are cached outside this database (Vercel Runtime Cache,
-- see web/api/analyze.py). The obvious way to keep a cache honest is to fire a
-- webhook on every write and have the reader throw entries away. That is a
-- MESSAGE, and a message can fail to arrive: pg_net's worker can be down, the
-- receiver can 500, we can be mid-deploy. When it fails nothing is logged on the
-- reading side and the cache serves yesterday's numbers indefinitely — the exact
-- shape of CLAUDE.md 11z, where three stacked silences let a dead source look
-- healthy for a month.
--
-- So the version goes INTO the cache key instead. A stale entry is not deleted,
-- it is UNREACHABLE: nobody ever asks for version 4471 again once the counter
-- reads 4472. There is no delivery, so there is nothing to miss.
--
-- It is also wider than a webhook. A webhook only covers the writers somebody
-- remembered to attach one to; this fires inside the transaction of ANY write —
-- the nightly refresh, a split or dividend re-pull (11ae/11af), a hand edit in
-- the Studio, a migration, a backfill. Including writers that do not exist yet.
--
-- ⚠️ WATCH ALL THREE VERBS, NOT JUST INSERT. `daily_refresh._upsert_price_bars`
-- issues INSERT ... ON CONFLICT DO UPDATE, and in Postgres a conflicting row
-- takes the UPDATE path and fires UPDATE triggers, not INSERT ones. A trigger
-- armed only on INSERT would therefore sit silent on the case that matters most:
-- the full re-pulls that rewrite HISTORY without adding a bar. Measured on a
-- temp clone of price_bars before this was written — 6 upsert statements fired
-- 12 statement triggers, both paths every time.
--
-- ── Cost, measured before writing this (2026-09-09, live Micro instance) ─────
--   500-bar chunk, no trigger .......  7.1 ms
--   500-bar chunk, with trigger ..... 15.4 ms
--   5-bar chunk (a normal night) ....  0.6 ms
-- A normal night is ~761 small statements, so ~0.3 s on a ~40-minute job. A full
-- one-ticker re-pull (24 chunks) adds ~0.2 s. A whole-universe --repull-prices
-- adds ~2.5 minutes to a run already measured in hours.
--
-- Statement-level with transition tables, never FOR EACH ROW: a re-pull rewrites
-- 11,525 bars for one company and a row trigger would turn that into 11,525
-- separate updates of a single stocks row.

alter table public.stocks
  add column if not exists data_version bigint not null default 1;

comment on column public.stocks.data_version is
  'Bumped by trigger on ANY write to this row or to this ticker''s price_bars. '
  'Rides in the screener''s cache key so a cached analysis built from older data '
  'can never be found again. Never reset; never written by application code.';

-- ── stocks: bump itself ──────────────────────────────────────────────────────
-- BEFORE ... FOR EACH ROW so the bump is part of the same tuple write rather than
-- a second one, and so it cannot recurse.
--
-- ⚠️ THE COMPARISON IS `>`, NOT `IS DISTINCT FROM`, AND THAT COST A REAL HOLE.
-- The guard exists because `bump_price_bars_data_version` below sets the column
-- explicitly and must not then be incremented a second time. Written as "is it
-- different?", any write carrying a LOWER value was honoured — measured on the
-- live table, a single upsert sending data_version = 1 took a stock from 500 back
-- to 1. Every cached answer ever written at versions 1..500 became reachable
-- again, which is precisely the staleness this whole column exists to prevent,
-- arriving through the one door nobody watches: a write that looks like a
-- correction. Note the asymmetry — forgetting to bump costs one recompute, while
-- going backwards serves a wrong number, so the two failure directions are not
-- equally bad and the guard must be built for the worse one.
--
-- Nothing in the codebase sends this column today. That is not the argument: the
-- point of a trigger is to hold against writers that do not exist yet, including
-- a Studio edit, a restore, or an import that round-trips a whole row.
--
-- With `>` the counter is monotonic BY CONSTRUCTION. Any write that does not move
-- it forward falls through to old + 1, so there is no state in which a version is
-- ever seen twice.
create or replace function public.bump_stocks_data_version()
returns trigger
language plpgsql
as $$
begin
  if new.data_version > old.data_version then
    return new;  -- an explicit forward bump (the price_bars trigger); leave it
  end if;
  new.data_version := old.data_version + 1;
  return new;
end;
$$;

drop trigger if exists stocks_bump_data_version on public.stocks;
create trigger stocks_bump_data_version
  before update on public.stocks
  for each row
  execute function public.bump_stocks_data_version();

-- ── price_bars: bump the owning stock ────────────────────────────────────────
-- Three separate triggers because Postgres allows a trigger with transition
-- tables to cover exactly one event. They share one function, which branches on
-- TG_OP; plpgsql plans each statement lazily, so the branch that does not run
-- never touches the transition table it cannot see.
create or replace function public.bump_price_bars_data_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.stocks s
       set data_version = s.data_version + 1
     where s.ticker in (select distinct ticker from removed);
  else
    update public.stocks s
       set data_version = s.data_version + 1
     where s.ticker in (select distinct ticker from changed);
  end if;
  return null;
end;
$$;

drop trigger if exists price_bars_bump_i on public.price_bars;
create trigger price_bars_bump_i
  after insert on public.price_bars
  referencing new table as changed
  for each statement
  execute function public.bump_price_bars_data_version();

drop trigger if exists price_bars_bump_u on public.price_bars;
create trigger price_bars_bump_u
  after update on public.price_bars
  referencing new table as changed
  for each statement
  execute function public.bump_price_bars_data_version();

drop trigger if exists price_bars_bump_d on public.price_bars;
create trigger price_bars_bump_d
  after delete on public.price_bars
  referencing old table as removed
  for each statement
  execute function public.bump_price_bars_data_version();

-- ── Least privilege ──────────────────────────────────────────────────────────
-- Supabase re-grants EXECUTE to anon and authenticated on every CREATE OR REPLACE
-- (CLAUDE.md 11y / audit F-024), so the revoke has to sit in the same migration
-- as the function or it is undone the next time this file is applied. Neither
-- role holds any privilege on stocks or price_bars today, so neither can reach
-- these as triggers either — this closes the direct-call route as well.
revoke all on function public.bump_stocks_data_version() from public, anon, authenticated;
revoke all on function public.bump_price_bars_data_version() from public, anon, authenticated;

-- The screener reads data_version through the service role, which already holds
-- SELECT on stocks. No new grant is needed and none is given.
