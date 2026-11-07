"""Derive the measured figures for the Q3 2026 earnings videos (MSFT GOOGL LLY AMZN INTC SNDK NOW).

Same rules as `tsla_figures.py`, one ticker at a time, from `earn-q3-2026-DATA.json.gz` only:
the site's engine (Medium preset) for "how far it normally falls", the recovery study's episode
rule for the history of falls, and the reaction to every quarterly results release since 2016.

RELEASES come from SEC EDGAR: every 8-K carrying Item 2.02 (accession numbers saved in
`mc-video-tools/earnings-q3/edgar/releases_raw.json`), less the filings that are not a quarterly
release (listed in DROP with the reason). AFTER-close reporters react on the NEXT session's close
against the release day's; LLY releases before the open, so its reaction is the release day's
close against the previous close.

    python -I reference/article-drafts/verify/earn_figures.py MSFT
"""

from __future__ import annotations

import gzip
import json
import statistics
import sys
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from analytics.major_cycle import CycleParams, calculate_cycle_metrics  # noqa: E402
from analytics.presets import PRESETS  # noqa: E402
import recovery_episodes  # noqa: E402
from recovery_episodes import episodes  # noqa: E402

#: The whole stored history, not the recovery study's 2000 window: "record" must mean the record.
recovery_episodes.WINDOW_START = "1900-01-01"

#: Batch 1 (MSFT, GOOGL, LLY) is frozen at 29 Oct in the default file; batch 2 (INTC, AMZN, SNDK, reaction on 30 Oct)
#: uses its own file so re-freezing it cannot move a published article's figures (11ad). Set EARN_DATA to choose.
DATA = Path(__import__("os").environ.get("EARN_DATA") or ROOT / "reference" / "earn-q3-2026-DATA.json.gz")
RAW = Path.home() / "mc-video-tools" / "earnings-q3" / "edgar" / "releases_raw.json"
P = PRESETS["medium"]
PARAMS = CycleParams(
    pullback_threshold=float(P["pullback_threshold"]),
    profit_threshold=float(P["profit_threshold"]),
    lookback_bars=int(P["lookback_bars"]),
)

PRE_MARKET = {"LLY", "NAB.AX", "WBC.AX", "NVO"}

#: Companies that file no 8-K (ASX-listed): results days from the ASX announcements list, saved in
#: reference/nab-2026-fy/sources/asx-ann-<year>.html (each Appendix 4D/4E, all lodged ~8am, before the open).
RELEASES = {
    "NAB.AX": ["2016-05-05", "2016-10-27", "2017-05-04", "2017-11-02", "2018-05-03", "2018-11-01", "2019-05-02",
               "2019-11-07", "2020-04-27", "2020-11-05", "2021-05-06", "2021-11-09", "2022-05-05", "2022-11-09",
               "2023-05-04", "2023-11-09", "2024-05-02", "2024-11-07", "2025-05-07", "2025-11-06", "2026-05-04",
               "2026-11-05"],
    #: Westpac: reference/wbc-2026-fy/sources/asx-ann-<year>.html, each Interim / Full Year Financial Results
    #: Announcement, all lodged 7:30-7:50am, before the open.
    "WBC.AX": ["2016-05-02", "2016-11-07", "2017-05-08", "2017-11-06", "2018-05-07", "2018-11-05", "2019-05-06",
               "2019-11-04", "2020-05-04", "2020-11-02", "2021-05-03", "2021-11-01", "2022-05-09", "2022-11-07",
               "2023-05-08", "2023-11-06", "2024-05-06", "2024-11-04", "2025-05-05", "2025-11-03", "2026-05-05",
               "2026-11-02"],
    #: Novo Nordisk (ADR): the date each financial report gives itself (nvo-2026-q3/sources/edgar/, every caq*.htm,
    #: "for the period 1 January ... to <period end> <date>"), equal to its 6-K filing date. Announced in Copenhagen
    #: hours, before the US close; Q3 2026 was on CNBC at 1:40am ET, before the US open.
    "NVO": ['2018-05-02', '2018-08-08', '2018-11-01', '2019-02-01', '2019-05-03', '2019-08-09', '2019-11-01', '2020-02-05', '2020-05-06', '2020-08-06', '2020-10-30', '2021-02-03', '2021-05-05', '2021-08-04', '2021-11-03', '2022-02-02', '2022-04-29', '2022-08-03', '2022-11-02', '2023-02-01', '2023-05-04', '2023-08-10', '2023-11-02', '2024-01-31', '2024-05-02', '2024-08-07', '2024-11-06', '2025-02-05', '2025-05-07', '2025-08-06', '2025-11-05', '2026-02-03', '2026-05-06', '2026-08-04', '2026-11-04'],
}

