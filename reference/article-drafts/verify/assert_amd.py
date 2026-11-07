"""Assert every figure and quote in draft 20 (AMD, third quarter of 2026) against its source.

Same method as assert_now.py / assert_nab.py: SOURCE phrases in the saved release, earlier releases and call
transcript; DERIVED comparisons recomputed; MEASURED share-price history from `earn_figures.figures()` (frozen data)
and closes from the saved Nasdaq history; every number in the body must be one this file checks; every quotation
word for word in a saved source.

    python -I reference/article-drafts/verify/assert_amd.py
"""

from __future__ import annotations

import json
import os
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-amd-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "20-amd-q3-2026-results.md"
SRC = ROOT / "amd-2026-q3" / "sources"
REL, AUG, CALL = "AMD-ex99_1-20261103.txt", "AMD-ex99_1-20260804.txt", "AMD-Q3-2026-transcript-fool.txt"
GOT = "gotrade-20261102.txt"

Q = {"rev": 13377, "oi": 2832, "ni": 2428, "fcf": 554, "fcf_q2": 1558, "warrant": 1097, "inv": 11463, "debt": 7079}
Y = {"rev": 9246, "oi": 1270, "ni": 1243, "fcf": 1530, "inv_q2": 8468, "debt_q2": 3226}
SOURCES = {
    REL: ["AMD announced an agreement to acquire World Labs", "AMD announced an agreement to acquire Taalas",
          "Revenue ($M) $13,377 $9,246 Up 45%", "Gross margin 54% 52% Up 2 ppts",
          "Operating income ($M) $2,832 $1,270 Up 123%", "Net income ($M) $2,428 $1,243 Up 95%",
          "Diluted earnings per share $1.46 $0.75 Up 95%", "Diluted earnings per share $2.09 $1.20 Up 74%",
          "Gross margin 56% 54% Up 2 ppts", "Operating margin 29% 24% Up 5 ppts",
          "Data Center segment revenue was a record $8.5 billion, up 97% year-over-year",
          "driven by strong demand for AMD EPYC™ processors and the launch of AMD Instinct™ MI450 Series GPUs",
          "Client business revenue was $2.9 billion, up 7% year-over-year",
          "Gaming business revenue was $773 million, down 40% year-over-year, due to lower semi-custom and graphics revenue",
          "Embedded segment revenue was $1.1 billion, up 29% year-over-year",
          "For the fourth quarter of 2026, AMD expects revenue to be approximately $17 billion, plus or minus 3%",
          "year-over-year growth of approximately 66% and a sequential increase of approximately 27%",
          "Non-GAAP gross margin is expected to be approximately 55%",
          "Free cash flow $ 554 $ 1,558 $ 1,530", "Total debt $ 7,079 $ 3,226 $ 3,220",
          "Change in fair value of warrant liability (3) 1,097", "Inventories 11,463 7,920",
          "Change in fair value of warrant liability relating to the quarterly remeasurement of warrants issued to certain customers"],
    AUG: ["For the third quarter of 2026, AMD expects revenue to be approximately $13 billion, plus or minus $300 million",
          "Inventories 8,468 7,920"],
    CALL: ["In server, both cloud and enterprise sales more than doubled year-over-year",
           "revenue to grow more than 80% in 2027", "more than twice the long-term financial model",
           "more than 80% of our total revenue in 2027", "We now expect server revenue to double year-over-year in 2027",
           "PC sell-through slowed late in the quarter as higher memory and component costs weighed on demand",
           "In 2027, we are planning for PC market unit shipments to decline by a double-digit percentage",
           "approximately $3 billion sequentially to $11.5 billion to fulfill our strong data center demand",
           "including $4.75 billion senior notes offering we completed in August",
           "quarterly noncash fair value adjustments are expected to increase",
           "data center segment of approximately 50% growth, a decline in our client and the gaming segment of greater than 20%",
           "semi-custom console sales", "we have secured more supply to support that growth",
           "We expect both acquisitions to close by the end of the year", "We announced 2 acquisitions in the quarter"],
    GOT: ["closed at $504.80 on Friday, October 30, 2026, down 10.88%", "after Intel (INTC) forecast lower fourth-quarter revenue"],
}


