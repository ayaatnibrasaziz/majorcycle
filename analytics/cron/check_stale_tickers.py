"""Which tickers stopped receiving prices, and which have actually stopped trading.

Roadmap "Stale prices + dead tickers", parts 2, 3 and 5 — agreed with the owner on
2026-08-30. Runs at the END of each nightly workflow, after every write, so failing
it can never skip work.

── The problem ───────────────────────────────────────────────────────────────

A ticker the provider stops serving looks *exactly* like a ticker nothing is wrong
with. `daily_refresh` logs it as failed and exits 0; the page keeps rendering; the
stored price simply stops moving. Checked by hand on 2026-08-30, eleven companies
were stale and one by four months, and every night the job had reported success.

── ⚠️ Why "no quote" is NOT allowed to mean "delisted" ───────────────────────

Yahoo answers `404 Quote not found` for **BK** — Bank of New York Mellon, one of
the largest banks in America — because the company renamed its ticker to BNY. A
symbol that has never existed answers the same way (verified with `ZZQQ9`). So the
provider's silence cannot distinguish delisted from renamed from typo.

Three independent sources must agree before anything is marked:

    1. the provider has no price data,
    2. the exchange's own symbol directory (`listings`) does not list it active,
    3. no index we track (`index_membership`) still has it as a member.

All three are already fetched nightly, so this needs no new source and no waiting
period.

⚠️ **AND THE LIVE EVIDENCE FOR THE RULE IS NOT BK — CHECKED, 2026-08-30.** The
design note claimed BK survives because the other two sources still carry it. They
no longer do: the rename has propagated, `BK` is absent from `listings` and from
`index_membership`, and both now carry `BNY` instead. So all three agree and BK is
retired — which is *right*, because the ticker `BK` genuinely does not trade any
more, and nothing is lost: its 13,485 bars are kept, and we separately hold `BNY`
complete from 1973 to current.

What the rule actually saves, measured the same day, is better evidence than BK
ever was. **`EA`, `EQR` and `AVB` — three S&P 500 companies, all trading — are
`is_active = false` in `listings` AND `false` in `index_membership`.** Two of the
three sources call them dead. Only the live quote keeps them, so a two-of-three
rule would have retired three live large caps that night. Our reference tables go
stale in exactly the way that makes a majority vote dangerous; **it has to be
unanimous.**

The protection for the BK case is therefore part 3 below — mark, never delete —
not this test. Do not re-attribute it (CLAUDE.md 14f: a mechanism that is present
is not thereby the one responsible).

── ⚠️ Marked, never deleted ──────────────────────────────────────────────────

Once a ticker 404s its history cannot be re-fetched from anywhere. Four delisted
tickers have already cost 30,784 bars that exist in no copy we can reach. A marked
company keeps every bar it ever had; it stops being refreshed and stops being
offered. `stocks.is_active` mirrors the same contract `listings.is_active` has
carried since June.

── ⚠️ Coming BACK is manual, and that is a deliberate limitation ─────────────

A retired ticker drops out of the universe this sweep reads, so nothing here will
ever look at it again. There is no automatic path back, by design: an un-retirement
is a decision, and a rule that could flip a company back on its own would need the
same care in the opposite direction. The manual path is one statement, and it costs
nothing because no data was destroyed:

    update public.stocks
       set is_active = true, inactive_since = null, inactive_reason = null
     where ticker = 'XYZ';

The next nightly run then refreshes it normally and backfills whatever it missed.
If a company genuinely returns under a NEW ticker (a rename), the right move is
usually to leave the old row retired and let the index-membership job fetch the new
symbol — which is what already happened for BK → BNY, and why we hold both.

── ⚠️ What is RED, and what is merely printed ────────────────────────────────

"A red X every night for something nobody can act on is how people learn to ignore
red" (audit F-027). Eleven chronically-slow tickers are not actionable — the owner's
ruling on 2026-08-30 was explicit that a slow provider is the provider's problem,
not a defect in the product. So staleness is reported as a *proportion*, and only an
outbreak is red:

    RED   a market has more than STALE_ALARM_PCT of its tickers stale
          → something broke tonight: the run, the provider, the network
    RED   the delisting cap was hit
          → a source collapsed and we were one step from retiring live companies
    green everything else, with the stale list printed in full

The cap is the same protection the listings sweep gained after a dry run showed the
replacement source would have retired 158 live companies including an ASX 200 name:
**leaving a dead company in the universe costs one failed fetch a night; removing a
live one destroys irreplaceable history.** When completeness is uncertain, keep.

── ⚠️ One email, not two ─────────────────────────────────────────────────────

There is no app-sent nightly email to merge into — the Resend key has been dead
since 2026-07-02 and the alert was removed on 2026-08-06. GitHub's failed-workflow
notification is the only channel, and it fires **once per failed run** however many
steps failed. So this is one more step in the existing workflow, sharing the
existing gate: one email when something is wrong, none when it is not, no new
service and no new cost.
"""

