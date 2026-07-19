-- Drop the dead `trial_tombstones.card_fingerprint` column + its index.
--
-- Built in 20260715000000 for the ORIGINAL Step 7 "detect a reused card at the webhook and
-- end the trial (charge immediately)" mechanism, which the owner rejected as a surprise
-- charge. The shipped trial-abuse guard is email-only (`email_hash`, web/lib/trialGuard.ts);
-- the same-card-across-different-emails vector is Stripe Radar's Free-trial-abuse control
-- (a Dashboard setting), never our column. The column was never written or read by any code,
-- and the Supabase performance advisor flagged `trial_tombstones_card_fp_idx` as unused.
-- Removing dead schema.

drop index if exists public.trial_tombstones_card_fp_idx;

alter table public.trial_tombstones
  drop column if exists card_fingerprint;

comment on table public.trial_tombstones is
  'Trial-abuse guard: sha256 email_hash of consumed free trials. NOT a FK to profiles (must survive account deletion). RLS on, no policies (service-role only). Reused email -> no-trial checkout (billed day one, no free week). The same-card-across-different-emails vector is Stripe Radar''s Free-trial-abuse control (Dashboard), not code.';
