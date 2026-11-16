"""Every number article 29 (home loans, September quarter 2026) derives, in one place.

Three inputs, all saved locally and never fetched here:
  * the ABS Lending indicators workbook, Table 1 (5601001, seasonally adjusted, $m and number),
  * APRA's Monthly ADI Statistics for September 2026, Table 2 (loans by purpose, per bank),
  * our frozen share prices, `reference/housing-2026-11-DATA.json.gz` (freeze_housing.py).

    python -I reference/article-drafts/verify/housing_figures.py          # prints the figures
    python -I reference/article-drafts/verify/housing_figures.py --json   # what assert_housing.py reads

Share prices are dividend-adjusted, so a bank's move over a window INCLUDES the dividends it paid
in that window. The ASX 200 is the price index and does not. The article says so beside every table.

Window dates are Westpac's own (2026 Full Year Results Presentation & Investor Discussion Pack,
p40, "Australian housing cycles", source Westpac Economics): Jan 08 to Jan 09, Jul 17 to May 19,
Jan 22 to Jan 23, Mar 26 to 2027f. A window runs from the last close of its first month to the
last close of its last month; the current one ends at the frozen close.
"""

from __future__ import annotations

import bisect
import datetime as dt
import gzip
import json
import sys
from pathlib import Path
from typing import Any

import openpyxl

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "reference" / "housing-2026-11" / "sources"
DATA = ROOT / "reference" / "housing-2026-11-DATA.json.gz"
BIG4 = ["CBA.AX", "WBC.AX", "NAB.AX", "ANZ.AX"]
OTHERS = ["MQG.AX", "BOQ.AX", "BEN.AX"]
INDEX = "^AXJO"
AS_OF = "2026-11-13"

# APRA's legal names for the banks we report (Table 2, column A).
APRA_NAMES = {
    "CBA": "Commonwealth Bank of Australia",
    "WBC": "Westpac Banking Corporation",
    "NAB": "National Australia Bank Limited",
    "ANZ": "Australia and New Zealand Banking Group Limited",
    "MQG": "Macquarie Bank Limited",
    "BOQ": "Bank of Queensland Limited",
    "BEN": "Bendigo and Adelaide Bank Limited",
}

CYCLES = [  # (label, first month, last month) — Westpac's table
    ("2008-09", "2008-01", "2009-01"),
    ("2017-19", "2017-07", "2019-05"),
    ("2022-23", "2022-01", "2023-01"),
    ("2026", "2026-03", None),
]


def r1(x: float) -> float:
    return round(x + 0.0, 1)


# ---------------------------------------------------------------- ABS
def abs_series() -> dict[str, Any]:
    wb = openpyxl.load_workbook(SRC / "abs-560101.xlsx", read_only=True, data_only=True)
    rows = list(wb["Data1"].iter_rows(values_only=True))
    head, unit, kind = rows[0], rows[1], rows[2]

    def col(words: list[str], u: str) -> int:
        hits = [
            i
            for i, h in enumerate(head)
            if h and kind[i] == "Seasonally Adjusted" and unit[i] == u and all(w in h for w in words)
        ]
        if len(hits) != 1:
            raise SystemExit(f"ambiguous ABS column {words} {u}: {hits}")
        return hits[0]

    want = {
        "total_value": (["Housing Finance ;  Total dwellings excluding refinancing"], "$ Millions"),
        "oo_value": (["Owner occupier ;  Total dwellings"], "$ Millions"),
        "inv_value": (["Investor ;  Total dwellings"], "$ Millions"),
        "fhb_value": (["Owner occupier ;  First Home Buyers"], "$ Millions"),
        "total_number": (["Housing Finance ;  Total dwellings excluding refinancing"], "Number"),
        "oo_number": (["Owner occupier ;  Total dwellings"], "Number"),
        "inv_number": (["Investor ;  Total dwellings"], "Number"),
        "fhb_number": (["Owner occupier ;  First Home Buyers"], "Number"),
    }
    cols = {k: col(w, u) for k, (w, u) in want.items()}
    out: dict[str, list[tuple[str, float]]] = {k: [] for k in cols}
    for r in rows[10:]:
        if isinstance(r[0], dt.datetime):
            q = r[0].strftime("%Y-%m")
            for k, i in cols.items():
                if r[i] is not None:
                    out[k].append((q, float(r[i])))
    return out


