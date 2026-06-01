ALTER TABLE stocks
  ADD COLUMN IF NOT EXISTS company_overview TEXT,
  ADD COLUMN IF NOT EXISTS income_statement_annual JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS income_statement_quarterly JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS balance_sheet_annual JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS balance_sheet_quarterly JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cashflow_annual JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cashflow_quarterly JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS earnings_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS top_holders JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS insider_transactions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS analyst_upgrades_downgrades JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS pe_history JSONB DEFAULT '[]';
