"""One-off script: re-compute pe_history for tickers with thin data.

Uses the Supabase REST API directly (no supabase-py needed) so it runs on
any Python 3.11+ without extra build dependencies.

Usage:
    python -m analytics.cron.fix_pe_history              # all tickers with < 4 pe_history points
    python -m analytics.cron.fix_pe_history --ticker AAPL  # single ticker
"""

import argparse
import json
import logging
import os
from pathlib import Path
from typing import Any

import requests
import yfinance as yf  # type: ignore[import-untyped]

from analytics.config import DATA_PROVIDER

# Load .env.local from project root
_env_path = Path(__file__).parent.parent.parent / ".env.local"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def _supabase_headers() -> dict[str, str]:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def _supabase_url() -> str:
    return (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    ).rstrip("/")


def _get_thin_tickers() -> list[str]:
    url = _supabase_url() + "/rest/v1/stocks"
    resp = requests.get(
        url,
        headers=_supabase_headers(),
        params={"select": "ticker,pe_history"},
        timeout=30,
    )
    resp.raise_for_status()
    rows: list[dict[str, Any]] = resp.json()
    return [
        r["ticker"] for r in rows
        if not r.get("pe_history") or len(r["pe_history"]) < 4
    ]


def _patch_pe_history(ticker: str, pe_hist: list[dict[str, Any]]) -> None:
    url = _supabase_url() + "/rest/v1/stocks"
    resp = requests.patch(
        url,
        headers=_supabase_headers(),
        params={"ticker": f"eq.{ticker}"},
        data=json.dumps({"pe_history": pe_hist}),
        timeout=15,
    )
    resp.raise_for_status()


def run(ticker_filter: str | None = None) -> None:
    if ticker_filter:
        tickers = [ticker_filter]
        logger.info("Re-computing pe_history for: %s", ticker_filter)
    else:
        tickers = _get_thin_tickers()
        logger.info("Found %d tickers with thin pe_history", len(tickers))

    updated = 0
    failed: list[str] = []

    for ticker in tickers:
        try:
            t = yf.Ticker(ticker)
            pe_hist = DATA_PROVIDER._compute_pe_history(t, ticker)  # type: ignore[attr-defined]

            if not pe_hist:
                logger.debug("%s: still empty after recompute — skipping", ticker)
                continue

            _patch_pe_history(ticker, pe_hist)
            logger.info("%s: %d data points written", ticker, len(pe_hist))
            updated += 1
        except Exception as e:
            logger.error("%s: failed — %s", ticker, e)
            failed.append(ticker)

    logger.info(
        "Done — %d updated, %d failed%s",
        updated,
        len(failed),
        (f": {failed}" if failed else ""),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", help="Single ticker to fix (e.g. AAPL)")
    args = parser.parse_args()
    run(ticker_filter=args.ticker)
