"""One-off script: re-fetch insider_transactions for tickers with bad dates.

yfinance returns a RangeIndex DataFrame; the original code stored the integer
row index as the date (e.g. "53") instead of the "Start Date" column.  This
script re-fetches and overwrites insider_transactions for every affected ticker.

Usage:
    python -m analytics.cron.fix_insider_transactions              # all affected tickers
    python -m analytics.cron.fix_insider_transactions --ticker AAPL  # single ticker
"""

import argparse
import json
import logging
import os
import re
from pathlib import Path
from typing import Any

import requests
import yfinance as yf  # type: ignore[import-untyped]

from analytics.config import DATA_PROVIDER

_env_path = Path(__file__).parent.parent.parent / ".env.local"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

_BAD_DATE_RE = re.compile(r"^\d+$")


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


def _get_affected_tickers() -> list[str]:
    url = _supabase_url() + "/rest/v1/stocks"
    resp = requests.get(
        url,
        headers=_supabase_headers(),
        params={"select": "ticker,insider_transactions"},
        timeout=30,
    )
    resp.raise_for_status()
    rows: list[dict[str, Any]] = resp.json()
    affected = []
    for r in rows:
        txs = r.get("insider_transactions") or []
        if txs and _BAD_DATE_RE.match(str(txs[0].get("date", ""))):
            affected.append(r["ticker"])
    return affected


def _patch_insider_transactions(ticker: str, txs: list[dict[str, Any]]) -> None:
    url = _supabase_url() + "/rest/v1/stocks"
    resp = requests.patch(
        url,
        headers=_supabase_headers(),
        params={"ticker": f"eq.{ticker}"},
        data=json.dumps({"insider_transactions": txs}),
        timeout=15,
    )
    resp.raise_for_status()


def run(ticker_filter: str | None = None) -> None:
    if ticker_filter:
        tickers = [ticker_filter]
        logger.info("Re-fetching insider_transactions for: %s", ticker_filter)
    else:
        tickers = _get_affected_tickers()
        logger.info("Found %d tickers with bad insider transaction dates", len(tickers))

    updated = 0
    skipped = 0
    failed: list[str] = []

    for ticker in tickers:
        try:
            t = yf.Ticker(ticker)
            df = getattr(t, "insider_transactions", None)
            txs = DATA_PROVIDER._extract_insider_transactions(df)  # type: ignore[attr-defined]

            if not txs:
                logger.debug("%s: no insider_transactions returned — clearing", ticker)
                _patch_insider_transactions(ticker, [])
                skipped += 1
                continue

            _patch_insider_transactions(ticker, txs)
            logger.info("%s: %d transactions written (first date: %s)", ticker, len(txs), txs[0].get("date", "?"))
            updated += 1
        except Exception as e:
            logger.error("%s: failed — %s", ticker, e)
            failed.append(ticker)

    logger.info(
        "Done — %d updated, %d skipped (no data), %d failed%s",
        updated,
        skipped,
        len(failed),
        (f": {failed}" if failed else ""),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", help="Single ticker to fix (e.g. AAPL)")
    args = parser.parse_args()
    run(ticker_filter=args.ticker)
