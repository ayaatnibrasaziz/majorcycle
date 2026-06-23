"""Refresh the `index_membership` table from official ETF holdings files.

Runs in the daily cron AFTER `refresh_listings` and BEFORE `drain_requests`
(see architecture.md §8 Tier 4), so any brand-new constituent we don't yet cover
is enqueued here and fetched into the universe by the same night's drain.

Each index is fetched in isolation: if one source breaks (or returns an
out-of-bounds / high-churn list), the others still update and that index's existing
membership is left untouched — a single bad pull never wipes a basket. Per-index
counts are logged; a heads-up email goes out only if EVERY index fails.

The Run Analysis index baskets read `index_membership` at request time, so an update
here goes live without a redeploy.

Usage:
    python -m analytics.cron.refresh_index_membership                 # all indices
    python -m analytics.cron.refresh_index_membership --only sp500    # one (debug)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Callable, Optional, cast

from analytics.cron.daily_refresh import _get_supabase, _send_failure_email
from analytics.index_membership import sources

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

_DB_CHUNK = 500

# (index id, fetcher, sane min/max constituent count). Bounds guard against a
# malformed pull writing a wildly wrong list; a fetch outside them is treated as a
# soft failure (existing membership kept).
_SOURCES: list[tuple[str, Callable[[], list[str]], int, int]] = [
    ("sp500", sources.fetch_sp500, 480, 520),
    ("asx200", sources.fetch_asx200, 190, 215),
    ("tsx60", sources.fetch_tsx60, 55, 65),
]

# If more than this fraction of an index's membership would change vs the current
# active set, treat the pull as suspect and skip writing it (existing kept). Skipped
# when there's no existing set (first run / freshly seeded with 0 rows).
_MAX_CHURN = 0.15


def _market_of(ticker: str) -> str:
    if ticker.endswith(".AX"):
        return "au"
    if ticker.endswith(".TO"):
        return "ca"
    return "us"


def _active_members(supabase: Any, index_id: str) -> set[str]:
    res = (
        supabase.table("index_membership")
        .select("ticker")
        .eq("index_id", index_id)
        .eq("is_active", True)
        .execute()
    )
    return {r["ticker"] for r in cast(list[dict[str, Any]], res.data or [])}


def _write_index(supabase: Any, index_id: str, tickers: list[str], now: str) -> None:
    """Upsert current members (active, stamped now), then deactivate the rest."""
    payload = [
        {"index_id": index_id, "ticker": t, "is_active": True, "updated_at": now}
        for t in tickers
    ]
    for i in range(0, len(payload), _DB_CHUNK):
        supabase.table("index_membership").upsert(
            payload[i: i + _DB_CHUNK], on_conflict="index_id,ticker"
        ).execute()
    # Former members (present before, absent now) → inactive. Never deleted.
    supabase.table("index_membership").update({"is_active": False}).eq(
        "index_id", index_id
    ).lt("updated_at", now).execute()


def _enqueue_missing(supabase: Any, members: set[str]) -> int:
    """Enqueue any constituent not yet in `stocks` into `ticker_requests` so the
    same night's drain fetches it. Skips symbols already queued/known (any status)
    — in particular never resurrects a terminal 'unsupported'."""
    if not members:
        return 0
    # The covered universe (~720 rows, under the 1000-row cap) — one select.
    got = supabase.table("stocks").select("ticker").execute()
    covered = {r["ticker"] for r in cast(list[dict[str, Any]], got.data or [])}
    missing = sorted(members - covered)
    if not missing:
        return 0
    existing = supabase.table("ticker_requests").select("symbol").execute()
    queued = {r["symbol"] for r in cast(list[dict[str, Any]], existing.data or [])}
    to_add = [m for m in missing if m not in queued]
    if not to_add:
        return 0
    rows = [
        {"symbol": m, "market": _market_of(m), "status": "queued", "requested_by": None}
        for m in to_add
    ]
    for i in range(0, len(rows), _DB_CHUNK):
        supabase.table("ticker_requests").insert(rows[i: i + _DB_CHUNK]).execute()
    logger.info("Enqueued %d new constituent(s) for fetch: %s", len(to_add), ", ".join(to_add))
    return len(to_add)


def run(only: Optional[list[str]] = None) -> dict[str, object]:
    supabase = _get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    wanted = [s for s in (only or [s[0] for s in _SOURCES])]
    sources_to_run = [s for s in _SOURCES if s[0] in wanted]

    counts: dict[str, int] = {}
    refreshed: list[str] = []
    failed: list[str] = []
    all_members: set[str] = set()

    for index_id, fetch, lo, hi in sources_to_run:
        try:
            tickers = fetch()
            counts[index_id] = len(tickers)
            if not (lo <= len(tickers) <= hi):
                logger.warning(
                    "%s: %d constituents outside sane bounds [%d, %d] — skipping write",
                    index_id, len(tickers), lo, hi,
                )
                failed.append(index_id)
                continue
            # Churn guard (only when there's an existing set to compare against).
            current = _active_members(supabase, index_id)
            if current:
                churn = len(set(tickers) ^ current) / max(len(current), len(tickers))
                if churn > _MAX_CHURN:
                    logger.warning(
                        "%s: churn %.0f%% vs current (%d→%d) exceeds %.0f%% — skipping write",
                        index_id, churn * 100, len(current), len(tickers), _MAX_CHURN * 100,
                    )
                    failed.append(index_id)
                    continue
            _write_index(supabase, index_id, tickers, now)
            all_members.update(tickers)
            refreshed.append(index_id)
            logger.info("%s: wrote %d constituents", index_id, len(tickers))
        except Exception as e:
            logger.error("%s membership fetch failed: %s", index_id, e, exc_info=True)
            counts[index_id] = 0
            failed.append(index_id)

    enqueued = _enqueue_missing(supabase, all_members)

    logger.info(
        "Index membership refresh complete — counts=%s refreshed=%s failed=%s enqueued=%d",
        counts, refreshed, failed, enqueued,
    )

    # Only shout if everything failed (avoids noise from a single flaky source).
    if sources_to_run and not refreshed:
        _send_failure_email(
            subject="MajorCycle index membership: all sources failed",
            body=(
                f"Index-membership refresh at {now} wrote no index.\n"
                f"Counts: {counts}\nFailed: {failed}\n"
                "Existing `index_membership` is unchanged; investigate the source URLs."
            ),
        )

    return {"counts": counts, "refreshed": refreshed, "failed": failed, "enqueued": enqueued}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Refresh index membership from ETF holdings")
    parser.add_argument("--only", default=None, help="Comma-separated index ids, e.g. --only sp500,tsx60")
    args = parser.parse_args()
    run(only=args.only.split(",") if args.only else None)
