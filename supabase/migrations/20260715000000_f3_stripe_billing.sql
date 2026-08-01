-- F3 — Stripe subscriptions: billing columns + webhook idempotency + trial-abuse guard.
-- Plan: ~/.claude/plans/moonlit-prancing-lantern.md §1. Docs: data-contracts.md §10/§12.
--
-- ANTI-FREELOAD BACKBONE. Every new `profiles` column below is SERVICE-ROLE-ONLY:
-- deliberately NOT added to the authenticated column-UPDATE grant (20260705032433),
-- so a browser session (anon key + user JWT) can never write them. Only the Stripe
-- webhook — running with the service-role admin client, which bypasses column grants
-- and RLS — sets them. Entitlement is therefore server-derived Stripe truth that the
-- client cannot forge. Postgres enforces column privileges AND RLS together.

-- ── 1) profiles: new billing columns ────────────────────────────────────────
alter table public.profiles
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_currency  text,
  add column if not exists current_period_end     timestamptz,
  add column if not exists cancel_at_period_end    boolean not null default false,
  add column if not exists grace_until             timestamptz,
  add column if not exists frozen_trial_ms         bigint,
  add column if not exists billing_blocked         boolean not null default false,
  add column if not exists trial_reminder_sent     text;

comment on column public.profiles.stripe_subscription_id is
  'Active Stripe subscription id (sub_…) — needed for portal/cancel/sync. Service-role-only.';
comment on column public.profiles.subscription_currency is
  'Locked billing currency usd/aud/cad, fixed by country at checkout (mirrors why country locks). Service-role-only.';
comment on column public.profiles.current_period_end is
  'End of the current paid/trial period (Stripe current_period_end) — drives the "renews on" display and delete-during-paid logic. Service-role-only.';
comment on column public.profiles.cancel_at_period_end is
  'True when the sub is set to cancel at period end (user cancel in the Portal, or delete-during-paid). Service-role-only.';
comment on column public.profiles.grace_until is
  'Set to now()+3d on invoice.payment_failed; past_due beyond this hard-locks access. Cleared on payment success. Service-role-only.';
comment on column public.profiles.frozen_trial_ms is
  'Remaining trial in ms, recorded when a *trialing* account is deleted; restored on reactivation. Service-role-only.';
comment on column public.profiles.billing_blocked is
  'Access suspended by a chargeback/fraud dispute (charge.dispute.created). The gate treats true as no-access; cleared only if the dispute is won. Service-role-only.';
comment on column public.profiles.trial_reminder_sent is
  'Which trial-ending reminders have been sent (e.g. day5/day7) — prevents double-send by the reminder cron. Service-role-only.';

-- Note: we do NOT re-grant UPDATE on any of these to `authenticated`. The
-- 20260705032433 grant stays display_name/country/acknowledged_disclaimer_at only,
-- so all eight columns are client-immutable by construction.

-- ── 2) stripe_events: webhook idempotency ledger ────────────────────────────
-- Insert-on-first-sight of a Stripe event id; if the id already exists the webhook
-- returns 200 and skips, giving exactly-once side effects. Server-only: RLS enabled
-- with NO policies (the service-role webhook bypasses RLS) — same lockdown pattern as
-- stocks / price_bars / split_events (see 20260614020000_enable_rls_lockdown).
create table if not exists public.stripe_events (
  id          text        primary key,          -- Stripe event id (evt_…)
  type        text,                             -- event type, for debugging/observability
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

comment on table public.stripe_events is
  'Webhook idempotency ledger: one row per processed Stripe event id. RLS on, no policies (service-role only). The "RLS enabled, no policy" advisor notice is intentional.';

-- ── 3) trial_tombstones: trial-abuse guard (must survive account deletion) ──
-- Records a consumed free trial by hashed email + Stripe card fingerprint.
-- DELIBERATELY NOT a FK to profiles: it has to OUTLIVE a hard-deleted account so a
-- purged user cannot farm a fresh free trial. Written when a trial is first consumed
-- (checkout.session.completed) and at purge time. Server-only: RLS on, no policies.
create table if not exists public.trial_tombstones (
  id               uuid        primary key default gen_random_uuid(),
  email_hash       text,                        -- sha256(lower(trim(email)))
  card_fingerprint text,                        -- Stripe PaymentMethod card.fingerprint
  created_at       timestamptz not null default now()
);

-- Both columns are looked up individually (email at checkout; fingerprint at webhook),
-- and either may be null on a given row until the matching value is known.
create index if not exists trial_tombstones_email_hash_idx
  on public.trial_tombstones (email_hash);
create index if not exists trial_tombstones_card_fp_idx
  on public.trial_tombstones (card_fingerprint);

alter table public.trial_tombstones enable row level security;

comment on table public.trial_tombstones is
  'Trial-abuse guard: sha256 email_hash + Stripe card_fingerprint of consumed trials. NOT a FK to profiles (must survive account deletion). RLS on, no policies (service-role only). Reused email -> no-trial checkout; reused card fingerprint -> trial ended at webhook.';
