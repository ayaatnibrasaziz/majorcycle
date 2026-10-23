"""Derive every measured figure in draft 08 (Meta Q3 2026) from the frozen file.

Uses the site's own engine (`analytics.major_cycle.calculate_cycle_metrics`, the Medium
preset) for "how far it normally falls", and the recovery study's episode rule for the
history of falls. No database, no credentials.

    python -I reference/article-drafts/verify/meta_figures.py
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
from recovery_episodes import episodes  # noqa: E402

DATA = ROOT / "reference" / "meta-q3-2026-DATA.json.gz"
P = PRESETS["medium"]
PARAMS = CycleParams(
    pullback_threshold=float(P["pullback_threshold"]),
    profit_threshold=float(P["profit_threshold"]),
    lookback_bars=int(P["lookback_bars"]),
)

#: Meta's regular quarterly results releases, Q4 2015 to Q2 2026: the filing date of every
#: 8-K carrying Item 2.02 (SEC EDGAR, CIK 1326801). Every one was accepted after 4pm New
#: York time, so the reaction is the NEXT session's close against the release day's close.
#: The Q3 2026 release (2026-10-21) is appended once its next-day close is frozen.
#: The size of fall the article lists (owner, 23 Oct 2026: 30%, so the history holds enough
#: episodes to judge by; 35% gives the same three as 40%, 30% gives six including today's).
FALL_THRESHOLD = -30

RELEASES = [
    "2016-01-27", "2016-04-27", "2016-07-27", "2016-11-02", "2017-02-01", "2017-05-03",
    "2017-07-26", "2017-11-01", "2018-01-31", "2018-04-25", "2018-07-25", "2018-10-30",
    "2019-01-30", "2019-04-24", "2019-07-24", "2019-10-30", "2020-01-29", "2020-04-29",
    "2020-07-30", "2020-10-29", "2021-01-27", "2021-04-28", "2021-07-28", "2021-10-25",
    "2022-02-02", "2022-04-27", "2022-07-27", "2022-10-26", "2023-02-01", "2023-04-26",
    "2023-07-26", "2023-10-25", "2024-02-01", "2024-04-24", "2024-07-31", "2024-10-30",
    "2025-01-29", "2025-04-30", "2025-07-30", "2025-10-29", "2026-01-28", "2026-04-29",
    "2026-07-29", "2026-10-21",
]


def load() -> dict[str, Any]:
    with gzip.open(DATA, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def frame(rows: list[list[Any]]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["date", "High", "Low", "Close"])
    df["date"] = pd.to_datetime(df["date"])
    return df.set_index("date").astype(float)


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def reactions(rows: list[list[Any]]) -> list[dict[str, Any]]:
    close = {r[0]: float(r[3]) for r in rows}
    dates = [r[0] for r in rows]
    out = []
    for d in RELEASES:
        i = dates.index(d)
        out.append({"release": d, "next": dates[i + 1], "move": pct(close[dates[i + 1]], close[d])})
    return out


def figures() -> dict[str, Any]:
    d = load()
    nf = d["full"]["META"]
    df = frame(nf)
    last_date = nf[-1][0]
    last = float(nf[-1][3])
    ath_i = df["Close"].idxmax()
    year = df[df.index > pd.Timestamp(last_date) - pd.DateOffset(years=1)]
    m = calculate_cycle_metrics(df, PARAMS)
    eps = episodes(nf, d["as_of"])
    big = [e for e in eps if e["depth_pct"] <= FALL_THRESHOLD]
    rx = reactions(nf)
    moves = [r["move"] for r in rx]
    streak = 0
    for r in reversed(rx):
        if r["move"] >= 0:
            break
        streak += 1
    idx = {}
    for t in ("^GSPC", "^IXIC"):
        f = frame(d["full"][t])
        idx[t] = {"last": f["Close"].iloc[-1], "below_high": pct(f["Close"].iloc[-1], f["Close"].max()),
                  "day_move": pct(f["Close"].iloc[-1], f["Close"].iloc[-2]),
                  "high_date": f["Close"].idxmax().strftime("%Y-%m-%d")}
    return {
        "as_of": d["as_of"],
        "last_date": last_date,
        "last_close": last,
        "prev_close": float(nf[-2][3]),
        "model_window": PARAMS.lookback_bars,
        "model_high": float(df["High"].iloc[-PARAMS.lookback_bars:].max()),
        "model_high_date": df["High"].iloc[-PARAMS.lookback_bars:].idxmax().strftime("%Y-%m-%d"),
        # The last earlier close at or below today's: "its lowest close since <month year>".
        "prev_lower_close_month": df["Close"].iloc[:-1][df["Close"].iloc[:-1] <= last].index[-1].strftime("%B %Y"),
        "ath_close": float(df["Close"].max()),
        "ath_date": ath_i.strftime("%Y-%m-%d"),
        "below_ath": pct(last, float(df["Close"].max())),
        "high_52w": float(year["High"].max()),
        "high_52w_date": year["High"].idxmax().strftime("%Y-%m-%d"),
        "low_52w": float(year["Low"].min()),
        "low_52w_date": year["Low"].idxmin().strftime("%Y-%m-%d"),
        "close_2025": float(df.loc["2025-12-31", "Close"]),
        "ytd": pct(last, float(df.loc["2025-12-31", "Close"])),
        "engine": {k: m[k] for k in m if isinstance(m[k], (int, float, str))},
        "big_falls": big,
        "reactions": rx,
        "rx_n": len(moves),
        "rx_down": sum(x < 0 for x in moves),
        "rx_median_abs": statistics.median(abs(x) for x in moves),
        "rx_median_abs_since_2022": statistics.median(abs(r["move"]) for r in rx if r["release"] >= "2022-01-01"),
        "rx_over10": sum(abs(x) >= 10 for x in moves),
        "rx_worst": min(rx, key=lambda r: r["move"]),
        "rx_best": max(rx, key=lambda r: r["move"]),
        "down_streak": streak,
        "index": idx,
    }


def main() -> None:
    f = figures()
    rx = f.pop("reactions")
    big = f.pop("big_falls")
    print(json.dumps(f, indent=1, default=str))
    print("\nfalls of 40%+ since the first bar (peak close -> lowest close):")
    for e in big:
        print(f"  {e['peak_date']} {e['peak']:.3f} -> {e['trough_date']} {e['trough']:.3f} "
              f"{e['depth_pct']:.1f}%  recovered {e['recovery_date']}")
    print("\nreactions:")
    for r in rx:
        print(f"  {r['release']} -> {r['next']} {r['move']:+.2f}%")


if __name__ == "__main__":
    main()
