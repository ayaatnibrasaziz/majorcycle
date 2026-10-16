"""Freeze every input the ASX tech article (draft 05) derives a figure from.

Run once. After that every figure is re-derived from the frozen file by
`asx_tech_figures.py`, so the article gives the same answer in a year as today and
no reader depends on the live database (CLAUDE.md 11ad: freeze what you rank,
group and filter by, not only what you print).

Writes reference/asx-tech-2026-10-15-DATA.json.gz:
  meta    — name, sector, industry, market cap for every current ASX 200 member
  full    — full daily high/low/close history for every ASX 200 member and ^AXJO
"""

from __future__ import annotations

import gzip
import json
import os
import sys
from pathlib import Path
from typing import Any, cast

from supabase import create_client

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "reference" / "asx-tech-2026-10-15-DATA.json.gz"
AS_OF = "2026-10-15"
PAGE = 1000  # PostgREST caps a request at 1000 rows and says nothing (14c).


def _env() -> None:
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def _all(query: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        batch = cast(list[dict[str, Any]], query.range(start, start + PAGE - 1).execute().data or [])
        rows.extend(batch)
        if len(batch) < PAGE:
            return rows
        start += PAGE


def main() -> None:
    _env()
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    members = [
        r["ticker"]
        for r in _all(
            sb.table("index_membership").select("ticker").eq("index_id", "asx200").eq("is_active", True).order("ticker")
        )
    ]
    meta = {
        r["ticker"]: r
        for r in _all(
            sb.table("stocks")
            .select("ticker,name,sector,industry,market_cap,currency,is_active")
            .in_("ticker", members)
            .order("ticker")
        )
    }
    tech = sorted(t for t, m in meta.items() if m["sector"] == "Technology" and m["is_active"])

    full: dict[str, list[list[Any]]] = {}
    for t in [*members, "^AXJO"]:
        rows = _all(
            sb.table("price_bars").select("date,high,low,close").eq("ticker", t).lte("date", AS_OF).order("date")
        )
        full[t] = [[r["date"], r["high"], r["low"], r["close"]] for r in rows]

    last = {t: v[-1][0] for t, v in full.items() if v}
    stale = sorted(t for t, d in last.items() if d != AS_OF)
    payload = {"as_of": AS_OF, "members": members, "tech": tech, "meta": meta, "full": full}
    with gzip.open(OUT, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh)
    print(f"members={len(members)} tech={len(tech)} full_rows={sum(len(v) for v in full.values())}")
    print(f"no bar on {AS_OF}: {stale}")
    if len(members) < 190:
        sys.exit("Fewer than 190 ASX 200 members: refusing to trust this freeze")


if __name__ == "__main__":
    main()