def norm(s: str) -> str:
    s = re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"')
    return s.replace("‑", "-")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("AMD")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))
    # Who said it (6 Nov): each attributed call quote must sit in that speaker's own turn.
    SPEAKER = {"In server, both cloud and enterprise sales more than doubled": "Lisa Su",
               "revenue to grow more than 80% in 2027": "Lisa Su", "more than twice the long-term financial model": "Lisa Su",
               "more than 80% of our total revenue in 2027": "Lisa Su", "secured more supply to support that growth": "Lisa Su",
               "PC sell-through slowed late in the quarter as higher memory and component costs weighed on demand": "Lisa Su",
               "approximately $3 billion sequentially to $11.5 billion to fulfill our strong data center demand": "Jean Hu",
               "quarterly noncash fair value adjustments are expected to increase": "Jean Hu"}
    turns = re.split(r"\n\s*([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+)?): ", (SRC / CALL).read_text(encoding="utf-8"))
    for q, who in SPEAKER.items():
        said = {turns[i - 1] for i in range(2, len(turns), 2) if norm(q) in norm(turns[i])}
        if said != {who}:
            bad.append((CALL, f"{q!r} not said by {who} alone (said by {sorted(said)})"))
    need("su server", "Chief executive Lisa Su said both cloud and enterprise server sales more than doubled")
    need("su 2027", 'On the call, Su said AMD now expects "revenue to grow more than 80% in 2027"')
    need("su pc", 'She also said "PC sell-through slowed')
    need("hu inv", 'Finance chief Jean Hu said inventory rose "approximately $3 billion')
    need("hu warr", 'Hu said these "quarterly')

    assert round(pct(Q["rev"], Y["rev"])) == 45 and round(pct(Q["oi"], Y["oi"])) == 123 and round(pct(Q["ni"], Y["ni"])) == 95
    assert round(pct(Q["fcf"], Y["fcf"])) == -64 and 13000 + 300 < Q["rev"]
    need("answer", "AMD's revenue rose 45% to a record $13.4 billion in the third quarter of 2026")
    need("answer 80", "it expects revenue to grow more than 80% in 2027")
    need("short rev", "a record $13,377 million, up 45% from $9,246 million a year earlier")
    need("short dc", "a record $8.5 billion, up 97%")
    need("short ni", "net income of $2,428 million, up 95%, after a $1,097 million charge")
    need("short fc", "revenue of about $17 billion in the fourth quarter, up about 66%, and more than 80% growth in")
    need("short fcf", "free cash flow of $554 million, down from $1,530 million a year earlier, as inventory rose by about")
    need("short inv", "$3 billion in the quarter")
    for row in ["| Revenue | $13,377M | $9,246M | +45% |", "| Gross margin | 54% | 52% | +2 points |",
                "| Operating income | $2,832M | $1,270M | +123% |", "| Net income | $2,428M | $1,243M | +95% |",
                "| Earnings per share, reported | $1.46 | $0.75 | +95% |", "| Earnings per share, non-GAAP | $2.09 | $1.20 | +74% |",
                "| Free cash flow (AMD's measure) | $554M | $1,530M | −64% |",
                "| Data Center | $8.5B | +97% |", "| Client (PC processors) | $2.9B | +7% |", "| Gaming | $773M | −40% |",
                "| Embedded | $1.1B | +29% |", "| September 2026 | $12.7B to $13.3B | $13.4B |",
                "| December 2026 | $16.5B to $17.5B | |", f"| Inventory | $11.5B | ${Y['inv_q2'] / 1000:.1f}B |",
                f"| Total debt | ${Q['debt'] / 1000:.1f}B | ${Y['debt_q2'] / 1000:.1f}B |",
                "| Free cash flow, three months | $554M | $1,558M |"]:
        need(row, row)
    assert round(17000 * 0.97) == 16490 and round(17000 * 1.03) == 17510
    need("ng", "its gross margin was 56% and its operating margin 29%")
    need("q/q", "The new forecast is about 27% more revenue")
    need("q4 seg", "grow about 50% on a year earlier in the fourth quarter, and its PC and gaming sales to fall by more than 20%")
    need("q4 gm", "It expects a gross margin of about 55% on its own non-GAAP measure, against 56% in the third quarter")
    need("bonds", "AMD's debt includes $4.75 billion of bonds it sold in August")
    need("next fc", "Whether fourth-quarter revenue reaches about $17 billion")
    need("next 80", "Whether growth of more than 80% shows up")

    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2025", "2026", "2027", "2016", "2020", "1980", "3", "4", "26", "450", "500", "2"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8")) for fn in SOURCES)
    for q in re.findall(r'"([^"]+)"', text):
        if len(q) >= 8 and norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values())} source phrases, {len(bad)} failed (as at {f['as_of']})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


