"""Derive every measured figure in draft 10 (NEXTDC, the power poles) from the frozen file.

Uses the site's own engine (`analytics.major_cycle.calculate_cycle_metrics`, the Medium
preset) for "how far it normally falls", and the recovery study's episode rule for the
history of falls. No database, no credentials.

    python -I reference/article-drafts/verify/nxt_figures.py
"""

from __future__ import annotations

import gzip
import json
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

DATA = ROOT / "reference" / "nxt-2026-10-DATA.json.gz"
P = PRESETS["medium"]
PARAMS = CycleParams(
    pullback_threshold=float(P["pullback_threshold"]),
    profit_threshold=float(P["profit_threshold"]),
    lookback_bars=int(P["lookback_bars"]),
)
#: NEXTDC's quoted ordinary shares after the 9 October 2026 issue (Appendix 2A, as shown on
#: Market Index on 24 October 2026). No shares were issued between then and 23 October.
SHARES = 759_626_698
#: The two capital raisings the article compares with (NEXTDC ASX releases).
ENTITLEMENT_PRICE = 12.70  # 20 Apr 2026, 1 for 5.4
CONVERTIBLE_REF = 12.60  # 10 Sep 2026, reference share price
HALT_LAST = "2026-10-16"
CRASH = "2026-10-21"


def load() -> dict[str, Any]:
    with gzip.open(DATA, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def figures() -> dict[str, Any]:
    d = load()
    rows = d["full"]["NXT.AX"]
    close = {r[0]: float(r[3]) for r in rows}
    traded = [r for r in rows if r[4]]  # the two halt days carry no trades
    moves = [(traded[i][0], pct(float(traded[i][3]), float(traded[i - 1][3]))) for i in range(1, len(traded))]
    moves.sort(key=lambda m: m[1])
    df = pd.DataFrame([r[:4] for r in rows], columns=["date", "High", "Low", "Close"])
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").astype(float)
    m = calculate_cycle_metrics(df, PARAMS)
    eps = episodes([r[:4] for r in rows], d["as_of"])
    falls = [e for e in eps if e["depth_pct"] <= -20]
    ath = max(rows, key=lambda r: float(r[3]))
    low_21 = next(float(r[2]) for r in rows if r[0] == CRASH)
    ix = {r[0]: float(r[3]) for r in d["full"]["^IXIC"]}
    return {
        "as_of": d["as_of"],
        "first_trade": traded[0][0],
        "n_days": len(traded),
        "pre": close[HALT_LAST],
        "crash": close[CRASH],
        "crash_move": pct(close[CRASH], close[HALT_LAST]),
        "crash_low": low_21,
        "crash_low_move": pct(low_21, close[HALT_LAST]),
        "d22": close["2026-10-22"],
        "d22_move": pct(close["2026-10-22"], close[CRASH]),
        "d23": close["2026-10-23"],
        "d23_move": pct(close["2026-10-23"], close["2026-10-22"]),
        "cap_pre_m": close[HALT_LAST] * SHARES / 1e6,
        "cap_crash_m": close[CRASH] * SHARES / 1e6,
        "lost_m": (close[HALT_LAST] - close[CRASH]) * SHARES / 1e6,
        "worst": moves[:3],
        "days_down_10": [m_ for m_ in moves if m_[1] <= -10],
        "ath_close": float(ath[3]),
        "ath_date": ath[0],
        "below_ath_crash": pct(close[CRASH], float(ath[3])),
        "below_ath_last": pct(close["2026-10-23"], float(ath[3])),
        "vs_entitlement": pct(close["2026-10-23"], ENTITLEMENT_PRICE),
        "vs_convertible": pct(close["2026-10-23"], CONVERTIBLE_REF),
        "falls": falls,
        "engine_typical": m["typical_drawdown"],
        "engine_current": m["current_drawdown_pct"],
        "nasdaq_22": pct(ix["2026-10-22"], ix["2026-10-21"]),
    }


def main() -> None:
    f = figures()
    for k, v in f.items():
        if k == "falls":
            for e in v:
                print(f"  fall {e['peak_date']} -> {e['trough_date']} {e['depth_pct']:.1f}% back {e['recovery_date']}")
        else:
            print(f"{k}: {v}")


if __name__ == "__main__":
    main()
