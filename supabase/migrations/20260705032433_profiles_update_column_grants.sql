-- F0.5 auth hardening — findings E (billing-column lockdown) + L (RLS initplan).
--
-- E (HIGH, latent billing bypass): the profiles UPDATE policy is
-- `USING (auth.uid() = id)` with NO column restriction, so an authenticated user
-- can update ANY column of their own row from the browser (anon key + session) —
-- including subscription_status / subscription_plan / trial_ends_at /
-- stripe_customer_id. Once features are gated on subscription (roadmap #20), a
-- user could self-grant paid access with one client call. Fix: strip the blanket
-- table-level UPDATE privilege and re-grant it only on the three columns the
-- client legitimately writes (display_name, country via account settings;
-- acknowledged_disclaimer_at via the onboarding modal). Postgres enforces column
-- privileges AND RLS, so the billing columns become client-immutable. The cron
-- and Stripe webhooks keep writing them via the service-role key, which bypasses
-- both grants and RLS. (anon is already blocked by the RLS USING clause — for it
-- auth.uid() is null, so `null = id` is never true.)
--
-- L (perf): the four profiles/analysis_runs policies call auth.uid() directly,
-- which Postgres re-evaluates once PER ROW. Wrapping it as `(select auth.uid())`
-- lets the planner evaluate it once per query (initplan). Same semantics, faster
-- at scale; clears the Supabase `auth_rls_initplan` advisor warnings.

-- ── E: column-level UPDATE grant on profiles ────────────────────────────────
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, country, acknowledged_disclaimer_at)
  ON public.profiles TO authenticated;

-- ── L: rewrite the per-row auth.uid() policies as once-per-query initplans ───
DROP POLICY IF EXISTS "users read own profile" ON public.profiles;
CREATE POLICY "users read own profile"
  ON public.profiles FOR SELECT
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
  ON public.profiles FOR UPDATE
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "users read own runs" ON public.analysis_runs;
CREATE POLICY "users read own runs"
  ON public.analysis_runs FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users insert own runs" ON public.analysis_runs;
CREATE POLICY "users insert own runs"
  ON public.analysis_runs FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
