"""Vendored cycle math + scoring for the Vercel Python serverless function.

This package is a snapshot of the relevant parts of the canonical
`analytics/` package at the repo root. The cron and the Vercel function
share the same algorithm — keeping two copies in sync via the CI drift
check at `.github/workflows/ci.yml` (`Check _engine drift from analytics`).

Imports inside this package are rewritten from `analytics.X` to `_engine.X`
so the same module structure works in both locations. The drift check
applies the same `sed` substitution before diffing — so if either copy is
edited without the other, CI fails.

DO NOT EDIT THESE FILES DIRECTLY. Edit `analytics/<file>.py` first, then
update the vendored copy in the same commit.
"""
