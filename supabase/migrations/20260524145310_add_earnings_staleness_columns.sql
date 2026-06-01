ALTER TABLE stocks
  ADD COLUMN IF NOT EXISTS next_earnings_date DATE,
  ADD COLUMN IF NOT EXISTS enriched_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stocks_next_earnings_date ON stocks (next_earnings_date);
CREATE INDEX IF NOT EXISTS idx_stocks_enriched_updated_at ON stocks (enriched_updated_at);
