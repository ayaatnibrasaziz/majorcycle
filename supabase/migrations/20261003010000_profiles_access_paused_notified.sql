-- When the "your access is paused" email was sent for the CURRENT payment failure
-- (owner, 2026-10-03; beta review D-5). A failed card keeps access for the 3-day grace
-- window and then pauses it — and until now nothing told the customer when that
-- happened. The daily cron (web/app/api/cron/purge-accounts) sends the email once and
-- stamps this; a successful payment, or a NEW failure, clears it so the next lapse is
-- told too. Additive and nullable: no existing row or reader changes.
alter table public.profiles
  add column if not exists access_paused_notified_at timestamptz;

comment on column public.profiles.access_paused_notified_at is
  'When the access-paused email went out for the current payment failure. NULL = not sent. Cleared on recovery and on a new failure (web/app/api/stripe/webhook/route.ts).';
