"""Derive every measured figure in draft 11 (the RBA's rate rises and the big four banks).

Reads only the frozen file. A decision is announced at 2:30pm Sydney while the ASX is open, so
its day is measured from the previous session's close to the decision day's close. The dates
are the RBA's announcement dates: one day before the "effective" date in its cash-rate table.

    python -I reference/article-drafts/verify/rba_figures.py
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path
from statistics import mean, median
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "reference" / "rba-2026-10-DATA.json.gz"
BANKS = ["CBA.AX", "WBC.AX", "NAB.AX", "ANZ.AX"]
INDEX = "^AXJO"

#: Announcement date -> (change in points, new cash rate). RBA cash-rate table.
RISES: dict[str, tuple[float, float]] = {
    "2022-05-03": (0.25, 0.35),
    "2022-06-07": (0.50, 0.85),
    "2022-07-05": (0.50, 1.35),
    "2022-08-02": (0.50, 1.85),
    "2022-09-06": (0.50, 2.35),
    "2022-10-04": (0.25, 2.60),
    "2022-11-01": (0.25, 2.85),
    "2022-12-06": (0.25, 3.10),
    "2023-02-07": (0.25, 3.35),
    "2023-03-07": (0.25, 3.60),
    "2023-05-02": (0.25, 3.85),
    "2023-06-06": (0.25, 4.10),
    "2023-11-07": (0.25, 4.35),
    "2026-02-03": (0.25, 3.85),
    "2026-03-17": (0.25, 4.10),
    "2026-05-05": (0.25, 4.35),
    "2026-09-29": (0.25, 4.60),
}
#: The 2026 meetings that left the rate at 4.35%.
HOLDS_2026 = ["2026-06-16", "2026-08-11"]
YEAR_START = "2025-12-31"
#: Tue 8 Sep 2026: the day Westpac's economists joined the other three majors in forecasting
#: a rise (Motley Fool Australia, 9 Sep 2026). The rise came on 29 Sep.
FORECAST_DAY = "2026-09-08"
#: Results days in 2026 (each bank's own release; NAB's ASX summary is dated 4 May 2026).
RESULTS_2026 = {
    "ANZ.AX": ["2026-05-01"],
    "NAB.AX": ["2026-05-04"],
    "WBC.AX": ["2026-05-05", "2026-08-10"],
    "CBA.AX": ["2026-08-12"],
}
#: Ex-dividend dates 2022-2026 (NAB: nab.com.au payment history; the others: InvestSMART).
#: Our stored prices are dividend-adjusted, so a one-day move equals the traded move on every
#: day except an ex-dividend day. `figures()` refuses to report a day that is one.
EX_DIVIDEND = {
    "ANZ.AX": ["2022-05-09", "2022-11-07", "2023-05-15", "2023-11-16", "2024-05-13", "2024-11-13",
               "2025-05-13", "2025-11-13", "2026-05-11"],
    "CBA.AX": ["2022-02-16", "2022-08-17", "2023-02-22", "2023-08-16", "2024-02-21", "2024-08-21",
               "2025-02-19", "2025-08-20", "2026-02-18", "2026-08-19"],
    "NAB.AX": ["2022-05-11", "2022-11-15", "2023-05-10", "2023-11-14", "2024-05-07", "2024-11-12",
               "2025-05-12", "2025-11-11", "2026-05-07"],
    "WBC.AX": ["2022-05-19", "2022-11-17", "2023-05-11", "2023-11-09", "2024-05-09", "2024-11-07",
               "2025-05-08", "2025-11-06", "2026-05-08"],
}


#: Dividends paid in 2026 (ex-date, A$ per share; InvestSMART and nab.com.au). Our stored prices
#: fold each one into every earlier price, so the plain share-price change is rebuilt from them.
#: Check: CBA's rebuilt 31 Dec 2025 close is $160.57, the close Motley Fool Australia reported.
DIVIDENDS_2026 = {
    "ANZ.AX": [("2026-05-11", 0.83)],
    "CBA.AX": [("2026-02-18", 2.35), ("2026-08-19", 2.70)],
    "NAB.AX": [("2026-05-07", 0.85)],
    "WBC.AX": [("2026-05-08", 0.77)],
}


def load() -> dict[str, Any]:
    with gzip.open(DATA, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def series(d: dict[str, Any], t: str) -> tuple[list[str], dict[str, float]]:
    rows = d["full"][t]
    return [r[0] for r in rows], {r[0]: float(r[3]) for r in rows}


def window(dates: list[str], close: dict[str, float], day: str, n: int) -> float:
    """Move from the close before `day` to the close n sessions later (n=0 is the day itself)."""
    i = dates.index(day)
    return pct(close[dates[i + n]], close[dates[i - 1]])


def on_or_before(dates: list[str], day: str) -> str:
    return max(x for x in dates if x <= day)


def actual_close(dates: list[str], close: dict[str, float], t: str, day: str) -> float:
    """The traded close on `day`, undoing the dividend adjustment for 2026 ex-dates after it."""
    later = 1.0
    for ex, amount in sorted(DIVIDENDS_2026.get(t, []), reverse=True):
        if ex <= day:
            break
        before = close[dates[dates.index(ex) - 1]] / later + amount
        later *= 1 - amount / before
    return close[day] / later


def figures() -> dict[str, Any]:
    d = load()
    s = {t: series(d, t) for t in BANKS + [INDEX]}
    for day in list(RISES) + HOLDS_2026:
        missing = [t for t, (ds, _) in s.items() if day not in ds]
        if missing:
            raise SystemExit(f"{day} is not a trading day for {missing}")
    reported = list(RISES) + HOLDS_2026 + [FORECAST_DAY] + [x for v in RESULTS_2026.values() for x in v]
    clash = [(t, x) for t, xs in EX_DIVIDEND.items() for x in xs if x in reported]
    if clash:
        raise SystemExit(f"a reported day is an ex-dividend day: {clash}")
    rows = []
    for day, (chg, rate) in RISES.items():
        banks = {t: window(*s[t], day, 0) for t in BANKS}
        avg = mean(banks.values())
        ix = window(*s[INDEX], day, 0)
        rows.append({"day": day, "chg": chg, "rate": rate, "banks": banks, "avg": avg, "index": ix,
                     "vs_index": avg - ix})
    holds = [{"day": h, "avg": mean(window(*s[t], h, 0) for t in BANKS), "index": window(*s[INDEX], h, 0)}
             for h in HOLDS_2026]
    forecast = {t: window(*s[t], FORECAST_DAY, 0) for t in BANKS + [INDEX]}
    results = {(t, x): (window(*s[t], x, 0), window(*s[INDEX], x, 0)) for t, xs in RESULTS_2026.items() for x in xs}
    last = d["as_of"]
    start = {t: on_or_before(s[t][0], YEAR_START) for t in BANKS + [INDEX]}
    ytd_total = {t: pct(s[t][1][last], s[t][1][start[t]]) for t in BANKS}
    ytd = {t: pct(actual_close(*s[t], t, last), actual_close(*s[t], t, start[t])) for t in BANKS + [INDEX]}
    year_start_close = {t: actual_close(*s[t], t, start[t]) for t in BANKS}
    avgs = [r["avg"] for r in rows]
    return {
        "as_of": last,
        "rows": rows,
        "holds": holds,
        "n": len(rows),
        "n_up": sum(a > 0 for a in avgs),
        "n_beat_index": sum(r["vs_index"] > 0 for r in rows),
        "avg_day": mean(avgs),
        "median_day": median(avgs),
        "best": max(rows, key=lambda r: r["avg"]),
        "worst": min(rows, key=lambda r: r["avg"]),
        "ytd": ytd,
        "ytd_total": ytd_total,
        "year_start_close": year_start_close,
        "last_close": {t: s[t][1][last] for t in BANKS},
        "forecast": forecast,
        "forecast_avg": mean(forecast[t] for t in BANKS),
        "results": results,
    }


def main() -> None:
    f = figures()
    print("as_of", f["as_of"])
    for r in f["rows"]:
        b = " ".join(f"{t[:3]} {v:+.2f}" for t, v in r["banks"].items())
        print(f"{r['day']} +{r['chg']:.2f}->{r['rate']:.2f} | {b} | avg {r['avg']:+.2f} ix {r['index']:+.2f}")
    for h in f["holds"]:
        print("hold", h["day"], f"avg {h['avg']:+.2f} ix {h['index']:+.2f}")
    for k in ("n", "n_up", "n_beat_index", "avg_day", "median_day"):
        print(k, f[k])
    print("best", f["best"]["day"], round(f["best"]["avg"], 2), "worst", f["worst"]["day"], round(f["worst"]["avg"], 2))
    print("ytd price", {k: round(v, 1) for k, v in f["ytd"].items()})
    print("ytd incl dividends", {k: round(v, 1) for k, v in f["ytd_total"].items()})
    print("year-start closes", {k: round(v, 2) for k, v in f["year_start_close"].items()})
    print("forecast day", {k: round(v, 2) for k, v in f["forecast"].items()}, "avg", round(f["forecast_avg"], 2))
    for (t, x), (b, ix) in f["results"].items():
        print("results", t, x, round(b, 2), "ix", round(ix, 2))


if __name__ == "__main__":
    main()
