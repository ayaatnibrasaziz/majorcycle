"""Assert every figure and quote in draft 30 (Coca-Cola, third quarter 2026) against its source.

Same method as assert_360.py:
  * SOURCE  — every raw number and phrase taken from Coca-Cola must appear, as written, in the saved document it is
    attributed to (the four 2026 results releases, the Form 10-Q), the results call as The Singju Post transcribed it,
    and CNBC's report of 27 October;
  * DERIVED — every comparison is recomputed here from those raw numbers (the table's changes, the margin, the
    implied $3.33, the dividend rate and yield);
  * MEASURED — share-price history from `earn_figures.figures()` (frozen data, dividend-adjusted, used for the
    reactions, the falls and the counting-dividends return); the traded closes from Nasdaq's saved history;
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_ko.py
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
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-ko-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "30-coca-cola-q3-2026-results.md"
SRC = ROOT / "earn-2026-nov-b" / "ko"
REL, FEB, APR, JUL, TENQ, CALL, CNBC = ("q3-release.txt", "q4-2025-release.txt", "q1-release.txt", "q2-release.txt",
                                        "form-10q.txt", "call-singju.txt", "news-cnbc.txt")

# --- REPORTED, US$ millions except per share, three months to 2 October 2026 vs 26 September 2025 ---
REV, REV0, OI, OI0, NI, NI0 = 13380, 12455, 4465, 3982, 4009, 3696
EPS, EPS0, CEPS, CEPS0 = 0.93, 0.86, 0.91, 0.82
SEG = {"North America": (5386, 3, 3, 0), "Europe, Middle East & Africa": (3104, 4, 7, 5),
       "Latin America": (1958, 25, 16, 6), "Asia Pacific": (1563, 4, 6, 6), "Bottling investments": (1523, 13, 12, 8)}
SOURCES = {
    REL: ["Net Operating Revenues | $ | 13,380 | $ | 12,455 | 7", "Operating Income | 4,465 | 3,982 | 12",
          "Net Income Attributable to Shareowners of The Coca-Cola Company | $ | 4,009 | $ | 3,696 | 8",
          "Diluted Net Income Per Share1 | $ | 0.93 | $ | 0.86 | 8",
          "EPS Grew 8% to $0.93; Comparable EPS (Non-GAAP) Grew 11% to $0.91",
          "Comparable (Non-GAAP) | $ | 397 | $ | 637 | $ | 69 | $ | 4,451 | $ | 913 | 20.5 | % | $ | 3,544 | $ | 0.82",
          "Other Items | 5 | — | 182 | 109 | 5 | 104 | 0.02", "Certain Tax Matters | — | — | — | — | 172 | (172) | (0.04)",
          "Operating margin was 33.4% versus 32.0% in the prior year",
          "Both EPS and comparable EPS (non-GAAP) performance included the impact of a 2-point currency tailwind",
          "Consolidated | 7 | 1 | 1 | (1) | 7 | 7 | 5",
          "Europe, Middle East & Africa | 6 | 1 | 0 | (3) | 4 | 7 | 5", "Latin America | 8 | 7 | 9 | 0 | 25 | 16 | 6",
          "North America | 2 | 1 | 0 | 0 | 3 | 3 | 0", "Asia Pacific | 8 | (2) | (3) | 0 | 4 | 6 | 6",
          "Bottling Investments | 10 | 3 | 1 | 0 | 13 | 12 | 8",
          "EMEA | $ | 3,104 | $ | 2,996 | 4", "Latin America | 1,958 | 1,573 | 25", "North America | 5,386 | 5,253 | 3",
          "Asia Pacific | 1,563 | 1,506 | 4", "Bottling Investments | 1,523 | 1,346 | 13",
          "Unit case volume grew 5%, led by India, China, Mexico and Brazil",
          "Coca-Cola Zero Sugar grew 16%", "Diet Coke/Coca-Cola Light grew 6%", "Sports drinks declined 3%",
          "Concentrate sales were 2 points ahead of unit case volume due to the timing of concentrate shipments",
          "driven by a 7% increase in concentrate sales and 1% growth in price/mix",
          "Comparable EPS (non-GAAP) | At least 11% growth, which includes:•Approx. 3% currency tailwind1",
          "| 9% to 10% growth, which includes:",
          "Organic revenues (non-GAAP) | At least 5% growth | Approx. 5% growth",
          "Comparable currency neutral EPS excluding acquisitions and divestitures (non-GAAP) | At least 9% growth | 7% to 8% growth",
          "Free cash flow (non-GAAP) | At least $13.0 billion", "| Approx. $12.4 billion, consisting of",
          "Current column assumes the pending sale of our bottling operations in Africa closes during the fourth quarter of 2026",
          "Closing is subject to regulatory approvals",
          "Comparable net revenues (non-GAAP) | •Slight currency headwind1•Approx. 8% headwind from acquisitions and divestitures2",
          "Comparable EPS (non-GAAP) | •Slight currency headwind1•Approx. 2% headwind from acquisitions and divestitures2",
          "The company will provide full year 2027 guidance when it reports fourth quarter earnings",
          "fourth quarter 2026 financial results will be impacted by six fewer days as compared to fourth quarter 2025",
          "Free Cash Flow (Non-GAAP) | $ | 11,408",
          "Henrique Braun, CEO of The Coca-Cola Company"],
    FEB: ["comparable EPS (non-GAAP) growth of 7% to 8% versus $3.00 in 2025",
          "The company expects to deliver organic revenue (non-GAAP) growth of 4% to 5%."],
    APR: ["comparable EPS (non-GAAP) growth of 8% to 9% versus $3.00 in 2025",
          "The company expects to deliver organic revenue (non-GAAP) growth of 4% to 5%. — No Update"],
    JUL: ["Coca-Cola Reports Second Quarter 2026 Results and Raises Full Year Guidance Global Unit Case Volume Grew 5%",
          "Organic revenues (non-GAAP) | Approx. 5% growth | 4% to 5% growth",
          "Comparable EPS (non-GAAP) | 9% to 10% growth, which includes"],
    TENQ: ["The Company consequently initiated litigation by filing a petition in the U.S. Tax Court (“Tax Court”) in December 2015",
           "the Tax Court issued an opinion (“Opinion”) in which it predominantly sided with the IRS",
           "reallocating income earned by the Company’s foreign licensees to increase the Company’s U.S. tax",
           "With applicable interest, the total liability for the 2007 through 2009 tax years resulting from the Tax Court’s decision is $6.0 billion",
           "The Company paid those invoices (“IRS Tax Litigation Deposit”) on September 10, 2024",
           "That amount, plus interest earned, would be refunded in full or in pa",
           "The U.S. Court of Appeals for the Eleventh Circuit heard the case on June 25, 2026",
           "the Company believes that it is more likely than not that we will ultimately prevail in this litigation upon appeal",
           "could be approximately $14 billion as of December 31, 2025",
           "would result in an incremental annual tax liability that would increase the Company’s effective tax rate by approximately 3.8%",
           "Dividends paid/payable to shareowners of The Coca-Cola Company ($0.53 per share)",
           "Dividends paid/payable to shareowners of The Coca-Cola Company ($1.59 per share)",
           "Our Board of Directors approved the Company’s regular quarterly dividend of $0.53 per share at its October 2026 meeting. This dividend is payable on December 15, 2026"],
    CALL: ["This was driven by 4 points of pricing actions, partially offset by 3 points of unfavourable mix, primarily due to geographic mix, timing of investments, and category mix",
           "We also now expect slight destocking in the 4th quarter. Therefore, we expect concentrate shipments to slightly trail unit case volume for the full year",
           "we are exploring a potential IPO of our bottling operations in India",
           "We’re continuing to judiciously manage our balance sheet. As we await a court decision",
           "With our net debt leverage of 1.3 times EBITDA, which is below our target range of 2 to 2.5 times",
           "Overall, we expect consumer behaviour to remain largely unchanged, with value being a very important consideration across all markets and income groups",
           "the restaurant industry continues to be under pressure",
           "we expect an 8-point headwind to comparable net revenues and a 2-point headwind to comparable earnings per share",
           "John Murphy, President and Chief Financial Officer"],
    CNBC: ["Earnings per share: 91 cents adjusted vs. 88 cents expected",
           "Revenue: $13.4 billion vs. $12.92 billion expected",
           "Wall Street analysts surveyed by LSEG",
           "Shares of the company fell less than 1% in morning trading on its gloomy forecast for the consumer environment",
           "would have reported volume growth if not for the timing of the Fourth of July holiday and the monthslong shortage of Topo Chico, a sparkling water brand Coke owns, Murphy told CNBC",
           "The company hiked its full-year forecast for the third straight quarter"],
}


def norm(s: str) -> str:
    s = s.replace("\\\"", '"')
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def sg(x: float) -> str:
    return f"+{x:.0f}%" if round(x) > 0 else ("0%" if round(x) == 0 else f"−{abs(x):.0f}%")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("KO")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    # DERIVED: the quarter table
    assert (round(pct(REV, REV0)), round(pct(OI, OI0)), round(pct(NI, NI0))) == (7, 12, 8)
    assert round(pct(EPS, EPS0)) == 8 and round(pct(CEPS, CEPS0)) == 11
    assert round(OI / REV * 100, 1) == 33.4
    assert round(EPS + 0.02 - 0.04, 2) == CEPS  # the reconciliation: other items add back 0.02, tax matters take 0.04
    need("t rev", "| Revenue | $13,380M | $12,455M | +7% |")
    need("t oi", "| Operating income | $4,465M | $3,982M | +12% |")
    need("t ni", "| Net income | $4,009M | $3,696M | +8% |")
    need("t eps", "| Earnings per share | $0.93 | $0.86 | +8% |")
    need("t ceps", "| Comparable earnings per share | $0.91 | $0.82 | +11% |")
    need("margin", "Its operating margin, operating income as a share of revenue, rose from 32.0% to 33.4%")
    need("fx", "Coca-Cola said currency movements added 2 points to the growth in earnings per share")
    need("recon", "This quarter's reported figure included a tax benefit worth $0.04 a share and other costs worth $0.02, so the comparable figure is the lower one")
    for k, (rv, rep, org, vol) in SEG.items():
        need(f"seg {k}", f"| {k} | ${rv:,}M | {sg(rep)} | {sg(org)} | {sg(vol)} |")
    assert sum(v[0] for v in SEG.values()) + 38 - 192 == REV  # + corporate − eliminations = consolidated
    need("answer", "Coca-Cola's revenue rose 7% to $13.4 billion in the third quarter of 2026, above analysts' forecasts, and it raised its forecast for the year for the third time")
    need("s rev", "**Revenue:** $13,380 million, up 7% from $12,455 million a year earlier")
    need("s vol", "measured in unit cases, up 5%, the same as the quarter before")
    need("s eps", "earnings per share of $0.93, up 8%. On Coca-Cola's own adjusted measure, which it calls comparable earnings per share, $0.91, up 11%")
    need("s fc", "comparable earnings per share now expected to grow at least 11% in 2026, up from 9% to 10%. It started the year at 7% to 8%")
    need("led", "Volume growth was led by India, China, Mexico and Brazil, Coca-Cola said. Coca-Cola Zero Sugar grew 16% and Diet Coke 6%. Its sports drinks fell 3%")
    need("pm", "Higher prices added 4 points to revenue, Murphy said on the results call, but a less favourable mix, mainly of countries, the timing of investments and the kinds of drinks sold, took 3 points off. So price and mix together added just 1%")
    need("conc", "Its concentrate sales grew 7%, 2 points faster than the volume of drinks sold")
    need("est", "Analysts surveyed by LSEG had expected comparable earnings per share of 88 cents and revenue of $12.92 billion, CNBC reported. Coca-Cola reported 91 cents and $13.4 billion")
    for row in ["| February | 7% to 8% | 4% to 5% |", "| April | 8% to 9% | 4% to 5% |", "| July | 9% to 10% | About 5% |",
                "| October | At least 11% | At least 5% |"]:
        need(f"fc {row}", row)
    assert round(3.00 * 1.11, 2) == 3.33
    need("333", "Growth of at least 11% on $3.00 would be comparable earnings per share of at least $3.33 for 2026")
    need("fcf", "to at least $13.0 billion, from about $12.4 billion")
    need("fx3", "About 3 points of that 11% is expected to come from currency movements")
    need("cn", "it expects growth of at least 9%, up from 7% to 8%")
    need("africa", "it expects the sale to take about 8 points off its comparable revenue growth and about 2 points off comparable earnings per share")
    need("tax pay", "in September 2024 Coca-Cola paid $6.0 billion of tax and interest for 2007 to 2009 while it appeals")
    need("tax hear", "The appeals court heard the case on 25 June 2026")
    need("tax 14", "it estimates the further tax and interest for 2010 to 2025 at about $14 billion as of the end of 2025")
    need("tax rate", "losing would raise its tax rate each year by about 3.8%")
    need("fcf9", "Coca-Cola generated $11.4 billion of free cash flow in the first nine months of 2026")
    need("lev", "Its net debt was 1.3 times its earnings before interest, tax, depreciation and amortisation, Murphy said, below its target of 2 to 2.5 times")
    need("q4", "the quarter also has six fewer days than a year earlier")
    assert round(1.59 / 3, 2) == 0.53  # nine months at $1.59 = $0.53 in each quarter
    need("div q", "It has paid a dividend of $0.53 a share each quarter this year. Its board declared the same again in October, payable on 15 December")

    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2015", "2016", "2019", "2024", "2025", "2026", "2027", "1962", "1996", "2", "27", "28"}
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
    # Traded closes (Nasdaq). From 2026 the stored series equals the traded one: no ex-dividend date between
    # 15 September and the freeze, so the late-October bars are unadjusted; the year-end bar is not.
    with open(SRC / "nasdaq-hist-KO-20261119.csv", encoding="utf-8") as fh:
        nq = {r["date"]: float(r["close"]) for r in csv.DictReader(x for x in fh if not x.startswith("#"))}
    for d_ in ["10/22/2026", "10/26/2026", "10/27/2026", "10/28/2026"]:
        iso = f"{d_[6:]}-{d_[:2]}-{d_[3:5]}"
        assert abs(adj[iso] - nq[d_]) < 0.006, (iso, adj[iso], nq[d_])
    c22, c26, c27, c28, ye = nq["10/22/2026"], nq["10/26/2026"], nq["10/27/2026"], nq["10/28/2026"], nq["12/31/2025"]
    mv = pct(c27, c26)
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    assert this["release"] == "2026-10-27" and abs(this["move"] - mv) < 1e-3 and f["as_of"] == "2026-10-28"
    assert f["ath_date"] == "2026-10-22" and abs(f["ath_close"] - c22) < 0.006
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    x = {r[0]: float(r[3]) for r in full["^GSPC"]}
    spx = pct(x["2026-10-27"], x["2026-10-26"])
    ytd, ytd_tr = pct(c28, ye), f["ytd"]
    need("answer move", f"Its shares still fell {abs(mv):.1f}% on results day")
    need("answer ytd", f"on 28 October they were up {ytd:.1f}% this year")
    need("s move", f"down {abs(mv):.1f}% on 27 October, to ${c27:.2f}, while the S&P 500 rose {spx:.1f}%")
    need("day", f"Coca-Cola shares set a record close of ${c22:.2f} on 22 October, five days before the results. They closed at ${c26:.2f} on 26 October, and on results day, 27 October, they fell {abs(mv):.1f}% to ${c27:.2f}. The S&P 500 rose {spx:.1f}% the same day")
    need("after", f"On 28 October the shares closed at ${c28:.2f}, {abs(pct(c28, c22)):.1f}% below their record and up {ytd:.1f}% since the end of 2025. Counting dividends, they were up {ytd_tr:.1f}%")
    # Best year since 1996, counting dividends: every calendar year's return from the stored (adjusted) year-end closes.
    yend: dict[str, float] = {}
    for d_, c_ in zip(f["full_dates"], f["full_closes"]):
        yend[d_[:4]] = c_
    ys = sorted(yend)
    yr = {y: pct(yend[y], yend[p]) for p, y in zip(ys, ys[1:]) if y != "2026"}
    beaten = [y for y in yr if yr[y] > ytd_tr]
    assert max(beaten) == "1996" and all(yr[y] < ytd_tr for y in yr if y > "1996")
    need("best", "If 2026 ended there, it would be Coca-Cola's best year since 1996")
    yld = 4 * 0.53 / c28 * 100
    need("div", f"a rate of ${4 * 0.53:.2f} a year, {yld:.1f}% of the share price on 28 October")
    # Results-day history (the 43 before this one)
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 43 and before[0]["release"] == "2016-02-09" and before[-1]["release"] == "2026-07-28"
    need("rx n", f"We measured all {n} of Coca-Cola's results releases before this one, from February 2016 to July 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    o5, o10 = sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)
    assert (o5, o10) == (2, 0)
    need("rx 5", f"Only {o5} of the {n} moved the shares by 5% or more, and none by 10%")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2019-02-14" and b["release"] == "2019-07-23"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in February 2019")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in July 2019")
    assert all(v != 0 for v in m)
    need("rx updown", f"The shares rose after {sum(v > 0 for v in m)} of the {n} and fell after {sum(v < 0 for v in m)}")
    apr, jul = before[-2], before[-1]
    assert apr["release"] == "2026-04-28" and jul["release"] == "2026-07-28"
    need("rx last2", f"sent the shares up **{apr['move']:.1f}%** in April and **{jul['move']:.1f}%** in July 2026")
    further = sum(abs(v) > abs(mv) for v in m)
    need("bigger", f"So a {abs(mv):.1f}% fall is an ordinary move for Coca-Cola: {further} of the {n} earlier results moved the shares more")
    # The falls (counting dividends: the stored series is dividend-adjusted)
    falls = f["big_falls"]
    assert len(falls) == 4 and f["fall_threshold"] == -30 and f["first_bar"] == "1962-01-02"
    need("falls n", "Counting dividends, Coca-Cola has fallen 30% or more four times since 1962, the start of our price history")
    for e in falls:
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {my(e['recovery_date'])} |")
    assert all(e["recovery_date"] for e in falls)
    yrs = lambda a, b: (int(b[:4]) - int(a[:4])) + (int(b[5:7]) - int(a[5:7])) / 12  # noqa: E731
    longest = max(falls, key=lambda e: yrs(e["peak_date"], e["recovery_date"]))
    assert longest["peak_date"] == "1998-07-14" and 12 < yrs(longest["peak_date"], longest["recovery_date"]) < 13
    assert max(round(yrs(e["trough_date"], e["recovery_date"])) for e in falls) == 8
    need("falls back", "The longest took more than 12 years from the record, and about eight years from the low")


if __name__ == "__main__":
    main()
