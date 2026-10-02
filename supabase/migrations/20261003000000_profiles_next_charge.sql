-- ─────────────────────────────────────────────────────────────────────────────
-- The NEXT CHARGE, as Stripe itself will make it (2026-10-03).
--
-- WHY. The account page could say when a plan renews but not for how much. Showing
-- our own price table would be wrong the day anyone has a discount, tax or a
-- grandfathered price, so the owner asked for the real figure: "store the real charged
-- amount… so that it works in every case". `lib/billing/sync.ts` asks Stripe for a
-- preview of the subscription's next invoice and stores its total here.
--
-- WHAT. Three nullable columns. NULL means "nothing will be charged" (cancelling,
-- cancelled) or "Stripe could not say"; the page then shows the date alone, never a
-- guessed price (CLAUDE.md 11aa). While past_due, the payment-failed webhook writes the
-- FAILED invoice's amount instead (docs/data-contracts.md, profiles).
--
-- GRANTS. Nothing to add. A reader may already SELECT their own profile row (RLS), and
-- `authenticated` can UPDATE only display_name / country / acknowledged_disclaimer_at
-- (20260705032433, re-granted in 20260825000000), so these are written by the service
-- role alone.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists next_charge_amount integer,
  add column if not exists next_charge_currency text,
  add column if not exists next_charge_at timestamptz;

comment on column public.profiles.next_charge_amount is
  'Stripe''s own figure for the next charge, minor units. Written by lib/billing/sync.ts.';
comment on column public.profiles.next_charge_currency is
  'Currency of next_charge_amount (aud/usd/cad).';
comment on column public.profiles.next_charge_at is
  'When Stripe will take next_charge_amount.';
