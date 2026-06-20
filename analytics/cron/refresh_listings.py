"""Refresh the `listings` "menu" from free public exchange symbol files.

Runs in the daily cron BEFORE the queue drain (see architecture.md §8 Tier 4).
Each market is fetched in isolation: if one source breaks, the others still update
and the cached `listings` table stays usable — a listings hiccup never blocks the
nightly price refresh. Per-market counts are logged so a bad pull can be pinpointed
after the fact; a heads-up email goes out only if EVERY market fails.

Usage:
    python -m analytics.cron.refresh_listings                 # all markets
    python -m analytics.cron.refresh_listings --only us       # one market (debug)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Callable, Optional

from analytics.cron.daily_refresh import _get_supabase, _send_failure_email
from analytics.listings import sources
from analytics.listings.normalize import ListingRow

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

_DB_CHUNK = 500

_SOURCES: dict[str, Callable[[], list[ListingRow]]] = {
    "us": sources.fetch_us,
    "au": sources.fetch_au,
    "ca": sources.fetch_ca,
}


def run(only: Optional[list[str]] = None) -> dict[str, object]:
    supabase = _get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    markets = [m for m in (only or list(_SOURCES)) if m in _SOURCES]

    counts: dict[str, int] = {}
    refreshed: list[str] = []
    failed: list[str] = []
    all_rows: list[ListingRow] = []

    for market in markets:
        try:
            rows = _SOURCES[market]()
            counts[market] = len(rows)
            if not rows:
                # Empty is treated as a soft failure: do NOT deactivate the market
                # (a 403/format change shouldn't wipe a market's whole menu).
                logger.warning("%s listings empty — skipping upsert + deactivation", market)
                failed.append(market)
                continue
            all_rows.extend(rows)
            refreshed.append(market)
        except Exception as e:
            logger.error("%s listings fetch failed: %s", market, e, exc_info=True)
            counts[market] = 0
            failed.append(market)

    # Upsert everything we successfully pulled (active, stamped `now`).
    payload = [
        {
            "symbol": r.symbol,
            "name": r.name,
            "exchange": r.exchange,
            "market": r.market,
            "is_active": True,
            "updated_at": now,
        }
        for r in all_rows
    ]
    for i in range(0, len(payload), _DB_CHUNK):
        supabase.table("listings").upsert(
            payload[i: i + _DB_CHUNK], on_conflict="symbol"
        ).execute()

    # Flag delisted symbols (present before, absent from this pull) inactive — only
    # for markets that actually refreshed, and never deleting (history is kept).
    for market in refreshed:
        supabase.table("listings").update({"is_active": False}).eq(
            "market", market
        ).lt("updated_at", now).execute()

    logger.info(
        "Listings refresh complete — counts=%s refreshed=%s failed=%s",
        counts, refreshed, failed,
    )

    # Only shout if the whole thing failed (avoids noise from a single flaky source).
    if markets and not refreshed:
        _send_failure_email(
            subject="MajorCycle listings: all sources failed",
            body=(
                f"Listings refresh at {now} produced no rows for any market.\n"
                f"Counts: {counts}\nFailed: {failed}\n"
                "The cached `listings` table is unchanged; investigate the source URLs."
            ),
        )

    return {"counts": counts, "refreshed": refreshed, "failed": failed, "total": len(payload)}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Refresh the listings menu")
    parser.add_argument("--only", default=None, help="Comma-separated markets, e.g. --only us,au")
    args = parser.parse_args()
    run(only=args.only.split(",") if args.only else None)
