-- Drop the now-dead `profiles.frozen_trial_ms` column.
--
-- It backed the original freeze/restore trial-deletion model. F3 Step 6 replaced
-- that with cancel-at-trial-end (`cancel_at_period_end`), so trial + paid deletion
-- are one identical mechanism and this column is never read or written by any code.
-- Removed here as a standalone cleanup (owner request, 2026-07-19).
--
-- The other Step-1 billing columns stay: grace_until (payment-failure grace),
-- billing_blocked (chargeback lock), trial_reminder_sent (reminder de-dupe) — all
-- reserved for Step 8.

alter table public.profiles
  drop column if exists frozen_trial_ms;
