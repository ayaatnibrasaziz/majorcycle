-- Request-a-Ticker search perf: one-shot listings search.
--
-- The /api/listings/search route previously made THREE round-trips (ilike on
-- listings, then `covered` from stocks + `request_status` from ticker_requests).
-- This function does the match, the two left-joins, and the ranking in a SINGLE
-- server-side query, so the route makes one round-trip instead of three —
-- noticeably faster, especially from a distant dev machine.
--
-- Ranking: symbol-prefix > symbol-contains > name-contains, then shortest symbol,
-- then alphabetical (deterministic). STABLE, read-only; called server-side with
-- the service-role key (which bypasses RLS, so the locked-down tables are read).
-- Not SECURITY DEFINER: it runs as the caller, so anon/authenticated (even if they
-- could execute it) would hit RLS and get nothing. EXECUTE is revoked from them
-- anyway, mirroring get_price_bars_json.

create or replace function public.search_listings(p_q text)
returns table (
  symbol text,
  name text,
  exchange text,
  market text,
  covered boolean,
  request_status text
)
language sql
stable
set search_path = public
as $$
  with norm as (select lower(trim(coalesce(p_q, ''))) as term)
  select
    l.symbol,
    l.name,
    l.exchange,
    l.market,
    (s.ticker is not null) as covered,
    tr.status as request_status
  from public.listings l
  cross join norm
  left join public.stocks s on s.ticker = l.symbol
  left join public.ticker_requests tr on tr.symbol = l.symbol
  where norm.term <> ''
    and l.is_active
    and (lower(l.symbol) like norm.term || '%' or lower(l.name) like '%' || norm.term || '%')
  order by
    (lower(l.symbol) like norm.term || '%') desc,            -- symbol prefix
    (lower(l.symbol) like '%' || norm.term || '%') desc,     -- symbol contains
    (lower(l.name)   like norm.term || '%') desc,            -- name prefix (e.g. "Apple…")
    length(l.symbol),
    l.symbol
  limit 20;
$$;

revoke execute on function public.search_listings(text) from anon, authenticated;
