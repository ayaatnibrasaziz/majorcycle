-- Audit F-004 — say out loud that "RLS on, zero policies" is DELIBERATE.
--
-- Ten public tables are server-only: row-level security is enabled and no policy
-- exists, so `anon` and `authenticated` can reach none of them and every read goes
-- through the service-role key. That is the correct deny-all posture, and it is also
-- exactly what a FORGOTTEN policy looks like — Supabase's own advisor raises an
-- `rls_enabled_no_policy` notice for each one, and nothing in the database says which
-- kind it is.
--
-- Two tables (`stripe_events`, `trial_tombstones`) already carried a comment saying so.
-- The other eight did not, so the next person to read that advisor output — or the
-- next audit — has to re-derive the answer, or "fixes" it by adding a policy and opens
-- the table up. This is CLAUDE.md 11f in miniature: the intent existed only in
-- somebody's head, and a database cannot be asked what somebody meant.
--
-- ⚠️ The audit recorded SEVEN tables on 2026-08-23. It is eight: `dividend_events` was
-- created a week later (11af) and inherited the same silence. A count written down is a
-- measurement with a date on it, not a fact (CLAUDE.md 11k).
--
-- Comments only. No grant, policy, column or row is touched by this migration.

comment on table public.stocks is
  'The covered universe: one row per company, with its latest fundamentals snapshot. Auto-expands when a reader requests an uncovered ticker (decision #12). `is_active = false` marks a retired listing — MARKED, never deleted, because its price history cannot be re-fetched once the provider drops the symbol. RLS on, no policies (service-role only). The RLS-enabled-no-policy advisor notice is intentional.';

comment on table public.price_bars is
  'Daily OHLCV history, one row per ticker per exchange trading day. `date` is the exchange''s OWN calendar date, never UTC (CLAUDE.md 14a). Split- and dividend-adjusted relative to the latest bar, which is why both event tables below force a full re-pull. RLS on, no policies (service-role only). The RLS-enabled-no-policy advisor notice is intentional.';

comment on table public.listings is
  'Exchange symbol directory behind the Request-a-Ticker menu — every symbol we could cover, not the ones we do. Refreshed nightly from free exchange directories; the sweep refuses to retire more than 2% of a market in one night, because removing a live company tells a customer their real stock does not exist (audit F-027). RLS on, no policies (service-role only). The RLS-enabled-no-policy advisor notice is intentional.';

comment on table public.index_membership is
  'Which tickers are currently in SPY / IOZ / XIU, refreshed nightly from ETF holdings — the source of the S&P 500 / ASX 200 / TSX 60 screener baskets. RLS on, no policies (service-role only). The RLS-enabled-no-policy advisor notice is intentional.';

comment on table public.split_events is
  'A STATE MACHINE, not a log: one row per detected share split, tracked pending -> repulled -> resolved. A split rescales the whole prior series, and the provider''s history can be internally inconsistent, so the re-pull is VERIFIED against a cliff check. Compare `dividend_events`, which needs no verify step and is therefore a separate table (CLAUDE.md 11af). RLS on, no policies (service-role only). The RLS-enabled-no-policy advisor notice is intentional.';

comment on table public.dividend_events is
  'A RECORD, not a state machine: one row per ex-dividend date that forced a full price re-pull. yfinance rescales a company''s entire prior series on each ex-date, so a nightly incremental window would leave old bars (the peak included) on the old basis and read drawdowns up to two points too deep (CLAUDE.md 11ae). `repulled_at IS NULL` is the state that matters. RLS on, no policies (service-role only). The RLS-enabled-no-policy advisor notice is intentional.';

comment on table public.ticker_requests is
  'Reader requests for tickers outside the current universe, drained by the nightly cron. A row here is how the universe auto-expands. ⚠️ A failed database read must never queue a request for a ticker we already cover — that is indistinguishable from a genuine one (audit F-012). RLS on, no policies (service-role only). The RLS-enabled-no-policy advisor notice is intentional.';

comment on table public.universe_log is
  'Append-only provenance: when each ticker entered the universe and what put it there (seed, index refresh, or a named reader''s request). Answers "why do we cover this?" long after the fact. RLS on, no policies (service-role only). The RLS-enabled-no-policy advisor notice is intentional.';
