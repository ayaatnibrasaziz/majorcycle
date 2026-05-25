"""Daily data refresh pipeline — runs via GitHub Actions cron at 23:00 UTC.

Usage:
    python -m analytics.cron.daily_refresh               # smart mode (default) — price+fundamentals daily, enriched only when stale
    python -m analytics.cron.daily_refresh --mode full   # full mode — forces enriched refresh for every ticker (~4-5 hrs)
"""

import csv
import dataclasses
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, cast

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

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


def _should_fetch_enriched(
    state: Optional[dict[str, Any]], today_str: str, mode: str
) -> bool:
    if mode == "full":
        return True
    if state is None:
        return True
    enrich_ts: Optional[str] = state.get("enriched_updated_at")
    enrich_date = enrich_ts[:10] if enrich_ts else None
    if enrich_date is None:
        return True
    next_ed: Optional[str] = state.get("next_earnings_date")
    if next_ed is None:
        try:
            days_since = (
                datetime.fromisoformat(today_str) - datetime.fromisoformat(enrich_date)
            ).days
            return days_since >= 7
        except Exception:
            return True
    return next_ed <= today_str and enrich_date < next_ed


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


def run(mode: str = "smart") -> None:
    started_at = datetime.now(timezone.utc)
    logger.info("Daily refresh started at %s (mode=%s)", started_at.isoformat(), mode)

    supabase = _get_supabase()
    universe = _load_universe()
    failed: list[str] = []
    succeeded = 0
    enriched_count = 0

    result = supabase.table("stocks").select(
        "ticker,enriched_updated_at,next_earnings_date"
    ).execute()
    raw_states = cast(list[dict[str, Any]], result.data or [])
    ticker_states: dict[str, dict[str, Any]] = {
        str(row["ticker"]): row for row in raw_states
    }
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logger.info(
        "%d tickers already in DB — checking staleness for enriched data",
        len(ticker_states),
    )

    batches = [universe[i: i + _BATCH_SIZE] for i in range(0, len(universe), _BATCH_SIZE)]

    for batch_idx, batch in enumerate(batches):
        for item in batch:
            ticker = item["ticker"]
            try:
                state = ticker_states.get(ticker)
                fetch_enriched = _should_fetch_enriched(state, today_str, mode)
                price_period = "max" if state is None else "5d"

                df = DATA_PROVIDER.fetch_price_history(ticker, period=price_period)
                if df is None or df.empty:
                    logger.debug("%s: no price data", ticker)
                    failed.append(ticker)
                    continue

                fund = DATA_PROVIDER.fetch_fundamentals(ticker)
                now = datetime.now(timezone.utc).isoformat()
                market = _infer_market(ticker)

                fund_dict: dict[str, Any] = dataclasses.asdict(fund) if fund else {}

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
                    "updated_at":   now,
                }

                if fetch_enriched:
                    news = DATA_PROVIDER.fetch_news(ticker)
                    enriched = DATA_PROVIDER.fetch_enriched_data(ticker)

                    news_list: list[dict[str, Any]] = [dataclasses.asdict(n) for n in news]
                    enriched_dict: dict[str, Any] = dataclasses.asdict(enriched) if enriched else {}

                    stock_row["news"] = _jsonb(news_list)
                    stock_row["company_overview"] = (
                        enriched.company_overview if enriched else None
                    )
                    stock_row["income_statement_annual"] = _jsonb(
                        enriched_dict.get("income_statement_annual", {})
                    )
                    stock_row["income_statement_quarterly"] = _jsonb(
                        enriched_dict.get("income_statement_quarterly", {})
                    )
                    stock_row["balance_sheet_annual"] = _jsonb(
                        enriched_dict.get("balance_sheet_annual", {})
                    )
                    stock_row["balance_sheet_quarterly"] = _jsonb(
                        enriched_dict.get("balance_sheet_quarterly", {})
                    )
                    stock_row["cashflow_annual"] = _jsonb(
                        enriched_dict.get("cashflow_annual", {})
                    )
                    stock_row["cashflow_quarterly"] = _jsonb(
                        enriched_dict.get("cashflow_quarterly", {})
                    )
                    stock_row["earnings_history"] = _jsonb(
                        enriched_dict.get("earnings_history", [])
                    )
                    stock_row["top_holders"] = _jsonb(
                        enriched_dict.get("top_holders", [])
                    )
                    stock_row["insider_transactions"] = _jsonb(
                        enriched_dict.get("insider_transactions", [])
                    )
                    stock_row["analyst_upgrades_downgrades"] = _jsonb(
                        enriched_dict.get("analyst_upgrades_downgrades", [])
                    )
                    stock_row["pe_history"] = _jsonb(
                        enriched_dict.get("pe_history", [])
                    )
                    stock_row["enriched_updated_at"] = now
                    # Defensive: only send a real ISO date to the DATE column.
                    # Anything else (None, '', '[]', other garbage) is dropped
                    # — the column will keep its previous value.
                    next_ed = enriched_dict.get("next_earnings_date") if enriched else None
                    if isinstance(next_ed, str) and _ISO_DATE_RE.match(next_ed):
                        stock_row["next_earnings_date"] = next_ed

                    enriched_count += 1
                    logger.info(
                        "%s | enriched | market=%s | sector=%s | bars=%d",
                        ticker,
                        market,
                        fund.sector if fund else "?",
                        len(df),
                    )
                else:
                    logger.info("%s | price+fund | bars=%d", ticker, len(df))

                supabase.table("stocks").upsert(stock_row, on_conflict="ticker").execute()
                _upsert_price_bars(supabase, ticker, df)
                succeeded += 1

            except Exception as e:
                logger.error("%s: unexpected error: %s", ticker, e, exc_info=True)
                failed.append(ticker)

        if batch_idx < len(batches) - 1:
            time.sleep(_SLEEP_BETWEEN_BATCHES)

    finished_at = datetime.now(timezone.utc)
    elapsed = (finished_at - started_at).total_seconds()

    logger.info(
        "Refresh complete — %d succeeded (%d enriched), %d failed, %.0fs elapsed",
        succeeded,
        enriched_count,
        len(failed),
        elapsed,
    )

    if failed:
        logger.warning("Failed tickers (%d): %s", len(failed), ", ".join(failed))
        _send_failure_email(
            subject=f"MajorCycle cron: {len(failed)} tickers failed",
            body=(
                f"Daily refresh finished at {finished_at.isoformat()}\n"
                f"Succeeded: {succeeded} ({enriched_count} enriched)\n"
                f"Failed: {len(failed)}\n\n"
                "Failed tickers:\n" + "\n".join(failed)
            ),
        )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="MajorCycle data refresh pipeline")
    parser.add_argument("--mode", choices=["smart", "full"], default="smart")
    args = parser.parse_args()
    run(mode=args.mode)
