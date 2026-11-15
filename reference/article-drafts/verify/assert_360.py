"""Assert every figure and quote in draft 28 (Life360, third quarter 2026) against its source.

Same method as assert_xro.py:
  * SOURCE  — every raw number and phrase taken from Life360 must appear, as written, in the saved document it is
    attributed to (results release, second-quarter release, Form 10-Q), read with `pdftotext -raw` so table rows
    stay in order; the results call as MarketBeat reported it; the brokers and the closes as IBTimes reported them;
  * DERIVED — every comparison is recomputed here from those raw numbers (the revenue table's changes, the guidance
    mid-point, operating expenses as a share of revenue);
  * MEASURED — share-price history from `earn_figures.figures()` (frozen data; Life360 pays no dividend, so the
    stored closes are traded closes), and the 13 November close is checked against the ASX's own quote;
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_360.py
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
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-360-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "28-life360-q3-2026-results.md"
SRC = ROOT / "360-2026-q3" / "sources"
REL, Q2, TENQ, MB, IBT = ("q3-release.raw.txt", "q2-release.raw.txt", "form-10q.raw.txt", "call-marketbeat.txt",
                          "news-ibtimes.txt")

# --- REPORTED, US$ thousands, three months to 30 September (results release, condensed statements) ---
REV26 = {"sub": 124193, "hw": 8996, "ad": None, "other": 15500, "total": 174137}
REV25 = {"sub": 96300, "hw": 11312, "ad": None, "other": 9614, "total": 124497}
REV26["ad"] = REV26["total"] - REV26["sub"] - REV26["hw"] - REV26["other"]
REV25["ad"] = REV25["total"] - REV25["sub"] - REV25["hw"] - REV25["other"]
NI26, NI25, GAIN, ADJ26, ADJ25 = 22490, 9793, 17454, 34609, 24485
OPEX26, OPEX25 = 126020, 91444
SOURCES = {
    REL: ["Total revenue grew 40% year-over-year to $174.1 million",
          "Record third quarter global net Paying Circle additions of 188 thousand, reaching 3.4 million",
          "Subscription revenue $ 124.2 $ 96.3 $ 348.0 $ 266.8", "Hardware revenue 9.0 11.3 23.3 32.5",
          "Advertising revenue13 25.4 7.3 67.1 17.1", "Other revenue 15.5 9.6 37.8 27.1",
          "Total revenue $ 174.1 $ 124.5 $ 476.2 $ 343.5",
          "Subscription revenue $ 124,193 $ 96,300 $ 348,023 $ 266,756", "Hardware revenue 8,996 11,312 23,328 32,485",
          "Other revenue 15,500 9,614 37,793 27,119", "Total revenue 174,137 124,497 476,219 343,502",
          "Advertising revenue of $25.4 million, up 250% YoY",
          "Net income of $22.5 million, up 130% YoY including a $17.5 million net gain on the fair value of investments",
          "Net income $ 22,490 $ 9,793 $ 30,330 $ 21,177",
          "Adjusted EBITDA $ 34,609 $ 24,485 $ 82,821 $ 60,766", "Adjusted EBITDA margin 20 % 20 % 17 % 18 %",
          "Adjusted EBITDA2 of $34.6 million, an increase of 41% from $24.5 million in Q3'25",
          "we generated operating cash flows of $27.2 million, up 3% year-over-year",
          "was lower than Adjusted EBITDA of $34.6 million primarily due to the timing of receipts and payables",
          "We ended Q3'26 with $465.0 million in cash, cash equivalents, restricted cash, and short-term investments",
          "Global MAU net additions of 5.3 million in Q3'26 lifted total MAU to approximately 107.7 million, up 17%",
          "U.S. 55.8 54.0 48.7 3 % 14 %", "International 51.9 48.4 42.9 7 % 21 %",
          "international Monthly Active Users (MAU) crossing over the 50 million mark",
          "Global Paying Circle net additions totaled 188 thousand. Total Paying Circles grew 26% YoY to 3.4 million",
          "highest-ever net Paying Circle additions for a third quarter",
          "Average Revenue Per Paying Circle (ARPPC) increased 4% YoY primarily due to a shift in product mix toward higher-priced offerings and the early impact of U.S. price increases",
          "primarily driven by growth in managed advertising revenue15 following the acquisition of Nativo",
          "Q3'26 hardware revenue decreased 20% YoY", "strategic exit of our brick-and-mortar retail channel",
          "Gross Margin 77 % 78 % 78 % 79 %",
          "primarily due to lower advertising gross margin driven by a shift in margin mix",
          "Total operating expenses 126,020 91,444 371,620 261,313",
          "Q3'26 operating expenses increased 38% YoY",
          "Operating expenses as a percentage of revenue decreased to 72% from 73%",
          "announcement of our share repurchase program in May 2026",
          "aggregate purchase consideration of $44.4 million, leaving approximately $180.6 million",
          "approved multi-year $225.0 million share repurchase program",
          "MAU growth of 17% to 20% (unchanged)",
          "Consolidated revenue of $665 million to $681 million (YoY growth of 36% to 39%), increased from $650 million to $685 million",
          "Subscription revenue of $483 million to $488 million, increased from $475 million to $480 million",
          "Advertising revenue of $98 million to $102 million, narrowed from $98 million to $115 million",
          "Adjusted EBITDA2 of $132 million to $138 million, narrowed from $130 million to $140 million",
          "A Paying Circle is defined as a group of Life360 members with a paying subscription",
          "Gain on change in fair value of investments17 (17,454) (821) (12,727) (2,090)",
          "Stock-based compensation 20,150 14,866 59,226 39,985",
          "Life360 Chief Executive Officer Lauren Antonoff", "said Chief Financial Officer Russell Burke"],
    Q2: ["Total Revenue Grew 38% Year-Over-Year to $159.0 million",
         "Advertising revenue of $98 million to $115 million (unchanged)"],
    TENQ: ["On November 9, 2025, the Company entered into an Agreement and Plan of Reorganization with Nativo, Inc.",
           "Nativo is an advertising technology company",
           "The transaction closed on January 2, 2026",
           "The total consideration was $104.0 million, consisting of approximately $75.9 million in cash and $28.0 million in common stock"],
    MB: ["Antonoff said the company paused programmatic advertising for a period during the third quarter while it improved ad quality",
         "By the time Life360 had combined the sales efforts, it was late to secure some 2026 advertising budgets",
         "Antonoff said the company expects stronger advertising growth in 2027",
         "Burke said U.S. net paying-circle additions in the fourth quarter are likely to be about half what they otherwise would have been, largely because of a one-time churn event",
         "the company anticipates a return to normal growth in the first quarter of 2027",
         "Antonoff said Life360 continues to trend toward the lower end of its 17% to 20% annual growth outlook"],
    IBT: ["BofA Securities downgraded the Nasdaq-listed shares to Neutral from Buy",
          "Macquarie also downgraded the stock to Neutral on Wednesday morning",
          "Other analysts said the sell-off was overdone",
          "Adjusted earnings per share were 38 U.S. cents, compared with Wall Street forecasts of about 24 cents",
          "The rebound followed a 15.3% drop on Tuesday, when the shares closed at A$18.91",
          "Life360 shares rose A$1.90, or 10.05%, to A$20.81"],
}


def norm(s: str) -> str:
    s = s.replace("\\\"", '"')
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def m1(x: int) -> str:
    return f"{x / 1000:.1f}M"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("360.AX")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    # DERIVED: the revenue table (thousands -> one decimal of a million; change from the thousands)
    assert REV26["ad"] == 25448 and REV25["ad"] == 7271, (REV26["ad"], REV25["ad"])
    for lbl, k, g in [("Subscription revenue", "sub", "+29%"), ("Advertising revenue", "ad", "+250%"),
                      ("Hardware revenue", "hw", "−20%"), ("Other revenue", "other", "+61%")]:
        ch = pct(REV26[k], REV25[k])
        assert f"{'+' if ch > 0 else '−'}{abs(round(ch))}%" == g, (k, ch)
        need(f"rev row {k}", f"| {lbl} | {m1(REV25[k])} | {m1(REV26[k])} | {g} |")
    assert round(pct(REV26["total"], REV25["total"])) == 40
    need("rev total", f"| **Total revenue** | **{m1(REV25['total'])}** | **{m1(REV26['total'])}** | **+40%** |")
    assert round(pct(NI26, NI25)) == 130 and round(pct(ADJ26, ADJ25)) == 41
    assert round(OPEX26 / REV26["total"] * 100) == 72 and round(OPEX25 / REV25["total"] * 100) == 73
    assert round(pct(OPEX26, OPEX25)) == 38
    assert (132 + 138) / 2 == (130 + 140) / 2 == 135
    need("answer", "Life360's revenue rose 40% to US$174.1 million in the September 2026 quarter, and it added a record 188,000 Paying Circles for a third quarter")
    need("short rev", "US$174.1 million, up 40%, a little faster than the 38% of the quarter before")
    need("short mau", "107.7 million, up 17%, after adding 5.3 million in the quarter")
    need("short pc", "3.4 million, up 26%, after a record 188,000 net additions for a third quarter")
    need("short ni", "US$22.5 million, up 130%, including a US$17.5 million gain on the value of investments")
    need("short guide", "revenue for 2026 now expected to be US$665 million to US$681 million, from US$650 million to US$685 million; advertising revenue US$98 million to US$102 million, from US$98 million to US$115 million")
    need("pc growth", "Paying Circles grew 26% and the average revenue from each rose 4%")
    need("nativo", "Nativo, an advertising technology company, for US$104.0 million in cash and shares. The deal was agreed in November 2025 and completed on 2 January 2026")
    need("users", "Life360 had 55.8 million monthly active users in the US and 51.9 million outside it, the first time its international users have passed 50 million")
    need("ni", f"Net income was US$22.5 million, up from US${NI25 / 1000:.1f} million a year earlier. US${GAIN / 1000:.1f} million of it was a net gain")
    need("adj", "Life360 earned US$34.6 million, up 41%, a margin of 20%")
    need("ocf", "Cash from operations rose 3% to US$27.2 million, below adjusted EBITDA")
    need("cash", "It ended the quarter with US$465.0 million of cash and short-term investments")
    need("gm", "Gross margin slipped from 78% to 77%")
    need("opex", "Operating expenses rose 38%, a little slower than revenue, so they fell from 73% of revenue to 72%")
    need("bb", "Since it announced a US$225 million program in May 2026, it has bought back US$44.4 million worth, leaving US$180.6 million")
    need("eps", "adjusted earnings per share of 38 US cents against about 24 cents expected, IBTimes reported")
    need("g rev", "| Total revenue | 650M to 685M | 665M to 681M |")
    need("g sub", "| Subscription revenue | 475M to 480M | 483M to 488M |")
    need("g ad", "| Advertising revenue | 98M to 115M | 98M to 102M |")
    need("g adj", "| Adjusted EBITDA | 130M to 140M | 132M to 138M |")
    need("g mid", "the middle of the adjusted EBITDA range stayed at US$135 million")
    need("g top", "the top of its range fell from US$115 million to US$102 million")
    need("call ad", "Lauren Antonoff said Life360 had paused programmatic advertising for a period in the quarter while it improved ad quality")
    need("call ad 2027", "She said Life360 expects stronger advertising growth in 2027")
    need("call q4", "finance chief Russell Burke said US Paying Circle net additions in the fourth quarter were likely to be about half what they otherwise would have been")
    need("call q1", "Life360 expects growth to return to normal in the first quarter of 2027")
    need("call mau", "user growth was heading towards the lower end of Life360's forecast of 17% to 20% for the year")
    need("brokers", "Bank of America and Macquarie each cut their rating on the shares to neutral, IBTimes reported")
    need("next ad", "Whether it lands within the US$98 million to US$102 million Life360 now expects for 2026")

    if "MOVE_" in raw or "PENDING" in raw:
        bad.append(("placeholder", "placeholders still in the draft"))
    else:
        measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2019", "2020", "2021", "2022", "2024", "2025", "2026", "2027", "30", "3", "9", "10", "11", "12", "13",
               "1", "2", "8"}
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
    dmy = lambda d: f"{int(d[8:])} {MON[int(d[5:7]) - 1]} {d[:4]}"  # noqa: E731
    d, c = f["full_dates"], dict(zip(f["full_dates"], f["full_closes"]))
    hdr = json.loads((SRC / "asx-quote-header.json").read_text(encoding="utf-8"))["data"]
    assert d[-1] == "2026-11-13" and abs(c["2026-11-13"] - hdr["priceLast"]) < 0.006
    assert hdr["dateListed"] == "2019-05-10" == f["first_bar"]
    c09, c10, c11, c13 = c["2026-11-09"], c["2026-11-10"], c["2026-11-11"], c["2026-11-13"]
    mv = pct(c10, c09)
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    assert this["release"] == "2026-11-10" and abs(this["move"] - mv) < 1e-9
    assert round(abs(mv), 1) == 15.3 and round(c10, 2) == 18.91 and round(c11, 2) == 20.81  # = IBTimes
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    x = {r[0]: float(r[3]) for r in full["^AXJO"]}
    xjo = pct(x["2026-11-10"], x["2026-11-09"])
    need("answer move", f"its ASX shares fell {abs(mv):.1f}% on results day, their fifth such fall in a row")
    need("short move", f"down {abs(mv):.1f}% on results day on the ASX, to A${c10:.2f}, and up {pct(c11, c10):.1f}% the next day")
    need("day", f"Life360's ASX shares closed at A${c09:.2f} on 9 November. On 10 November, results day, they closed at A${c10:.2f}, down {abs(mv):.1f}%. The ASX 200 rose {xjo:.1f}% the same day. On 11 November they rose {pct(c11, c10):.1f}% to A${c11:.2f}, and they closed at A${c13:.2f} on 13 November")
    # The streak: the last five results days all fell; the one before them rose.
    last5 = rx[-5:]
    assert all(r["move"] < 0 for r in last5) and rx[-6]["move"] > 0
    for r in last5:
        need(f"streak {r['release']}", f"| {dmy(r['release'])} | A${c[r['from']]:.2f} | A${c[r['to']]:.2f} | −{abs(r['move']):.1f}% |")
    first19 = rx[:-5]
    assert len(first19) == 19
    need("before run", f"the shares had risen on results day {sum(r['move'] > 0 for r in first19)} times in {len(first19)}")
    # Results-day history (the 23 before this one)
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 23 and before[0]["release"] == "2019-08-22" and before[-1]["release"] == "2026-08-11"
    need("rx n", f"We measured all {n} of Life360's results from August 2019, its first after it listed on the ASX in May 2019, to August 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    o5, o10 = sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)
    assert (o5, o10) == (19, 10)
    need("rx 5", f"Nineteen of the {n} moved the shares 5% or more, and ten 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2022-02-24" and b["release"] == "2024-03-01"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in February 2022")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in March 2024")
    assert all(v != 0 for v in m)
    need("rx updown", f"The shares rose on {sum(v > 0 for v in m)} of the {n} days and fell on {sum(v < 0 for v in m)}")
    further = sum(abs(v) > abs(mv) for v in m)
    assert abs(mv) > statistics.median(abs(v) for v in m)
    need("bigger", f"So a {abs(mv):.1f}% fall was a big move even for Life360: {words(further)} of the {n} earlier results moved the shares more")
    rank = sorted(r["move"] for r in rx).index(this["move"]) + 1
    assert rank == 4
    need("rank", "Counting this one, it was its fourth-largest results-day fall")
    # Half-yearly until Feb 2022, quarterly from Aug 2022 (the release list in earn_figures.RELEASES).
    rel = [r["release"] for r in rx]
    assert rel[5] == "2022-02-24" and rel[6] == "2022-08-16"
    # The fall
    assert f["ath_date"] == "2025-10-03" and round(c["2025-10-03"], 2) == 55.44
    lo, lo_d = min((c[x_], x_) for x_ in d if x_ > "2025-10-03")
    assert lo_d == "2026-04-13" and round(lo, 2) == 17.91
    need("record", f"Life360's record close on the ASX was A${c['2025-10-03']:.2f} on 3 October 2025")
    need("fall", f"From there the shares fell {abs(pct(lo, c['2025-10-03'])):.1f}% to A${lo:.2f} on 13 April 2026, their lowest close since")
    need("since low", f"On 13 November they were {pct(c13, lo):.1f}% above that low, but still {abs(f['below_ath']):.1f}% below the record, and down {abs(f['ytd']):.1f}% since the start of 2026")
    falls = f["big_falls"]
    assert len(falls) == 6 and f["fall_threshold"] == -15 and falls[0]["peak_date"] == f["first_bar"]
    need("falls n", "Life360's shares have fallen 15% or more six times since they listed on the ASX in May 2019")
    for k, e in enumerate(falls):
        rec = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        frm = f"{my(e['peak_date'])} (its first day)" if k == 0 else my(e["peak_date"])
        need(f"fall {e['peak_date']}", f"| {frm} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {rec} |")
    done = [e for e in falls if e["recovery_date"]]
    mon = lambda a, b: (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])  # noqa: E731
    slow = max(done, key=lambda e: mon(e["trough_date"], e["recovery_date"]))
    assert len(done) == 5 and slow["trough_date"] == "2022-06-23" and mon(slow["trough_date"], slow["recovery_date"]) == 22
    need("falls back", "The five earlier falls all got back to where they started, the slowest about 22 months after its low")
    deep = min(falls, key=lambda e: e["depth_pct"])
    need("deepest", f"The deepest, {abs(deep['depth_pct']):.1f}%, took from November 2021 to April 2024 to recover")


def words(k: int) -> str:
    return "zero one two three four five six seven eight nine ten".split()[k]


if __name__ == "__main__":
    main()
