"""Drain the `ticker_requests` queue — fetch user-requested tickers into the universe.

Runs in the daily cron after `refresh_listings` (see architecture.md §8 Tier 4).
Reuses `daily_refresh.run(only=...)` so a requested ticker gets the EXACT same full
fetch (price history + fundamentals + enriched) as a seeded one, through the sacred
DataProvider interface (#9) with the Stooq fallback. After the fetch it reconciles
each request against what actually landed in `stocks`:

    in stocks now            → 'fetched'   (logged to universe_log, cached forever #16)
    no data, attempts < cap  → 'failed'    (transient — retried next run)
    no data, attempts >= cap → 'unsupported' (terminal — "not supported")

`last_error` is recorded so a stuck request can be diagnosed from the queue itself.

Usage:
    python -m analytics.cron.drain_requests
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, cast

from analytics.cron import daily_refresh
from analytics.cron.daily_refresh import _get_supabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 3


def run() -> dict[str, int]:
    supabase = _get_supabase()

    # Pick up new requests AND transient retries (terminal 'unsupported'/'fetched' are left alone).
    res = (
        supabase.table("ticker_requests")
        .select("symbol,market,attempts,requested_by")
        .in_("status", ["queued", "failed"])
        .execute()
    )
    pending = cast(list[dict[str, Any]], res.data or [])
    if not pending:
        logger.info("Ticker-request queue empty — nothing to drain")
        return {"pending": 0, "fetched": 0, "failed": 0, "unsupported": 0}

    symbols = [r["symbol"] for r in pending]
    logger.info("Draining %d requested ticker(s): %s", len(symbols), ", ".join(symbols))

    # Full fetch through the existing pipeline. Failures here are expected (some
    # requested symbols genuinely have no data), so don't email the owner.
    daily_refresh.run(only=symbols, notify_on_failure=False)

    # Reconcile: which of the requested symbols are now in `stocks`?
    got = (
        supabase.table("stocks").select("ticker").in_("ticker", symbols).execute()
    )
    present = {row["ticker"] for row in cast(list[dict[str, Any]], got.data or [])}

    now = datetime.now(timezone.utc).isoformat()
    fetched = failed = unsupported = 0

    for r in pending:
        symbol = r["symbol"]
        attempts = int(r.get("attempts") or 0) + 1
        if symbol in present:
            supabase.table("ticker_requests").update(
                {"status": "fetched", "fetched_at": now, "last_attempt_at": now,
                 "attempts": attempts, "last_error": None}
            ).eq("symbol", symbol).execute()
            supabase.table("universe_log").insert(
                {"ticker": symbol, "added_by": "user_request",
                 "added_by_user": r.get("requested_by")}
            ).execute()
            fetched += 1
            logger.info("%s | fetched → universe", symbol)
        elif attempts >= _MAX_ATTEMPTS:
            supabase.table("ticker_requests").update(
                {"status": "unsupported", "last_attempt_at": now, "attempts": attempts,
                 "last_error": f"No price data after {attempts} attempts"}
            ).eq("symbol", symbol).execute()
            unsupported += 1
            logger.info("%s | unsupported (gave up after %d attempts)", symbol, attempts)
        else:
            supabase.table("ticker_requests").update(
                {"status": "failed", "last_attempt_at": now, "attempts": attempts,
                 "last_error": "No data on last attempt; will retry next run"}
            ).eq("symbol", symbol).execute()
            failed += 1
            logger.info("%s | failed (attempt %d) — will retry", symbol, attempts)

    summary = {
        "pending": len(pending),
        "fetched": fetched,
        "failed": failed,
        "unsupported": unsupported,
    }
    logger.info("Queue drain complete — %s", summary)
    return summary


if __name__ == "__main__":
    run()