#: Single releases made BEFORE the open by an after-close reporter (reaction = that day's close vs the day before).
#: AMD 2020-10-27: filed 06:34 ET with the Xilinx acquisition announcement.
#: PLTR: from Feb 2021 to Nov 2023 it filed around 07:00 ET (11:00-12:10 UTC), before the open (EDGAR acceptance times).
PRE_MARKET_DAYS = {"AMD": {"2020-10-27"},
                   "PLTR": {"2021-02-16", "2021-05-11", "2021-08-12", "2021-11-09", "2022-02-17", "2022-05-09",
                            "2022-08-08", "2022-11-07", "2023-11-02"}}

#: The benchmark per market (US default).
INDICES = {"NAB.AX": ["^AXJO"], "WBC.AX": ["^AXJO"]}

#: Item 2.02 filings that are not a quarterly results release.
DROP = {
    "GOOGL": {"2023-04-20": "segment recast ahead of the Q1 2023 release"},
    "INTC": {"2021-01-14": "preliminary figures with the CEO change, before the 2021-01-21 release"},
    "NOW": {"2016-04-13": "litigation settlement charges, not a quarterly release"},
    "AMD": {"2018-02-27": "ASC 606 recast of earlier results, not a quarterly release",
            "2022-10-06": "preliminary third-quarter revenue, before the 2022-11-01 release"},
    "AAPL": {"2019-01-02": "letter cutting the December-quarter revenue forecast, before the 2019-01-29 release"},
    "NAB.AX": {"2020-04-27": "trading halt all day (capital raising announced with the results); no reaction to measure"},
    "LLY": {
        "2017-12-13": "annual guidance", "2018-12-19": "annual guidance", "2019-12-17": "annual guidance",
        "2020-12-15": "annual guidance", "2021-12-15": "annual guidance", "2022-12-13": "annual guidance",
        "2022-04-14": "not a quarterly release", "2025-01-14": "preliminary revenue at a conference",
    },
}

#: The size of fall listed. Owner's rule (23 Oct 2026): the threshold that leaves 5-10 falls.
FALL_THRESHOLD = {"NVO": -40, "ARM": -20, "ALAB": -20, "PLTR": -20, "WBC.AX": -25, "AAPL": -40, "AMD": -50, "NAB.AX": -30, "MSFT": -30, "GOOGL": -20, "LLY": -35, "AMZN": -40, "INTC": -40, "SNDK": -20, "NOW": -40}


