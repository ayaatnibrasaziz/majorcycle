"""The recovery study's episode rule, written down so it can be re-run.

The code that produced `drawdown-recovery-2026-08-27-DATA.json.gz` was never committed
(see README, "Which of these actually RUN"). This re-implements its rule from the
fields it recorded, and `--validate` proves the re-implementation against that file
before anything is built on it:

    an EPISODE starts at a new highest close (since 2000-01-01, or the first bar);
    it ends on the first later close at or above that peak (RECOVERED), or is still
    open when the data ends. Depth = lowest close in between, against the peak.
    The clock for a 20% fall starts on the first close at least 20% below the peak
    and is counted in trading bars (252 to a year).
"""

from __future__ import annotations

import sys
from typing import Any

WINDOW_START = "2000-01-01"


def episodes(rows: list[list[Any]], end: str) -> list[dict[str, Any]]:
    """rows: [[date, high, low, close], ...] sorted by date."""
    bars = [(r[0], float(r[3])) for r in rows if WINDOW_START <= r[0] <= end and r[3] is not None]
    out: list[dict[str, Any]] = []
    n = len(bars)
    i = 0
    while i < n:
        pdate, peak = bars[i]
        j = i + 1
        trough, tdate, cross20 = peak, pdate, None
        while j < n and bars[j][1] < peak:
            d, c = bars[j]
            if c < trough:
                trough, tdate = c, d
            if cross20 is None and c <= peak * 0.8:
                cross20 = j
            j += 1
        if j > i + 1:
            recovered = j < n
            out.append(
                {
                    "peak": peak,
                    "peak_date": pdate,
                    "trough": trough,
                    "trough_date": tdate,
                    "depth_pct": (trough / peak - 1) * 100,
                    "recovered": recovered,
                    "recovery_date": bars[j][0] if recovered else None,
                    "cross20_date": bars[cross20][0] if cross20 is not None else None,
                    "days_cross20_to_recovery": (j - cross20) if (recovered and cross20 is not None) else None,
                    "bars_after_cross20": (n - 1 - cross20) if cross20 is not None else None,
                }
            )
        i = j if j > i + 1 else i + 1
    return out


def validate() -> None:
    """Re-derive the August study's ASX 200 episodes from the October freeze."""
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
    import _data
    from asx_tech_figures import load

    study = _data.load()
    oct_ = load()
    rows = [r for r in study["rows"] if r["index_id"] == "asx200"]
    same_count = same_depth = same_recovered = compared = missing = 0
    for r in rows:
        if r["ticker"] not in oct_["full"]:
            missing += 1
            continue
        mine = [e for e in episodes(oct_["full"][r["ticker"]], study["as_at"]) if e["cross20_date"]]
        theirs = [e for e in r["episodes"] if e["cross20_date"]]
        compared += 1
        if len(mine) == len(theirs):
            same_count += 1
            if all(abs(a["depth_pct"] - b["depth_pct"]) < 1.0 for a, b in zip(mine, theirs)):
                same_depth += 1
            if all(a["recovered"] == b["recovered"] for a, b in zip(mine, theirs)):
                same_recovered += 1
    print(
        f"compared {compared} companies (missing from Oct freeze: {missing}) · same number of 20% falls: "
        f"{same_count} · same depths within 1 pt: {same_depth} · same recovered/not: {same_recovered}"
    )



TY = 252.0


def km_median_years(clocks: list[tuple[int, bool]]) -> float | None:
    """Kaplan-Meier median wait, in years — a line-for-line copy of assert_all.km.

    A fall still open at the end of the data counts as 'not back yet after N bars'
    rather than being dropped, so recent falls do not flatter the answer. The tie
    order (numpy argsort on the duration alone) is kept identical on purpose: the
    first version sorted by (duration, recovered) and gave 0.92 years where the
    published figure, from the same falls, is 0.94.
    """
    import numpy as np

    dur = [c[0] for c in clocks]
    ev = [c[1] for c in clocks]
    o = np.argsort(dur)
    t = np.asarray(dur, float)[o]
    e = np.asarray(ev, bool)[o]
    n = len(t)
    s = 1.0
    prev = 1.0
    for ti, ei in zip(t, e):
        if ei:
            s *= 1.0 - 1.0 / n
            if s <= 0.5 < prev:
                return float(ti) / TY
            prev = s
        n -= 1
    return None


def back_within(clocks: list[tuple[int, bool, int]], years: float) -> tuple[float, int]:
    """Share of falls back within `years`, counting only falls old enough to judge."""
    need = int(years * TY)
    el = [c for c in clocks if c[2] >= need]
    if not el:
        return float("nan"), 0
    return 100 * sum(1 for c in el if c[1] and c[0] <= need) / len(el), len(el)


def clocks_for(ep: list[dict[str, Any]]) -> list[tuple[int, bool, int, float]]:
    out = []
    for e in ep:
        if e["cross20_date"] is None:
            continue
        dur = e["days_cross20_to_recovery"] if e["recovered"] else e["bars_after_cross20"]
        out.append((dur, e["recovered"], e["bars_after_cross20"], e["depth_pct"]))
    return out


if __name__ == "__main__":
    validate()
