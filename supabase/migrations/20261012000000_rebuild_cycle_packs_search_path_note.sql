-- The Supabase linter flags `public.rebuild_stale_cycle_packs` as
-- "function_search_path_mutable", and its suggested fix is `SET search_path = ''`.
-- DO NOT APPLY IT. A procedure with any SET clause may not COMMIT, and this one
-- commits after every ticker on purpose (see 20260926000000). Measured 2026-10-12
-- by running both shapes from pg_cron, the way the real job runs: the plain
-- procedure answered CALL, the pinned one failed every run with
-- "invalid transaction termination". The fix would stop the screener's price
-- packages rebuilding after each nightly refresh, silently, behind a green linter.
--
-- The lint's risk does not apply here: every name in the body is schema-qualified
-- (public.*, and set_config lives in pg_catalog, which is always searched first),
-- and only the owner can run it (EXECUTE is revoked from public, anon and
-- authenticated). So the warning stays, and this comment says why.
comment on procedure public.rebuild_stale_cycle_packs(int) is
  'Intentionally has no SET search_path: a procedure with a SET clause cannot COMMIT, and this one commits per ticker. Every name in the body is schema-qualified and EXECUTE is owner-only. See migration 20261012000000.';
