-- Perf (Supabase advisor 0003 auth_rls_initplan): the referrals policies from
-- 20260712000000_referrals.sql call auth.uid() directly, so Postgres re-evaluates
-- it for every row scanned. Wrapping it in a scalar subselect — (select auth.uid())
-- — makes the planner evaluate it ONCE per statement (an InitPlan), which is the
-- pattern profiles + analysis_runs already use. Behaviour is unchanged: a signed-in
-- user still reads/inserts only their own referral rows; only the query plan improves.
-- See https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own" on public.referrals
  for select using ((select auth.uid()) = referrer_id);

drop policy if exists "referrals_insert_own" on public.referrals;
create policy "referrals_insert_own" on public.referrals
  for insert with check ((select auth.uid()) = referrer_id);
