-- Each real payment dispute on an account, open or closed (2026-10-07, pre-merge audit of
-- the beta-review batch).
--
-- A dispute PAUSES billing and holds access (web/lib/billing/dispute.ts); winning it
-- resumes both. That rule was decided per dispute, but the hold is per ACCOUNT, so a
-- customer with two disputes open at once — the usual shape of a stolen card, whose real
-- owner disputes every charge from us together — was unblocked and billed again the
-- moment the FIRST was won, while the second was still open. The next charge would then
-- have been disputed too. This table lets the webhook ask "is any other dispute on this
-- account still open, or already LOST?" before it lifts the hold — a lost dispute keeps
-- the account held for good, whatever happens to the others.
--
-- One row per dispute, upserted by id, so two disputes arriving at once can never
-- overwrite each other. Bank inquiries (`warning_*`) move no money and are not recorded.
create table if not exists public.billing_disputes (
  dispute_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  state text not null check (state in ('open', 'won', 'lost')),
  updated_at timestamptz not null default now()
);

create index if not exists billing_disputes_unsettled_by_user
  on public.billing_disputes (user_id) where state <> 'won';

comment on table public.billing_disputes is
  'Real payment disputes per account: open, won or lost. Written only by the Stripe webhook (service role); the hold on an account lifts only when none is open.';

-- Server-only: no policy, and no grant to either public role (CLAUDE.md 11y, audit F-026).
alter table public.billing_disputes enable row level security;
revoke all on public.billing_disputes from public, anon, authenticated;
