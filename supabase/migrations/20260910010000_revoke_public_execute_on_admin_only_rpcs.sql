-- Two RPCs carried EXECUTE for PUBLIC (`=X/postgres` in proacl), so an anonymous
-- caller reached INSIDE the function and was stopped only by the table grant.
-- Measured at the wire on 2026-09-09 with the anon key, BEFORE this migration:
--
--   get_price_bars_json  -> 42501 "permission denied for TABLE price_bars"
--   search_listings      -> 42501 "permission denied for TABLE listings"
--   get_cycle_bars_json  -> 42501 "permission denied for FUNCTION ..."   <- two layers
--
-- The third is what the other two should say. Nothing was ever exposed, and that
-- is exactly the F-024 shape (CLAUDE.md 11y): a permission held back by ONE
-- layer survives every green check precisely because the remaining layer keeps
-- working, so its absence is unobservable until someone reads the grants.
--
-- Safe to revoke: every caller uses the service_role key, confirmed by grepping
-- each call site rather than assumed —
--   get_price_bars_json  web/api/cycle.py (SUPABASE_SERVICE_ROLE_KEY),
--                        web/lib/stocks.ts (createAdminClient),
--                        web/api/analyze.py (service role)
--   search_listings      web/app/api/listings/search/route.ts (createAdminClient)

revoke execute on function public.get_price_bars_json(text) from public, anon, authenticated;
revoke execute on function public.search_listings(text)      from public, anon, authenticated;

-- VERIFIED AFTER APPLYING, both directions, at the wire:
--   anon    get_price_bars_json -> 42501 "permission denied for FUNCTION"  ✅
--   anon    search_listings     -> 42501 "permission denied for FUNCTION"  ✅
--   service get_price_bars_json -> 200, 11,526 rows                        ✅
--   service search_listings     -> 200, 5 rows                             ✅
-- The service-role rows are the load-bearing control: a database that refuses
-- everyone passes both refusal assertions and breaks the product (11y).
--
-- ⚠️ NOT touched: `enforce_acknowledgement_write_once` also carries a PUBLIC
-- grant. It is a TRIGGER function — calling it directly raises "can only be
-- called as a trigger" — and revoking EXECUTE risks the compliance trigger from
-- F-034. Recorded here rather than tidied away.
