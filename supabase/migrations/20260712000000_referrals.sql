-- Part C — refer-a-friend. One row per invite email sent (used for the
-- per-user daily rate-limit, duplicate-invite guard, and audit).
create table if not exists public.referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references public.profiles(id) on delete cascade,
  friend_email  text not null,
  message       text,
  created_at    timestamptz not null default now()
);

-- Drives the rate-limit ("how many did I send in the last 24h?") and the
-- duplicate-invite lookup ((referrer_id, friend_email) recently).
create index if not exists referrals_referrer_created_idx
  on public.referrals (referrer_id, created_at desc);

alter table public.referrals enable row level security;

-- A signed-in user may read only their own referral history.
create policy "referrals_select_own" on public.referrals
  for select using (auth.uid() = referrer_id);

-- A signed-in user may create referrals only as themselves (referrer_id is
-- their own uid). The server action additionally enforces validation, the
-- rate-limit, and the self-referral / duplicate guards.
create policy "referrals_insert_own" on public.referrals
  for insert with check (auth.uid() = referrer_id);

comment on table public.referrals is
  'F2 Part C refer-a-friend: one row per invite email sent. referrer_id -> profiles ON DELETE CASCADE (a deleted account takes its referral history with it). RLS: owner-only select + insert; no update/delete policy (immutable audit rows).';