import argparse
import logging
import os
import sys
from bisect import bisect_right
from collections import defaultdict
from collections.abc import Mapping
from datetime import date, datetime, timezone
from typing import Any, Optional, cast

from dotenv import load_dotenv
from supabase import Client, create_client

from analytics.config import DATA_PROVIDER

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

_PAGE = 1000

#: How many of its OWN market's SESSIONS a ticker may fall behind before it counts
#: as stale. Measured against the market's real trading calendar (see
#: `market_calendars`) rather than in calendar days, so it needs no holiday table,
#: never false-fires over Easter or Christmas, stays correct if an exchange adds a
#: closure, and does not report a market as stale merely for being closed while
#: another is open — which is what lets the same sweep run in both nightly
#: workflows, eight hours apart.
#:
#: Three, not one: a thinly-traded stock genuinely may not print on a given day,
#: and a threshold that flagged every gap would bury the real cases in noise.
STALE_TRADING_DAYS = 3

#: A market with more than this share of its tickers stale is an outbreak, not a
#: handful of slow symbols. A PROPORTION, not a count, so it needs no re-tuning as
#: the universe grows (the same reasoning as the listings guard).
STALE_ALARM_PCT = 5.0

#: Never retire more than this share of a market in one night. If a source
#: collapses, the honest outcome is a red run and zero rows changed.
MAX_RETIRE_PCT = 2.0

#: A ticker with no bars at all is not "behind" by any number of sessions — it has
#: never been fetched. Sorted to the top of the report with this sentinel rather
#: than silently skipped, because "never fetched" and "up to date" must never share
#: an outcome (CLAUDE.md 11e).
NEVER_FETCHED = 10_000


