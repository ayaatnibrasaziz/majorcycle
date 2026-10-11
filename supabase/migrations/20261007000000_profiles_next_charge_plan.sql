-- Which plan the stored next charge is FOR (2026-10-07, pre-merge audit of the beta-review
-- batch). It differs from `subscription_plan` only while a plan switch waits for the end
-- of the period: the Stripe Customer Portal now applies a downgrade (annual -> monthly) at
-- the period end, so for up to a year an annual customer's NEXT charge is a monthly one.
-- Without this the account card read "A$19.00/year" and the annual renewal email would
-- have told them their annual plan renews for the monthly amount. Additive and nullable:
-- NULL means "same as subscription_plan", which is every existing row.
alter table public.profiles
  add column if not exists next_charge_plan text
    check (next_charge_plan is null or next_charge_plan in ('monthly', 'annual'));

comment on column public.profiles.next_charge_plan is
  'Plan the stored next charge bills (monthly|annual), from the invoice preview''s period length. NULL = same as subscription_plan (web/lib/billing/nextCharge.ts).';
