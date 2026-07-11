-- Part B — account self-deletion (soft-delete + 30-day grace + purge cron).
-- See docs/data-contracts.md (§profiles) and the F2 runbook.

-- 1) universe_log.added_by_user is an audit breadcrumb; it must not block deleting
--    the profile it points at. NO ACTION -> SET NULL so a hard delete cascades
--    cleanly. (profiles.id -> auth.users is already ON DELETE CASCADE; analysis_runs
--    cascades; ticker_requests.requested_by is already SET NULL — universe_log was
--    the last remaining blocker.)
alter table public.universe_log
  drop constraint universe_log_added_by_user_fkey,
  add constraint universe_log_added_by_user_fkey
    foreign key (added_by_user) references public.profiles(id) on delete set null;

-- 2) Soft-delete marker. When set, the account is scheduled for permanent deletion
--    at this timestamp (30-day grace); cleared on reactivation; the purge cron
--    hard-deletes rows whose time has passed. Deliberately NOT added to the
--    authenticated column-UPDATE grant (20260705032433) — only the service role
--    (the delete action / reactivation / purge route) may set or clear it.
alter table public.profiles
  add column if not exists deletion_scheduled_at timestamptz;

comment on column public.profiles.deletion_scheduled_at is
  'When set, the account is soft-deleted and will be permanently purged at this timestamp (30-day grace). Cleared on reactivation. Service-role-only (excluded from the authenticated UPDATE grant).';
