"""Assert every figure and quote in draft 36 (Nvidia, third quarter of fiscal 2027) against its source.

Same method as assert_amat.py:
  * SOURCE  — every raw number and phrase taken from Nvidia must appear, as written, in the saved document it is
    attributed to (the Q3 release and CFO commentary, the Q2 release, the 8-K and press release on the change of chief
    executive, the board's statement), and every number from the press in the article it is attributed to (CNBC,
    NBC News, The Motley Fool);
  * DERIVED — every comparison is recomputed here from those raw numbers (the beat, the extra week, the cash gap);
  * MEASURED — share-price history from `earn_figures.figures()` (frozen, dividend-adjusted: the reactions, the falls)
    and the traded closes from Nasdaq's saved history (the day, the record, the year, the fall since 6 November);
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_nvda.py
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
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-nvda-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "36-nvidia-q3-fy27-results.md"
SRC = ROOT / "earn-2026-nov-b" / "nvda"
REL, CFO, Q2, K8, PR, BOARD = ("q3-release.txt", "q3-cfo.txt", "q2-release.txt", "ceo-8k.txt", "ceo-transition.txt",
                              "board-statement.txt")
HUANG, CNBC, NOV18, NBC, FOOL = ("news-cnbc-huang.txt", "news-cnbc.txt", "news-cnbc-nov18.txt", "news-nbc-live.txt",
                                 "news-fool.txt")
REUTERS = "news-reuters-sec.txt"  # added 21 Nov: the SEC update

# raw figures, $ millions unless noted (release, statement of income / cash flows / balance sheet)
REV, REV0, OI, OI0, NI, NI0 = 115844, 57006, 77520, 36010, 65287, 31910
OCF, AR_CHG, AR, INV, BUY, DIV, DIV0 = 48253, 18052, 81033, 39724, 22122, 6026, 243
GUIDE_Q3, GUIDE_Q4 = 108000, 130000

SOURCES = {
    REL: ["the third quarter ended October 25, 2026, of $115.8 billion",
          "Revenue | $ | 115,844 | $ | 57,006", "Operating income | 77,520 | 36,010",
          "Net income | $ | 65,287 | $ | 31,910", "Diluted | $ | 2.70 | $ | 1.30",
          "Non-GAAP* | $ | 2.68 | $ | 2.22 | $ | 1.27",
          "GAAP gross margin | 74.8 | % | 75.0 | % | 73.4 | %",
          "Revenue | $115.8 | $96.2 | $57.0 | 20 | % | 103 | %",
          "Operating income | $77.5 | $63.7 | $36.0 | 22 | % | 115 | %",
          "Net income | $65.3 | $59.7 | $31.9 | 9 | % | 105 | %",
          "Diluted earnings per share | $2.70 | $2.46 | $1.30 | 10 | % | 108 | %",
          "Diluted earnings per share | $2.68 | $2.22 | $1.27 | 21 | % | 111 | %",
          "Gross margin | 74.8 | % | 75.0 | % | 73.4 | % | (0.2) pts | 1.4 pts",
          "NVIDIA’s outlook for the fourth quarter of fiscal 2027, which includes an additional week, is as follows",
          "Revenue is expected to be $130.0 billion, plus or minus 3%. NVIDIA is not assuming any Data Center compute revenue from China in its outlook.",
          "GAAP and non-GAAP gross margins are expected to be between 71.0% and 72.0%.",
          "Beginning in the first quarter of fiscal 2027, NVIDIA’s non-GAAP financial measures no longer exclude stock-based compensation expense.",
          "Gains from equity securities, net | (1,767)",
          "Net cash provided by operating activities | 48,253 | 23,750",
          "Accounts receivable | (18,052)", "Accounts receivable, net | 81,033 | 38,466",
          "Payments related to repurchases of common stock | (22,122) | (12,456)",
          "Dividends paid | (6,026) | (243)",
          "NVIDIA returned $28.1 billion to shareholders in the form of shares repurchased and cash dividends",
          "NVIDIA will pay its next quarterly cash dividend of $0.25 per share",
          "the ongoing investigation by an independent committee of NVIDIA’s board of directors"],
    CFO: ["Data Center | $107.6 | $89.0 | $51.2 | 21 | % | 110 | %",
          "Hyperscale | 60.1 | 48.7 | 35.1 | 23 | % | 71 | %",
          "AI Clouds, Industrial, & Enterprise | 47.5 | 40.3 | 16.1 | 18 | % | 195 | %",
          "Edge Computing | 8.2 | 7.2 | 5.8 | 14 | % | 42 | %",
          "driven by the introduction of our Rubin infrastructure, our fastest architecture ramp ever, standalone Vera CPUs and the continued growth of Blackwell Ultra",
          "Shipments of Data Center Hopper products to China during the quarter were $2.4 billion.",
          "Net gains from equity securities for the third quarter were $1.8 billion",
          "Our supply commitments increased from $279 billion last quarter to $390 billion, primarily related to the multi-year procurement of memory supply.",
          "driven by shipment linearity from our Rubin launch and extended payment terms on large, multi-quarter agreements with certain investment-grade customers",
          "Inventory was $39.7 billion, up from $31.6 billion sequentially, to support our Rubin product ramp.",
          "we may be required to make payments to third parties if certain of our partners default on their obligations",
          "Total | $ | 118.0", "SB Energy Corp. credit support guarantees | 105.0",
          "PORTS-Pike Technology Campus in Ohio, which will exclusively host NVIDIA infrastructure under 20-year leases to OpenAI",
          "up to a maximum of $105 billion", "To date, we have not made any payments related to our guarantees."],
    Q2: ["Revenue is expected to be $108.0 billion, plus or minus 2%."],
    K8: ["On November 11, 2026, the Board of Directors, or the Board, of NVIDIA Corporation accepted the resignation of Jen-Hsun Huang, as NVIDIA’s President, Chief Executive Officer and member of the Board, effective immediately.",
         "Ms. Kress has served as NVIDIA’s Executive Vice President and Chief Financial Officer since 2013",
         "Mr. Jones has served on the Board since 1993"],
    PR: ["Harvey C. Jones Appointed First-Ever Chair of the Board", "November 12, 2026"],
    BOARD: ["November 8, 2026",
            "The NVIDIA Board is initiating an independent investigation in light of recent reporting that founder and CEO Jensen Huang has been the target of a foreign intelligence effort.",
            "A committee of independent directors, assisted by outside independent counsel, will oversee the investigation.",
            "While the Board has no reason to believe that either national security or NVIDIA secrets were compromised"],
    HUANG: ["I have made serious mistakes in my personal life.",
            "I would be honored to answer these calls and return as CEO"],
    CNBC: ["co-founder Jensen Huang", "EPS: $2.68 adjusted vs. $2.48 expected",
           "Revenue: $115.84 billion vs. $109.10 billion expected",
           "topping the $125.1 billion average analyst estimate, according to LSEG",
           "whether Nvidia would scrap a previous forecast for 70% growth in the fiscal year ending in January 2028. However, Kress raised guidance, saying that Nvidia now expects 75% growth."],
    NOV18: ["said on the earnings call that the board does not intend to reinstate him as CEO"],
    NBC: ["does not intend to reinstate"],
    FOOL: ["closed at $150.96, down 2.89%",
           "investors are now watching succession uncertainty and China-related regulatory scrutiny"],
    REUTERS: ["Nov 20 (Reuters) - The US Securities and Exchange Commission is probing Nvidia's",
              "said two people briefed on the matter",
              "The Wall Street Journal on Tuesday reported that the SEC was probing Nvidia",
              "SEC enforcement staff are scrutinizing potential accounting issues at the company",
              "A spokesperson for the SEC declined to comment. Spokespeople for Nvidia did not immediately respond",
              "Reuters could not immediately determine when the SEC opened its inquiry or exactly what potential accounting issues the watchdog is examining",
              "Investigations are not evidence of wrongdoing"],
}


def norm(s: str) -> str:
    s = s.replace("\\\"", '"')
    s = re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"')
    return s.replace("�", " ").replace("–", " ").replace("  ", " ")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("NVDA")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    # the quarter table: each change recomputed from $ millions
    assert round(pct(REV, REV0)) == 103 and round(pct(OI, OI0)) == 115 and round(pct(NI, NI0)) == 105
    assert round(pct(2.70, 1.30)) == 108 and round(pct(2.68, 1.27)) == 111
    for row in ["| Revenue | $115.8B | $57.0B | +103% |", "| Gross margin | 74.8% | 73.4% | +1.4 points |",
                "| Operating income | $77.5B | $36.0B | +115% |", "| Net income | $65.3B | $31.9B | +105% |",
                "| Earnings per share | $2.70 | $1.30 | +108% |",
                "| Adjusted earnings per share | $2.68 | $1.27 | +111% |",
                "| Data centres | $107.6B | $51.2B | +110% |",
                "| of which the largest cloud companies | $60.1B | $35.1B | +71% |",
                "| of which other AI clouds, industry and business | $47.5B | $16.1B | +195% |",
                "| Edge computing (PCs, robots, cars) | $8.2B | $5.8B | +42% |"]:
        need(f"t {row}", row)
    need("adj", "This quarter it was slightly lower, because it leaves out a $1.8 billion net gain")
    need("china", "It shipped $2.4 billion of its Hopper data-centre chips to China in the quarter")
    need("s rev", "**Revenue:** $115.8 billion, up 103% from $57.0 billion a year earlier")
    need("s dc", "**Data centres:** $107.6 billion of it, up 110%")
    need("s fc", "**The forecast:** about $130 billion for the quarter to January")
    need("s ceo", "resigned as chief executive on 12 November")

    # the beat against Nvidia's own August forecast
    beat, top = REV - GUIDE_Q3, GUIDE_Q3 * 1.02
    assert round(beat / 1000, 1) == 7.8 and round(pct(REV, GUIDE_Q3), 1) == 7.3 and round((REV - top) / 1000, 1) == 5.7
    need("s beat", f"${beat / 1000:.1f} billion above the middle of Nvidia's own forecast")
    need("beat", f"In August Nvidia forecast revenue of $108.0 billion, plus or minus 2%, for this quarter. It reported $115.8 billion, ${beat / 1000:.1f} billion or {pct(REV, GUIDE_Q3):.1f}% above the middle, and ${(REV - top) / 1000:.1f} billion above the top of the range")
    need("est", "Analysts had expected adjusted earnings per share of $2.48 and revenue of $109.10 billion, according to LSEG data reported by CNBC")

    # the extra week: Q3 ran 27 Jul - 25 Oct 2026 (91 days, 13 weeks); Q4 "includes an additional week" (14)
    import datetime as dt
    assert (dt.date(2026, 10, 25) - dt.date(2026, 7, 26)).days == 91
    wk3, wk4 = REV / 13, GUIDE_Q4 / 14
    assert round(pct(GUIDE_Q4, REV), 1) == 12.2 and round(pct(wk4, wk3), 1) == 4.2
    need("fc", f"Nvidia expects revenue of $130.0 billion, plus or minus 3%, for the quarter to January, against $125.1 billion that analysts had expected, CNBC reported. That is {pct(GUIDE_Q4, REV):.1f}% more than this quarter")
    need("week", f"14 weeks, against 13 in the quarter just reported. Per week, $130.0 billion is about ${wk4 / 1000:.2f} billion, against about ${wk3 / 1000:.2f} billion this quarter, a rise of {pct(wk4, wk3):.1f}%")
    need("gm", "to fall to between 71.0% and 72.0%, from 74.8%")
    need("2028", "Nvidia expects revenue to grow 75% in the year to January 2028, up from the 70% it had forecast before, CNBC reported")

    # the change of chief executive
    need("board", "On 8 November Nvidia's board said")
    need("resign", "the board accepted Huang's resignation as president, chief executive and director on 11 November")
    need("kress", "which she has held since 2013, and appointed Harvey C. Jones, a director since 1993, as its first chair")
    need("huang", "In a statement reported by CNBC on 17 November")

    # cash, working capital, commitments, returns
    assert round(AR_CHG / 1000, 1) == 18.1 and round(AR / 1000, 1) == 81.0 and round(INV / 1000, 1) == 39.7
    assert NI - OCF < AR_CHG  # the rise in receivables is bigger than the whole gap, so "the biggest part" holds
    need("ocf", "Nvidia generated $48.3 billion of cash from operations in the quarter, less than its $65.3 billion of net income")
    need("ar", "what customers owe it rose $18.1 billion in the quarter, to $81.0 billion")
    need("inv", "Its stock of unsold chips and parts rose to $39.7 billion, from $31.6 billion three months earlier")
    need("supply", "$390 billion of commitments to buy parts and capacity, up from $279 billion three months earlier")
    need("guar", "up to $118.0 billion that Nvidia may have to pay")
    need("sb", "Most of it, up to $105.0 billion, backs the building of data centres in Ohio")
    assert round((BUY + DIV) / 1000, 1) == 28.1
    need("ret", f"It returned $28.1 billion to shareholders in the quarter: ${BUY / 1000:.1f} billion buying back its own shares and ${DIV / 1000:.1f} billion in dividends, against ${DIV0} million in dividends a year earlier. It pays $0.25 a share each quarter")
    need("next fc", "Whether revenue for the quarter to January lands between $126.1 billion and $133.9 billion")
    assert (round(130 * .97, 1), round(130 * 1.03, 1)) == (126.1, 133.9)
    need("next gm", "Whether the gross margin lands between 71.0% and 72.0%")

    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2016", "2025", "2026", "2027", "2028", "1999", "17", "18", "25", "31"}
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
    with open(SRC / "nasdaq-hist-NVDA-20261121.csv", encoding="utf-8") as fh:
        lines = list(fh)
    meta = lines[0]
    nq = {r["date"]: r for r in csv.DictReader(x for x in lines if not x.startswith("#"))}
    c = {k: float(v["close"]) for k, v in nq.items()}
    # no dividend went ex between 6 October and 18 November, so the adjusted and traded closes agree there
    for d_ in ["11/18/2026", "11/17/2026", "11/06/2026", "10/06/2026"]:
        iso = f"{d_[6:]}-{d_[:2]}-{d_[3:5]}"
        assert abs(adj[iso] - c[d_]) < 0.006, (iso, adj[iso], c[d_])
    assert "max_close_in_window = 10/06/2026 239.24" in meta and f["ath_date"] == "2026-10-06"
    c17, c18, c06, rec, ye = c["11/17/2026"], c["11/18/2026"], c["11/06/2026"], c["10/06/2026"], c["12/31/2025"]
    mv = pct(c18, c17)
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    assert this["release"] == "2026-11-17" and (this["from"], this["to"]) == ("2026-11-17", "2026-11-18")
    assert abs(this["move"] - mv) < 1e-3 and f["as_of"] == "2026-11-18"
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    sx = {r[0]: float(r[3]) for r in full["^GSPC"]}
    nx = {r[0]: float(r[3]) for r in full["^IXIC"]}
    spx, ndq = pct(sx["2026-11-18"], sx["2026-11-17"]), pct(nx["2026-11-18"], nx["2026-11-17"])
    assert spx < 0 < ndq
    c13, c19, c20 = c["11/13/2026"], c["11/19/2026"], c["11/20/2026"]
    need("answer", f"Its shares still fell {abs(mv):.1f}% the next day, its first results since Jensen Huang resigned as chief executive. On 20 November, the day Reuters reported that the SEC is examining Nvidia's accounting, they fell {abs(pct(c20, c19)):.1f}%, leaving them {abs(pct(c20, rec)):.1f}% below their October record")
    need("s since", f"**Since then:** down {abs(pct(c20, c19)):.1f}% on 20 November, the day Reuters reported that the US markets regulator is examining Nvidia's accounting. That left the shares {abs(pct(c20, rec)):.1f}% below their October record")
    need("sec 1", "On 17 November, the day of the results, The Wall Street Journal reported that the US Securities and Exchange Commission, the country's markets regulator, was investigating Nvidia, Reuters reported. On 20 November Reuters reported, citing two people briefed on the matter")
    need("sec days", f"Nvidia closed at ${c19:.2f} on 19 November, down {abs(pct(c19, c18)):.1f}%, and at ${c20:.2f} on 20 November, down {abs(pct(c20, c19)):.1f}%. Over the week it fell {abs(pct(c20, c13)):.1f}%, from ${c13:.2f} on 13 November")
    # "worst week since October 2008": Friday-to-Friday closes (last close of each week) in our dividend-adjusted
    # history, frozen to 18 Nov; this week's fall is from Nasdaq's traded closes (no dividend went ex in between)
    import datetime as dt
    wk: dict = {}
    for d_, v in zip(f["full_dates"], f["full_closes"]):
        wk[dt.date.fromisoformat(d_).isocalendar()[:2]] = (d_, v)
    ws = sorted(wk.values())
    rets = [(ws[i][0], pct(ws[i][1], ws[i - 1][1])) for i in range(1, len(ws))]
    this_week = pct(c20, c13)
    worse = [(d_, r) for d_, r in rets if r <= this_week]
    assert worse and worse[-1][0] == "2008-10-10", worse[-3:]
    need("worst", "its worst week since October 2008 in our price history")
    need("now", f"It is now {abs(pct(c20, rec)):.1f}% below its October record, and down {abs(pct(c20, ye)):.1f}% since the end of 2025")
    need("s move", f"**The shares:** down {abs(mv):.1f}% on 18 November, to ${c18:.2f}, after opening higher")
    r18 = nq["11/18/2026"]
    need("day", f"Nvidia closed at ${c17:.2f} on 17 November. On 18 November it opened at ${float(r18['open']):.2f}, up {pct(float(r18['open']), c17):.1f}%, then fell as low as ${float(r18['low']):.2f} and closed at ${c18:.2f}, down {abs(mv):.1f}%. The S&P 500 fell {abs(spx):.1f}% and the Nasdaq Composite rose {ndq:.1f}% the same day")
    need("since", f"Nvidia closed at ${c06:.2f} on 6 November, the last trading day before the board's statement. By the close on 18 November it had fallen {abs(pct(c18, c06)):.1f}% since then, was {abs(pct(c18, rec)):.1f}% below its record close of ${rec:.2f}, set on 6 October 2026, and was down {abs(pct(c18, ye)):.1f}% since the end of 2025")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 43 and before[0]["release"] == "2016-02-17" and before[-1]["release"] == "2026-08-26"
    assert not any(r["release"] in ("2019-01-28", "2022-08-08") for r in rx)
    need("rx n", f"We measured all {n} of Nvidia's results releases before this one, from February 2016 to August 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    o5, o10 = sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)
    need("rx 5", f"{o5} of the {n} moved the shares by 5% or more, and {o10} by 10% or more")
    assert all(v != 0 for v in m)
    need("rx ud", f"The shares rose after {sum(v > 0 for v in m)} and fell after {sum(v < 0 for v in m)}")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2018-11-15" and b["release"] == "2016-11-10"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in November 2018")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in November 2016")
    assert abs(mv) < statistics.median(abs(v) for v in m)
    need("small", f"So a {abs(mv):.1f}% fall is a small move for Nvidia on a results day")
    falls = f["big_falls"]
    assert len(falls) == 7 and f["fall_threshold"] == -50 and f["first_bar"] == "1999-01-22"
    need("falls n", "Nvidia's shares have fallen 50% or more seven times since 1999")
    for e in falls:
        rec_ = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {rec_} |")
    assert all(e["recovery_date"] for e in falls)
    mon = lambda a, b: (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])  # noqa: E731
    slow = max(falls, key=lambda e: mon(e["peak_date"], e["recovery_date"]))
    assert slow["peak_date"][:4] == "2007" and mon(slow["peak_date"], slow["recovery_date"]) == 102  # 8.5 years
    cur, least = abs(pct(c20, rec)), min(abs(e["depth_pct"]) for e in falls)
    assert cur < least and least - cur < 5  # "but only just"
    need("back", f"All seven got back to their record. The slowest, the fall that began in 2007, took eight and a half years. The current fall, {cur:.1f}% from the October record at the close on 20 November, is still smaller than any of them, but only just: the smallest of the seven was {least:.1f}%")


if __name__ == "__main__":
    main()
