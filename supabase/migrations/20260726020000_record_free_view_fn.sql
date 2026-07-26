-- Atomic recorder for the free-tier daily view fence (F3 Step 10).
--
-- WHY A DATABASE FUNCTION AND NOT APPLICATION CODE.
-- The obvious implementation -- read free_views_tickers, append in TypeScript,
-- write it back -- is read-modify-write on a whole array, and it is defeated by
-- exactly the traffic shape this fence exists to stop. A scraper firing N page
-- requests concurrently would have all N read the same stale array, and each
-- write would clobber the others: the row ends up holding one or two tickers
-- while the scraper walked away with N pages. The fence would look like it was
-- working and be doing nothing.
--
-- `select ... for update` takes a row lock, so concurrent views of the SAME
-- profile serialise. The check and the append then happen inside one statement's
-- transaction and the count cannot be lost.
--
-- FAIL OPEN on a missing profile row. This is a rate-limit fence, NOT the
-- paywall: premium fields are stripped server-side by api/cycle.py regardless of
-- what this returns (see lib/entitlement.ts for the fail-CLOSED half). A user in
-- a broken account state gets nothing premium either way, so telling them
-- "daily limit reached" would be a lie. Denying costs us honesty and buys
-- nothing.
--
-- Distinct TICKERS, not page loads -- see 20260726010000 for why (next/link
-- prefetch, and re-opening the same stock must be free).
--
-- Service-role only. `authenticated` must never hold EXECUTE: the whole point is
-- that a user cannot influence their own count. Note that the column-level
-- REVOKEs in 20260726010000 are what stop a direct write, and the absence of a
-- column-level UPDATE grant is what actually holds that line.
--
-- Reversible: drop function public.record_free_view(uuid, text, int);

create or replace function public.record_free_view(
  p_user_id uuid,
  p_ticker  text,
  p_limit   int
)
returns table (allowed boolean, used int)
language plpgsql
-- Pinned so the function cannot be hijacked by a caller's search_path; every
-- object it touches is schema-qualified.
set search_path = ''
as $$
declare
  -- The quota day is UTC so it is the same instant for every user worldwide and
  -- does not shift with the server's local timezone.
  v_today   date := (now() at time zone 'utc')::date;
  v_date    date;
  v_tickers text[];
begin
  select p.free_views_date, coalesce(p.free_views_tickers, '{}')
    into v_date, v_tickers
    from public.profiles p
   where p.id = p_user_id
     for update;

  -- No profile row -- fail open (see header).
  if not found then
    allowed := true;
    used := 0;
    return next;
    return;
  end if;

  -- A new UTC day wipes the set. Stored rather than cleared by a cron so there is
  -- no scheduled job to fail: the reset happens on the first view of the new day.
  if v_date is distinct from v_today then
    v_tickers := '{}';
  end if;

  -- Already seen today: free, and no write (so a refresh or a back-navigation
  -- never costs quota).
  if p_ticker = any (v_tickers) then
    allowed := true;
    used := coalesce(array_length(v_tickers, 1), 0);
    return next;
    return;
  end if;

  if coalesce(array_length(v_tickers, 1), 0) >= p_limit then
    allowed := false;
    used := coalesce(array_length(v_tickers, 1), 0);
    return next;
    return;
  end if;

  v_tickers := v_tickers || p_ticker;

  update public.profiles
     set free_views_date    = v_today,
         free_views_tickers = v_tickers
   where id = p_user_id;

  allowed := true;
  used := coalesce(array_length(v_tickers, 1), 0);
  return next;
end;
$$;

-- EXECUTE defaults to PUBLIC on a new function -- revoke before granting, or the
-- browser-facing roles could call it and burn/inspect someone else's quota.
revoke all on function public.record_free_view(uuid, text, int) from public;
revoke all on function public.record_free_view(uuid, text, int) from anon;
revoke all on function public.record_free_view(uuid, text, int) from authenticated;
grant execute on function public.record_free_view(uuid, text, int) to service_role;

comment on function public.record_free_view(uuid, text, int) is
  'Atomically records one free-tier stock view and reports whether it is allowed. Row-locks the profile so concurrent requests cannot lose count. Service-role only. (F3 Step 10.)';
