"""Assert every figure and quote in draft 35 (Palo Alto Networks, first quarter of fiscal 2027) against its source.

Same method as assert_csco.py:
  * SOURCE  — every raw number and phrase taken from Palo Alto Networks must appear, as written, in the saved
    document it is attributed to (the Q1 FY27 and Q4 FY26 releases, the Applied Compute announcement, the Form 10-K),
    the results call as TradingKey transcribed it, CNBC and Reuters;
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen: the reactions, the falls) and the traded
    closes from Nasdaq's saved history;
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_panw.py
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
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-panw-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "35-palo-alto-networks-q1-fy27-results.md"
SRC = ROOT / "earn-2026-nov-b" / "panw"
REL, Q4, PRESS, TENK, CALL, CNBC, REUT = ("q1-release.txt", "q4-release.txt", "nov-press.txt", "form-10k.txt",
                                          "call-tradingkey.txt", "news-cnbc.txt", "news-reuters.txt")
NASDAQ = "nasdaq-hist-PANW-20261120.csv"

REV, REV0, GP, GP0, OI, OI0, NI, NI0 = 3445, 2474, 2342, 1836, 96, 309, 482, 334
SOURCES = {
    REL: ["Total revenue | 3,445 | 2,474", "Total gross profit | 2,342 | 1,836", "Operating income | 96 | 309",
          "Income before income taxes | 25 | 412", "Provision for (benefit from) income taxes | (457) | 78",
          "Net income | $ | 482 | $ | 334", "Net income per share, diluted | $ | 0.57 | $ | 0.47",
          "Weighted-average shares used to compute net income per share, diluted | 838 | 709",
          "Share-based compensation-related charges | 622 | 387",
          "Amortization expense of acquired intangible assets | 282 | 39",
          "Share-based compensation-related charges | 0.74 | 0.53",
          "Amortization expense of acquired intangible assets | 0.34 | 0.06",
          "Income tax and other tax adjustments(4) | (0.84) | (0.15)",
          "Non-GAAP net income per share, diluted | $ | 1.05 | $ | 0.93",
          "a one-time tax adjustment relating to a change in our tax position on a historical transaction",
          "Next-Generation Security ARR for the fiscal first quarter 2027 grew 66% year over year to $9.73 billion",
          "Remaining performance obligations grew 35% year over year to $21.0 billion",
          "Net cash provided by operating activities | $ | 1,929 | $ | 1,771",
          "Adjusted free cash flow (non-GAAP) | $ | 1,937 | $ | 1,713",
          "Adjusted free cash flow margin (non-GAAP) | 56.2 | % | 69.2 | %",
          "Total revenue in the range of $14.52 billion to $14.57 billion",
          "Diluted non-GAAP net income per share in the range of $4.26 to $4.30",
          "Next-Generation Security ARR of $11.475 billion to $11.525 billion",
          "Total revenue in the range of $3.530 billion to $3.550 billion",
          "Diluted non-GAAP net income per share in the range of $1.01 to $1.03",
          "Given the current threat environment and demand we see ahead of us, we are materially raising our full year guidance",
          "fiscal first quarter ended October 31, 2026"],
    Q4: ["Total revenue in the range of $3.300 billion to $3.310 billion",
         "Total revenue in the range of $14.10 billion to $14.20 billion",
         "Diluted non-GAAP net income per share in the range of $4.16 to $4.19",
         "Next-Generation Security ARR of $11.075 billion to $11.175 billion"],
    PRESS: ["The all-stock transaction is valued at $4.5 billion", "including regulatory clearance",
            "expected to close in Palo Alto Networks' fiscal third quarter of 2027",
            "Yash Patil, Applied Compute's co-founder and CEO, will become Palo Alto Networks' Co-Chief AI Officer"],
    TENK: ["On January 29, 2026, we completed our acquisition of Chronosphere",
           "The total purchase consideration for the acquisition of Chronosphere was $3.0 billion",
           "on February 11, 2026, the Company completed the acquisition of CyberArk for total purchase consideration of $21.1 billion",
           "CyberArk shareholders received $45.00 in cash and 2.2005 shares of our common stock for each CyberArk share",
           "Total revenue | $ | 12,312 | $ | 10,486", "Total revenue | $ | 11,480 | $ | 9,221 | $ | 2,259 | 25 | %"],
    CALL: ["Revenue grew 20% year-over-year to $2.3 billion",
           "Q1 revenue grew 53% year-over-year and 40% year-over-year on a pro forma basis",
           "Q1 revenue grew 23% year-over-year on a pro forma basis",
           "In Q1, our total gross margin was 75.2%, down 170 basis points year-over-year",
           "industry-wide elevated component costs within our hardware business",
           "hardware represents approximately 10% of our total revenue",
           "impact our gross margins throughout the course of the fiscal year",
           "a greater mix of higher growth SaaS offerings but earlier in their maturity curve",
           "reaching $100 million in annualized revenue within 18 months of their founding",
           "add $1 billion in NGS ARR by fiscal year '29",
           "lower our operating margin by up to 100 basis points in fiscal '27 and up to 200 basis points in fiscal '28 before returning to our current 29% to 30% operating margin",
           "cumulative CapEx needs through fiscal 2030 to be less than $3 billion",
           "approximately $500 million in cash and prepaid compute commitments",
           "we had no share repurchases in the quarter", "Dipak Golechha"],
    CNBC: ["Earnings per share: $1.05 adjusted vs. 97 cents expected", "Revenue: $3.44 billion vs $3.31 billion expected",
           "topped the earnings of $4.18 per share and $14.16 billion in revenue expected by analysts"],
    REUT: ["Shares of Palo Alto jumped about 9% in after-hours trading to $368.70",
           "CrowdStrike rose 5%, Zscaler climbed 3% and Fortinet gained 2%"],
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
    f = figures("PANW")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    assert (round(pct(REV, REV0)), round(pct(OI, OI0)), round(pct(NI, NI0))) == (39, -69, 44)
    g, g0 = GP / REV * 100, GP0 / REV0 * 100
    assert (round(g, 1), round(g0, 1), round(g - g0, 1)) == (68.0, 74.2, -6.2)
    assert (round(pct(0.57, 0.47)), round(pct(1.05, 0.93)), round(pct(838, 709))) == (21, 13, 18)
    need("t rev", "| Revenue | $3,445M | $2,474M | +39% |")
    need("t gm", "| Gross margin | 68.0% | 74.2% | −6.2 points |")
    need("t oi", "| Operating income | $96M | $309M | −69% |")
    need("t ni", "| Net income | $482M | $334M | +44% |")
    need("t eps", "| Earnings per share | $0.57 | $0.47 | +21% |")
    need("t aeps", "| Adjusted earnings per share | $1.05 | $0.93 | +13% |")
    need("ng", "It leaves out the cost of the shares it pays its staff in, $0.74 a share this quarter, and an accounting charge for the companies it has bought, $0.34 a share")
    need("ng tax", "which this quarter took out $0.84 a share")
    need("s rev", "**Revenue:** $3,445 million, up 39% from $2,474 million a year earlier")
    assert 21.1 + 3.0 == 24.1
    need("s bought", "two companies it bought in early 2026 for $24.1 billion between them")
    need("s oi", "operating income fell to $96 million from $309 million")
    need("s ni", "Net income rose to $482 million, helped by a $457 million tax benefit")
    need("s fc", "revenue for the year to July 2027 of $14.52 billion to $14.57 billion, up from $14.10 billion to $14.20 billion")
    need("s ac", "Applied Compute, an AI start-up, for $4.5 billion in shares")
    need("chrono", "It bought Chronosphere, which helps companies monitor their software and cloud systems, on 29 January for $3.0 billion")
    need("cyber", "on 11 February for $21.1 billion, paying CyberArk's shareholders $45.00 in cash and 2.2005 Palo Alto shares for each of theirs")
    # pro forma growth recomputed; the reported 25% is the 10-K's own (from unrounded figures: 11,480/9,221 is 24.498%)
    assert round(pct(12312, 10486)) == 17
    need("pf", "revenue rose 17% that year, against 25% as reported")
    for row in ["| Network and AI security | +20% | No separate figure given |",
                "| Cortex (security operations, now including Chronosphere) | +53% | +40% |",
                "| Identity security (CyberArk) | Not given | +23% |"]:
        need(f"seg {row}", row)
    need("shares", "Palo Alto's diluted shares rose to 838 million from 709 million, up 18%")
    need("why13", "adjusted earnings per share rose 13% while revenue rose 39%")
    need("amort", "rose to $282 million from $39 million. The cost of the shares it pays its staff in rose to $622 million from $387 million")
    need("oi69", "Operating income fell 69%")
    need("tax", "Net income still rose 44%, because Palo Alto recorded a tax benefit of $457 million against a $78 million tax charge a year earlier")
    need("ptax", "Before tax, it made $25 million, against $412 million a year earlier")
    need("gm", "fell from 74.2% to 68.0%. On Palo Alto's adjusted measure it was 75.2%, down 1.7 points")
    need("hw", "Hardware is about 10% of Palo Alto's revenue")
    need("arr", "rose 66% to $9.73 billion")
    need("rpo", "rose 35% to $21.0 billion")
    need("est", "Analysts had expected adjusted earnings per share of $0.97 and revenue of $3.31 billion, according to LSEG data reported by CNBC. Palo Alto reported $1.05 and $3,445 million")
    need("est fy", "analysts had expected revenue of $14.16 billion and adjusted earnings per share of $4.18")
    assert REV - (3300 + 3310) / 2 == 140 and (14520 + 14570) / 2 - (14100 + 14200) / 2 == 395
    need("beat", "In September Palo Alto forecast revenue of $3.300 billion to $3.310 billion for this quarter. It reported $3,445 million, about $140 million above the middle of that range. It then raised its forecast for the year by about $395 million at the middle")
    need("fc1", "| Revenue | $14.10B to $14.20B | $14.52B to $14.57B |")
    need("fc2", "| Adjusted earnings per share | $4.16 to $4.19 | $4.26 to $4.30 |")
    need("fc3", "It also raised its forecast for next-generation security recurring revenue, to $11.475 billion to $11.525 billion from $11.075 billion to $11.175 billion")
    rest0, rest1 = (14100 + 14200) / 2 - (3300 + 3310) / 2, (14520 + 14570) / 2 - REV
    assert (round(rest1 / 1000, 1), round(rest0 / 1000, 1)) == (11.1, 10.8)
    need("rest", "about $11.1 billion of revenue from the three quarters still to come, up from about $10.8 billion")
    need("q2", "revenue of $3.530 billion to $3.550 billion and adjusted earnings per share of $1.01 to $1.03")
    need("ac", "Palo Alto is paying $4.5 billion in its own shares")
    need("ac100", "had passed $100 million of annualised revenue within 18 months of being founded")
    need("ac1b", "add $1 billion of recurring revenue by its 2029 financial year")
    need("ac m", "by up to 1 percentage point in the year to July 2027 and up to 2 points the year after, before returning to the current 29% to 30%")
    need("ac capex", "less than $3 billion through its 2030 financial year")
    need("ac cash", "about $500 million of cash and prepaid computing")
    need("cash", "Palo Alto generated $1,929 million of cash from operations in the quarter, up from $1,771 million")
    need("fcf", "was $1,937 million, 56.2% of revenue against 69.2% a year earlier")
    need("next fc", "Whether revenue for the year lands between $14.52 billion and $14.57 billion")

    if (SRC / NASDAQ).exists():
        measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2016", "2025", "2026", "2027", "2029", "2030", "31", "18", "1", "2", "29", "11", "12"}
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
    with open(SRC / NASDAQ, encoding="utf-8") as fh:
        lines = list(fh)
    meta = lines[0]
    nq = {r["date"]: r for r in csv.DictReader(x for x in lines if not x.startswith("#"))}
    c = {k: float(v["close"]) for k, v in nq.items()}
    # no dividend: our stored closes ARE the traded closes, across the whole window
    for d_ in nq:
        iso = f"{d_[6:]}-{d_[:2]}-{d_[3:5]}"
        assert abs(adj[iso] - c[d_]) < 0.006, (iso, adj[iso], c[d_])
    assert "max_close_in_window = 10/06/2026 419.91" in meta and f["ath_date"] == "2026-10-06"
    assert "min_close_after_record = 11/17/2026 309.29" in meta
    c17, c18, c19, rec, ye = c["11/17/2026"], c["11/18/2026"], c["11/19/2026"], c["10/06/2026"], c["12/31/2025"]
    mv = pct(c19, c18)
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    assert this["release"] == "2026-11-18" and (this["from"], this["to"]) == ("2026-11-18", "2026-11-19")
    assert abs(this["move"] - mv) < 1e-3 and f["as_of"] == "2026-11-19"
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    sx = {r[0]: float(r[3]) for r in full["^GSPC"]}
    nx = {r[0]: float(r[3]) for r in full["^IXIC"]}
    spx, ndq = pct(sx["2026-11-19"], sx["2026-11-18"]), pct(nx["2026-11-19"], nx["2026-11-18"])
    ndq18 = pct(nx["2026-11-18"], nx["2026-11-17"])
    need("answer move", f"Its shares rose {mv:.1f}% the next day, on a day the S&P 500 fell {abs(spx):.1f}%")
    need("s move", f"up {mv:.1f}% on 19 November, to ${c19:.2f}, while the S&P 500 fell {abs(spx):.1f}%")
    r19 = nq["11/19/2026"]
    need("day", f"Palo Alto closed at ${c18:.2f} on 18 November, before its results. On 19 November it opened at ${float(r19['open']):.2f}, rose as high as ${float(r19['high']):.2f}, and closed at ${c19:.2f}, up {mv:.1f}%. The S&P 500 fell {abs(spx):.1f}% and the Nasdaq Composite {abs(ndq):.1f}% the same day")
    need("ah", "the shares had been up about 9%, at $368.70, and rival cybersecurity companies rose with them, CrowdStrike by 5%, Zscaler by 3% and Fortinet by 2%, Reuters reported")
    need("d18", f"The shares had already risen {pct(c18, c17):.1f}% on 18 November, before the results, a day the Nasdaq Composite rose {ndq18:.1f}%. Over the two days they rose {pct(c19, c17):.1f}%, from ${c17:.2f} to ${c19:.2f}")
    need("rec", f"That leaves them {abs(pct(c19, rec)):.1f}% below their record close of ${rec:.2f} on 6 October 2026, and up {pct(c19, ye):.1f}% since the end of 2025")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 43 and before[0]["release"] == "2016-02-25" and before[-1]["release"] == "2026-09-01"
    need("rx n", f"We measured all {n} of Palo Alto's results releases before this one, from February 2016 to September 2026")
    pre = [r for r in before if r["release"] in ("2018-06-04", "2020-11-16")]
    assert all(r["to"] == r["release"] != r["from"] for r in pre) and len(pre) == 2
    assert all(r["from"] == r["release"] for r in before if r not in pre)
    need("rx pre", "Two were released before the market opened, in June 2018 and November 2020")
    med = statistics.median(abs(v) for v in m)
    need("rx med", f"The middle move, up or down, was **{med:.1f}%**")
    need("rx 5", f"{sum(abs(v) >= 5 for v in m)} of the {n} moved the shares by 5% or more, and {sum(abs(v) >= 10 for v in m)} by 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2024-02-20" and b["release"] == "2021-08-23"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in February 2024")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in August 2021")
    assert all(v != 0 for v in m)
    need("rx updown", f"The shares rose after {sum(v > 0 for v in m)} of the {n} and fell after {sum(v < 0 for v in m)}")
    last4, up = before[-4:], [r for r in before if r["move"] > 0][-1]
    assert all(r["move"] < 0 for r in last4) and up["release"] == "2025-08-18" and before.index(up) == n - 5
    fe, ju, se = last4[1:]
    assert (fe["release"], ju["release"], se["release"]) == ("2026-02-17", "2026-06-02", "2026-09-01")
    assert abs(se["move"] - pct(c["09/02/2026"], c["09/01/2026"])) < 0.05
    need("rx last", f"most recently by **{abs(fe['move']):.1f}%** in February, **{abs(ju['move']):.1f}%** in June and **{abs(se['move']):.1f}%** in September 2026. The last rise was **{up['move']:.1f}%** in August 2025")
    more = sum(abs(v) > abs(mv) for v in m)
    assert abs(mv) < med and med - abs(mv) < 1
    need("usual", f"So a {mv:.1f}% rise is close to Palo Alto's usual move, a little below the middle one: {more} of the {n} earlier results moved the shares more")
    falls = f["big_falls"]
    assert len(falls) == 7 and f["fall_threshold"] == -30 and f["first_bar"] == "2012-07-20"
    need("falls n", "Palo Alto's shares have fallen 30% or more seven times since July 2012, when they began trading and our price history starts")
    for e in falls:
        assert e["recovery_date"]
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {my(e['recovery_date'])} |")
    span = lambda e: (int(e["recovery_date"][:4]) - int(e["peak_date"][:4])) * 12 + int(e["recovery_date"][5:7]) - int(e["peak_date"][5:7])  # noqa: E731
    longest = max(falls, key=span)
    assert 33 <= span(longest) < 36
    assert (longest["peak_date"], longest["recovery_date"]) == ("2015-07-23", "2018-05-07")
    need("longest", "All seven got back to their record. The longest took almost three years, from July 2015 to May 2018")
    f24 = falls[-2]
    assert f24["peak_date"] == "2024-02-09" and f24["trough_date"] == w["to"] == "2024-02-21"
    need("f24", "The fall that began in February 2024 came mostly from one day: the 28.4% drop after its results that month")
    dd = pct(c17, rec)
    assert -30 < dd and min(v for k, v in c.items() if f"{k[6:]}{k[:2]}{k[3:5]}" > "20261006") == c17
    need("cur", f"Since the record close on 6 October 2026 the shares have fallen as low as ${c17:.2f}, on 17 November, {abs(dd):.1f}% below it")


if __name__ == "__main__":
    main()
