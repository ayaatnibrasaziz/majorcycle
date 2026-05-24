"""Daily data refresh pipeline — runs via GitHub Actions cron at 23:00 UTC.

Usage:
    python -m analytics.cron.daily_refresh             # fast mode (default) — price bars only, ~20 min
    python -m analytics.cron.daily_refresh --mode full  # full mode — all data, ~4 hrs, runs weekly
"""

import csv
import dataclasses
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from dotenv import load_dotenv
from supabase import Client, create_client

from analytics.config import DATA_PROVIDER

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

_UNIVERSE_DIR = Path(__file__).parent.parent / "universe"
_BATCH_SIZE = 10
_SLEEP_BETWEEN_BATCHES = 2.0
_DB_CHUNK = 500


def _jsonb(obj: Any) -> Any:
    return json.loads(json.dumps(obj, default=str))


def _get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _load_universe() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for csv_file in sorted(_UNIVERSE_DIR.glob("*.csv")):
        with csv_file.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("ticker"):
                    rows.append(row)
    logger.info("Universe loaded: %d tickers from %s", len(rows), _UNIVERSE_DIR)
    return rows


def _infer_market(ticker: str) -> str:
    if ticker.endswith(".AX"):
        return "au"
    if ticker.endswith(".TO"):
        return "ca"
    return "us"


def _upsert_price_bars(supabase: Client, ticker: str, df: pd.DataFrame) -> None:
    bars: list[dict[str, Any]] = []
    for ts, row in df.iterrows():
        vol = row["Volume"]
        bars.append({
            "ticker": ticker,
            "date":   ts.strftime("%Y-%m-%d"),  # type: ignore[attr-defined]
            "open":   float(row["Open"]),
            "high":   float(row["High"]),
            "low":    float(row["Low"]),
            "close":  float(row["Close"]),
            "volume": int(vol) if pd.notna(vol) else None,
        })
    for i in range(0, len(bars), _DB_CHUNK):
        chunk = bars[i: i + _DB_CHUNK]
        supabase.table("price_bars").upsert(chunk, on_conflict="ticker,date").execute()


def _send_failure_email(subject: str, body: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY", "")
    owner = os.environ.get("OWNER_EMAIL", "")
    if not api_key or not owner:
        logger.warning("Failure email skipped — RESEND_API_KEY or OWNER_EMAIL not set")
        return
    try:
        requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": "MajorCycle Cron <noreply@majorcycle.com>",
                "to": [owner],
                "subject": subject,
                "text": body,
            },
            timeout=10,
        )
    except Exception as e:
        logger.error("Failed to send failure email: %s", e)


def run(mode: str = "fast") -> None:
    started_at = datetime.now(timezone.utc)
    logger.info("Daily refresh started at %s (mode=%s)", started_at.isoformat(), mode)

    supabase = _get_supabase()
    universe = _load_universe()
    failed: list[str] = []
    succeeded = 0

    batches = [universe[i: i + _BATCH_SIZE] for i in range(0, len(universe), _BATCH_SIZE)]

    for batch_idx, batch in enumerate(batches):
        for item in batch:
            ticker = item["ticker"]
            try:
                if mode == "fast":
                    df = DATA_PROVIDER.fetch_price_history(ticker, period="5d")
                    if df is None or df.empty:
                        logger.debug("%s: no recent price data", ticker)
                        failed.append(ticker)
                        continue
                    _upsert_price_bars(supabase, ticker, df)
                    logger.info("%s | fast | bars=%d", ticker, len(df))
                else:
                    df = DATA_PROVIDER.fetch_price_history(ticker)
                    if df is None:
                        logger.warning("%s: no price data — skipping", ticker)
                        failed.append(ticker)
                        continue

                    fund = DATA_PROVIDER.fetch_fundamentals(ticker)
                    news = DATA_PROVIDER.fetch_news(ticker)
                    enriched = DATA_PROVIDER.fetch_enriched_data(ticker)

                    now = datetime.now(timezone.utc).isoformat()
                    market = _infer_market(ticker)

                    fund_dict: dict[str, Any] = dataclasses.asdict(fund) if fund else {}
                    news_list: list[dict[str, Any]] = [dataclasses.asdict(n) for n in news]
                    enriched_dict: dict[str, Any] = dataclasses.asdict(enriched) if enriched else {}

                    stock_row: dict[str, Any] = {
                        "ticker":       ticker,
                        "market":       market,
                        "name":         fund.name if fund else None,
                        "sector":       fund.sector if fund else None,
                        "industry":     fund.industry if fund else None,
                        "currency":     fund.currency if fund else "USD",
                        "exchange":     fund.exchange if fund else None,
                        "market_cap":   fund.market_cap if fund else None,
                        "fundamentals": _jsonb(fund_dict),
                        "news":         _jsonb(news_list),
                        "company_overview":            enriched.company_overview if enriched else None,
                        "income_statement_annual":     _jsonb(enriched_dict.get("income_statement_annual", {})),
                        "income_statement_quarterly":  _jsonb(enriched_dict.get("income_statement_quarterly", {})),
                        "balance_sheet_annual":        _jsonb(enriched_dict.get("balance_sheet_annual", {})),
                        "balance_sheet_quarterly":     _jsonb(enriched_dict.get("balance_sheet_quarterly", {})),
                        "cashflow_annual":             _jsonb(enriched_dict.get("cashflow_annual", {})),
                        "cashflow_quarterly":          _jsonb(enriched_dict.get("cashflow_quarterly", {})),
                        "earnings_history":            _jsonb(enriched_dict.get("earnings_history", [])),
                        "top_holders":                 _jsonb(enriched_dict.get("top_holders", [])),
                        "insider_transactions":        _jsonb(enriched_dict.get("insider_transactions", [])),
                        "analyst_upgrades_downgrades": _jsonb(enriched_dict.get("analyst_upgrades_downgrades", [])),
                        "pe_history":                  _jsonb(enriched_dict.get("pe_history", [])),
                        "updated_at":   now,
                    }

                    supabase.table("stocks").upsert(stock_row, on_conflict="ticker").execute()
                    _upsert_price_bars(supabase, ticker, df)
                    logger.info(
                        "%s | full | market=%s | sector=%s | bars=%d",
                        ticker,
                        market,
                        fund.sector if fund else "?",
                        len(df),
                    )

                succeeded += 1

            except Exception as e:
                logger.error("%s: unexpected error: %s", ticker, e, exc_info=True)
                failed.append(ticker)

        if batch_idx < len(batches) - 1:
            time.sleep(_SLEEP_BETWEEN_BATCHES)

    finished_at = datetime.now(timezone.utc)
    elapsed = (finished_at - started_at).total_seconds()

    logger.info(
        "Refresh complete — %d succeeded, %d failed, %.0fs elapsed",
        succeeded,
        len(failed),
        elapsed,
    )

    if failed:
        logger.warning("Failed tickers (%d): %s", len(failed), ", ".join(failed))
        _send_failure_email(
            subject=f"MajorCycle cron: {len(failed)} tickers failed",
            body=(
                f"Daily refresh finished at {finished_at.isoformat()}\n"
                f"Succeeded: {succeeded}\n"
                f"Failed: {len(failed)}\n\n"
                "Failed tickers:\n" + "\n".join(failed)
            ),
        )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="MajorCycle data refresh pipeline")
    parser.add_argument("--mode", choices=["fast", "full"], default="fast")
    args = parser.parse_args()
    run(mode=args.mode)