def load() -> dict[str, Any]:
    with gzip.open(DATA, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def releases(t: str) -> list[str]:
    if t in RELEASES:
        return [d for d in RELEASES[t] if d not in DROP.get(t, {})]
    raw = json.loads(RAW.read_text())[t]
    # dict.fromkeys: one release per day. ServiceNow's preliminary Q3 2019 figures (filed 01:41 UTC on 23 Oct, the
    # evening of the 22nd in New York, with the CEO change) share a UTC date with the full release that afternoon.
    days = list(dict.fromkeys(r[0][:10] for r in raw))
    return [d for d in days if d not in DROP.get(t, {})]


def frame(rows: list[list[Any]]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["date", "High", "Low", "Close"])
    df["date"] = pd.to_datetime(df["date"])
    return df.set_index("date").astype(float)


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def reactions(t: str, rows: list[list[Any]]) -> list[dict[str, Any]]:
    close = {r[0]: float(r[3]) for r in rows}
    dates = [r[0] for r in rows]
    out = []
    for d in releases(t):
        if d not in close:
            continue  # before the first stored bar (SNDK) or a non-trading day
        i = dates.index(d)
        if t in PRE_MARKET or d in PRE_MARKET_DAYS.get(t, set()):
            before, after = dates[i - 1], d
        else:
            if i + 1 >= len(dates):
                continue
            before, after = d, dates[i + 1]
        out.append({"release": d, "from": before, "to": after, "move": pct(close[after], close[before])})
    return out


def figures(t: str) -> dict[str, Any]:
    d = load()
    nf = d["full"][t]
    df = frame(nf)
    last_date = nf[-1][0]
    last = float(nf[-1][3])
    year = df[df.index > pd.Timestamp(last_date) - pd.DateOffset(years=1)]
    m = calculate_cycle_metrics(df, PARAMS)
    eps = episodes(nf, d["as_of"])
    big = [e for e in eps if e["depth_pct"] <= FALL_THRESHOLD[t]]
    rx = reactions(t, nf)
    moves = [r["move"] for r in rx]
    idx = {}
    for i in INDICES.get(t, ["^GSPC", "^IXIC"]):
        f = frame(d["full"][i])
        idx[i] = {"last": f["Close"].iloc[-1], "below_high": pct(f["Close"].iloc[-1], f["Close"].max())}
    return {
        "ticker": t,
        "as_of": d["as_of"],
        "first_bar": nf[0][0],
        "last_close": last,
        "ath_close": float(df["Close"].max()),
        "ath_date": df["Close"].idxmax().strftime("%Y-%m-%d"),
        "below_ath": pct(last, float(df["Close"].max())),
        "high_52w": float(year["High"].max()),
        "low_52w": float(year["Low"].min()),
        "ytd": pct(last, float(df.loc[:"2025-12-31", "Close"].iloc[-1])),
        "engine": {k: m[k] for k in m if isinstance(m[k], (int, float, str))},
        "fall_threshold": FALL_THRESHOLD[t],
        "big_falls": big,
        "reactions": rx,
        "rx_n": len(moves),
        "rx_first": rx[0]["release"] if rx else None,
        "rx_up": sum(x > 0 for x in moves),
        "rx_down": sum(x < 0 for x in moves),
        "rx_median_abs": statistics.median(abs(x) for x in moves) if moves else None,
        "rx_over5": sum(abs(x) >= 5 for x in moves),
        "rx_over10": sum(abs(x) >= 10 for x in moves),
        "rx_worst": min(rx, key=lambda r: r["move"]) if rx else None,
        "rx_best": max(rx, key=lambda r: r["move"]) if rx else None,
        "index": idx,
        "full_dates": [r[0] for r in nf],
        "full_closes": [float(r[3]) for r in nf],
    }


def main() -> None:
    f = figures(sys.argv[1])
    rx = f.pop("reactions")
    big = f.pop("big_falls")
    f.pop("full_dates")
    f.pop("full_closes")
    print(json.dumps(f, indent=1, default=str))
    print(f"\nfalls of {f['fall_threshold']}% or more, whole history (peak close -> lowest close):")
    for e in big:
        print(f"  {e['peak_date']} {e['peak']:.2f} -> {e['trough_date']} {e['trough']:.2f} "
              f"{e['depth_pct']:.1f}%  recovered {e['recovery_date']}")
    print("\nreactions:")
    for r in rx:
        print(f"  {r['release']} {r['from']}->{r['to']} {r['move']:+.2f}%")


if __name__ == "__main__":
    main()
