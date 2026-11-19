"""Assert every figure and quote in draft 31 (McDonald's, third quarter 2026) against its source.

Same method as assert_ko.py:
  * SOURCE  — every raw number and phrase taken from McDonald's must appear, as written, in the saved document it is
    attributed to (the Q3 release and supplement, the Q2 release, the Investor Day release, the Form 10-Q), the
    results call as Benzinga transcribed it, CNBC's report and Restaurant Business's;
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen, dividend-adjusted: the reactions, the falls,
    the 23 September move) and the traded closes from Nasdaq's saved history (the record, the year, the low);
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_mcd.py
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
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-mcd-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "31-mcdonalds-q3-2026-results.md"
SRC = ROOT / "earn-2026-nov-b" / "mcd"
REL, SUP, Q2, INV, TENQ, CALL, CNBC, RB = ("q3-release.txt", "q3-supplement.txt", "q2-release.txt", "investor-day.txt",
                                           "form-10q.txt", "call-webull.txt", "news-cnbc.txt", "news-nrn.txt")

REV, REV0, OI, OI0, NI, NI0, EPS, EPS0, AEPS, AEPS0 = 7157, 7078, 3595, 3357, 2486, 2278, 3.51, 3.18, 3.57, 3.22
FR, FR0, CO, CO0, OT, OT0, GAIN, GAIN0 = 4487, 4363, 2480, 2563, 189, 151, 97, 35
SOURCES = {
    REL: ["TOTAL REVENUES | 7,157 | 7,078 | 79 | 1", "OPERATING INCOME | 3,595 | 3,357 | 239 | 7",
          "NET INCOME | $ | 2,486 | $ | 2,278 | $ | 208 | 9 | %", "EARNINGS PER SHARE-DILUTED | $ | 3.51 | $ | 3.18 | $ | 0.33 | 10 | %",
          "Non-GAAP | $ | 2,529 | $ | 2,308 | 10 | % | 10 | % | $ | 3.57 | $ | 3.22 | 11 | % | 11 | %",
          "Revenues from franchised restaurants | $ | 4,487 | $ | 4,363 | $ | 124 | 3 | %",
          "Sales by Company-owned and operated restaurants | 2,480 | 2,563 | (83) | (3)",
          "Other revenues | 189 | 151 | 39 | 26",
          "Global Systemwide sales* increased 4% to over $38 billion for the quarter",
          "Global comparable sales increased 1.5%", "U.S. | (0.2) | % | 2.4 | %",
          "International Operated Markets | 1.4 | 4.3", "International Developmental Licensed Markets | 4.2 | 4.7",
          "Total Company | 1.5 | % | 3.6 | %",
          "Comparable sales declined slightly as negative comparable guest counts were largely offset by positive check growth",
          "Most markets reflected positive comparable sales, led by Germany and Australia, partly offset by France",
          "Positive comparable sales were led by Japan, partly offset by negative comparable sales in China",
          "Results reflected pre-tax charges of $56 million and $39 million for the current year and prior year, respectively, primarily related to restructuring charges associated with Accelerating the Organization",
          "Excluding the current year charges described above of $0.06 per share",
          "The Company declared a 4% increase in its quarterly cash dividend to $1.93 per share",
          "McDonald’s is the world’s leading global foodservice retailer with over 45,000 locations in over 100 countries. Approximately 95% of McDonald’s restaurants worldwide are owned and operated by independent local business owners",
          "in operation at least thirteen months"],
    SUP: ["Gains on sales of restaurant businesses | $ | (97) | $ | (35) | $ | (167) | $ | (50)",
          "Total | $9,887 | $9,237 | 7 | % | 5 | %", "Operating margin | 47.6 | % | 46.5 | %",
          "The Company expects 2026 operating margin percent to be in the mid-to-high 40% range",
          "The Company expects 2026 capital expenditures to be about $3.7 billion",
          "Globally, the Company expects to open about 2,500 restaurants in 2026",
          "The Company expects net restaurant unit expansion will contribute approximately 2.5% to 2026 Systemwide sales growth, in constant currencies"],
    Q2: ["U.S. | 0.8 | % | 2.5 | %", "International Operated Markets | 1.5 | 4.0",
         "International Developmental Licensed Markets | 1.9 | 5.6", "Total Company | 1.3 | % | 3.8 | %"],
    INV: ["9/23/2026", "McDONALD'S ADVANCES NEXT STRATEGY",
          "McDonald's plans to provide approximately $8.5 billion in total NEXT partnering support through 2036, including approximately $5 billion through 2030, through a combination of rent relief and capital support",
          "Operating margin % | Low-to-mid 50% range by 2030",
          "Gain +1.5pp in chicken share and +1.5pp in beverage share by 2030",
          "The target of approximately 250 basis points of gross restaurant-level efficiency improvements is equivalent to roughly $100,000 in annual cash flow benefits for the average U.S. restaurant"],
    TENQ: ["Treasury stock purchases | (519) | (501) | (1,770) | (1,483)"],
    CALL: ["comparable sales turning positive in September following a slightly negative result in July and August",
           "restoring some digital offers to drive frequency with our most engaged customers, shifting marketing support toward proven value platforms",
           "Examples of these offers included a $2 breakfast sandwich and free fries with a $1 minimum purchase",
           "I’m encouraged by our baseline traffic trends in September and October",
           "Just last week we began an eight-week test of two new everyday affordable price menu constructs across all dayparts in about 1,900 restaurants",
           "We’re testing mix-and-match bundles", "We’re also testing fixed bundles",
           "franchisees representing about an additional 4,000 restaurants have chosen to move forward with similar entry-level bundles in advance of the formal test results",
           "represent more than 40% of the U.S. system",
           "which structure resonates most with customers, works best operationally, and delivers sustainable incremental traffic and sales for franchisees",
           "Our goal is to launch a new program nationally in early 2027",
           "focusing on this entry-level value as being the last piece of the value equation for us that we need to figure out",
           "goal of having 98% of our global restaurant portfolio franchised by 2028, having refranchised about 175 restaurants across the U.S. and IOM so far this year",
           "We now expect 2,500 gross restaurant openings globally this year, slightly below our target of 2,600, but remain on track for approximately 2,100 net restaurant openings",
           "This primarily reflected the continued underperformance versus our expectations in France",
           "Chief Financial Officer Ian Borden"],
    CNBC: ["Earnings per share: $3.57 adjusted vs. $3.38 expected", "Revenue: $7.16 billion vs. $7.29 billion expected",
           "based on a survey of analysts by LSEG",
           "the segment performed better than the 0.5% decline that Wall Street anticipated, according to a survey of analysts by StreetAccount",
           "That topped analysts' expectations of a 1.3% increase, according to StreetAccount",
           "McDonald's stock rises as earnings beat, U.S. restaurants show improvement",
           "clarified that he did not say that U.S. same-store sales would be better in the fourth quarter"],
    RB: ["comparable-store sales declined for the first time since early last year",
         "I think we expect the U.S. business will be slightly negative for Q3",
         "because of that slower start to the beginning of the quarter"],
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
    f = figures("MCD")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    assert (round(pct(REV, REV0)), round(pct(OI, OI0)), round(pct(NI, NI0)), round(pct(EPS, EPS0)), round(pct(AEPS, AEPS0))) == (1, 7, 9, 10, 11)
    need("t rev", "| Revenue | $7,157M | $7,078M | +1% |")
    need("t oi", "| Operating income | $3,595M | $3,357M | +7% |")
    need("t ni", "| Net income | $2,486M | $2,278M | +9% |")
    need("t eps", "| Earnings per share | $3.51 | $3.18 | +10% |")
    need("t aeps", "| Leaving out charges | $3.57 | $3.22 | +11% |")
    need("charges", "$56 million before tax this quarter, or $0.06 a share, against $39 million a year earlier")
    assert (round(pct(FR, FR0)), round(pct(CO, CO0)), round(pct(OT, OT0))) == (3, -3, 25)  # 25.2%: the release prints 26 from unrounded
    assert FR + CO + OT + 1 == REV  # the release's own rounding (4,487 + 2,480 + 189 = 7,156)
    need("r fr", "| From franchised restaurants | $4,487M | $4,363M | +3% |")
    need("r co", "| Sales at its own restaurants | $2,480M | $2,563M | −3% |")
    need("r ot", "| Other revenue | $189M | $151M | +26% |")
    assert OI - OI0 == 238 or OI - OI0 == 239  # release: 239 from unrounded
    assert GAIN - GAIN0 == 62
    need("gains", "Its gains on selling restaurants rose from $35 million to $97 million, so $62 million of the $239 million rise in operating income came from them")
    need("175", "Ian Borden said McDonald's had sold about 175 restaurants to franchisees in the US and its larger international markets so far this year, and that it aims to have 98% of its restaurants franchised by the end of 2028")
    need("95", "About 95% of McDonald's restaurants are run by franchisees")
    need("size", "owns or franchises more than 45,000 restaurants in more than 100 countries")
    for row in ["| United States | −0.2% | +0.8% | +2.4% |", "| Large international markets | +1.4% | +1.5% | +4.3% |",
                "| Other international markets | +4.2% | +1.9% | +4.7% |", "| All restaurants | +1.5% | +1.3% | +3.6% |"]:
        need(f"comps {row}", row)
    need("s sys", "of more than $38 billion, up 4%")
    need("s comp", "sales at restaurants open at least 13 months, up 1.5% worldwide but down 0.2% in the US")
    need("s rev", "**Revenue:** $7,157 million, up just 1%")
    need("s eps", "earnings per share of $3.51, up 10%, or $3.57 leaving out restructuring charges")
    need("s plan", "a test of new low-priced meal bundles in about 1,900 US restaurants, with a national launch planned for early 2027")
    need("s div", "raised 4% to $1.93 a share each quarter")
    need("answer", "McDonald's US sales fell 0.2% in the third quarter of 2026, less than analysts expected, and it said they turned positive in September. Its earnings per share rose 10%")
    need("app", "Borden gave examples of the app offers: a $2 breakfast sandwich, and free fries with a $1 purchase")
    need("test", "began an eight-week test of two kinds of bundle")
    need("4000", "Franchisees running about 4,000 more have started similar bundles without waiting for the result, so together more than 40% of US restaurants are offering one")
    need("est", "Analysts surveyed by LSEG had expected earnings per share of $3.38, leaving out charges, and revenue of $7.29 billion, CNBC reported. McDonald's reported $3.57 and $7,157 million")
    need("est2", "analysts surveyed by StreetAccount had expected US comparable sales to fall 0.5%, CNBC reported, and worldwide comparable sales to rise 1.3%")
    need("next", "it said it would provide about $8.5 billion of support through 2036, about $5 billion of it by 2030")
    assert round(9887 / 20773 * 100, 1) == 47.6
    need("margin", "against 47.6% so far in 2026")
    need("share", "1.5 percentage points more of the chicken and drinks markets")
    need("eff", "about 250 basis points of gains in the efficiency of its restaurants, which it says is about $100,000 of cash a year for the average US restaurant")
    need("units", "new restaurants to add about 2.5% to systemwide sales growth, leaving out currency movements")
    need("first", "It was the first fall in US comparable sales since early 2025, Restaurant Business reported")
    need("capex", "capital spending of about $3.7 billion")
    need("open", "about 2,500 new restaurants worldwide, Borden said, a little below its target of 2,600, and about 2,100 more restaurants in total once closures are counted")
    need("div", "McDonald's raised its quarterly dividend 4% to $1.93 a share")
    need("bb", "It also spent $1,770 million buying back its own shares in the first nine months of 2026")

    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2016", "2019", "2020", "2025", "2026", "2027", "1966", "3", "4", "5", "6", "7", "10", "13", "23", "30", "50"}
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
    with open(SRC / "nasdaq-hist-MCD-20261119.csv", encoding="utf-8") as fh:
        lines = list(fh)
    meta = lines[0]
    nq = {r["date"]: r for r in csv.DictReader(x for x in lines if not x.startswith("#"))}
    c = {k: float(v["close"]) for k, v in nq.items()}
    # No ex-dividend date between the September payment and the freeze, so these stored bars are traded closes.
    for d_ in ["11/03/2026", "11/04/2026", "11/05/2026", "10/07/2026"]:
        iso = f"{d_[6:]}-{d_[:2]}-{d_[3:5]}"
        assert abs(adj[iso] - c[d_]) < 0.006, (iso, adj[iso], c[d_])
    assert "max_close_in_window = 02/27/2026 341.06" in meta and "min_close_2026 = 10/07/2026 230.88" in meta
    assert f["ath_date"] == "2026-02-27"  # the stored (adjusted) record falls on the same day as the traded one
    c03, c04, c05, rec, low, ye = c["11/03/2026"], c["11/04/2026"], c["11/05/2026"], c["02/27/2026"], c["10/07/2026"], c["12/31/2025"]
    mv = pct(c04, c03)
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    assert this["release"] == "2026-11-04" and abs(this["move"] - mv) < 1e-3 and f["as_of"] == "2026-11-05"
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    x = {r[0]: float(r[3]) for r in full["^GSPC"]}
    spx4, spx5 = pct(x["2026-11-04"], x["2026-11-03"]), pct(x["2026-11-05"], x["2026-11-04"])
    need("answer move", f"its shares rose {mv:.1f}% on results day, their biggest results-day rise in ten years, though they were still {abs(pct(c05, rec)):.1f}% below their February record")
    need("s move", f"up {mv:.1f}% on 4 November, to ${c04:.2f}, while the S&P 500 rose {spx4:.1f}%")
    rng = nq["11/04/2026"]
    need("day", f"McDonald's closed at ${c03:.2f} on 3 November. On 4 November it was as low as ${float(rng['low']):.2f} and as high as ${float(rng['high']):.2f}, and closed at ${c04:.2f}, up {mv:.1f}%. The S&P 500 rose {spx4:.1f}% the same day")
    need("5nov", f"On 5 November the S&P 500 fell {abs(spx5):.1f}% and McDonald's only {abs(pct(c05, c04)):.1f}%, to ${c05:.2f}")
    need("rec", f"That leaves the shares {abs(pct(c05, rec)):.1f}% below their record close of ${rec:.2f}, set on 27 February 2026, and down {abs(pct(c05, ye)):.1f}% this year")
    need("low", f"$230.88 on 7 October, they fell {abs(pct(low, rec)):.1f}%; they have since risen {pct(c05, low):.1f}% from that low")
    need("div y", f"That is ${4 * 1.93:.2f} a year, {4 * 1.93 / c05 * 100:.1f}% of the share price on 5 November")
    sep = pct(adj["2026-09-23"], adj["2026-09-22"])
    need("sep", f"The shares fell {abs(sep):.1f}% that day")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 43 and before[0]["release"] == "2016-01-25" and before[-1]["release"] == "2026-08-04"
    feb = [r for r in before if r["release"] == "2026-02-11"][0]
    assert (feb["from"], feb["to"]) == ("2026-02-11", "2026-02-12")
    need("rx n", f"We measured all {n} of McDonald's quarterly results before this one, from January 2016 to August 2026, leaving out two 2020 sales updates")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    o5, o10 = sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)
    assert (o5, o10) == (4, 0)
    need("rx 5", f"{o5} of the {n} moved the shares by 5% or more, and none by 10%")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2019-10-22" and b["release"] == "2018-10-23"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in October 2019")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in October 2018")
    assert all(v != 0 for v in m)
    need("rx updown", f"The shares rose after {sum(v > 0 for v in m)} of the {n} and fell after {sum(v < 0 for v in m)}")
    assert abs(mv) > max(abs(v) for v in m)
    need("rx this", f"So this {mv:.1f}% rise was McDonald's largest results-day move since at least 2016")
    falls = f["big_falls"]
    assert len(falls) == 8 and f["fall_threshold"] == -30 and f["first_bar"] == "1966-07-05"
    need("falls n", "Counting dividends, McDonald's has fallen 30% or more eight times since 1966, the start of our price history, including this year")
    for e in falls:
        rec_ = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {rec_} |")
    cur = falls[-1]
    assert cur["peak_date"] == "2026-02-27" and cur["trough_date"] == "2026-10-07" and not cur["recovery_date"]
    need("cur", f"Counting dividends, this year's fall is {abs(cur['depth_pct']):.1f}%, smaller than the {abs(pct(low, rec)):.1f}% in the share price alone")
    yrs = lambda a, b: (int(b[:4]) - int(a[:4])) + (int(b[5:7]) - int(a[5:7])) / 12  # noqa: E731
    done = falls[:-1]
    assert all(e["recovery_date"] for e in done)
    assert 8 < max(yrs(e["peak_date"], e["recovery_date"]) for e in done) < 9
    need("back", "The seven earlier falls all got back to their record; the longest took more than eight years")


if __name__ == "__main__":
    main()
