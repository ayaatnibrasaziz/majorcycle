-- price_bars: a key the screener can read ON ITS OWN, kept in order without ever
-- pausing the table — plus the database's own nightly housekeeping.
--
-- ── Why (2026-09-22) ─────────────────────────────────────────────────────────
-- A 765-stock screen took 838 s, then 343 s. The cause was LAYOUT, not the maths
-- and not the network: one company's rows were spread ~11 to a page where a page
-- holds ~59, because the nightly refresh appends one row per company per day and a
-- dividend/split re-pull deletes a whole history and re-inserts it into whatever
-- holes are free. A screen therefore read ~7x more of the disk than the data it
-- used, through a 224 MB cache. `CLUSTER price_bars USING price_bars_pkey` fixed it
-- once (80-company sample 54,912 -> 7,382 pages; screens 62 s then 25 s) — but a
-- CLUSTER locks the table for ~5 minutes and the scatter comes straight back.
--
-- ── The fix ──────────────────────────────────────────────────────────────────
-- The screener's readers (get_cycle_bars_json / _b64 / _bin) touch only ticker,
-- date, high, low and close. A B-tree on (ticker, date) that also CARRIES
-- high/low/close answers them entirely from the index ("index-only scan"), and a
-- B-tree stays in (ticker, date) order by construction — a re-pulled history goes
-- back into its own key range, not into somebody else's hole. So the screener stops
-- depending on the table's physical order at all.
--
-- It REPLACES the primary key rather than sitting beside it, so there is still one
-- index to maintain and upserts (`on_conflict=ticker,date`) are unchanged: the key
-- columns are identical, INCLUDE columns are not part of uniqueness.
--
-- ⚠️ In production the index was built with CREATE INDEX CONCURRENTLY (no lock)
-- before this ran; `if not exists` makes the line below a no-op there and a normal
-- build on a fresh database.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

create unique index if not exists price_bars_covering_idx
  on public.price_bars (ticker, date) include (high, low, close);

-- The swap holds an exclusive lock for milliseconds (no rebuild: the index exists).
alter table public.price_bars drop constraint price_bars_pkey;
alter table public.price_bars
  add constraint price_bars_pkey primary key using index price_bars_covering_idx;

-- ── Nightly housekeeping — none of it pauses anything ───────────────────────
-- Times are UTC and sit after each data refresh. GitHub has been starting the
-- scheduled refreshes ~5 h late (US+CA "01:30" lands ~06:30, AU "08:00" ~12:30),
-- so these are placed after the LATE times, not the nominal ones.

-- 1. VACUUM keeps the visibility map current, which is what lets the screener's
--    read skip the table entirely. Autovacuum would not do this for us: ~900 new
--    rows a night is far below its insert threshold on a 6.6M-row table. Plain
--    VACUUM takes no lock that blocks reads or writes.
select cron.schedule('price-bars-vacuum', '30 9,15 * * *',
  $$vacuum (analyze) public.price_bars$$);

-- 2. REBUILD the key weekly, CONCURRENTLY — readers and writers carry on
--    throughout. Deletes from re-pulls leave dead entries; this compacts them.
select cron.schedule('price-bars-reindex', '0 16 * * 0',
  $$reindex index concurrently public.price_bars_pkey$$);

-- 3. BACKSTOP for test leftovers (CLAUDE.md #20). A test's afterAll does not run
--    when a run is killed. `@example.com` is reserved (RFC 2606) and can never be a
--    customer. Only rows older than a day, so a test still running is never hit.
select cron.schedule('sweep-test-leftovers', '15 16 * * *', $$
  delete from public.stripe_events
   where id like 'evt\_e2e\_%' and received_at < now() - interval '1 day';
  delete from auth.users
   where email like '%@example.com' and created_at < now() - interval '1 day';
  delete from auth.sessions
   where user_id in (select id from auth.users where email = 'e2e@majorcycle.com')
     and coalesce(refreshed_at, updated_at, created_at) < now() - interval '1 day';
$$);