def _get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    return create_client(url, os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def _select_all(sb: Client, table: str, columns: str) -> list[dict[str, Any]]:
    """Every row, page by page. PostgREST caps a response at 1000 rows and says
    nothing about it — an unpaginated read of `listings` (8,964 rows) is already
    silently truncated today (CLAUDE.md 14c)."""
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        res = sb.table(table).select(columns).range(start, start + _PAGE - 1).execute()
        batch = cast(list[dict[str, Any]], res.data or [])
        rows.extend(batch)
        if len(batch) < _PAGE:
            return rows
        start += _PAGE


def _market_of(ticker: str) -> str:
    """Which market's calendar this ticker trades on.

    Same table as `daily_refresh._infer_market` and `web/lib/ticker.ts`. ⚠️ `.V`
    (TSX Venture) is Canadian — treating it as US would compare a Canadian ticker
    against the US session calendar and report half the venture board as stale.
    """
    if ticker.startswith("^"):
        return "index"
    if ticker.endswith(".AX"):
        return "au"
    if ticker.endswith(".TO") or ticker.endswith(".V"):
        return "ca"
    return "us"


def newest_bar_dates(sb: Client, tickers: list[str]) -> dict[str, Optional[str]]:
    """The newest stored bar date for each ticker.

    One indexed single-row query per ticker. That is ~870 round trips, which is
    slow and is the right trade: the alternative — one query filtered on `date`
    alone — cannot use `idx_bars_ticker_date` (it leads on `ticker`) and full-scans
    6.6 million rows until it times out.
    """
    out: dict[str, Optional[str]] = {}
    for i, t in enumerate(tickers, 1):
        res = (
            sb.table("price_bars")
            .select("date")
            .eq("ticker", t)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        rows = cast(list[dict[str, Any]], res.data or [])
        out[t] = str(rows[0]["date"]) if rows else None
        if i % 200 == 0:
            logger.info("  ... read %d/%d newest bar dates", i, len(tickers))
    return out


#: Which benchmark index supplies each market's session calendar. These are
#: refreshed by the same nightly job as the equities and are price-only rows, so
#: they hold every session the market actually had.
CALENDAR_INDEX: dict[str, str] = {
    "us": "^GSPC",
    "au": "^AXJO",
    "ca": "^GSPTSE",
}


def market_calendars(sb: Client, days: int = 60) -> dict[str, list[str]]:
    """The recent session dates of each market, most recent first.

    ⚠️ **Read from the market's own benchmark index, NOT derived from the tickers
    being checked** — and the difference is the whole check. The first version of
    this built the calendar out of the distinct newest-bar dates in the universe.
    That is fine while several tickers are lagging by different amounts and
    silently useless in the normal case: if 869 companies are current at the 28th
    and one stopped at the 21st, the only two dates in evidence are those two, so
    the lagging ticker ranks as **one** session behind and is reported healthy.
    The check would have been at its blindest exactly when there was a single
    thing to find.

    ``^GSPC``/``^AXJO``/``^GSPTSE`` have a bar for every session, so ranking
    against them measures real missed sessions. It also costs nothing: they are
    already in `price_bars`, refreshed by the same job.
    """
    cal: dict[str, list[str]] = {}
    for market, index_ticker in CALENDAR_INDEX.items():
        res = (
            sb.table("price_bars")
            .select("date")
            .eq("ticker", index_ticker)
            .order("date", desc=True)
            .limit(days)
            .execute()
        )
        rows = cast(list[dict[str, Any]], res.data or [])
        if rows:
            cal[market] = [str(r["date"]) for r in rows]
        else:
            logger.warning(
                "No bars for %s — %s has no session calendar this run",
                index_ticker, market.upper(),
            )
    return cal


def stale_by_market(
    newest: Mapping[str, Optional[str]],
    calendars: Mapping[str, list[str]],
) -> tuple[dict[str, list[tuple[str, str, int]]], dict[str, int]]:
    """Group tickers by market and return the stale ones, with how far behind.

    ``calendars`` maps a market to its real session dates, most recent first (see
    ``market_calendars``). "3 sessions behind" therefore means three sessions the
    market genuinely had and this ticker does not.

    Returns ``({market: [(ticker, newest_date, sessions_behind)]},
    {market: total_tickers})``.
    """
    by_market: dict[str, list[str]] = defaultdict(list)
    for t in newest:
        by_market[_market_of(t)].append(t)

    stale: dict[str, list[tuple[str, str, int]]] = {}
    totals: dict[str, int] = {}
    for market, tickers in sorted(by_market.items()):
        totals[market] = len(tickers)
        sessions = calendars.get(market)
        if not sessions:
            # No calendar, no verdict. ⚠️ Deliberately NOT falling back to a
            # calendar derived from the tickers themselves: that fallback is the
            # bug described in `market_calendars`, and a check that quietly
            # degrades into a broken one reports what a healthy system reports.
            # The benchmark being absent is itself worth seeing.
            logger.warning(
                "%s: no session calendar — %d ticker(s) NOT checked for staleness",
                market.upper(), len(tickers),
            )
            continue
        # ⚠️ "How many sessions is this ticker behind?" is asked as **how many
        # sessions are strictly NEWER than its bar**, not as a lookup of its date
        # in the calendar. The lookup version was written first and was wrong in
        # both directions against real data:
        #
        #   · A date NEWER than the calendar scored as maximally behind. Measured
        #     2026-08-30: 247 ASX stocks held a bar for the 28th while ^AXJO
        #     reached only the 27th, so almost the entire Australian market was
        #     reported "60 sessions behind" — a false alarm covering a whole
        #     market, on the owner's own market, from a benchmark index that was
        #     itself one session late.
        #   · A date inside the window but not itself a session had no answer at
        #     all and fell to the same maximum.
        #
        # Counting what is newer handles every case with no special branch: level
        # with the market → 0; ahead of a lagging benchmark → 0; one session back
        # → 1; older than the whole window → the window's length. It also fails in
        # the SAFE direction — a benchmark that lags makes this check slightly
        # lenient, never falsely alarming.
        asc = sorted(sessions)
        found: list[tuple[str, str, int]] = []
        for t in tickers:
            d = newest[t]
            if d is None:
                found.append((t, "(no bars)", NEVER_FETCHED))
                continue
            behind = len(asc) - bisect_right(asc, d)
            if behind > STALE_TRADING_DAYS:
                found.append((t, d, behind))
        if found:
            stale[market] = sorted(found, key=lambda r: -r[2])
    return stale, totals


def three_source_verdict(sb: Client, tickers: list[str]) -> dict[str, dict[str, bool]]:
    """For each ticker: does the provider, the exchange directory, or an index
    still know it? Dead requires all three to say no.

    The two table reads are done once for the whole set; the provider call is the
    slow one and cannot be batched.
    """
    listed: set[str] = {
        str(r["symbol"])
        for r in _select_all(sb, "listings", "symbol,is_active")
        if r.get("is_active")
    }
    indexed: set[str] = {
        str(r["ticker"])
        for r in _select_all(sb, "index_membership", "ticker,is_active")
        if r.get("is_active")
    }
    logger.info(
        "Reference sets: %d active listings, %d active index members",
        len(listed),
        len(indexed),
    )
    # ⚠️ A control, not a formality. If either read came back empty — a truncated
    # page, a failed refresh, a renamed column — every ticker would look absent
    # from it, and the three-source test would collapse into the one-source test
    # this whole design exists to avoid. An empty reference set must never be
    # allowed to vote "dead" (CLAUDE.md 14g).
    if not listed or not indexed:
        raise RuntimeError(
            f"A reference set is empty (listings={len(listed)}, index={len(indexed)}). "
            "Refusing to run the delisting test — an empty set would mark every stale "
            "ticker dead."
        )

    verdict: dict[str, dict[str, bool]] = {}
    for t in tickers:
        # `period="1mo"` deliberately: a company that still trades has bars in the
        # last month, and asking for full history would make this the slowest step
        # in the workflow for no extra information.
        try:
            df = DATA_PROVIDER.fetch_price_history(t, period="1mo")
            has_quote = df is not None and not df.empty
        except Exception as e:
            # A provider crash is not evidence of a delisting. Fail toward KEEPING.
            logger.warning("%s: provider raised (%s) — treating as STILL QUOTED", t, e)
            has_quote = True
        verdict[t] = {"quote": has_quote, "listed": t in listed, "indexed": t in indexed}
    return verdict


def retire(sb: Client, ticker: str, reason: str) -> None:
    """Mark a ticker inactive. Its price history is untouched, deliberately."""
    sb.table("stocks").update(
        {
            "is_active": False,
            "inactive_since": date.today().isoformat(),
            "inactive_reason": reason,
        }
    ).eq("ticker", ticker).execute()


def run(apply_changes: bool = True) -> int:
    """Returns a process exit code: 0 green, 1 red."""
    started = datetime.now(timezone.utc)
    sb = _get_supabase()

    universe = [
        str(r["ticker"])
        for r in _select_all(sb, "stocks", "ticker,is_active")
        if r.get("is_active", True)
    ]
    logger.info("Checking %d active tickers for staleness", len(universe))
    if not universe:
        logger.error("The active universe is EMPTY — refusing to report a vacuous pass.")
        return 1

    calendars = market_calendars(sb)
    logger.info(
        "Session calendars: %s",
        ", ".join(f"{m.upper()} newest {d[0]}" for m, d in sorted(calendars.items())) or "NONE",
    )
    newest = newest_bar_dates(sb, universe)
    stale, totals = stale_by_market(newest, calendars)

    problems: list[str] = []

    if not stale:
        logger.info("No stale tickers in any market.")
    for market, rows in stale.items():
        pct = 100.0 * len(rows) / max(1, totals[market])
        logger.info(
            "%s: %d of %d stale (%.1f%%)", market.upper(), len(rows), totals[market], pct
        )
        for t, d, behind in rows:
            how = "never fetched" if behind >= NEVER_FETCHED else f"{behind} sessions behind"
            logger.info("    %-10s newest bar %s  (%s)", t, d, how)
        if pct > STALE_ALARM_PCT:
            problems.append(
                f"{market.upper()}: {len(rows)} of {totals[market]} tickers ({pct:.1f}%) "
                f"are stale — above the {STALE_ALARM_PCT}% alarm line. That is an "
                f"outbreak, not a few slow symbols: suspect tonight's run, the "
                f"provider, or the network."
            )

    # ── The three-source test, on the stale set only ──────────────────────────
    candidates = [t for rows in stale.values() for (t, _, _) in rows]
    retired: list[str] = []
    if candidates:
        logger.info("Applying the three-source test to %d stale ticker(s)", len(candidates))
        verdict = three_source_verdict(sb, candidates)
        dead = [t for t, v in verdict.items() if not any(v.values())]

        for t in candidates:
            if t in dead:
                continue
            kept = [k for k, ok in verdict[t].items() if ok]
            logger.info("    %-10s STALE BUT ALIVE — still %s", t, " + ".join(kept))

        by_market: dict[str, list[str]] = defaultdict(list)
        for t in dead:
            by_market[_market_of(t)].append(t)

        for market, ts in sorted(by_market.items()):
            cap = max(1, int(totals.get(market, 0) * MAX_RETIRE_PCT / 100.0))
            if len(ts) > cap:
                problems.append(
                    f"{market.upper()}: {len(ts)} tickers would be retired tonight, over "
                    f"the safety cap of {cap} ({MAX_RETIRE_PCT}% of "
                    f"{totals.get(market, 0)}). NOTHING was changed. A source collapsing "
                    f"looks exactly like a mass delisting, and retiring a live company "
                    f"destroys history that cannot be re-fetched. "
                    f"Candidates: {', '.join(sorted(ts))}"
                )
                continue
            for t in sorted(ts):
                logger.warning(
                    "    %-10s DEAD — no provider quote, not in the exchange directory, "
                    "in no index. Marking inactive; its price history is kept.",
                    t,
                )
                if apply_changes:
                    retire(sb, t, "no quote; absent from exchange directory and all indices")
                retired.append(t)

    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    logger.info(
        "Staleness sweep complete — %d stale, %d retired%s, %.0fs",
        len(candidates),
        len(retired),
        "" if apply_changes else " (DRY RUN, nothing written)",
        elapsed,
    )

    if problems:
        for p in problems:
            logger.error("STALENESS ALARM: %s", p)
        return 1
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Stale-ticker and delisting sweep")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be marked without writing anything.",
    )
    args = ap.parse_args()
    sys.exit(run(apply_changes=not args.dry_run))
