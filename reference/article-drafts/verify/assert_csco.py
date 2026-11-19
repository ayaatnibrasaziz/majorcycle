"""Assert every figure and quote in draft 33 (Cisco, first quarter of fiscal 2027) against its source.

Same method as assert_ko.py:
  * SOURCE  — every raw number and phrase taken from Cisco must appear, as written, in the saved document it is
    attributed to (the Q1 FY27 and Q4 FY26 releases, the Form 10-Q), the results call as The Motley Fool transcribed
    it, Trefis and 24/7 Wall St.;
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen, dividend-adjusted: the reactions, the falls,
    the 5 November move) and the traded closes from Nasdaq's saved history;
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_csco.py
"""

from __future__ import annotations

import csv
import gzip
import json
import os
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-csco-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "33-cisco-q1-fy27-results.md"
SRC = ROOT / "earn-2026-nov-b" / "csco"
REL, Q4, TENQ, CALL, TREFIS, W247 = ("q1-release.txt", "q4-release.txt", "form-10q.txt", "call-fool.txt",
                                     "news-trefis.txt", "news-247-nov5.txt")

REV, REV0, OI, OI0, NI, NI0 = 18517, 14883, 5598, 3363, 4552, 2860
GP, GP0 = 11788, 9745
SOURCES = {
    REL: ["Product | $ | 14,667 | $ | 11,077", "Services | 3,850 | 3,806", "Total revenue | 18,517 | 14,883",
          "GROSS MARGIN | 11,788 | 9,745", "OPERATING INCOME | 5,598 | 3,363", "NET INCOME | $ | 4,552 | $ | 2,860",
          "Diluted | $ | 1.14 | $ | 0.72", "Non-GAAP EPS | $ | 1.40 | $ | 1.00",
          "Share-based compensation expense | 0.23 | 0.26", "Amortization of acquisition-related intangible assets | 0.10 | 0.12",
          "Networking | $ | 11,132 | 43%", "Security | 2,120 | 7%", "Collaboration | 1,136 | 8%", "Observability | 279 | 2%",
          "Total revenue was $18.5 billion, up 24%, with product revenue up 32% and services revenue up 1%",
          "Americas up 28%, EMEA up 18%, and APJC up 21%",
          "total gross margin, product gross margin, and services gross margin were 63.7%, 61.8%, and 70.9%, respectively, as compared with 65.5%, 64.5%, and 68.4%",
          "In Q1, we delivered the strongest revenue and non-GAAP earnings per share growth rates for Cisco in over 15 years",
          "Raised expectation for AI infrastructure revenue from hyperscalers to $9B in FY27, more than double the total for FY26",
          "Revenue | $74.8 billion - $75.8 billion", "Non-GAAP EPS | $5.47 - $5.53",
          "Revenue | $18.0 billion - $18.2 billion", "Non-GAAP EPS | $1.34 - $1.36",
          "$4.4 billion for the first quarter of fiscal 2027, an increase of 36%",
          "we returned $3.7 billion to stockholders through share buybacks and dividends. We declared and paid a cash dividend of $0.42 per common share, or $1.7 billion, and repurchased approximately 18 million shares of common stock under our stock repurchase program at an average price of $112.38 per share for an aggregate purchase price of $2.0 billion",
          "Cisco has declared a quarterly dividend of $0.42 per common share",
          "first quarter results for the period ended October 24, 2026"],
    Q4: ["Q4 total product orders up 35% year over year; up 25% excluding hyperscalers",
         "Networking product orders grew 40% year over year in Q4",
         "Delivered approximately $4 billion of revenue in FY 2026; $7.5 billion expected in FY 2027",
         "Revenue | $18.0 billion - $18.2 billion", "Non-GAAP EPS | $1.32 - $1.34",
         "Revenue | $72.2 billion - $73.4 billion", "Non-GAAP EPS | $5.05 - $5.11"],
    TENQ: ["Product gross margin decreased by 2.7 percentage points, primarily driven by a product mix shift toward hardware and higher memory costs"],
    CALL: ["total product orders growing 21% year-over-year", "product orders up 14% year-over-year",
           "Networking product orders grew 28% in Q1",
           "a little bit of a sequential downtick in AI orders taken from hyperscalers",
           "I think you're right, it's going to be lumpy, and there's going to be some quarters that are going to be big, others that are going to be smaller",
           "In FY '27, we expect AI hyperscale revenue to represent 12% of total revenue, up from 6% in FY '26",
           "just shy of the 65%, and we're comfortable with that for the full year",
           "elevated memory costs", "Charles Robbins", "Mark Patterson"],
    TREFIS: ["The company posted adjusted earnings per share of $1.40, topping the $1.33 estimate. Revenue reached $18.5 billion, above the $18.12 billion analysts expected",
             "In its sub-industry, communications equipment, 14 of the 15 other large companies fell",
             "The median among them dropped 4.5%"],
    W247: ["Morgan Stanley downgraded Cisco to Equal-weight from Overweight on November 5"],
}


