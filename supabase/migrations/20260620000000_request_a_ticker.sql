-- Request a Ticker (universe expansion via a cron-drained queue).
--
-- Adds two tables:
--   listings        — the searchable "menu" of every US/AU/CA common stock
--                     (yfinance format), sourced from free public exchange symbol
--                     files and refreshed by the daily cron. Far larger than the
--                     analysed `stocks` universe; a row here only becomes
--                     analysable once the cron has fetched its data into `stocks`.
--   ticker_requests — the GLOBAL queue of user-requested symbols (one row per
--                     symbol → never queued twice; visible to every user). Drained
--                     by the daily cron, which fetches the data via the yfinance
--                     DataProvider into stocks + price_bars and flips `status`.
--
-- Both are server-only: RLS enabled with NO policies, exactly like
-- stocks / price_bars / universe_log (see 20260614020000_enable_rls_lockdown).
-- The /api/listings/search + /api/request-ticker routes touch them with the
-- service-role admin client after authenticating the user. See
-- docs/architecture.md §6 + §8 (Tier 4) and docs/data-contracts.md §5.

-- Trigram indexes power fast case-insensitive autocomplete over ~15k listings.
create extension if not exists pg_trgm;

create table public.listings (
  symbol      text primary key,             -- yfinance format: 'AAPL', 'BHP.AX', 'SHOP.TO'
  name        text,
  exchange    text,                         -- 'NASDAQ' | 'NYSE' | 'NYSE American' | 'ASX' | 'TSX' | 'TSXV'
  market      text not null,                -- 'us' | 'au' | 'ca'
  is_active   boolean not null default true,-- false when a symbol drops out of the source files (never deleted)
  updated_at  timestamptz not null default now(),
  constraint valid_listing_market check (market in ('us', 'au', 'ca'))
);

create index idx_listings_symbol_trgm on public.listings using gin (lower(symbol) gin_trgm_ops);
create index idx_listings_name_trgm   on public.listings using gin (lower(name)   gin_trgm_ops);
create index idx_listings_market      on public.listings (market);

create table public.ticker_requests (
  symbol          text primary key,         -- yfinance format; must exist in `listings`
  market          text not null,            -- 'us' | 'au' | 'ca'
  status          text not null default 'queued', -- 'queued' | 'fetched' | 'unsupported' | 'failed'
  requested_by    uuid references public.profiles(id) on delete set null, -- most recent requester (analytics only)
  requested_at    timestamptz not null default now(),
  attempts        integer not null default 0,
  last_attempt_at timestamptz,
  fetched_at      timestamptz,
  last_error      text,
  constraint valid_request_market check (market in ('us', 'au', 'ca')),
  constraint valid_request_status check (status in ('queued', 'fetched', 'unsupported', 'failed'))
);

create index idx_ticker_requests_status       on public.ticker_requests (status);
create index idx_ticker_requests_requested_at on public.ticker_requests (requested_at desc);

-- Server-only: lock out the public anon/authenticated roles entirely. The app +
-- cron keep full access via the service-role key (which bypasses RLS). The
-- resulting "RLS enabled, no policy" advisor notices are INFO-level and intentional.
alter table public.listings        enable row level security;
alter table public.ticker_requests enable row level security;
