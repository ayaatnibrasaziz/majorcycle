"""Write the landing page's live figures to a small JSON snapshot.

The landing page shows ONE real stock with real numbers (owner decision), and it
reads them from a file rather than querying the database per visit. Three reasons,
in order of importance:

1. **It cannot leak.** The snapshot is built from `calculate_cycle_metrics`, which
   returns cycle geometry and nothing else — no overall rating, no health score,
   no valuation. There is no code path from this file to a paid field, so the
   most public page we own is *structurally* incapable of publishing one. That is
   a stronger guarantee than remembering to strip fields (CLAUDE.md 11b).

2. **It cannot break the front door.** A landing page that queries Postgres has a
   database outage in its critical path. This one is a static import.

3. **It cannot be slow.** No round trip, no cold start, nothing for Lighthouse to
   wait on.

Reads the SITE's own price history from Supabase rather than re-fetching from the
provider, so the figure on the landing page is the same figure the stock page
shows.

⚠️ **THREE FILES, TWO LIFECYCLES — and the split exists because one file carrying
two rules shipped a defect (finding 5A-013, 2026-09-01).**

Written on **every** run:

* ``universe-count.json`` — a plain FACT about the product, how many companies we
  cover. It must always be true. The universe auto-expands on every reader's
  ticker request (#16), so a stale count is a number the product is actively
  working to falsify (11c-v).
* ``learn-snapshot.json`` — Apple's cycle figures for the ``/learn`` explainers.
  **Live by owner decision**, restated 2026-09-01: *"keep the learn articles as
  is ... keep it separate."* An explainer describes how the product behaves
  **today**, and each article prints its own as-of date.

Written only with ``--worked-example``:

* ``landing-snapshot.json`` — the landing page's dated WORKED EXAMPLE, the same
  Apple figures with a different job. The page writes prose *about* these numbers
  and puts them beside the frozen Mag 7 table, so it is **frozen** too.

⚠️ **``learn-snapshot.json`` and ``landing-snapshot.json`` hold the same shape and
are written from ONE computation, so they can never disagree at the moment they
are both written — they diverge only as the frozen one ages, which is the point.**

**Why they cannot share a lifecycle.** Apple appears in this file AND in the
Mag 7 table above it on the same page. While this one rebuilt nightly and the
Mag 7 table stayed frozen, the two drifted apart — and the live page printed
Apple at **-11.3%** in the table and **"8.0% below its high"** three screens
later. Both correct for their own date; together they read as a mistake, on the
page whose whole promise is careful measurement. That is CLAUDE.md **11k**
verbatim: *two snapshots describing the same subject must carry the same date.*

So: **regenerate the two worked examples together, or not at all.**

    python -m analytics.cron.build_landing_snapshot --worked-example
    python -m analytics.cron.build_mag7_snapshot

and then RE-READ the surrounding copy, because the page states relationships
between these rows, not just the rows (finding 5A-014).

⚠️ The cycle maths is imported from `analytics/major_cycle.py`, never restated.
An algorithm reimplemented for a second surface is the defect that put three
different roundings of one number on the page, the .csv and the .xlsx
(CLAUDE.md 11c iii).
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

import pandas as pd
from postgrest.types import CountMethod
from supabase import Client, create_client

from analytics.major_cycle import CycleParams, calculate_cycle_metrics
from analytics.presets import PRESETS

# The landing stock is FIXED, not rotating (owner decision). A rotating example
# means the page a reader shares is not the page their friend opens, and every
# screenshot in circulation goes stale.
TICKER = "AAPL"
DISPLAY_NAME = "Apple"
PRESET = "medium"

_APP = Path(__file__).resolve().parents[2] / "web" / "app"
#: The dated worked example — FROZEN. Only written with ``--worked-example``.
OUT = _APP / "landing-snapshot.json"
#: The live company count — rewritten and committed every night.
COUNT_OUT = _APP / "universe-count.json"
#: Apple's cycle figures for the /learn explainers — rewritten every night.
#: Same shape as OUT, different LIFECYCLE. See the module docstring.
LEARN_OUT = _APP / "learn-snapshot.json"
_PAGE = 1000  # PostgREST caps a request at 1000 rows and says nothing (14c).


def _supabase() -> Client:
    # SUPABASE_URL, matching every other cron script and the GitHub secret they
    # all read. `NEXT_PUBLIC_SUPABASE_URL` is the web app's name for the same
    # value; using it here would work locally off .env.local and then raise
    # KeyError at 22:30 UTC in a workflow nobody is watching.
    url = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    return create_client(url, os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def _universe_count(supabase: Client) -> int:
    """How many companies the site covers, for the landing page's headline.

    ⚠️ `count=CountMethod.exact` with `limit(1)`, NOT `len(res.data)`. PostgREST caps a
    request at 1000 rows and says nothing about it (14c), so counting the rows
    would be correct right up to the day we passed a thousand and then read
    “1,000 companies” forever — on the most public page we own, with nothing going
    red. The count comes back in the Content-Range header instead, so it is
    structurally immune to that cap rather than merely under it today.

    `market='index'` rows are benchmarks (^GSPC etc.), not companies a reader can
    browse — the same exclusion `fetchUniverseIndex` applies for /stocks and
    `check_field_units.py` applies nightly. **Retired companies are excluded for the
    same reason**: they are absent from Browse, so counting them made the landing's
    "Browse all N companies" a promise Browse does not keep.
    """
    res = (
        supabase.table("stocks")
        .select("ticker", count=CountMethod.exact)
        .neq("market", "index")
        # ⚠️ `is_active` too — audit 5A-130 (P5, 2026-09-05). Without it the count
        # included the 5 RETIRED companies, which Browse filters out
        # (`lib/universe.server.ts`, `.eq('is_active', true)`). The landing says
        # "Browse all N companies" and the promise was five short of what Browse
        # actually lists — 869 against 864. Nothing errored; both numbers are
        # plausible, and the only way to see it is to count both sides.
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    count = res.count
    # A count that failed to arrive must never reach the page. "0 companies." and
    # "null companies." are both fluent, both wrong, and neither raises.
    if count is None or count < 50:
        raise SystemExit(f"Refusing to write a snapshot with universeCount={count!r}")
    return int(count)


def _load_bars(supabase: Client, ticker: str) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        res = (
            supabase.table("price_bars")
            .select("date,open,high,low,close,volume")
            .eq("ticker", ticker)
            .order("date")
            .range(start, start + _PAGE - 1)
            .execute()
        )
        # `res.data` is typed as loose JSON by the supabase client; cast at the
        # boundary exactly as _select_all() in daily_refresh.py does.
        batch = cast(list[dict[str, Any]], res.data or [])
        rows.extend(batch)
        if len(batch) < _PAGE:
            break
        start += _PAGE

    if not rows:
        raise SystemExit(f"No price bars for {ticker} — refusing to write a snapshot")

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    return df.rename(
        columns={"open": "Open", "high": "High", "low": "Low", "close": "Close", "volume": "Volume"}
    )


def _write_universe_count(supabase: Client) -> int:
    """The nightly half: one fact, always current.

    Deliberately a separate FILE rather than a key inside the frozen snapshot.
    A reader opening either file can tell from its name which lifecycle it has;
    a single file with one live key among ten frozen ones cannot say that, and
    the next person to regenerate it would have no way to know which is which.
    """
    count = _universe_count(supabase)
    COUNT_OUT.write_text(
        json.dumps(
            {
                "universeCount": count,
                "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"{COUNT_OUT.name}: {count} companies")
    return count


def _build_apple_snapshot(supabase: Client) -> dict[str, Any]:
    """Apple's cycle geometry, freshly computed. Used by BOTH output files."""
    row = supabase.table("stocks").select("ticker,name,currency").eq("ticker", TICKER).execute()
    if not row.data:
        raise SystemExit(f"{TICKER} is not in the universe")
    stock = cast(list[dict[str, Any]], row.data)[0]
    currency = stock.get("currency") or "USD"

    df = _load_bars(supabase, TICKER)
    p = PRESETS[PRESET]
    metrics = calculate_cycle_metrics(
        df,
        CycleParams(
            pullback_threshold=float(p["pullback_threshold"]),
            profit_threshold=float(p["profit_threshold"]),
            lookback_bars=int(p["lookback_bars"]),
        ),
    )
    # An explicit allow-list, not a blocklist. A blocklist silently ships whatever
    # field is added upstream next; this can only ever emit these keys.
    #
    # ⚠️ Widened for the storyboard's two distribution bars — how far this stock
    # falls, and how far it recovers. Every one of the added figures is cycle
    # GEOMETRY, which is free-tier by the free/paid line: a drawdown is arithmetic
    # on public prices, whereas a rating is our judgement. `calculate_cycle_metrics`
    # still cannot return a rating, a health score or a valuation, so the guarantee
    # in this file's docstring is unchanged — it is not "we remembered to strip the
    # paid fields", it is "there is no code path to one".
    snapshot = {
        "ticker": TICKER,
        "name": DISPLAY_NAME,
        "currency": currency,
        "price": metrics["current_close"],
        # ── how far it falls ──
        "currentDrawdownPct": metrics["current_drawdown_pct"],
        "typicalDrawdownPct": metrics["typical_drawdown"],
        "deepestDrawdownPct": metrics["lower_bound"],
        "pullbackEvents": metrics["total_pullback_events"],
        # ── how far it recovers ──
        "currentProfitPct": metrics["current_profit_pct"],
        "typicalRecoveryPct": metrics["typical_profit"],
        "largestRecoveryPct": metrics["upper_bound"],
        "recoveryEvents": metrics["total_profit_events"],
        "asOf": metrics["as_of"],
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    # Every figure the page prints, not a sample of them. A None reaching the page
    # renders as "null%" or an empty bar — plausible-looking and wrong — and the
    # storyboard's copy states these numbers in words as well as in the chart.
    required = (
        "price",
        "currentDrawdownPct",
        "typicalDrawdownPct",
        "deepestDrawdownPct",
        "currentProfitPct",
        "typicalRecoveryPct",
        "largestRecoveryPct",
    )
    missing = [k for k in required if snapshot[k] is None]
    if missing:
        raise SystemExit(f"Refusing to write a snapshot missing {missing}")

    # Deliberately writes NOTHING. `main()` decides which files receive this, and
    # the two files it can go to have different lifecycles — a builder that also
    # wrote one of them would make the nightly path capable of touching the frozen
    # one by accident, which is the whole defect this split exists to prevent.
    return snapshot


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--worked-example",
        action="store_true",
        help=(
            "Also rebuild the FROZEN landing-snapshot.json (the landing page's dated "
            "worked example). Regenerate build_mag7_snapshot.py in the same sitting "
            "and re-read the landing copy - the page states relationships between "
            "those rows, not just the rows."
        ),
    )
    args = parser.parse_args()

    supabase = _supabase()

    # Always: the count is a fact about the product and must never go stale.
    _write_universe_count(supabase)

    # Apple's cycle geometry, computed ONCE and written to one or two files. Both
    # hold the same shape; what differs is their lifecycle.
    snapshot = _build_apple_snapshot(supabase)

    def _write(path: Path) -> None:
        path.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
        print(
            f"{path.name}: {snapshot['ticker']} {snapshot['currency']} "
            f"{snapshot['price']:.2f} - now {snapshot['currentDrawdownPct']:.1f}% - "
            f"usually {snapshot['typicalDrawdownPct']:.1f}% over "
            f"{snapshot['pullbackEvents']} pullbacks - as of {snapshot['asOf']}"
        )

    # NIGHTLY. The /learn explainers describe how the product behaves TODAY, so
    # their figures stay live. Owner decision, restated 2026-09-01 when the landing
    # page's example was frozen: "keep the learn articles as is ... keep it separate".
    _write(LEARN_OUT)

    if not args.worked_example:
        return

    # ON REQUEST ONLY. The landing page writes prose ABOUT these numbers and shares
    # Apple with the frozen Mag 7 table beside it, so this file moves when a person
    # decides it should - never at 22:30 UTC (finding 5A-013).
    _write(OUT)


if __name__ == "__main__":
    main()
