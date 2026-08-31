-- The two public roles get exactly the verbs the row policies allow, and nothing
-- else. Audit F-026, owner-approved 2026-08-25.
--
-- ── What was here before ────────────────────────────────────────────────────
-- Supabase grants ALL privileges on a new public table to `anon` and
-- `authenticated`, and safety then rests entirely on row-level security. Measured
-- across all 12 public tables the day before this migration, both roles held
-- SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER **and TRUNCATE** on every
-- one, with two deliberate exceptions: `authenticated`'s three-column UPDATE on
-- `profiles` (July) and `anon` on `profiles`, narrowed to SELECT the same day as
-- this (migration 20260825000000, audit F-024).
--
-- ⚠️ `TRUNCATE` is the one that deserves naming, because **row-level security does
-- not apply to it**. RLS governs SELECT/INSERT/UPDATE/DELETE; a TRUNCATE is not
-- filtered by any policy. So for that one verb the layer everything else rests on
-- was simply absent.
--
-- ⚠️ It was NOT reachable, and that was checked rather than assumed: PostgREST
-- only ever issues SELECT/INSERT/UPDATE/DELETE and function calls — it has no path
-- that emits TRUNCATE — and both roles have `rolcanlogin = false`, so nobody can
-- connect to Postgres directly as either. This is defence in depth, not a patched
-- hole. But "unreachable today" is exactly where F-024 started.
--
-- ── The rule ────────────────────────────────────────────────────────────────
-- Nine tables carry NO policy at all. That is their intended state — they are
-- read and written server-side with the service-role key, which bypasses RLS —
-- and it means both public roles already get nothing through the API. Revoking
-- their grants changes no behaviour and removes the verbs RLS never covered.
--
-- The three tables that DO carry policies get grants matching those policies
-- exactly, verified against `pg_policy` rather than from memory:
--
--     analysis_runs   SELECT + INSERT, own rows      (auth.uid() = user_id)
--     referrals       SELECT + INSERT, own rows      (auth.uid() = referrer_id)
--     profiles        SELECT + UPDATE, own row       (auth.uid() = id)
--
-- Every call site was checked before writing this. Everything touching the nine
-- policy-less tables uses `createAdminClient()`; the only session-client reads and
-- writes in the app are on exactly these three.
--
-- ── Why `anon` keeps SELECT on all three ────────────────────────────────────
-- Deliberate, and the same reasoning as F-024. A cookie-bound server client whose
-- JWT has just expired falls back to `anon`. With the grant, such a read answers
-- "0 rows" — which every caller already treats as "nothing to show", the safe
-- direction. Without it, the read answers an ERROR, and a page whose token expired
-- mid-request breaks for a paying customer. Row-level security returns nothing to
-- an anonymous caller either way (`auth.uid()` is NULL and NULL = x is never
-- true), so the grant buys an attacker nothing and costs us a failure mode.
--
-- ⚠️ `REVOKE ALL` then GRANT back, never a column-level REVOKE: Postgres does not
-- let a column-level REVOKE subtract from a table-level GRANT. Note that this also
-- drops `profiles`' three-column UPDATE, which is therefore re-granted below — if
-- that line is ever lost, /account silently stops saving.

-- ── The nine policy-less tables: nothing, to either role ────────────────────
REVOKE ALL ON
    public.index_membership,
    public.listings,
    public.price_bars,
    public.split_events,
    public.stocks,
    public.stripe_events,
    public.ticker_requests,
    public.trial_tombstones,
    public.universe_log
  FROM anon, authenticated;

-- ── analysis_runs: the Run tab reads its own history and records a run ──────
REVOKE ALL ON public.analysis_runs FROM anon, authenticated;
GRANT SELECT          ON public.analysis_runs TO anon;
GRANT SELECT, INSERT  ON public.analysis_runs TO authenticated;

-- ── referrals: /account counts today's invites and inserts one ──────────────
REVOKE ALL ON public.referrals FROM anon, authenticated;
GRANT SELECT          ON public.referrals TO anon;
GRANT SELECT, INSERT  ON public.referrals TO authenticated;

-- ── profiles: read your own row, edit three harmless columns of it ──────────
-- `anon` was already narrowed to SELECT by 20260825000000 and is untouched here.
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, country, acknowledged_disclaimer_at)
  ON public.profiles TO authenticated;
