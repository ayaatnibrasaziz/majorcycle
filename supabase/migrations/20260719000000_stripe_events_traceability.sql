-- F3 Step 6 — stripe_events traceability (post-launch auditability).
-- Plan: ~/.claude/plans/lovely-napping-neumann.md Part G. Docs: data-contracts.md §10.
--
-- The idempotency ledger (20260715000000) stored only (id, type, received_at) — no way
-- to tell WHOSE event a row was. These additive columns let the webhook stamp each
-- processed event with the resolved user + Stripe customer/subscription, so a
-- post-launch issue is a single `select … where user_id = …` instead of guesswork.
-- Still service-role-only: RLS stays enabled with NO policies (the webhook writes via
-- the service-role admin client, which bypasses RLS). No authenticated grant is added.

alter table public.stripe_events
  add column if not exists user_id                uuid
    references auth.users (id) on delete set null,   -- keep the audit row after a purge
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text;

comment on column public.stripe_events.user_id is
  'Profile/auth user this event resolved to (set by the webhook after handling). ON DELETE SET NULL so the audit row survives an account purge. Service-role-only.';
comment on column public.stripe_events.stripe_customer_id is
  'Stripe customer id (cus_…) the event related to, when resolvable. Service-role-only.';
comment on column public.stripe_events.stripe_subscription_id is
  'Stripe subscription id (sub_…) the event related to, when resolvable. Service-role-only.';

-- Audit lookups are "all events for this user" (and occasionally by customer).
create index if not exists stripe_events_user_id_idx
  on public.stripe_events (user_id);
create index if not exists stripe_events_customer_id_idx
  on public.stripe_events (stripe_customer_id);
