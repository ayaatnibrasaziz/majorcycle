"""Refresh the `index_membership` table from official ETF holdings files.

Runs in the daily cron after `refresh_listings` (see architecture.md §8 Tier 4).
Any brand-new constituent we don't yet cover is fetched into the universe HERE,
directly (via `daily_refresh.run`), and audited in `universe_log` as
`added_by='index_membership'`. It deliberately does NOT use the `ticker_requests`
queue — that queue belongs to the user-facing Request-a-Ticker page; index
constituents are a cron concern, not user requests.

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

from analytics.cron import daily_refresh
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


def _fetch_missing(supabase: Any, members: set[str]) -> int:
    """Fetch any constituent not yet in `stocks` directly into the universe.

    Index constituents are a CRON concern, NOT user requests — so we do NOT touch
    `ticker_requests` (that queue is for the Request-a-Ticker page only). We fetch
    the missing names through the same full pipeline a seeded ticker uses
    (`daily_refresh.run`), then audit the ones that landed in `universe_log` with
    `added_by='index_membership'` (never 'user_request'). A name that has no data
    simply doesn't land and is retried on the next run.
    """
    if not members:
        return 0
    # The covered universe (one select; well under the 1000-row cap historically,
    # but paginate defensively in case it grows past a page).
    covered: set[str] = set()
    start = 0
    while True:
        got = supabase.table("stocks").select("ticker").range(start, start + 999).execute()
        batch = cast(list[dict[str, Any]], got.data or [])
        covered.update(r["ticker"] for r in batch)
        if len(batch) < 1000:
            break
        start += 1000
    missing = sorted(members - covered)
    if not missing:
        return 0
    logger.info("Fetching %d uncovered constituent(s) into the universe: %s", len(missing), ", ".join(missing))
    # Full fetch (price + fundamentals + enriched) — same path as a seeded ticker,
    # through the sacred DataProvider (#9). Don't email on per-ticker failures: a few
    # genuinely data-less names are expected.
    daily_refresh.run(only=missing, notify_on_failure=False)
    # Reconcile: which of the missing names actually landed in `stocks`? Audit only
    # those, once, as index-membership additions.
    landed: set[str] = set()
    for i in range(0, len(missing), _DB_CHUNK):
        chunk = missing[i: i + _DB_CHUNK]
        res = supabase.table("stocks").select("ticker").in_("ticker", chunk).execute()
        landed.update(r["ticker"] for r in cast(list[dict[str, Any]], res.data or []))
    if landed:
        rows = [
            {"ticker": t, "added_by": "index_membership", "added_by_user": None}
            for t in sorted(landed)
        ]
        for i in range(0, len(rows), _DB_CHUNK):
            supabase.table("universe_log").insert(rows[i: i + _DB_CHUNK]).execute()
    logger.info("Constituent fetch complete — %d/%d landed in the universe", len(landed), len(missing))
    return len(landed)


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

    fetched = _fetch_missing(supabase, all_members)

    logger.info(
        "Index membership refresh complete — counts=%s refreshed=%s failed=%s fetched_new=%d",
        counts, refreshed, failed, fetched,
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

    return {"counts": counts, "refreshed": refreshed, "failed": failed, "fetched_new": fetched}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Refresh index membership from ETF holdings")
    parser.add_argument("--only", default=None, help="Comma-separated index ids, e.g. --only sp500,tsx60")
    args = parser.parse_args()
    run(only=args.only.split(",") if args.only else None)
