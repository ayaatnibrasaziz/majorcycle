-- Split-handling state: dated backend visibility into the nightly stock-split pipeline.
--
-- C-R7 detects a stock split (via yfinance's authoritative "Stock Splits" actions
-- calendar) and re-pulls the ticker's full re-adjusted history. C-R9 makes that
-- smart + observable: after a re-pull, daily_refresh verifies the price
-- discontinuity is actually gone. One row per detected split per ticker (a ticker
-- can split more than once over time):
--   - status 'pending'  — detected; being re-pulled + re-checked nightly
--   - status 'resolved' — the series is continuous at the split; STOP re-pulling
--   - status 'failed'   — still discontinuous 30 days after detection (e.g. DD, where
--                         yfinance lists the split but never back-adjusts the prices)
-- The cron writes this table; the owner reads it for backend visibility. No emails
-- (a 'failed' row is the flag). cliff_date/cliff_ratio record where the measured
-- discontinuity sits (DD's price cliff is ~2026-06-18, vs its 2026-06-24 split date).
--
-- Server-only: RLS enabled with NO policies, exactly like stocks / price_bars /
-- index_membership (see 20260614020000_enable_rls_lockdown + 20260624000000_index_membership).
-- The cron uses the service-role key, which bypasses RLS. The resulting
-- "RLS enabled, no policy" advisor notice is INFO-level and intentional.

create table public.split_events (
  id             uuid        primary key default gen_random_uuid(),
  ticker         text        not null references public.stocks(ticker) on delete cascade,
  split_date     date        not null,        -- yfinance's reported split action date
  ratio          numeric,                     -- "Stock Splits" value (0.3333 = 1-for-3 reverse; 2.0 = 2-for-1)
  status         text        not null default 'pending',
  detected_at    timestamptz not null default now(),
  last_repull_at timestamptz,
  repull_count   integer     not null default 0,
  resolved_at    timestamptz,
  cliff_date     date,                         -- where the measured discontinuity sits (visibility/debug)
  cliff_ratio    numeric,                      -- measured adjacent-day close ratio at the cliff
  updated_at     timestamptz not null default now(),
  constraint valid_split_status check (status in ('pending', 'resolved', 'failed')),
  constraint uq_split_ticker_date unique (ticker, split_date)
);

-- The nightly run reads only the still-pending splits (partial index keeps it tiny).
create index idx_split_events_pending on public.split_events (ticker) where status = 'pending';
create index idx_split_events_ticker  on public.split_events (ticker);

alter table public.split_events enable row level security;