def qchange(s: list[tuple[str, float]]) -> list[tuple[str, float]]:
    return [(s[i][0], (s[i][1] / s[i - 1][1] - 1) * 100) for i in range(1, len(s))]


def abs_figures() -> dict[str, Any]:
    s = abs_series()
    last = {k: v[-1] for k, v in s.items()}
    prev = {k: v[-2] for k, v in s.items()}
    yago = {k: v[-5] for k, v in s.items()}
    f: dict[str, Any] = {"quarter": last["total_value"][0]}
    for k in s:
        f[f"{k}_latest"] = last[k][1]
        f[f"{k}_q_pct"] = r1((last[k][1] / prev[k][1] - 1) * 100)
        f[f"{k}_y_pct"] = r1((last[k][1] / yago[k][1] - 1) * 100)
    # Records: the worst quarterly fall in each value series, and the second worst.
    for k in ("total_value", "inv_value"):
        ch = sorted(qchange(s[k]), key=lambda x: x[1])
        f[f"{k}_worst"] = [ch[0][0], r1(ch[0][1])]
        f[f"{k}_second_worst"] = [ch[1][0], r1(ch[1][1])]
        f[f"{k}_first_quarter"] = s[k][0][0]
    # Investor lending: peak to now, and how many quarters in a row it has fallen.
    inv = s["inv_value"]
    peak = max(inv, key=lambda x: x[1])
    f["inv_value_peak"] = [peak[0], round(peak[1])]
    f["inv_value_from_peak_pct"] = r1((inv[-1][1] / peak[1] - 1) * 100)
    run = 0
    for i in range(len(inv) - 1, 0, -1):
        if inv[i][1] < inv[i - 1][1]:
            run += 1
        else:
            break
    f["inv_value_quarters_falling"] = run
    # Investors' share of the value of new loans, a year ago and now.
    f["inv_share_value_now"] = r1(last["inv_value"][1] / last["total_value"][1] * 100)
    f["inv_share_value_peak_q"] = r1(
        dict(s["inv_value"])[peak[0]] / dict(s["total_value"])[peak[0]] * 100
    )
    f["inv_share_value_prev_q"] = r1(prev["inv_value"][1] / prev["total_value"][1] * 100)
    # Investors' part of the quarter's fall in the VALUE of new lending.
    drop_total = prev["total_value"][1] - last["total_value"][1]
    drop_inv = prev["inv_value"][1] - last["inv_value"][1]
    f["inv_part_of_value_fall_pct"] = r1(drop_inv / drop_total * 100)
    f["value_fall_bn"] = r1(drop_total / 1000)
    f["inv_value_fall_bn"] = r1(drop_inv / 1000)
    # The investor value series in the three Westpac housing downturns: start quarter to end quarter.
    d = dict(inv)
    f["inv_value_cycles"] = {}
    for label, a, b in [("2008-09", "2007-12", "2009-03"), ("2017-19", "2017-06", "2019-06"), ("2022-23", "2021-12", "2023-03")]:
        f["inv_value_cycles"][label] = r1((d[b] / d[a] - 1) * 100)
    # Annual series for the chart (value, $bn, September quarter each year, plus every quarter since 2024).
    f["chart_inv_value_bn"] = [[q, r1(v / 1000)] for q, v in inv]
    f["chart_oo_value_bn"] = [[q, r1(v / 1000)] for q, v in s["oo_value"]]
    return f


