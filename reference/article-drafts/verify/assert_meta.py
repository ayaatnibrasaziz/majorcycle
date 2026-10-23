"""Assert every figure in draft 08 (Meta Q3 2026) against its source.

Three kinds of figure:
  * REPORTED — Meta's own numbers, typed once below from its releases, 10-Q and information
    statement, with every DERIVED comparison (vs forecast, vs a year ago) computed here;
  * MEASURED — re-derived from the frozen price file via `meta_figures.figures()`;
  * ACTUAL PRICES — Meta pays a dividend, so our stored series sits slightly below the real
    closes. The dollar levels the article prints are Meta's own (ACTUAL-PRICES.json), and each
    one is checked against our series to within the dividend effect, so a typo in that file
    cannot pass.

Each expected string must appear in the draft's answer box or body (whitespace-normalised).

    python -I reference/article-drafts/verify/assert_meta.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from meta_figures import figures, frame, load  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
SLUG = "meta-q3-2026-results"
DRAFT = Path(__file__).resolve().parents[1] / "08-meta-q3-2026-results.md"
ACTUAL = ROOT / "reference" / "meta-q3-2026-ACTUAL-PRICES.json"

# --- REPORTED, $ millions unless noted -------------------------------------------------
Q3 = {"rev": 64601, "oi": 12988, "ni": 9860, "eps": 3.83, "capex": 34910, "cfo": 32786, "fcf": -2120}
Q3_FC = {"lo": 61000, "hi": 64000}  # Q2 2026 release, CFO outlook
Q3_25 = {"rev": 51242, "rev_24": 40589, "oi": 20535, "ni": 2709, "eps": 1.05, "eps_ex": 7.25,
         "tax_charge": 15930, "capex": 18829 + 545, "cfo": 29999, "fcf": 10625}
CHARGE = {"q3": 9890, "oi_ex": 22880, "eps_ex": 7.40, "ag_total": 18590, "ags": 52}
#: Revenue now and a year earlier, for the growth run (each quarter's own release).
GROWTH = {"Q4'25": (59893, 48385), "Q1'26": (56311, 42314), "Q2'26": (60801, 47516)}
Q2_CAPEX = 31080
Q4_FC = {"lo": 73000, "hi": 76000, "base": 59893, "tax": "15–17%"}
EXP = {"old": "$165–169 billion", "new": "$175–179 billion", "old_lo": 165, "new_lo": 175}
CAPEX_FC = {"old": "$130–145 billion", "new": "$135–145 billion"}
BAL = {"cash": 82450, "notes": 84000, "bond_may": 25000, "buyback_left": 25030, "div": 0.525}
OTHER = {"dap": "3.64 billion", "dap_growth": "3%", "impressions": "10%", "price": "14%",
         "rl_2026": "$18–19 billion", "rl_2027": "about $15 billion", "votes": "56.1%"}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s)


def bn(x_m: float, dp: int = 2) -> str:
    return f"${x_m / 1000:.{dp}f} billion"


def B(x_m: float, dp: int = 2) -> str:
    return f"${x_m / 1000:.{dp}f}B"


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # the misses print a minus sign (U+2212)
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures()
    act = json.loads(ACTUAL.read_text(encoding="utf-8"))
    want: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    # Reported.
    need("revenue", bn(Q3["rev"]))
    need("revenue table", B(Q3["rev"]))
    need("forecast range", f"${Q3_FC['lo'] // 1000}–{Q3_FC['hi'] // 1000} billion")
    need("revenue a year earlier", B(Q3_25["rev"]))
    need("operating income", bn(Q3["oi"]))
    need("operating income a year earlier", B(Q3_25["oi"]))
    need("charge", bn(CHARGE["q3"]))
    need("operating income without the charge", bn(CHARGE["oi_ex"]))
    need("eps", f"${Q3['eps']:.2f}")
    need("eps without the charge", f"${CHARGE['eps_ex']:.2f}")
    need("eps a year earlier", f"${Q3_25['eps']:.2f}")
    need("eps a year earlier without the tax charge", f"${Q3_25['eps_ex']:.2f}")
    need("tax charge", bn(Q3_25["tax_charge"]))
    need("net income", B(Q3["ni"]))
    need("net income a year earlier", bn(Q3_25["ni"]))
    need("capex", bn(Q3["capex"]))
    need("capex Q2", bn(Q2_CAPEX))
    need("capex a year earlier", bn(Q3_25["capex"]))
    need("capex table", B(Q3["capex"]))
    need("capex table a year earlier", B(Q3_25["capex"]))
    need("fcf", f"negative ${abs(Q3['fcf']) / 1000:.2f} billion")
    need("fcf table", f"−${abs(Q3['fcf']) / 1000:.2f}B")
    need("fcf a year earlier", B(Q3_25["fcf"]))
    need("cash from operations", B(Q3["cfo"]))
    need("cash from operations a year earlier", B(Q3_25["cfo"]))
    need("cash", bn(BAL["cash"]))
    need("notes", bn(BAL["notes"]))
    need("May bond", bn(BAL["bond_may"]))
    need("buyback left", bn(BAL["buyback_left"]))
    need("dividend", f"${BAL['div']:.3f} a share")
    need("AG total", f"about {bn(CHARGE['ag_total'])}")
    need("AG count", f"{CHARGE['ags']} attorneys general")
    need("Q4 forecast", f"${Q4_FC['lo'] // 1000}–{Q4_FC['hi'] // 1000} billion")
    need("Q4 tax", Q4_FC["tax"])
    for k in ("old", "new"):
        need(f"expense range {k}", EXP[k])
        need(f"capex range {k}", CAPEX_FC[k])
    for k, v in OTHER.items():
        need(k, v)

    # Derived from reported.
    need("growth", f"up {round(pct(Q3['rev'], Q3_25['rev']))}%")
    need("growth a year earlier (table)", f"| {round(pct(Q3_25['rev'], Q3_25['rev_24']))}% |")
    need("range growth", f"{round(pct(Q3_FC['lo'], Q3_25['rev']))}–{round(pct(Q3_FC['hi'], Q3_25['rev']))}%")
    need("above the top", f"{pct(Q3['rev'], Q3_FC['hi']):.1f}% above the top")
    need("operating income down", f"down {abs(round(pct(Q3['oi'], Q3_25['oi'])))}%")
    need("operating income without the charge, up", f"up {round(pct(CHARGE['oi_ex'], Q3_25['oi']))}%")
    need("margin", f"| {round(Q3['oi'] / Q3['rev'] * 100)}% |")
    need("margin a year earlier", f"| {round(Q3_25['oi'] / Q3_25['rev'] * 100)}% |")
    need("eps rise reported", f"{round(pct(Q3['eps'], Q3_25['eps']))}% rise")
    need("eps underlying", f"about {round(pct(CHARGE['eps_ex'], Q3_25['eps_ex']))}%")
    for q, (now, before) in GROWTH.items():
        need(f"growth {q}", f"{round(pct(now, before))}%")
    need("Q4 implied growth", f"{round(pct(Q4_FC['lo'], Q4_FC['base']))}–{round(pct(Q4_FC['hi'], Q4_FC['base']))}%")
    need("expense increase", f"${EXP['new_lo'] - EXP['old_lo']} billion")

    # Actual prices, each tied back to our series within the dividend effect.
    df = frame(load()["full"]["META"])
    for d, v in act["closes"].items():
        ours = float(df.loc[d, "Close"])
        assert abs(v / ours - 1) < 0.006, f"actual close {d} {v} vs ours {ours:.2f}: more than a dividend apart"
    assert df["Close"].idxmax().strftime("%Y-%m-%d") == act["record_close_date"], "record date differs"
    assert f["high_52w_date"] == act["one_year_high_date"], "one-year high date differs"
    c = act["closes"]
    last = c[f["last_date"]]
    rec = c[act["record_close_date"]]
    hi = act["highs"][act["one_year_high_date"]]
    low = c[act["low_close_in_current_fall_date"]]
    need("close", f"${last:.2f}")
    need("record close", f"${rec:.2f}")
    need("below record", f"{abs(pct(last, rec)):.1f}% below its record close")
    need("one-year high", f"${hi:.2f}")
    need("below one-year high", f"{abs(pct(last, hi)):.1f}% below its highest price")
    ytd = pct(last, c["2025-12-31"])
    need("ytd", f"{abs(ytd):.1f}% {'higher' if ytd >= 0 else 'lower'} than at the start of 2026")
    prev = c[f["reactions"][-1]["release"]]
    need("results-day close", f"Meta closed at ${last:.2f}, down {abs(pct(last, prev)):.1f}% from ${prev:.2f}")
    need("answer box move", f"The shares fell {abs(pct(last, prev)):.1f}% the next day")
    need("S&P that day", f"S&P 500 lost {abs(f['index']['^GSPC']['day_move']):.1f}%")
    need("Nasdaq that day", f"Nasdaq Composite {abs(f['index']['^IXIC']['day_move']):.1f}%")
    words = {2: "second", 3: "third", 4: "fourth", 5: "fifth"}
    need("streak", f"the {words[f['down_streak']]} results day in a row on which Meta's shares fell")
    need("March low", f"${low:.2f}")
    need("March low depth", f"{abs(pct(low, rec)):.1f}% below")
    need("current fall row", f"−{abs(pct(low, rec)):.1f}%")
    assert abs(f["high_52w"] - hi) < 0.01

    # Measured from the frozen series.
    need("S&P below high", f"{abs(f['index']['^GSPC']['below_high']):.1f}% below its record")
    need("releases", f"all {f['rx_n']} regular")
    need("median move", f"{f['rx_median_abs']:.1f}%")
    need("median move since 2022", f"{f['rx_median_abs_since_2022']:.1f}%")
    need("10%+ moves", f"{f['rx_over10']} of the {f['rx_n']}")
    need("worst", f"{abs(f['rx_worst']['move']):.1f}%")
    need("best", f"{f['rx_best']['move']:.1f}%")
    need("falls after", f"fell after {f['rx_down']} of the {f['rx_n']}")
    rx = {r["release"]: r["move"] for r in f["reactions"]}
    need("October 2022", f"{abs(rx['2022-10-26']):.1f}%")
    need("July 2018", f"({rx['2018-07-25']:+.1f}%)".replace("-", "−"))
    for r in f["reactions"][-4:]:
        need(f"reaction {r['release']}", f"({r['move']:+.1f}%)".replace("-", "−"))
    big = f["big_falls"]
    done = [e for e in big if e["recovery_date"]]
    words = {5: "five", 6: "six", 7: "seven", 8: "eight"}  # noqa: F841 (falls; the streak words are above)
    assert not big[-1]["recovery_date"], "the current fall should be the open one"
    need("number of falls", f"30% or more {words[len(big)]} times")
    need("finished falls", f"The first {words[len(done)]} all got back")
    for e in done:
        need(f"fall from {e['peak_date']}", f"−{abs(e['depth_pct']):.1f}%")
    from datetime import date as _d
    months = {e["peak_date"]: (_d.fromisoformat(e["recovery_date"]) - _d.fromisoformat(e["trough_date"])).days / 30.44 for e in done}
    quick = [v for k, v in months.items() if abs([e for e in done if e["peak_date"] == k][0]["depth_pct"]) < 40]
    slow = [v for k, v in months.items() if abs([e for e in done if e["peak_date"] == k][0]["depth_pct"]) >= 40]
    assert len(quick) == 2 and all(1.5 <= v < 2.5 for v in quick), quick   # "about two months"
    need("slow recoveries", f"between {round(min(slow))} and {round(max(slow))} months")
    deep = [abs(e["depth_pct"]) for e in done if abs(e["depth_pct"]) >= 40]
    need("deeper range", f"of {round(min(deep))}% to {round(max(deep))}%")
    need("normal fall", f"about {abs(f['engine']['typical_drawdown']):.1f}%")
    need("engine now", f"it was {abs(f['engine']['current_drawdown_pct']):.1f}% below")

    miss = [(lbl, s) for lbl, s in want if s not in text]

    # The SHIPPED copy (CLAUDE.md 11c: two copies of one set of figures is how they drift). The site
    # body must be exactly what md_to_tsx.py makes of this draft, and the registry answer exactly its
    # answer box, so every figure checked above is the figure a reader sees.
    from md_to_tsx import convert, curly  # noqa: E402
    web = Path(__file__).resolve().parents[3] / "web"
    tsx = (web / "app" / "(public)" / "articles" / "content.tsx").read_text(encoding="utf-8")
    reg = (web / "lib" / "articles.ts").read_text(encoding="utf-8")
    shipped = convert(raw, SLUG)
    if shipped not in tsx:
        miss.append(("site body", f"content.tsx does not hold the conversion of this draft for {SLUG}"))
    box = raw[raw.index("## The answer"):].split(chr(10) + "---", 1)[0].split(chr(10), 1)[1]
    entry = reg[reg.index(f"slug: '{SLUG}'"):]
    site_answer = entry[entry.index("answer:"):].split("'", 2)[1]
    if site_answer != curly(" ".join(x.strip() for x in box.strip().splitlines())):
        miss.append(("site answer", f"the registry answer differs from the draft: {site_answer!r}"))
    print(f"{len(want) - len(miss)} of {len(want)} figures found (as at {f['as_of']})")
    for lbl, s in miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if miss else 0)


if __name__ == "__main__":
    main()
