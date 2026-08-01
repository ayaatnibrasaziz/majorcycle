-- Free-tier daily view counter (F3 Step 10).
--
-- Anti-scraping fence, NOT user friction: a signed-in FREE user may open a
-- limited number of DISTINCT tickers per UTC day. Subscribers are never counted
-- (locked decision #18 promises no usage limits), so these columns stay null for
-- anyone entitled.
--
-- Why DISTINCT TICKERS and not a page-load count: `next/link` prefetches routes
-- on hover/viewport in production, so a plain counter would be burned by merely
-- scrolling the Browse list. Storing the ticker set makes a prefetch-then-click
-- (and any re-visit of the same stock) cost exactly one view.
-- Stock links also pass prefetch={false}. (Step 10 audit, finding B5.)
--
-- SECURITY -- these columns MUST NOT be user-writable. `profiles` RLS lets a user
-- UPDATE their own row ("users update own profile"), so a user-writable counter
-- could simply be reset to zero by the browser. Only the service role (which
-- bypasses RLS) may write them, exactly like the billing columns added in
-- 20260715000000. (Step 10 audit, finding B4.)
--
-- WHAT ACTUALLY ENFORCES THAT -- verified against the live database after applying
-- this migration, because the answer is not the obvious one:
--
--   `authenticated` holds NO table-level UPDATE on profiles. Its UPDATE is granted
--   per column, and lists exactly display_name, country and acknowledged_disclaimer_at.
--   A new column is therefore not updatable by a logged-in user the moment it is
--   added -- that absence is the real guarantee here.
--
-- The REVOKEs below are kept as a tripwire and a statement of intent, but be clear
-- about their limits: Postgres does NOT let a column-level REVOKE subtract from a
-- table-level GRANT. `authenticated` does hold table-level SELECT/INSERT on
-- profiles, and these columns are consequently still readable by their owner (which
-- is harmless -- it is their own count) despite the revoke. The lesson for anyone
-- editing this later: if you ever issue `grant update on public.profiles to
-- authenticated`, these revokes will NOT save you and the counter becomes
-- user-resettable. Grant UPDATE per column, never on the table.
--
-- `anon` does hold table-level UPDATE (pre-existing, inherited from the Supabase
-- defaults). It is not exploitable: the "users update own profile" policy requires
-- auth.uid() = id, and an anonymous caller has no auth.uid(), so the policy matches
-- zero rows. Tightening that grant is tracked separately.

alter table public.profiles
  add column if not exists free_views_date date,
  add column if not exists free_views_tickers text[];

-- Belt and braces: never grant these to the browser-facing roles.
revoke all (free_views_date, free_views_tickers) on public.profiles from anon;
revoke all (free_views_date, free_views_tickers) on public.profiles from authenticated;

comment on column public.profiles.free_views_date is
  'UTC date the free-tier view set applies to. Service-role only -- never granted to anon/authenticated (a user-writable counter would be resettable from the browser). Null for subscribers, who are never counted.';

comment on column public.profiles.free_views_tickers is
  'Distinct tickers a free user has opened on free_views_date. Distinct-set rather than a count so next/link prefetch and repeat visits do not burn quota. Service-role only.';