# ---------------------------------------------------------------- APRA
def apra_figures() -> dict[str, Any]:
    wb = openpyxl.load_workbook(SRC / "apra-madis-sep-2026.xlsx", read_only=True, data_only=True)
    rows = list(wb["Table 2 "].iter_rows(values_only=True))
    hdr = [str(x) if x else "" for x in rows[2]]
    i_oo = hdr.index("Housing: Owner-occupied")
    i_inv = hdr.index("Housing: Investment")
    i_tot = [str(x) if x else "" for x in rows[1]].index("Total residents loans and finance leases")
    by_name = {str(r[0]).strip(): r for r in rows[3:] if r[0]}
    out: dict[str, Any] = {}
    for code, name in APRA_NAMES.items():
        r = by_name.get(name)
        if r is None:
            raise SystemExit(f"APRA row not found: {name}")
        oo, inv, tot = float(r[i_oo]), float(r[i_inv]), float(r[i_tot])
        out[code] = {
            "housing_bn": round((oo + inv) / 1000),
            "housing_share_of_loans_pct": r1((oo + inv) / tot * 100),
            "investor_share_of_housing_pct": r1(inv / (oo + inv) * 100),
        }
    tot_rows = [r for k, r in by_name.items() if k.lower().startswith("total")]
    if tot_rows:
        r = tot_rows[0]
        oo, inv, tot = float(r[i_oo]), float(r[i_inv]), float(r[i_tot])
        out["ALL"] = {
            "housing_bn": round((oo + inv) / 1000),
            "housing_share_of_loans_pct": r1((oo + inv) / tot * 100),
            "investor_share_of_housing_pct": r1(inv / (oo + inv) * 100),
        }
        big4_housing = sum(out[c]["housing_bn"] for c in ("CBA", "WBC", "NAB", "ANZ"))
        out["big4_share_of_all_housing_pct"] = r1(big4_housing / out["ALL"]["housing_bn"] * 100)
    return out


# ---------------------------------------------------------------- prices
def prices() -> dict[str, list[tuple[str, float]]]:
    d = json.load(gzip.open(DATA, "rt", encoding="utf-8"))
    if d["as_of"] != AS_OF:
        raise SystemExit(f"frozen data is {d['as_of']}, expected {AS_OF}")
    return {t: sorted((r[0], float(r[3])) for r in v) for t, v in d["full"].items()}


def close_on_or_before(px: list[tuple[str, float]], day: str) -> tuple[str, float]:
    ds = [x[0] for x in px]
    i = bisect.bisect_right(ds, day) - 1
    return px[i]


def month_end(px: list[tuple[str, float]], ym: str) -> tuple[str, float]:
    days = [x for x in px if x[0].startswith(ym)]
    if not days:
        raise SystemExit(f"no bars in {ym}")
    return days[-1]


def move(px: list[tuple[str, float]], a: str, b: str) -> float:
    return (close_on_or_before(px, b)[1] / close_on_or_before(px, a)[1] - 1) * 100


def price_figures() -> dict[str, Any]:
    px = prices()
    tick = BIG4 + OTHERS + [INDEX]
    f: dict[str, Any] = {"as_of": AS_OF, "cycles": {}}
    for label, a, b in CYCLES:
        start = month_end(px[INDEX], a)[0]
        end = AS_OF if b is None else month_end(px[INDEX], b)[0]
        m = {t.split(".")[0].lstrip("^"): r1(move(px[t], start, end)) for t in tick}
        m["BIG4_AVG"] = r1(sum(move(px[t], start, end) for t in BIG4) / 4)
        f["cycles"][label] = {"start": start, "end": end, **m}

    def window(name: str, a: str, b: str) -> None:
        m = {t.split(".")[0].lstrip("^"): r1(move(px[t], a, b)) for t in tick}
        m["BIG4_AVG"] = r1(sum(move(px[t], a, b) for t in BIG4) / 4)
        f[name] = {"start": close_on_or_before(px[INDEX], a)[0], "end": close_on_or_before(px[INDEX], b)[0], **m}

    window("ytd", "2025-12-31", AS_OF)
    window("since_budget", "2026-05-12", AS_OF)  # budget night was after the close on 12 May
    window("abs_day", "2026-11-10", "2026-11-11")  # ABS released at 11:30am on 11 Nov
    f["closes"] = {t.split(".")[0].lstrip("^"): round(close_on_or_before(px[t], AS_OF)[1], 2) for t in tick}
    return f


def all_figures() -> dict[str, Any]:
    return {"abs": abs_figures(), "apra": apra_figures(), "prices": price_figures()}


if __name__ == "__main__":
    out = all_figures()
    if "--json" in sys.argv:
        print(json.dumps(out))
    else:
        for k, v in out.items():
            print(f"===== {k}")
            for kk, vv in v.items():
                if not str(kk).startswith("chart_"):
                    print(f"{kk}: {vv}")
