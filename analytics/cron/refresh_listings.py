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
from typing import Any, Callable, Optional, TypedDict

from postgrest.types import CountMethod

from analytics.cron.daily_refresh import _get_supabase
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

# Exit code for "a market's menu collapsed". Distinct from 1 so a genuine crash and
# a detected regression are never confused in the workflow log.
EXIT_REGRESSION = 2

# The share of a market's existing menu below which a pull is a REGRESSION rather
# than ordinary churn. Exchanges add and remove a handful of companies a week; none
# loses half its listings overnight, so this cannot fire on real delistings — and a
# threshold that cries wolf is a threshold people learn to ignore.
_REGRESSION_SHARE = 0.5


def is_regression(fetched: int, existing_active: int) -> bool:
    """Did this pull lose most of a market that we already had?

    ── Why this exists (audit F-027, 2026-08-25) ────────────────────────────────
    The AU source returned ZERO symbols every night from 2026-07-24 and nothing
    said so for a month. Two separate silences stacked:

      1. The ASX URL began answering **HTTP 200** with an HTML rejection page, so
         nothing raised — the failure wore a success code.
      2. `run()` treats an empty pull as a deliberate SOFT failure, warning and
         skipping rather than deactivating the market. That is the right call for a
         format change (a 403 must not wipe a market's whole menu) — but it made
         the workflow succeed, and GitHub's failed-workflow email is the only
         alerting channel this project has.

    So the soft failure stays, and this decides when it is loud as well as soft.

    ⚠️ Deliberately compares against WHAT WE ALREADY HAVE rather than a fixed
    number. A magic constant would have to be maintained per market and would be
    wrong the day a market is added. A market with nothing stored yet — a genuine
    cold start — is correctly quiet, because there is nothing to have lost.
    """
    if existing_active <= 0:
        return False
    return fetched < existing_active * _REGRESSION_SHARE


# How much of a market's existing menu a single pull may retire. Ordinary churn is
# a handful of companies a week — well under 1% — so anything past this is a
# disagreement between sources rather than a wave of delistings.
_CHURN_CEILING = 0.02


def is_safe_to_deactivate(missing: int, existing_active: int) -> bool:
    """May this pull mark `missing` symbols delisted?

    ── Why this exists ──────────────────────────────────────────────────────────
    The delisting sweep trusts the pull to be a complete picture of the market. On
    2026-08-25 that turned out to be false in a way no status code reveals: the
    replacement ASX directory carries 1,841 of the 1,981 symbols we hold, and the
    158 it omits are not all delistings. Two of them — **QUB.AX (Qube Holdings)
    and CVW.AX** — are companies we actively cover, with current price data. 27 of
    29 well-known ASX codes are present; those two simply are not in the file.

    So without this, applying the URL fix would have marked 158 live companies
    "not a known listing" — turning a source that returned *nothing* into a source
    that returned something *wrong*, which is worse, because the second one looks
    like it is working.

    ⚠️ The asymmetry is the whole argument. Leaving a delisted company in the menu
    costs a reader one failed request, which `drain_requests` already handles by
    marking it `unsupported`. Removing a LIVE company tells them their real stock
    does not exist, and nothing ever corrects it. When a source's completeness is
    uncertain, err toward keeping.

    A warning rather than a workflow failure, deliberately: this state can persist
    for as long as two sources disagree, and a red X every night for a condition
    nobody can act on is how people learn to ignore red. The alarm stays reserved
    for a market actually collapsing.
    """
    if existing_active <= 0:
        return True
    return missing <= existing_active * _CHURN_CEILING


class RefreshResult(TypedDict):
    """What a run did, per market — typed so the exit-code branch below can read
    `regressed` without a cast. It used to be `dict[str, object]`, which made every
    value opaque at exactly the point that decides whether the nightly job goes red."""

    counts: dict[str, int]
    refreshed: list[str]
    failed: list[str]
    regressed: list[str]
    existing: dict[str, int]
    total: int


def _active_symbols(supabase: Any, market: str) -> set[str]:
    """Every active symbol we currently hold for a market.

    Paginated, because PostgREST caps an unbounded read at 1000 rows and says
    nothing about it (CLAUDE.md 14c) — and `listings` is already past 9,000, so an
    unpaginated read here would silently under-report what we hold and make the
    churn check below far too permissive.
    """
    out: set[str] = set()
    page = 0
    while True:
        res = (
            supabase.table("listings")
            .select("symbol")
            .eq("market", market)
            .eq("is_active", True)
            .range(page * 1000, page * 1000 + 999)
            .execute()
        )
        rows = res.data or []
        out |= {r["symbol"] for r in rows}
        if len(rows) < 1000:
            return out
        page += 1


