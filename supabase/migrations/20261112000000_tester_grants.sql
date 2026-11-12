-- Beta-tester grants: free premium for a fixed period, switched OFF automatically.
--
-- Why: the Reddit beta offer ("first 100 testers, 6 months of premium, no card") is
-- granted by hand — `profiles.subscription_status = 'active'` with no Stripe record,
-- the same shape as the owner's own account. A hand grant has no end date, so every
-- tester would need a calendar reminder, and a forgotten one is free access forever.
--
-- What this adds:
--   * public.tester_grants — one row per grant: who, where they came from, when it
--     started, when it ends, and how it ended. The record of the promise.
--   * public.grant_tester_access(email, source, handle, months, notes) — the ONE way
--     to grant: refuses anyone already paying, writes the row and the profile together.
--   * public.end_expired_tester_grants() — run daily by pg_cron. Ends each grant
--     whose end date has passed, setting the profile to 'canceled' (the Account page
--     then says the subscription has ended and the free plan continues; `canceled`
--     may start a normal paid subscription later).
--
-- Safety:
--   * A tester who has since started paying is NEVER touched: the profile is only
--     changed while it still has no Stripe customer and no Stripe subscription and
--     is still 'active'. Otherwise the grant is closed as 'skipped_now_paying'.
--   * No email is sent on grant or on end (no Stripe record ⇒ no billing email fires).
--   * Service-role only: RLS on with no policies, and no grant/execute for the
--     public roles (CLAUDE.md 11y).

create table if not exists public.tester_grants (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  email           text not null,
  source          text not null,             -- e.g. 'reddit'
  source_handle   text,                      -- e.g. the Reddit username
  granted_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  ended_at        timestamptz,
  end_outcome     text check (end_outcome in ('ended', 'skipped_now_paying', 'skipped_not_active', 'revoked_by_hand')),
  notes           text
);

create unique index if not exists tester_grants_one_open_per_user
  on public.tester_grants (user_id) where ended_at is null;
create index if not exists tester_grants_due
  on public.tester_grants (expires_at) where ended_at is null;

alter table public.tester_grants enable row level security;
revoke all on public.tester_grants from anon, authenticated, public;

create or replace function public.grant_tester_access(
  p_email text,
  p_source text,
  p_handle text,
  p_months int default 6,
  p_notes text default null
) returns public.tester_grants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_prof public.profiles%rowtype;
  v_row public.tester_grants;
begin
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then
    raise exception 'No account with email %', p_email;
  end if;

  select * into v_prof from public.profiles where id = v_uid for update;
  if v_prof.stripe_customer_id is not null or v_prof.stripe_subscription_id is not null then
    raise exception 'Account % has a Stripe record; not granting by hand', p_email;
  end if;
  if v_prof.billing_blocked or v_prof.deletion_scheduled_at is not null then
    raise exception 'Account % is blocked or scheduled for deletion', p_email;
  end if;

  insert into public.tester_grants (user_id, email, source, source_handle, expires_at, notes)
  values (v_uid, lower(p_email), p_source, p_handle, now() + make_interval(months => p_months), p_notes)
  returning * into v_row;

  update public.profiles set subscription_status = 'active' where id = v_uid;
  return v_row;
end;
$$;

create or replace function public.end_expired_tester_grants()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g record;
  v_changed int;
  v_count int := 0;
begin
  for g in
    select * from public.tester_grants
     where ended_at is null and expires_at <= now()
     for update skip locked
  loop
    update public.profiles
       set subscription_status = 'canceled'
     where id = g.user_id
       and subscription_status = 'active'
       and stripe_customer_id is null
       and stripe_subscription_id is null;
    get diagnostics v_changed = row_count;

    update public.tester_grants
       set ended_at = now(),
           end_outcome = case
             when v_changed = 1 then 'ended'
             when exists (select 1 from public.profiles p where p.id = g.user_id
                           and (p.stripe_customer_id is not null or p.stripe_subscription_id is not null))
               then 'skipped_now_paying'
             else 'skipped_not_active'
           end
     where id = g.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.grant_tester_access(text, text, text, int, text) from public, anon, authenticated;
revoke all on function public.end_expired_tester_grants() from public, anon, authenticated;

-- Daily at 14:00 UTC (00:00–01:00 in eastern Australia).
select cron.schedule('end-expired-tester-grants', '0 14 * * *', $$ select public.end_expired_tester_grants() $$);
