-- ─────────────────────────────────────────────────────────────────────────────
-- A READY-BUILT copy of each ticker's screener price package (2026-09-26).
--
-- WHY. `get_cycle_bars_bin(ticker)` builds its package from `price_bars` on every
-- call. Measured on the live database, 25 US tickers: 329 ms warm, 4,142 ms cold —
-- twelve times slower, because the covering index it reads is 796 MB against 224 MB
-- of shared_buffers, so a full screen reads most of it from disk every time. Screens
-- measured the same morning: short 63 s, medium 86 s, long 66 s.
--
-- The package for every ticker together is ~200 MB — small enough to stay in memory —
-- and, stored, costs no per-call rebuild (0.38 ms against 17.9 ms, measured
-- 2026-09-09 in the commit that reverted the result cache).
--
-- CORRECTNESS is the whole design, because a stale package is a wrong rating:
--   • every write to price_bars — the nightly refresh, a dividend or split re-pull,
--     a new ticker, anything — bumps that ticker's `version`, by TRIGGER, so no write
--     path can forget to;
--   • `get_cycle_bars_packed` returns the stored package ONLY when it was built from
--     the current version; otherwise it builds it live (exactly today's work) and
--     stores it — and stores it only if no write landed while it was building
--     (`where version = v_version`), so a race can leave a package stale-and-marked,
--     never stale-and-trusted;
--   • the bytes are `get_cycle_bars_bin`'s own, so a fresh package is byte-identical
--     to the live build (checked across every ticker after the backfill).
--
-- This stores raw price data in a second layout, never a rating (CLAUDE.md #15).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.price_bars_cycle_pack (
  ticker        text primary key,
  version       bigint not null default 1,
  built_version bigint,
  bin           bytea
);

-- Floats do not compress; skip the attempt on every read and write.
alter table public.price_bars_cycle_pack alter column bin set storage external;

-- Server-only: no policy, and no grant to either public role (CLAUDE.md 11y).
alter table public.price_bars_cycle_pack enable row level security;
revoke all on public.price_bars_cycle_pack from public, anon, authenticated;

create or replace function public.bump_cycle_pack_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.price_bars_cycle_pack (ticker, version)
  select distinct ticker, 1 from changed
  on conflict (ticker) do update
    set version = public.price_bars_cycle_pack.version + 1;
  return null;
end;
$$;
revoke all on function public.bump_cycle_pack_version() from public, anon, authenticated;

-- One trigger per event: a trigger with a transition table may name only one.
-- An upsert fires both the INSERT and the UPDATE statement triggers, so both halves
-- of it bump the version.
drop trigger if exists price_bars_cycle_pack_ins on public.price_bars;
drop trigger if exists price_bars_cycle_pack_upd on public.price_bars;
drop trigger if exists price_bars_cycle_pack_del on public.price_bars;
create trigger price_bars_cycle_pack_ins after insert on public.price_bars
  referencing new table as changed for each statement execute function public.bump_cycle_pack_version();
create trigger price_bars_cycle_pack_upd after update on public.price_bars
  referencing new table as changed for each statement execute function public.bump_cycle_pack_version();
create trigger price_bars_cycle_pack_del after delete on public.price_bars
  referencing old table as changed for each statement execute function public.bump_cycle_pack_version();

create or replace function public.get_cycle_bars_packed(p_ticker text)
returns bytea
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_version bigint;
  v_built   bigint;
  v_bin     bytea;
begin
  select version, built_version, bin
    into v_version, v_built, v_bin
    from public.price_bars_cycle_pack
   where ticker = p_ticker;

  if found and v_built = v_version and v_bin is not null then
    return v_bin;
  end if;

  v_bin := public.get_cycle_bars_bin(p_ticker);
  if v_bin is null then
    return null;
  end if;

  if found then
    -- Only if nothing was written while we built; otherwise leave it marked stale.
    update public.price_bars_cycle_pack
       set bin = v_bin, built_version = v_version
     where ticker = p_ticker and version = v_version;
  else
    -- A ticker whose bars predate the triggers. version 0 = "built before any
    -- write was counted"; the next write makes it 1 and the package stale.
    insert into public.price_bars_cycle_pack (ticker, version, built_version, bin)
    values (p_ticker, 0, 0, v_bin)
    on conflict (ticker) do nothing;
  end if;
  return v_bin;
end;
$$;
revoke all on function public.get_cycle_bars_packed(text) from public, anon, authenticated;
grant execute on function public.get_cycle_bars_packed(text) to service_role, mc_bars_reader;

-- Rebuild whatever is stale, in the background, so the first screen after a nightly
-- refresh does not pay for it.
--
-- ⚠️ A PROCEDURE that COMMITs after every ticker, not a function. One function call
-- is one transaction: it would hold each rebuilt package's row lock until all ~870
-- were done, and the nightly refresh's trigger, bumping one of those rows, would
-- wait on it — stalling the refresh for the length of the rebuild. Run by pg_cron as
-- the owner, so no SECURITY DEFINER (which would forbid the COMMIT anyway).
create or replace procedure public.rebuild_stale_cycle_packs(p_limit int default 1000)
language plpgsql
as $$
declare
  r record;
begin
  -- Session-level, so it survives the COMMITs below; set here rather than in the
  -- cron command, because a two-statement command runs as ONE transaction block and
  -- a procedure cannot COMMIT inside one.
  perform set_config('statement_timeout', '0', false);
  for r in
    select s.ticker
      from public.stocks s
      left join public.price_bars_cycle_pack p on p.ticker = s.ticker
     where p.ticker is null or p.built_version is distinct from p.version or p.bin is null
     limit p_limit
  loop
    perform public.get_cycle_bars_packed(r.ticker);
    commit;
  end loop;
end;
$$;
revoke all on procedure public.rebuild_stale_cycle_packs(int) from public, anon, authenticated;

-- Every 20 minutes: cheap when nothing is stale (one indexed anti-join), and it
-- catches every refresh however late GitHub starts it.
select cron.schedule(
  'rebuild-cycle-packs',
  '*/20 * * * *',
  $$ call public.rebuild_stale_cycle_packs(1000) $$
);