def norm(s: str) -> str:
    s = s.replace("\\\"", '"')
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("CSCO")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    assert (round(pct(REV, REV0)), round(pct(OI, OI0)), round(pct(NI, NI0))) == (24, 66, 59)
    assert (round(GP / REV * 100, 1), round(GP0 / REV0 * 100, 1)) == (63.7, 65.5)
    assert (round(pct(1.14, 0.72)), round(pct(1.40, 1.00))) == (58, 40)
    need("t rev", "| Revenue | $18,517M | $14,883M | +24% |")
    need("t gm", "| Gross margin | 63.7% | 65.5% | −1.8 points |")
    need("t oi", "| Operating income | $5,598M | $3,363M | +66% |")
    need("t ni", "| Net income | $4,552M | $2,860M | +59% |")
    need("t eps", "| Earnings per share | $1.14 | $0.72 | +58% |")
    need("t aeps", "| Adjusted earnings per share | $1.40 | $1.00 | +40% |")
    need("ng", "It mainly leaves out the cost of the shares it pays its staff in, $0.23 a share this quarter, and an accounting charge for the companies it has bought, $0.10")
    for row in ["| Networking | $11,132M | +43% |", "| Security | $2,120M | +7% |", "| Collaboration | $1,136M | +8% |",
                "| Observability | $279M | +2% |", "| All products | $14,667M | +32% |", "| Services | $3,850M | +1% |"]:
        need(f"cat {row}", row)
    assert round(pct(14667, 11077)) == 32 and round(pct(3850, 3806)) == 1
    need("geo", "Revenue from the Americas rose 28%, from Europe, the Middle East and Africa 18%, and from Asia Pacific, Japan and China 21%")
    for row in ["| All product orders | +21% | +35% |", "| Leaving out the largest cloud companies | +14% | +25% |",
                "| Networking | +28% | +40% |"]:
        need(f"orders {row}", row)
    need("s rev", "**Revenue:** $18,517 million, a record, up 24% from $14,883 million a year earlier")
    need("s net", "product revenue of $11,132 million, up 43%")
    need("s eps", "earnings per share of $1.14, up 58%. On Cisco's own adjusted measure, $1.40, up 40%")
    need("s ord", "product orders up 21%, slower than the 35% of the quarter before")
    need("s gm", "gross margin down from 65.5% to 63.7%")
    need("s fc", "revenue for the year to July 2027 of $74.8 billion to $75.8 billion, up from $72.2 billion to $73.4 billion")
    need("answer", "Cisco's revenue rose 24% to a record $18.5 billion in the quarter to October 2026, its fastest growth in more than 15 years")
    need("gm", "fell from 65.5% to 63.7%")
    need("mix", "Patterson said AI equipment for the hyperscalers would be 12% of Cisco's revenue in the year to July 2027, up from 6%")
    need("ai", "it had delivered about $4 billion of AI equipment to the hyperscalers in the year to July 2026 and expected $7.5 billion in the year to July 2027. It now expects $9 billion, more than double the year before")
    need("est", "Analysts had expected adjusted earnings per share of $1.33 and revenue of $18.12 billion, Trefis reported. Cisco reported $1.40 and $18,517 million")
    need("aug q", "revenue of $18.0 billion to $18.2 billion and adjusted earnings per share of $1.32 to $1.34")
    need("fc rev", "| Revenue, year to July 2027 | $72.2B to $73.4B | $74.8B to $75.8B |")
    need("fc eps", "| Adjusted earnings per share | $5.05 to $5.11 | $5.47 to $5.53 |")
    need("q2", "Cisco expects revenue of $18.0 billion to $18.2 billion, slightly less than the quarter just reported, and adjusted earnings per share of $1.34 to $1.36")
    need("cash", "Cisco generated $4.4 billion of cash from operations in the quarter, up 36%. It returned $3.7 billion to shareholders: $1.7 billion in dividends and $2.0 billion buying back about 18 million of its own shares, at an average of $112.38")
    need("div", "It declared a quarterly dividend of $0.42 a share")
    need("sector", "Of the 15 other large companies that make communications equipment, 14 fell too, Trefis reported, with a median fall of 4.5%")
    need("next", "Whether revenue for the year lands between $74.8 billion and $75.8 billion")
    need("next ai", "Whether AI revenue from the hyperscalers reaches $9 billion this financial year")

    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2016", "2025", "2026", "2027", "1990", "2000", "65", "15", "21"}
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
    adj = dict(zip(f["full_dates"], f["full_closes"]))
    with open(SRC / "nasdaq-hist-CSCO-20261119.csv", encoding="utf-8") as fh:
        lines = list(fh)
    meta = lines[0]
    nq = {r["date"]: r for r in csv.DictReader(x for x in lines if not x.startswith("#"))}
    c = {k: float(v["close"]) for k, v in nq.items()}
    for d_ in ["11/12/2026", "11/13/2026", "11/16/2026", "11/06/2026"]:
        iso = f"{d_[6:]}-{d_[:2]}-{d_[3:5]}"
        assert abs(adj[iso] - c[d_]) < 0.006, (iso, adj[iso], c[d_])
    assert "max_close_in_window = 06/04/2026 130.00" in meta and f["ath_date"] == "2026-06-04"
    c12, c13, c16, rec, ye = c["11/12/2026"], c["11/13/2026"], c["11/16/2026"], c["06/04/2026"], c["12/31/2025"]
    mv = pct(c13, c12)
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    assert this["release"] == "2026-11-12" and (this["from"], this["to"]) == ("2026-11-12", "2026-11-13")
    assert abs(this["move"] - mv) < 1e-3 and f["as_of"] == "2026-11-16"
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    sx = {r[0]: float(r[3]) for r in full["^GSPC"]}
    nx = {r[0]: float(r[3]) for r in full["^IXIC"]}
    spx, ndq = pct(sx["2026-11-13"], sx["2026-11-12"]), pct(nx["2026-11-13"], nx["2026-11-12"])
    need("answer move", f"and its shares fell {abs(mv):.1f}% the next day")
    need("s move", f"down {abs(mv):.1f}% on 13 November, to ${c13:.2f}, while the S&P 500 fell {abs(spx):.1f}%")
    r13 = nq["11/13/2026"]
    need("day", f"Cisco closed at ${c12:.2f} on 12 November. On 13 November it opened at ${float(r13['open']):.2f}, fell as low as ${float(r13['low']):.2f}, and closed at ${c13:.2f}, down {abs(mv):.1f}%. The S&P 500 fell {abs(spx):.1f}% and the Nasdaq Composite {abs(ndq):.1f}% the same day")
    nov5, spx5 = pct(adj["2026-11-05"], adj["2026-11-04"]), pct(sx["2026-11-05"], sx["2026-11-04"])
    need("nov5", f"A week before, on 5 November, the shares had fallen {abs(nov5):.1f}%, the day Morgan Stanley lowered its rating on Cisco, 24/7 Wall St. reported, and a day the S&P 500 fell {abs(spx5):.1f}%. On 16 November they closed at ${c16:.2f}")
    need("rec", f"That leaves them {abs(pct(c16, rec)):.1f}% below their record close of ${rec:.2f} on 4 June 2026, though still up {pct(c16, ye):.1f}% since the end of 2025")
    need("div y", f"a rate of ${4 * 0.42:.2f} a year, {4 * 0.42 / c16 * 100:.1f}% of the share price on 16 November")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 43 and before[0]["release"] == "2016-02-10" and before[-1]["release"] == "2026-08-12"
    need("rx n", f"We measured all {n} of Cisco's results releases before this one, from February 2016 to August 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    o5, o10 = sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)
    need("rx 5", f"{o5} of the {n} moved the shares by 5% or more, and {o10} by 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2022-05-18" and b["release"] == "2026-05-13"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in May 2022")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in May 2026")
    assert all(v != 0 for v in m)
    need("rx updown", f"The shares rose after {sum(v > 0 for v in m)} of the {n} and fell after {sum(v < 0 for v in m)}")
    fe, ma, au = before[-3], before[-2], before[-1]
    assert (fe["release"], ma["release"], au["release"]) == ("2026-02-11", "2026-05-13", "2026-08-12")
    assert abs(au["move"] - pct(c["08/13/2026"], c["08/12/2026"])) < 0.05
    need("rx last3", f"moved the shares down **{abs(fe['move']):.1f}%** in February, up **{ma['move']:.1f}%** in May and down **{abs(au['move']):.1f}%** in August 2026")
    more = sum(abs(v) > abs(mv) for v in m)
    assert abs(mv) > statistics.median(abs(v) for v in m)
    need("bigger", f"So a {abs(mv):.1f}% fall is bigger than Cisco's usual move, though {more} of the {n} earlier results moved the shares more")
    falls = f["big_falls"]
    assert len(falls) == 10 and f["fall_threshold"] == -25 and f["first_bar"] == "1990-02-16"
    need("falls n", "Counting dividends, Cisco's shares have fallen 25% or more ten times since 1990, the start of our price history, including this year")
    for e in falls:
        rec_ = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {rec_} |")
    cur = falls[-1]
    assert cur["peak_date"] == "2026-06-04" and not cur["recovery_date"]
    assert "min_close_after_record = 11/06/2026 93.85" in meta and cur["trough_date"] == "2026-11-06"
    need("cur", f"This year's fall, to ${c['11/06/2026']:.2f} on 6 November, is {abs(pct(c['11/06/2026'], rec)):.1f}% in the share price alone and {abs(cur['depth_pct']):.1f}% counting dividends")
    big = falls[-3]
    assert big["peak_date"] == "2000-03-27" and big["recovery_date"] == "2021-08-24"
    need("back", "The nine earlier falls all got back to their record. The fall that began in March 2000 took more than 21 years, even counting dividends")


if __name__ == "__main__":
    main()
