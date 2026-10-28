"""Freeze every price the RBA and the banks article (draft 11) derives a figure from.

The big four banks and the ASX 200, every stored bar up to AS_OF, written
once to `reference/rba-2026-10-DATA.json.gz`. `rba_figures.py` and `assert_rba.py`
read only that file, so the article's figures cannot move when the nightly refresh does
(11ad).

    python -I reference/article-drafts/verify/freeze_rba.py 2026-10-23
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
OUT = ROOT / "reference" / "rba-2026-10-DATA.json.gz"
TICKERS = ["CBA.AX", "WBC.AX", "NAB.AX", "ANZ.AX", "^AXJO"]
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
    as_of = sys.argv[1]
    _env()
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    full: dict[str, list[list[Any]]] = {}
    for t in TICKERS:
        rows = _all(
            sb.table("price_bars").select("date,high,low,close,volume").eq("ticker", t).lte("date", as_of).order("date")
        )
        full[t] = [[r["date"], r["high"], r["low"], r["close"], r["volume"]] for r in rows]
    last = {t: v[-1][0] for t, v in full.items()}
    if any(d != as_of for d in last.values()):
        sys.exit(f"not every series reaches {as_of}: {last}")
    with gzip.open(OUT, "wt", encoding="utf-8") as fh:
        json.dump({"as_of": as_of, "full": full}, fh)
    print(f"wrote {OUT.name}: " + ", ".join(f"{t} {len(v)} bars" for t, v in full.items()))


if __name__ == "__main__":
    main()
