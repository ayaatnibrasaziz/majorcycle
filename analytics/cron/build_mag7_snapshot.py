"""Write the landing page's worked example — one real screener run, frozen.

The landing page shows what the product actually produces: seven well-known US
stocks, ranked, with the same columns the paying screener shows. Not a mockup and
not a screenshot — the real analysis, run through the real code path, committed to
the repo as a dated file.

⚠️ **This is the one place paid output appears on a public page**, and it is a
deliberate, owner-approved exception rather than an oversight. It is bounded four
ways, and every one of them matters:

1. **Seven allow-listed tickers.** `TICKERS` below is the whole universe of this
   file. There is no parameter, no query string and no way for a reader to ask it
   about an eighth company — which is the difference between publishing a worked
   example and publishing the product.
2. **An allow-list of KEYS, not a blocklist.** `_row()` can only ever emit the
   fields named in it. A blocklist would silently ship whatever `CycleAnalysis`
   grows next.
3. **A static import, so no database sits in the request path.** The landing page
   never calls `/api/cycle` or `/api/analyze` — both of which are entitlement-gated
   and must stay that way. Nothing about this file weakens either.
4. **Frozen, not nightly** (owner decision, 2026-08-13). The page writes sentences
   ABOUT this run — which stock fell furthest, that nothing reached the Opportunity
   Zone — and a nightly rebuild would let those sentences quietly become false with
   nothing going red. The date is printed beside the table so a reader knows
   exactly what they are looking at. Regenerate only on request, and re-read the
   surrounding copy when you do.

⚠️ The analysis is `analyze_ticker` — the SAME function the screener runs. Not the
scoring pieces recomposed here. When the shared rule is an ALGORITHM, a second
implementation agreeing with the spec is not enough; it has to consume the first
one's output (CLAUDE.md 11c iii, which cost this project three different roundings
of one number). Fundamentals are rehydrated exactly as `web/api/analyze.py` does,
for the same reason.
"""

from __future__ import annotations

import dataclasses
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

import pandas as pd
from supabase import Client, create_client

from analytics.major_cycle import CycleParams, analyze_ticker
from analytics.presets import PRESETS
from analytics.providers.base import FundamentalsSnapshot
from analytics.providers.field_spec import normalise_fundamentals

# The Magnificent Seven, fixed. Order here is not the display order — the page
# ranks by Overall Rating, exactly as the screener does.
TICKERS = ("AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA")
PRESET = "medium"

OUT = Path(__file__).resolve().parents[2] / "web" / "app" / "mag7-snapshot.json"
_PAGE = 1000  # PostgREST caps a request at 1000 rows and says nothing (14c).


def _supabase() -> Client:
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
        columns={
            "open": "Open",
            "high": "High",
            "low": "Low",
            "close": "Close",
            "volume": "Volume",
        }
    )


def _fundamentals(row: dict[str, Any]) -> FundamentalsSnapshot | None:
    """Rehydrate from the stocks JSONB, byte-for-byte as web/api/analyze.py does."""
    fund_dict: dict[str, Any] = row.get("fundamentals") or {}
    allowed = {f.name for f in dataclasses.fields(FundamentalsSnapshot)}
    clean = {k: v for k, v in fund_dict.items() if k in allowed}
    clean.setdefault("ticker", row["ticker"])
    if "market" not in clean and row.get("market"):
        clean["market"] = row["market"]
    if "currency" not in clean and row.get("currency"):
        clean["currency"] = row["currency"]
    try:
        return normalise_fundamentals(FundamentalsSnapshot(**clean))
    except TypeError as e:
        raise SystemExit(f"{row['ticker']}: could not rebuild fundamentals — {e}") from e


def _row(analysis: Any, name: str, currency: str) -> dict[str, Any]:
    """The ONLY fields this file may publish. An allow-list, never a blocklist."""
    return {
        "ticker": analysis.ticker,
        "name": name,
        "currency": currency,
        "overallRating": analysis.overall_rating,
        "overallLabel": analysis.overall_label,
        "healthScore": analysis.financial_health_score,
        "valuationScore": analysis.valuation_score,
        # The third weight in the Overall Rating. Needed because the landing page's
        # table renders the SAME Overall cell the screener does, and that cell
        # carries a composition micro-bar split 40/35/25 — which `ratingComposition()`
        # computes from all three parts. Deriving payoff from the other two and the
        # rounded total would be a second implementation of the weighting, free to
        # disagree with the first (CLAUDE.md 11c iii). No new exposure category: it
        # is one more component of a rating this file already publishes.
        "cyclePayoffScore": analysis.cycle_payoff_score,
        "valuationZone": analysis.valuation_zone,
        "currentDrawdownPct": analysis.current_drawdown_pct,
        "typicalDrawdownPct": analysis.typical_drawdown,
        "lowerBoundPct": analysis.lower_bound,
        "pullbackEvents": analysis.total_pullback_events,
    }


def main() -> None:
    supabase = _supabase()
    p = PRESETS[PRESET]
    params = CycleParams(
        pullback_threshold=float(p["pullback_threshold"]),
        profit_threshold=float(p["profit_threshold"]),
        lookback_bars=int(p["lookback_bars"]),
    )

    rows: list[dict[str, Any]] = []
    as_of: set[str] = set()

    for ticker in TICKERS:
        res = supabase.table("stocks").select("*").eq("ticker", ticker).execute()
        data = cast(list[dict[str, Any]], res.data or [])
        if not data:
            raise SystemExit(f"{ticker} is not in the universe")
        stock = data[0]

        analysis = analyze_ticker(ticker, _load_bars(supabase, ticker), _fundamentals(stock), params)

        # Refuse a partial set. Six rows under a heading that says "Magnificent
        # Seven" is a page telling the reader something untrue, and it would look
        # completely normal — the table would simply be one line shorter.
        if analysis is None:
            raise SystemExit(f"{ticker}: analysis returned nothing — refusing to write a short table")
        if analysis.overall_rating is None:
            raise SystemExit(f"{ticker}: no overall rating — refusing to publish a blank cell")

        rows.append(_row(analysis, stock.get("name") or ticker, stock.get("currency") or "USD"))
        as_of.add(analysis.as_of)

    # Every row must come from the same trading date, or the table silently
    # compares one company's Tuesday against another's Friday.
    if len(as_of) != 1:
        raise SystemExit(f"Rows span multiple dates {sorted(as_of)} — refusing to publish a mixed table")

    rows.sort(key=lambda r: r["overallRating"], reverse=True)

    snapshot = {
        "preset": PRESET,
        "asOf": as_of.pop(),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "rows": rows,
    }

    OUT.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(f"{OUT.name}: {len(rows)} rows, {PRESET} horizon, as of {snapshot['asOf']}")
    for r in rows:
        print(
            f"  {r['ticker']:<6} {r['overallRating']:>5.1f} {r['overallLabel']:<16} "
            f"health {r['healthScore']} · now {r['currentDrawdownPct']:.1f}%"
        )


if __name__ == "__main__":
    main()
