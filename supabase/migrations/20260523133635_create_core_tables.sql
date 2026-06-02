-- stocks: one row per ticker, master table
CREATE TABLE stocks (
  ticker       text PRIMARY KEY,
  market       text NOT NULL,
  name         text,
  sector       text,
  industry     text,
  currency     text NOT NULL DEFAULT 'USD',
  exchange     text,
  market_cap   numeric,
  fundamentals jsonb NOT NULL DEFAULT '{}',
  news         jsonb NOT NULL DEFAULT '[]',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_market CHECK (market IN ('us', 'au', 'ca'))
);

CREATE INDEX idx_stocks_market  ON stocks (market);
CREATE INDEX idx_stocks_sector  ON stocks (sector);
CREATE INDEX idx_stocks_updated ON stocks (updated_at);

-- price_bars: daily OHLCV history
CREATE TABLE price_bars (
  ticker  text    NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  date    date    NOT NULL,
  open    numeric NOT NULL,
  high    numeric NOT NULL,
  low     numeric NOT NULL,
  close   numeric NOT NULL,
  volume  bigint,
  PRIMARY KEY (ticker, date)
);

CREATE INDEX idx_bars_ticker_date ON price_bars (ticker, date DESC);

-- profiles: user accounts linked to Supabase Auth
CREATE TABLE profiles (
  id                         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                      text UNIQUE NOT NULL,
  display_name               text,
  country                    text,
  trial_ends_at              timestamptz,
  stripe_customer_id         text UNIQUE,
  subscription_status        text,
  subscription_plan          text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  acknowledged_disclaimer_at timestamptz
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- analysis_runs: user-triggered Run Analysis history
CREATE TABLE analysis_runs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preset             text        NOT NULL,
  pullback_threshold numeric     NOT NULL,
  profit_threshold   numeric     NOT NULL,
  lookback_bars      integer     NOT NULL,
  tickers            text[]      NOT NULL,
  ticker_count       integer     NOT NULL,
  results            jsonb       NOT NULL,
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,
  status             text        NOT NULL DEFAULT 'running'
);

ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own runs"
  ON analysis_runs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own runs"
  ON analysis_runs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- universe_log: audit of universe additions
CREATE TABLE universe_log (
  ticker        text        NOT NULL,
  added_at      timestamptz NOT NULL DEFAULT now(),
  added_by      text        NOT NULL,
  added_by_user uuid        REFERENCES profiles(id),
  PRIMARY KEY (ticker, added_at)
);
