"""Assert every figure and quote in draft 25 (Astera Labs, third quarter 2026) against its source.

Same method as assert_pltr.py: SOURCE phrases in the saved letter and coverage; DERIVED comparisons recomputed;
MEASURED share-price history from earn_figures.figures() (frozen data) and checked against Nasdaq's saved history
to the cent (Astera pays no dividend); every number in the body must be one this file checks; every quotation must
appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_arm.py
"""

from __future__ import annotations

import gzip
import json
import os
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-alab-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "25-astera-labs-q3-2026-results.md"
SRC = ROOT / "alab-2026-q3" / "sources"
REL, INV = "ALAB-ex99_1-20261103.txt", "investing-transcript-20261103.txt"
SOURCES = {
    REL: ["Record quarterly revenue of $584.9 million, up 49% QoQ and up 154% year-over-year",
          "Scorpio™ fabric switches became the company's largest product family",
          "GAAP gross margin of 72.3%", "GAAP operating income of $179.1 million", "GAAP operating margin of 30.6%",
          "GAAP net income of $182.9 million", "GAAP diluted net income per share of $0.99",
          "Non-GAAP operating income of $261.6 million", "Non-GAAP operating margin of 44.7%",
          "Non-GAAP diluted net income per share of $1.32", "Revenue within a range of $730 million to $750 million",
          "GAAP gross margin of approximately 72%", "GAAP diluted net income per share of approximately $1.13 to $1.17",
          "with broad-based growth led by Scorpio, which ramped to high-volume production and became our largest product family by revenue",
          "said Jitendra Mohan, Astera Labs’ Chief Executive Officer"],
    INV: ["beating Wall Street forecasts of $1.19 and $550.8 million, respectively",
          # owner 7 Nov, "more juice": products and customers, cash and the forecast, the executives in their words
          "Scorpio represented over $1 billion in annualized revenues", "In Q3, X-Series shipped to two customers across multiple platforms",
          "The P-Series similarly broadened its footprint across multiple platforms, including two U.S. hyperscalers in Q3",
          "Aries growth was led by strong PCIe Gen 6 adoption",
          "Taurus 800G solutions are qualified and shipping in volume to our lead customer and are currently sampling across several additional customers",
          "Leo momentum continues with qualifications completed across several customers, including two hyperscalers, and we expect to ramp volume shipments in mid-2027",
          "Revenue also diversified across a broader base of customers and platforms during the quarter",
          "for the third quarter was 72.4%, above our guidance of 72%", "Non-GAAP operating expenses for the third quarter were $162 million, up 19% sequentially, reflecting continued R&D investment",
          "We ended the quarter with $1.38 billion in cash equivalents, and marketable securities, an increase of $125.3 million from Q2",
          "record cash from operations of $179.2 million", "We expect non-GAAP operating margin to be approximately 45%",
          "we expect non-GAAP fully diluted earnings per share to be between $1.62 and $1.66",
          "Analysts also pressed on whether Scorpio X could plateau before newer protocols such as UALink take over",
          "Executives said Scorpio X remains on track to contribute at scale, while the company is expanding into new platforms and customers",
          "This is an important milestone in our journey to be a critical rack-scale AI infrastructure solutions provider",
          "Our design-in activities picked up significantly in Q3 at both new and existing customers"],
    # owner 7 Nov: lawsuits and other risks the company itself reports
    "ALAB-10Q-20260930.txt": [
        'Customer A 53 % 23 % 40 % 21 % Customer B 14 % 24 % 18 % 14 % Customer C 10 % 10 %',
        "Certain of the customers listed above are manufacturing partners that purchase the Company's products on behalf of the Company's end customers",
        'We are not currently a party to any material pending legal proceedings',
    ],
}
# The income statement's three columns (this quarter, the quarter before, a year earlier), for the table
SOURCES[REL] = SOURCES[REL] + ["Revenue $ 584,899 $ 392,400 $ 230,575", "Gross profit 422,752 287,567 175,812",
                               "Operating income 179,056 89,248 55,406", "Net income $ 182,944 $ 153,088 $ 91,114",
                               "Diluted $ 0.99 $ 0.83 $ 0.50"]

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("ALAB")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))
    assert round((740 / 584.9 - 1) * 100) == 27
    need("answer", "Astera Labs' revenue rose 154% to a record $584.9 million in the third quarter of 2026, above analysts' forecasts, and it forecast $730 million to $750 million for the next quarter")
    need("short rev", "$584.9 million, a record, up 154% on a year earlier and up 49% on the quarter before")
    need("short ni", "net income of $182.9 million, and earnings per share of $0.99")
    need("short adj", "earnings per share were $1.32")
    need("short fc", "revenue of $730 million to $750 million for the three months to December")
    # owner 7 Nov: the same table shape as the other articles; figures from the release's income statement
    R = dict(rev=(584899, 392400, 230575), gp=(422752, 287567, 175812), op=(179056, 89248, 55406), ni=(182944, 153088, 91114))
    assert (round(pct(R["rev"][0], R["rev"][2])), round(pct(R["op"][0], R["op"][2])), round(pct(R["ni"][0], R["ni"][2])),
            round(pct(0.99, 0.50)), round(pct(R["rev"][0], R["rev"][1]))) == (154, 223, 101, 98, 49)
    gm = [f"{R['gp'][k] / R['rev'][k] * 100:.1f}%" for k in (0, 2)]
    om = [f"{R['op'][k] / R['rev'][k] * 100:.1f}%" for k in (0, 2)]
    assert (gm, om) == (["72.3%", "76.2%"], ["30.6%", "24.0%"]), (gm, om)
    need("vs q2", "Against the three months to June, revenue rose 49%, from $392.4 million")
    need("margins", f"Its gross margin was {gm[0]}, against {gm[1]} a year earlier, and its operating margin {om[0]}, against {om[1]}")
    for row in ("| Revenue | $584.9M | $230.6M | +154% |", "| Operating income | $179.1M | $55.4M | +223% |",
                "| Net income | $182.9M | $91.1M | +101% |", "| Earnings per share | $0.99 | $0.50 | +98% |"):
        need(row, row)
    need("adj", "operating income was $261.6 million, a margin of 44.7%")
    need("cons", "analysts had expected revenue of $550.8 million and adjusted earnings of $1.19 a share, according to Investing.com. Astera reported $584.9 million and $1.32")
    need("fc", "Astera forecast revenue of $730 million to $750 million. At the midpoint, that would be 27% more than in the third quarter")
    need("next fc", "lands within the $730 million to $750 million Astera expects")
    need("scorpio 1b", "\"Scorpio represented over $1 billion in annualized revenues\". The X-Series shipped to two customers in the quarter, and the P-Series to two US cloud companies")
    need("aries", "grew on demand for the newest PCIe Gen 6 standard")
    need("leo", "including two of the largest cloud companies, with volume shipments expected from mid-2027")
    need("gm", "Astera's adjusted gross margin was 72.4%, above the 72% it had forecast")
    need("opex", "Its adjusted operating costs were $162 million, up 19% on the quarter before")
    need("cash", "with $1.38 billion in cash and marketable securities, up $125.3 million from June, helped by a record $179.2 million of cash from its operations")
    need("q4 adj", "an adjusted operating margin of about 45% and adjusted earnings of $1.62 to $1.66 a share")
    need("q3 word", "picked up significantly in Q3 at both new and existing customers")
    need("fc gm", "It expects a gross margin of about 72%, and earnings per share of about $1.13 to $1.17")
    need("ceo", "Its chief executive, Jitendra Mohan, said growth was \"led by Scorpio")
    need("legal 0", 'accounted for 53% of its revenue in the quarter, against 23% a year earlier, and its three largest together for 77%')
    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2026", "2024", "3", "4", "5", "29", "30", "10"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8", errors="replace")) for fn in SOURCES)
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
    c = dict(zip(f["full_dates"], f["full_closes"]))
    nq = {}
    for r in json.loads((SRC / "ALAB-hist10y-20261106.json").read_text(encoding="utf-8"))["data"]["tradesTable"]["rows"]:
        mm, dd, yy = r["date"].split("/")
        nq[f"{yy}-{mm}-{dd}"] = {k: float(r[k].strip("$").replace(",", "")) for k in ("close", "low")}
    for day in ("2026-06-30", "2026-10-29", "2026-11-03", "2026-11-04", "2026-11-05"):
        assert abs(c[day] - nq[day]["close"]) < 0.006, day
    c29, c3, c4, c5 = (nq[d]["close"] for d in ("2026-10-29", "2026-11-03", "2026-11-04", "2026-11-05"))
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    mv, mv5 = pct(c4, c3), pct(c5, c4)
    assert this["release"] == "2026-11-03" and this["to"] == "2026-11-04" and abs(this["move"] - mv) < 0.01
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    ix = {k: {r[0]: float(r[3]) for r in full[k]} for k in ("^IXIC", "^GSPC")}
    nq4, sp4 = (pct(ix[k]["2026-11-04"], ix[k]["2026-11-03"]) for k in ("^IXIC", "^GSPC"))
    nq5, sp5 = (pct(ix[k]["2026-11-05"], ix[k]["2026-11-04"]) for k in ("^IXIC", "^GSPC"))
    need("answer move", f"its shares fell {abs(mv):.1f}% the next day, while the Nasdaq Composite rose {nq4:.1f}%, and a further {abs(mv5):.1f}% the day after")
    need("short move", f"down {abs(mv):.1f}% on 4 November, to ${c4:.2f}, while the Nasdaq Composite rose {nq4:.1f}%. Then down a further {abs(mv5):.1f}% on 5 November, to ${c5:.2f}")
    need("pre", f"from ${c29:.2f} on 29 October to ${c3:.2f} at the close on 3 November, the day it reported")
    need("4 range", f"On 4 November the shares were as low as ${nq['2026-11-04']['low']:.2f}, before closing at ${c4:.2f}, down {abs(mv):.1f}%. The Nasdaq Composite rose {nq4:.1f}% that day, and the S&P 500 {sp4:.1f}%")
    need("5", f"On 5 November they fell another {abs(mv5):.1f}%, to ${c5:.2f}, on a day the whole market fell: the Nasdaq Composite was down {abs(nq5):.1f}% and the S&P 500 {abs(sp5):.1f}%")
    two = pct(c5, c3)
    assert 20 < abs(two) < 25
    need("two days", f"Over the two days, the shares fell {abs(two):.1f}%, almost a quarter of their value")
    assert f["ath_date"] == "2026-06-30" and f["as_of"] == "2026-11-05" and abs(f["ath_close"] - 483.02) < 0.006
    need("record", f"That leaves the shares {abs(f['below_ath']):.1f}% below their record close of ${f['ath_close']:.2f}, set on 30 June 2026, though still up {f['ytd']:.1f}% this year")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 10 and before[0]["release"] == "2024-05-07" and before[-1]["release"] == "2026-08-04" and f["first_bar"] == "2024-03-20"
    need("rx n", f"all {n} quarterly results Astera released from May 2024, after it listed in March 2024, to August 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    assert (sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)) == (7, 6)
    need("rx 5", f"Seven of the {n} moved the shares 5% or more, and six 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in {my(w['release'])}")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in {my(b['release'])}")
    need("rx updown", f"The shares rose after {sum(v > 0 for v in m)} of the {n} and fell after {sum(v < 0 for v in m)}")
    assert sum(abs(v) > abs(mv) for v in m) == 7
    need("smaller", "So the 4.4% fall after these results was smaller than usual: seven of the 10 earlier results moved the shares more")
    falls = f["big_falls"]
    assert len(falls) == 5 and f["fall_threshold"] == -20 and falls[-1]["recovery_date"] is None
    need("falls n", "fallen 20% or more five times since they listed, counting this one")
    for e in falls:
        back = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {back} |")
    from datetime import date
    longest = max((date.fromisoformat(e["recovery_date"]) - date.fromisoformat(e["peak_date"])).days for e in falls[:-1]) / 30.44
    assert 7.5 < longest < 8.5, longest
    need("falls back", "The four earlier falls all got back to their record, the longest after about eight months")


if __name__ == "__main__":
    main()
