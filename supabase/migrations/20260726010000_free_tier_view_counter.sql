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
-- could simply be reset to zero by the browser. Access is therefore restricted at
-- the COLUMN level: only the service role (which bypasses RLS) may write them,
-- exactly like the billing columns added in 20260715000000. The revokes below are
-- explicit and defensive -- they must hold even if a future table-level GRANT is
-- ever issued. (Step 10 audit, finding B4.)

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
