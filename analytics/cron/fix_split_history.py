"""One-off script: repair price history corrupted by a post-fetch stock split.

Background: the daily refresh historically re-pulled only the last few days, so a
split that happened *after* a ticker's initial `max` pull left the older bars on
the pre-split price scale while new bars were post-split — a permanent fake
discontinuity that corrupts the cycle drawdown/profit bounds. `daily_refresh.py`
now detects this going forward (`_price_scale_shifted`) and re-pulls automatically,
but tickers already corrupted before that fix landed need a one-off repair.

This re-pulls the FULL (split/dividend-adjusted) `max` history from the
DataProvider and overwrites the stored bars (upsert on ticker+date), so every bar
is re-adjusted consistently. Re-pulling a *correct* ticker just rewrites identical
data, so it's always safe to run on a candidate list (real crashes are preserved —
the fresh data shows them too).

Usage:
    python -m analytics.cron.fix_split_history --ticker TUA.AX        # one ticker
    python -m analytics.cron.fix_split_history --tickers AAA.AX,BBB   # explicit list
    python -m analytics.cron.fix_split_history --all                  # whole universe (heavy)
"""

import argparse
import logging
import os
from pathlib import Path

from analytics.config import DATA_PROVIDER
from analytics.cron.daily_refresh import (
    _get_supabase,
    _load_universe,
    _upsert_price_bars,
)

# Load .env.local from project root so the script runs locally without exported env.
_env_path = Path(__file__).parent.parent.parent / ".env.local"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())
# Python loaders read SUPABASE_URL; fall back to the Next public var if only that is set.
os.environ.setdefault("SUPABASE_URL", os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def run(tickers: list[str]) -> None:
    supabase = _get_supabase()
    logger.info("Re-pulling full split-adjusted history for %d ticker(s)", len(tickers))

    updated = 0
    failed: list[str] = []
    for ticker in tickers:
        try:
            df = DATA_PROVIDER.fetch_price_history(ticker, period="max")
            if df is None or df.empty:
                logger.warning("%s: no price data returned — skipping", ticker)
                failed.append(ticker)
                continue
            _upsert_price_bars(supabase, ticker, df)
            logger.info("%s: %d bars re-written (re-adjusted)", ticker, len(df))
            updated += 1
        except Exception as e:
            logger.error("%s: failed — %s", ticker, e)
            failed.append(ticker)

    logger.info(
        "Done — %d re-written, %d failed%s",
        updated,
        len(failed),
        (f": {failed}" if failed else ""),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Repair split-corrupted price history.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--ticker", help="Single ticker to repair (e.g. TUA.AX)")
    group.add_argument("--tickers", help="Comma-separated tickers (e.g. AAA.AX,BBB)")
    group.add_argument(
        "--all", action="store_true", help="Re-pull the entire universe (heavy)"
    )
    args = parser.parse_args()

    if args.all:
        wanted = [row["ticker"] for row in _load_universe(_get_supabase())]
    elif args.tickers:
        wanted = [t.strip() for t in args.tickers.split(",") if t.strip()]
    else:
        wanted = [args.ticker]

    run(wanted)