def run(only: Optional[list[str]] = None) -> RefreshResult:
    supabase = _get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    markets = [m for m in (only or list(_SOURCES)) if m in _SOURCES]

    counts: dict[str, int] = {}
    refreshed: list[str] = []
    failed: list[str] = []
    regressed: list[str] = []
    all_rows: list[ListingRow] = []

    # What we already hold, read BEFORE anything is written — the baseline every
    # regression below is judged against (see `is_regression`).
    existing: dict[str, int] = {}
    for market in markets:
        try:
            res = (
                supabase.table("listings")
                .select("symbol", count=CountMethod.exact)
                .eq("market", market)
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            existing[market] = res.count or 0
        except Exception as e:
            # A baseline we could not read is not a baseline of zero. Zero would
            # silently disable the regression check for that market, which is the
            # exact "unmeasurable counted as clean" failure this guard exists to
            # end (CLAUDE.md 14g), so say so and treat it as a breach.
            logger.error("%s: could not read the existing listing count: %s", market, e)
            existing[market] = -1

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

    # Judge every market AFTER all of them have been attempted, so one collapsed
    # source never stops the others from refreshing.
    for market in markets:
        base = existing.get(market, 0)
        if base < 0 or is_regression(counts.get(market, 0), base):
            regressed.append(market)
            logger.error(
                "%s LISTINGS REGRESSION: pulled %d, we already had %d active. "
                "The menu was NOT overwritten, so the site keeps serving the older "
                "one — but it is going stale and will not fix itself. Check whether "
                "the source now answers HTTP 200 with an error page (F-027).",
                market, counts.get(market, 0), base,
            )

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
    #
    # ⚠️ A REGRESSED market is excluded here, and that is the half that actually
    # protects a reader. An empty pull was already safe: nothing to upsert, nothing
    # to deactivate. A HALF-empty pull is the dangerous one — 500 symbols where we
    # had 2,000 is not empty, so without this line it would upsert the 500 and then
    # mark the other 1,500 delisted, quietly deleting three quarters of a market's
    # menu from a source that was merely having a bad night.
    fetched_by_market: dict[str, set[str]] = {}
    for r in all_rows:
        fetched_by_market.setdefault(r.market, set()).add(r.symbol)

    for market in refreshed:
        if market in regressed:
            logger.warning(
                "%s: skipping the delisting sweep — a regressed pull must not be "
                "allowed to mark the rest of the market inactive",
                market,
            )
            continue

        # How many symbols this sweep would actually retire. Counted as a set
        # difference rather than inferred from the totals, because a source that
        # adds 200 and drops 158 nets out to a comfortable-looking number while
        # still delisting 158 live companies.
        stored = _active_symbols(supabase, market)
        missing = stored - fetched_by_market.get(market, set())
        if not is_safe_to_deactivate(len(missing), len(stored)):
            logger.warning(
                "%s: skipping the delisting sweep — this pull would retire %d of "
                "%d symbols (%.1f%%), far past ordinary churn. That is two sources "
                "disagreeing, not a wave of delistings, and marking a LIVE company "
                "'not a known listing' is the more expensive mistake. Sample: %s",
                market, len(missing), len(stored),
                100 * len(missing) / max(len(stored), 1),
                ", ".join(sorted(missing)[:8]),
            )
            continue

        supabase.table("listings").update({"is_active": False}).eq(
            "market", market
        ).lt("updated_at", now).execute()

    logger.info(
        "Listings refresh complete — counts=%s refreshed=%s failed=%s regressed=%s",
        counts, refreshed, failed, regressed,
    )


    return {
        "counts": counts,
        "refreshed": refreshed,
        "failed": failed,
        "regressed": regressed,
        "existing": existing,
        "total": len(payload),
    }


if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Refresh the listings menu")
    parser.add_argument("--only", default=None, help="Comma-separated markets, e.g. --only us,au")
    args = parser.parse_args()
    result = run(only=args.only.split(",") if args.only else None)

    # ⚠️ Exiting non-zero here is only HALF the alarm, and on its own it is
    # decoration. The workflow step runs with `continue-on-error: true` — on
    # purpose, so a flaky listings source can never block the nightly price
    # refresh — which means a non-zero exit is recorded and the job still
    # succeeds. The other half is a gate step at the END of
    # `.github/workflows/daily-refresh.yml`, after the prices are safely in,
    # which reads this step's `outcome` and fails the job. Both are needed:
    # this one without that one changes nothing anybody would ever see.
    if result["regressed"]:
        regressed_names = ", ".join(result["regressed"])
        print(
            f"::error::listings regression in {regressed_names} — "
            f"pulled {result['counts']} against {result['existing']} already active"
        )
        sys.exit(EXIT_REGRESSION)
