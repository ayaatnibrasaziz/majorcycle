-- Two changes, both asked for by the owner on 2026-08-30.
--
-- ════════════════════════════════════════════════════════════════════════════
-- 1. dividend_events — corporate actions get ONE table per KIND of action
-- ════════════════════════════════════════════════════════════════════════════
--
-- The owner's words: "for the dividend and stock split events you are using the
-- same table and there is no way to distinguish between them."
--
-- ⚠️ Measured before acting, and the diagnosis is half right in a way that makes
-- the request MORE justified rather than less. `split_events` contains only
-- splits — nothing has ever written a dividend to it, and every one of its 1,762
-- rows carries a split ratio. So the two are not merged. What is true is the
-- thing behind the observation: **dividends had no table at all.** A dividend
-- forces a full price re-pull exactly as a split does (CLAUDE.md 11ae), and until
-- now that re-pull left NO record anywhere — you could not answer "why was this
-- company re-fetched last night?" from the database, only from a log line that
-- ages out. Splits got that visibility in June (20260628000000); dividends never
-- did, and reading the two side by side is what makes the asymmetry look like a
-- merge.
--
-- So: same shape, separate table, and the separation is now structural rather
-- than a convention someone has to remember. A future action kind (a spin-off, a
-- capital return) gets its own table too.
--
-- ⚠️ **It is deliberately NOT `split_events` plus a `kind` column.** That would be
-- one table serving two mechanisms with different columns and different
-- lifecycles, and the pending/resolve machinery below is the reason:
--
--   · A SPLIT can leave a real price cliff when the provider's own history is
--     internally inconsistent (MNST, audit F-030), so a split is re-pulled AND
--     VERIFIED, and carries status/cliff_date/cliff_ratio/repull_count to run
--     that cycle.
--   · A DIVIDEND adjustment is a smooth rescale of the whole prior series. It
--     either happened or it did not; there is no signature left in the data to
--     check afterwards. Every one of those six columns would be permanently NULL
--     on a dividend row, and a nullable column that is null for half a table is
--     an invitation to read it wrong.
--
-- This table is therefore a RECORD, not a state machine.

create table public.dividend_events (
  id            uuid        primary key default gen_random_uuid(),
  ticker        text        not null references public.stocks(ticker) on delete cascade,
  ex_date       date        not null,   -- the ex-dividend date yfinance reported
  amount        numeric,                -- per-share, in the stock's own currency
  detected_at   timestamptz not null default now(),
  repulled_at   timestamptz,            -- when the full re-adjusted history was fetched
  constraint uq_dividend_ticker_date unique (ticker, ex_date)
);

create index idx_dividend_events_ticker on public.dividend_events (ticker, ex_date desc);

-- Server-only, exactly like split_events: RLS on, no policies, service-role key
-- bypasses it. The "RLS enabled, no policy" advisor notice is INFO and intended.
alter table public.dividend_events enable row level security;

-- Audit F-026's rule, applied at creation rather than retrofitted. Supabase grants
-- ALL (TRUNCATE included, which no row policy governs) to both public roles on a
-- new public table; this table is never read through the API, so both get nothing.
revoke all on public.dividend_events from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. stocks.is_active — mark a dead ticker, NEVER delete it
-- ════════════════════════════════════════════════════════════════════════════
--
-- Roadmap "Stale prices + dead tickers", part 3, agreed with the owner 2026-08-30.
--
-- ⚠️ Deletion is irreversible in a way that is easy to underestimate. Once a
-- ticker 404s at the provider its history cannot be re-fetched from anywhere —
-- four delisted tickers have already cost 30,784 bars that no longer exist in any
-- copy we or anyone else can reach. So a company that stops trading keeps every
-- bar it ever had; it simply stops being refreshed and stops being offered.
--
-- ⚠️ Yahoo answers `404 Quote not found` for **BK** — Bank of New York Mellon —
-- because it renamed its ticker to BNY, and a symbol that has never existed
-- returns the identical answer (verified with ZZQQ9). "The provider has no data"
-- therefore cannot tell delisted from renamed from typo. Hence the three-source
-- test in analytics/cron/check_stale_tickers.py — no quote AND absent from the
-- exchange directory AND absent from every index we track.
--
-- ⚠️ That test must be UNANIMOUS, and the live evidence is not BK. Measured
-- 2026-08-30: EA, EQR and AVB — three trading S&P 500 companies — are
-- is_active = false in `listings` AND false in `index_membership`. Two of three
-- sources call them dead; only the live quote keeps them. Our reference tables go
-- stale in exactly the way that makes a majority vote dangerous. (BK itself is now
-- absent from both reference tables, so it IS retired — correctly, since the
-- ticker no longer trades, and its bars are kept while BNY is held complete.)
--
-- `is_active` mirrors `listings.is_active` (20260620000000), which already carries
-- the same "false when it drops out of the source, never deleted" contract. One
-- shape to learn, not two.

alter table public.stocks
  add column is_active       boolean not null default true,
  add column inactive_since  date,
  add column inactive_reason text;

-- Partial: the whole point is that the inactive set stays small, and every reader
-- filters `is_active = true`. Indexing the false rows would be indexing the
-- exception.
create index idx_stocks_inactive on public.stocks (ticker) where is_active = false;

comment on column public.stocks.is_active is
  'False when three independent sources agree the ticker no longer trades (no provider quote, absent from the exchange directory, absent from every index). Such a row keeps all its price history and stops being refreshed. Never deleted — see check_stale_tickers.py.';
