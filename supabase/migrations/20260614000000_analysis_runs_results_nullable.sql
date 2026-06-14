-- Layer D (Run Analysis): the Run tab persists only run INPUTS in analysis_runs
-- (preset, params, tickers, counts, timestamps, status) — never the computed
-- rating outputs (CLAUDE.md non-negotiable #15 / data-contracts §11: scores are
-- always derived, never stored). Live results live in client state instead.
--
-- The original table created `results jsonb NOT NULL`; relax it so we can write
-- NULL. Existing rows are unaffected.

ALTER TABLE analysis_runs ALTER COLUMN results DROP NOT NULL;
