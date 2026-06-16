-- Security: close the anon read/write exposure on the data tables.
--
-- stocks / price_bars / universe_log are only ever accessed server-side with the
-- service-role key (which bypasses RLS). Enabling RLS with NO policies locks out
-- the public anon/authenticated roles entirely while the app + cron keep full
-- access. profiles + analysis_runs already have per-user RLS policies (see the
-- create_core_tables migration) and are unchanged.
--
-- The resulting "RLS enabled, no policy" advisor notices on these three tables
-- are INFO-level and intentional (the tables are deliberately not client-facing).

alter table public.stocks enable row level security;
alter table public.price_bars enable row level security;
alter table public.universe_log enable row level security;
