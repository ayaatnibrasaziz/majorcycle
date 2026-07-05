-- F0.5 auth hardening — finding M (perf): unindexed foreign keys.
--
-- Three FK columns have no covering index, so a DELETE/UPDATE on the referenced
-- parent row (or a join/filter on the FK) forces a sequential scan of the child
-- table. Adding a covering index on each clears the Supabase
-- `unindexed_foreign_keys` advisor notices and keeps cascade deletes cheap:
--   analysis_runs.user_id       → profiles(id) ON DELETE CASCADE
--   ticker_requests.requested_by → profiles(id) ON DELETE SET NULL
--   universe_log.added_by_user  → profiles(id)
--
-- IF NOT EXISTS keeps this migration idempotent.

CREATE INDEX IF NOT EXISTS idx_analysis_runs_user_id
  ON public.analysis_runs (user_id);

CREATE INDEX IF NOT EXISTS idx_ticker_requests_requested_by
  ON public.ticker_requests (requested_by);

CREATE INDEX IF NOT EXISTS idx_universe_log_added_by_user
  ON public.universe_log (added_by_user);
