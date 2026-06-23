"""Index-membership sourcing — current S&P 500 / ASX 200 / S&P/TSX 60 constituents.

Sourced from official ETF holdings files (the ETF physically replicates the index,
so its holdings ARE the constituents): SPY (US, State Street), IOZ (AU, iShares),
XIU (CA, iShares). See `sources.py`. The cron runner `analytics.cron.refresh_index_membership`
writes the results to the `index_membership` table; the Run Analysis index baskets
read it at request time (no redeploy).
"""