def measured(f: dict, need) -> None:  # noqa: ANN001
    MON = "January February March April May June July August September October November December".split()
    my = lambda d: f"{MON[int(d[5:7]) - 1]} {d[:4]}"  # noqa: E731
    rows = json.loads(sorted(SRC.glob("AMD-hist10y-*.json"))[-1].read_text(encoding="utf-8"))["data"]["tradesTable"]["rows"]
    h = {r["date"]: float(r["close"][1:].replace(",", "")) for r in rows}
    hi = {r["date"]: float(r["high"][1:].replace(",", "")) for r in rows}
    c3, c4 = h["11/03/2026"], h["11/04/2026"]
    d, c = f["full_dates"], dict(zip(f["full_dates"], f["full_closes"]))
    assert f["as_of"] == "2026-11-04" and abs(c["2026-11-04"] - c4) < 0.006 and abs(c["2026-11-03"] - c3) < 0.006
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    mv = pct(c4, c3)
    assert this["release"] == "2026-11-03" and abs(this["move"] - mv) < 0.01
    need("answer move", f"Its shares rose just {mv:.1f}% the next day")
    need("short move", f"up {mv:.1f}% the next day, to ${c4:,.2f}")
    need("3 close", f"AMD closed at ${c3:,.2f} on 3 November")
    need("4 close", f"the shares were at ${c4:,.2f}, up {mv:.1f}%")
    need("high", f"as high as ${hi['11/04/2026']:,.2f}, up {pct(hi['11/04/2026'], c3):.1f}%")
    c28, c2, c29, c30 = h["10/28/2026"], h["11/02/2026"], h["10/29/2026"], h["10/30/2026"]
    assert d.index("2026-11-02") - d.index("2026-10-28") == 3
    need("pre", f"In the three sessions before the results, the shares fell {abs(pct(c2, c28)):.1f}%, from ${c28:,.2f} on 28 October to ${c2:,.2f} on")
    need("pre answer", f"after a {abs(pct(c2, c28)):.1f}% fall in the three sessions before")
    need("30 oct", f"including a {abs(pct(c30, c29)):.1f}% fall on 30 October")
    assert f["ath_date"] == "2026-10-06" and abs(f["ath_close"] - h["10/06/2026"]) < 0.006
    need("record", f"they were {abs(f['below_ath']):.1f}% below their record close of ${f['ath_close']:,.2f} on 6 October 2026")
    need("ytd", f"up {f['ytd']:.0f}% since the end of 2025")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 43 and before[0]["release"] == "2016-01-19" and before[-1]["release"] == "2026-08-04"
    assert [r["release"] for r in before if r["from"] != r["release"]] == ["2020-10-27"]  # the one pre-market release
    need("rx n", f"all {n} regular results releases before this one, from January 2016 to August 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(x) for x in m):.1f}%**")
    need("rx 5/10", f"{sum(abs(x) >= 5 for x in m)} of the {n} moved by 5% or more, and {sum(abs(x) >= 10 for x in m)} by 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in {my(w['release'])}")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in {my(b['release'])}")
    need("rx updown", f"The shares rose after {sum(x > 0 for x in m)} of the {n} and fell after {sum(x < 0 for x in m)}")
    assert sum(abs(x) < abs(mv) for x in m) == 2
    need("quiet", f"Only two of the {n} moved less than this one")
    falls = f["big_falls"]
    assert len(falls) == 6 and f["fall_threshold"] == -50 and f["first_bar"].startswith("1980")
    need("falls n", "AMD has fallen 50% or more six times since 1980")
    for e in falls:
        back = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {back} |")
    from datetime import date
    yrs = lambda a, z: (date.fromisoformat(z) - date.fromisoformat(a)).days / 365.25  # noqa: E731
    assert all(e["recovery_date"] for e in falls)
    assert 19 < max(yrs(e["peak_date"], e["recovery_date"]) for e in falls) < 20
    assert 6 < max(yrs(e["trough_date"], e["recovery_date"]) for e in falls) < 7
    need("falls back", "The longest took more than 19 years from the record; measured from the low, the longest took more than six years")


if __name__ == "__main__":
    main()
