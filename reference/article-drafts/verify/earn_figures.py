"""Derive the measured figures for the Q3 2026 earnings videos (MSFT GOOGL LLY AMZN INTC SNDK).

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

DATA = ROOT / "reference" / "earn-q3-2026-DATA.json.gz"
RAW = Path.home() / "mc-video-tools" / "earnings-q3" / "edgar" / "releases_raw.json"
P = PRESETS["medium"]
PARAMS = CycleParams(
    pullback_threshold=float(P["pullback_threshold"]),
    profit_threshold=float(P["profit_threshold"]),
    lookback_bars=int(P["lookback_bars"]),
)

PRE_MARKET = {"LLY"}

#: Item 2.02 filings that are not a quarterly results release.
DROP = {
    "GOOGL": {"2023-04-20": "segment recast ahead of the Q1 2023 release"},
    "INTC": {"2021-01-14": "preliminary figures with the CEO change, before the 2021-01-21 release"},
    "LLY": {
        "2017-12-13": "annual guidance", "2018-12-19": "annual guidance", "2019-12-17": "annual guidance",
        "2020-12-15": "annual guidance", "2021-12-15": "annual guidance", "2022-12-13": "annual guidance",
        "2022-04-14": "not a quarterly release", "2025-01-14": "preliminary revenue at a conference",
    },
}

#: The size of fall listed. Owner's rule (23 Oct 2026): the threshold that leaves 5-10 falls.
FALL_THRESHOLD = {"MSFT": -30, "GOOGL": -20, "LLY": -35, "AMZN": -40, "INTC": -40, "SNDK": -20}


def load() -> dict[str, Any]:
    with gzip.open(DATA, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def releases(t: str) -> list[str]:
    raw = json.loads(RAW.read_text())[t]
    days = [r[0][:10] for r in raw]
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
        if t in PRE_MARKET:
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
    for i in ("^GSPC", "^IXIC"):
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
    }


def main() -> None:
    f = figures(sys.argv[1])
    rx = f.pop("reactions")
    big = f.pop("big_falls")
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
