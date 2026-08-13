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
shows. Run nightly, after `daily_refresh.py`; the committed JSON is what ships.

⚠️ The cycle maths is imported from `analytics/major_cycle.py`, never restated.
An algorithm reimplemented for a second surface is the defect that put three
different roundings of one number on the page, the .csv and the .xlsx
(CLAUDE.md 11c iii).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

import pandas as pd
from supabase import Client, create_client

from analytics.major_cycle import CycleParams, calculate_cycle_metrics
from analytics.presets import PRESETS

# The landing stock is FIXED, not rotating (owner decision). A rotating example
# means the page a reader shares is not the page their friend opens, and every
# screenshot in circulation goes stale.
TICKER = "AAPL"
DISPLAY_NAME = "Apple"
PRESET = "medium"

OUT = Path(__file__).resolve().parents[2] / "web" / "app" / "landing-snapshot.json"
_PAGE = 1000  # PostgREST caps a request at 1000 rows and says nothing (14c).


def _supabase() -> Client:
    # SUPABASE_URL, matching every other cron script and the GitHub secret they
    # all read. `NEXT_PUBLIC_SUPABASE_URL` is the web app's name for the same
    # value; using it here would work locally off .env.local and then raise
    # KeyError at 22:30 UTC in a workflow nobody is watching.
    url = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    return create_client(url, os.environ["SUPABASE_SERVICE_ROLE_KEY"])


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


def main() -> None:
    supabase = _supabase()

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

    OUT.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(
        f"{OUT.name}: {TICKER} {currency} {snapshot['price']:.2f} · "
        f"now {snapshot['currentDrawdownPct']:.1f}% · "
        f"usually {snapshot['typicalDrawdownPct']:.1f}% "
        f"over {snapshot['pullbackEvents']} pullbacks · as of {snapshot['asOf']}"
    )


if __name__ == "__main__":
    main()
