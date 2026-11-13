"""Assert every figure and quote in draft 27 (Xero, half year to September 2026) against its source.

Same method as assert_wbc.py:
  * SOURCE  — every raw number and phrase taken from Xero must appear, as written, in the saved document it is
    attributed to (results announcement, Interim Report, investor presentation, buy-back disclosure, CFO notice,
    the June 2025 Melio and placement announcements), read with `pdftotext -raw` so table rows stay in order;
  * DERIVED — every comparison is recomputed here from those raw numbers (the profit bridge, the buy-back share of
    market value, the regional table);
  * MEASURED — share-price history from `earn_figures.figures()` (frozen data, Xero pays no dividend so the stored
    closes are traded closes), and the 12 November close is checked against the ASX's own quote;
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_xro.py
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
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-xro-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "27-xero-h1-fy27-results.md"
SRC = ROOT / "xro-2026-h1" / "sources"
RA, IR, PRES, BB, CFO = ("results-announcement.raw.txt", "interim-report-4D.raw.txt", "investor-presentation.raw.txt",
                         "buyback-disclosure.raw.txt", "cfo-transition.raw.txt")
MEL, PLC, APP, KEY, SOLE = ("melio-announcement-2025-06-25.raw.txt", "placement-complete-2025-06-26.raw.txt",
                            "app2a-2026-11-13.raw.txt", "fy27-key-dates.raw.txt", "sole-asx-listing-2018.raw.txt")
FOOL, AXIOS, NIGHTLY = ("news-www.fool.com.au_2026_11_12_why-are-xero-shares-flying-12-higher-today_.txt",
                        "news-axios-2026-02-03-ai-software-anthropic.txt",
                        "news-thenightly.com.au_business_xero-shares-tumble-as-ai-fears-spook-invest.txt")

# --- REPORTED, NZ$ thousands, six months to 30 September (Interim Report, Business results) ---
Y26 = {"opinc": 124499, "other": -14072, "disp": -507, "fin": -78045, "tax": -13346, "np": 18529}
Y25 = {"opinc": 137138, "other": 77592, "disp": -603, "fin": 17046, "tax": -96389, "np": 134784}
SOURCES = {
    RA: ["Operating revenue ($000s) 1,745,305 1,194,193 46%",
         "Pro-forma operating revenue ($000s) 1,745,305 1,377,724 27%",
         "Customers 5,146,000 4,590,000 12%", "Net customer additions 226,000 176,000 28%",
         "Average revenue per customer ($) 62.21 49.63 25%",
         "Gross margin percentage 76.0% 88.5% -12.5pp",
         "Adjusted EBITDA ($000s) 361,553 350,927 3%", "Pro-forma adjusted EBITDA ($000s) 361,553 294,748 23%",
         "Operating income ($000s) 3 124,499 137,138 -9%", "Free cash flow ($000s) 238,088 321,098 -26%",
         "Pro-forma free cash flow ($000s) 238,088 180,535 32%",
         "Net profit after tax (NPAT) ($000s) 18,529 134,784 -86%",
         "H1 FY27 revenue grew 46% (41% in constant currency (CC))",
         "Melio is expected to reach adjusted EBITDA breakeven on a run-rate basis in H2 FY28",
         "Operating revenue is now expected to be between $3,770 million and $3,830 million (up from previous guidance of $3,620 million to $3,730 million)",
         "Adjusted EBITDA is expected to be between $880 million and $920 million (previous guidance $860", "million to $920 million). This guide continues to reflect a higher than historical second half weighting",
         "largely reflects stronger Melio payments performance alongside an FX benefit from the weaker NZD",
         "Xero now sees the opportunity for FY28 revenue to be more than $4.6 billion",
         "on-market buy-back program of up to A$1 billion to be completed over the next 12 months",
         "as the current share price does not reflect Xero's long-term value and growth potential",
         "The buy-back program includes an amount intended to offset dilution from expected FY28 share-based compensation",
         "The buy-back is expected to commence on or after 13 November 2026",
         "Our H1 FY27 results show we're continuing to do what we said we'd do, delivering strong macro-resilient growth at scale with momentum across every region",
         "Our infrastructure, data, scale and trust advantages position Xero well and help customers continue to benefit in the agentic era",
         "In the UK, revenue grew 24%", "customers reached 455,000"],
    IR: ["Operating income 124,499 137,138 -9%", "Other income and expenses (14,072) 77,592 NM",
         "Loss on asset disposals (507) (603) -16%", "Net finance income/(expense) (78,045) 17,046 NM",
         "Income tax expense (13,346) (96,389) -86%", "Foreign exchange gains - 77,554",
         "Total finance income 19,992 73,431 -73%", "Total finance expense (98,037) (56,385) 74%",
         "Australia 670,060 545,693 23% 17%", "New Zealand 125,428 118,033 6% 6%",
         "United Kingdom 419,425 338,996 24% 20%", "United States 365,156 57,411 NM NM",
         "Australia 2,192,000 2,016,000 9%", "New Zealand 656,000 638,000 3%",
         "United Kingdom 1,404,000 1,209,000 16%", "United States 455,000 330,000 38%",
         "Pro-forma growth was 51%", "payments revenue increased 62%",
         "The UK added 85,000 net new customers in the six months ended 30 September 2026",
         "an increase from 56,000 net additions in H1 FY26",
         "New Zealand added 6,000 net new customers in H1 FY27",
         "Making Tax Digital (MTD) for Income Tax",
         "largely due to the partial recognition of a deferred tax asset on US carried forward tax losses",
         "This included the first full half-year contribution from Melio",
         "Melio's higher ARPC customer base alongside price changes",
         "The Company does not propose to pay a dividend",
         "has not been subject to audit or review"],
    PRES: ["One-time FX revaluation gains on US dollar funds held for the acquisition of Melio",
           "NZ / US price rises to come through in H2 ARPC and revenue",
           "Pro-forma statements are unaudited"],
    BB: ["on-market buy-back of up to 14,320,5541 ordinary shares (Shares), being up to an amount equal to A$1 billion",
         "Based on AU$1 billion divided by the 5-day VWAP of $69.8297 as at close of trade on 11 November 2026"],
    CFO: ["Claire Bramley to step down as CFO on 31 January 2027", "has decided to leave Xero to take up a new role with another global organisation",
          "Xero will undertake a global CFO search for her successor"],
    MEL: ["WELLINGTON, 25 June 2025", "The upfront consideration will be US$2.5 billion (A$3.9 billion)"],
    PLC: ["Approximately 10.5 million new fully paid ordinary shares in Xero (New Shares) at the price of A$176 per share",
          "A$1.85bn Institutional Placement"],
    APP: ["XRO ORDINARY FULLY PAID 8,164 13/11/2026", "XRO : ORDINARY FULLY PAID 170,661,000"],
    KEY: ["20 May 2027 FY27 Full Year Results to 31 March 2027", "12 November 2026 FY27 Half Year Results to 30 September 2026"],
    SOLE: ["trading in Xero shares will now occur exclusively on the ASX platform", "5 February 2018"],
    FOOL: ["up around 12% and changing hands at $79.66 apiece"],
    AXIOS: ["Software stocks slid after Anthropic rolled out new AI automation capabilities",
            "investors price in a world where AI could replace software services"],
    NIGHTLY: ["Xero shares fell 9 per cent on the day"],
}


def norm(s: str) -> str:
    s = s.replace("\\\"", '"')
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def m1(x: int) -> str:
    return f"{abs(x) / 1000:.1f}M"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("XRO.AX")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    # DERIVED: the profit bridge
    ch = {k: Y26[k] - Y25[k] for k in Y26}
    assert sum(Y26[k] for k in ("opinc", "other", "disp", "fin", "tax")) == Y26["np"]
    assert sum(Y25[k] for k in ("opinc", "other", "disp", "fin", "tax")) == Y25["np"]
    rows = sum(round(ch[k] / 1000, 1) for k in ("opinc", "other", "fin", "tax"))
    assert abs(rows - round(ch["np"] / 1000, 1)) <= 0.1 + 1e-9, rows
    assert round(pct(Y26["np"], Y25["np"])) == -86 and round(pct(Y26["opinc"], Y25["opinc"])) == -9
    need("answer", "Xero's revenue rose 46% to NZ$1.75 billion in the six months to September 2026, but its net profit fell 86% to NZ$18.5 million")
    need("bridge total", f"Net profit fell by NZ${abs(ch['np']) / 1000:.1f} million")
    need("row opinc", f"| Operating income | {m1(Y25['opinc'])} | {m1(Y26['opinc'])} | −{m1(ch['opinc'])} |")
    need("row other", f"| Other income and expenses | +{m1(Y25['other'])} | −{m1(Y26['other'])} | −{m1(ch['other'])} |")
    need("row fin", f"| Net finance income or expense | +{m1(Y25['fin'])} | −{m1(Y26['fin'])} | −{m1(ch['fin'])} |")
    need("row tax", f"| Income tax | −{m1(Y25['tax'])} | −{m1(Y26['tax'])} | +{m1(ch['tax'])} |")
    need("row np", f"| **Net profit** | **{m1(Y25['np'])}** | **{m1(Y26['np'])}** | **−{m1(ch['np'])}** |")
    need("disposals", f"NZ${abs(Y25['disp']) / 1000:.1f} million and NZ${abs(Y26['disp']) / 1000:.1f} million, so its rows add up to within NZ$0.1 million of the change")
    need("gm", "Xero's gross margin fell from 88.5% to 76.0%")
    need("fx gain", "Xero booked NZ$77.6 million of foreign-exchange gains, which it says were on US dollar funds it was holding to buy Melio. This year, the same line was a NZ$14.1 million cost")
    need("finance", "Finance income fell from NZ$73.4 million to NZ$20.0 million, and finance costs rose from NZ$56.4 million to NZ$98.0 million")
    need("adj", "Adjusted EBITDA rose 3% to NZ$361.6 million")
    need("pro-forma", "adjusted EBITDA rose 23% and free cash flow rose 32% to NZ$238.1 million. On the reported figures, free cash flow fell 26%")
    need("opinc 9", "Operating income fell 9%")
    need("short rev", "NZ$1,745 million, up 46%")
    need("short pf", "the comparable growth was 27%")
    need("short np", "NZ$18.5 million, down 86% from NZ$134.8 million")
    need("short cust", "5,146,000, up 12%, after adding 226,000 in the half")
    need("short customers", "the accounting software company with 5.1 million customers")
    need("guide", "NZ$3,770 million to NZ$3,830 million, up from NZ$3,620 million to NZ$3,730 million")
    need("guide row rev", "| Revenue | 3,620M to 3,730M | 3,770M to 3,830M |")
    need("guide row ebitda", "| Adjusted EBITDA | 860M to 920M | 880M to 920M |")
    need("fy28", "more than NZ$4.6 billion in the year to March 2028")
    need("melio", "for an upfront US$2.5 billion")
    need("cfo", "Claire Bramley will step down as chief financial officer on 31 January 2027")
    need("cfo2", "She stays until 31 January 2027")
    need("growth3", "| Reported | +46% |")
    need("growth3 cc", "| Reported, at constant currency | +41% |")
    need("growth3 pf", "| Pro-forma (as if Xero had owned Melio a year earlier) | +27% |")
    # Regions: revenue NZ$M (rounded), growth, customers
    for lbl, rev, g, cust in [("Australia", 670060, "+23%", "2,192,000"), ("New Zealand", 125428, "+6%", "656,000"),
                              ("United Kingdom", 419425, "+24%", "1,404,000"),
                              ("United States", 365156, "+51% pro-forma", "455,000")]:
        need(f"region {lbl}", f"| {lbl} | {round(rev / 1000)}M | {g} | {cust} |")
    assert round(pct(670060, 545693)) == 23 and round(pct(2192000, 2016000)) == 9
    need("au", "revenue up 23%, or 17% at constant currency, and 2,192,000 customers, up 9%")
    need("nz", "added 6,000 customers in the half")
    need("uk", "added 85,000 customers in the half, against 56,000 a year earlier")
    need("us", "US revenue rose 51% and payments revenue 62%")
    need("arpc", "average revenue per customer rose 25% to NZ$62.21 a month")
    # Who said it (a swapped speaker passed the first sabotage run): both quotes are the chief executive's.
    need("ceo attr", 'Chief executive Sukhinder Singh Cassidy said: "Our H1 FY27 results show')
    need("ceo attr ai", 'could replace accounting software, she said: "Our infrastructure')
    need("board attr", 'Xero\'s board says the program is a good use of capital "as the current share price')
    assert abs(3841321 / 5146000 / 12 * 1000 - 62.21) < 0.05  # ARPC is monthly: AMRR / customers / 12
    # Buy-back
    on_issue_12 = 170661000 - 8164
    keystats = json.loads((SRC / "asx-key-stats.json").read_text(encoding="utf-8"))["data"]
    assert on_issue_12 == keystats["numOfShares"] == 170652836 and keystats["priceClose"] == 75.17
    cap = on_issue_12 * 75.17
    assert abs(1e9 / 69.8297 - 14320554) < 1
    need("bb shares", "up to 14,320,554 shares, based on the average price over the five days to 11 November of A$69.83")
    need("bb pct", f"At the 12 November close, A$1 billion was {1e9 / cap * 100:.1f}% of Xero's market value of A${cap / 1e9:.1f} billion")
    need("bb start", "over the next 12 months, starting on or after 13 November")
    need("placement", "Xero sold about 10.5 million new shares at A$176 each, raising A$1.85 billion")
    need("results next", "due on 20 May 2027")

    if "MOVE_" in raw or "PENDING" in raw:
        bad.append(("placeholder", "placeholders still in the draft"))
    else:
        measured(f, need, keystats)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2025", "2026", "2027", "2028", "2018", "2012", "30", "12", "100", "200", "2014", "2015", "2019", "2020",
               "2021", "2022", "2024", "17", "40", "1", "3", "10"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8", errors="replace")) for fn in SOURCES)
    for q in re.findall(r'"([^"]+)"', text):
        if len(q) >= 8 and norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    # Who said it: the two chief-executive quotes are in the results announcement, attributed to her there.
    ra = norm((SRC / RA).read_text(encoding="utf-8"))
    for q in ("Our H1 FY27 results show", "Our infrastructure, data, scale and trust"):
        i = ra.index(q)
        assert "Sukhinder Singh Cassidy said" in ra[max(0, i - 1500):i], q
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values())} source phrases, {len(bad)} failed (as at {f['as_of']})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


def measured(f: dict, need, keystats: dict) -> None:  # noqa: ANN001
    MON = "January February March April May June July August September October November December".split()
    my = lambda d: f"{MON[int(d[5:7]) - 1]} {d[:4]}"  # noqa: E731
    d, c = f["full_dates"], dict(zip(f["full_dates"], f["full_closes"]))
    assert d[-1] == "2026-11-12" and abs(c["2026-11-12"] - keystats["priceClose"]) < 0.006
    c11, c12 = c["2026-11-11"], c["2026-11-12"]
    mv = pct(c12, c11)
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    assert this["release"] == "2026-11-12" and abs(this["move"] - mv) < 1e-9
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    x = {r[0]: float(r[3]) for r in full["^AXJO"]}
    xjo = pct(x["2026-11-12"], x["2026-11-11"])
    hi12 = next(float(r[1]) for r in full["XRO.AX"] if r[0] == "2026-11-12")
    assert round(xjo, 2) == -0.07 and pct(79.66, c11) > 12 and pct(hi12, c11) > 12
    gave = (pct(hi12, c11) - mv) / pct(hi12, c11)
    assert 0.45 < gave < 0.6, gave
    need("answer move", f"Its shares rose {mv:.1f}% on results day")
    need("short move", f"up {mv:.1f}% on results day, to A${c12:.2f}")
    need("day", f"Xero's shares closed at A${c11:.2f} on 11 November. On 12 November, results day, they closed at A${c12:.2f}, up {mv:.1f}%. The ASX 200 fell {abs(xjo):.2f}% the same day")
    need("intraday", "During the day they were up more than 12%, then gave back about half of that gain by the close")
    need("bb 70.86", f"On the day before the buy-back was announced, the shares closed at A${c11:.2f}")
    # Results-day history
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 17 and before[0]["release"] == "2018-05-10" and before[-1]["release"] == "2026-05-14"
    need("rx n", f"We measured all {n} of Xero's results from May 2018")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    o5, o10 = sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)
    assert (o5, o10) == (12, 5)
    need("rx 5", f"Twelve of the {n} moved the shares 5% or more, and five 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2021-05-13" and b["release"] == "2019-05-16"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in May 2021")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in May 2019")
    assert all(v != 0 for v in m)
    last2 = [r["move"] for r in before[-2:]]
    assert all(round(v, 1) == -9.0 for v in last2)
    need("rx updown", f"The shares rose on {sum(v > 0 for v in m)} of the {n} days and fell on {sum(v < 0 for v in m)}. The two results before this one both fell by 9.0%")
    further = sum(abs(v) > abs(mv) for v in m)
    assert abs(mv) < statistics.median(abs(v) for v in m)
    need("smaller", f"So a {mv:.1f}% rise was a smaller move than usual for Xero: {further} of the {n} earlier results moved the shares more")
    # The fall
    assert f["ath_date"] == "2025-06-24" and round(f["ath_close"], 2) == 194.21
    lows = [(c[x_], x_) for x_ in d if x_ > "2025-06-24"]
    lo, lo_d = min(lows)
    assert lo_d == "2026-10-01" and round(lo, 2) == 55.31
    need("record", f"Xero's record close was A${f['ath_close']:.2f} on 24 June 2025, the last trading day before it announced the Melio deal")
    need("fall", f"From there the shares fell {abs(pct(lo, f['ath_close'])):.1f}% to A${lo:.2f} on 1 October 2026")
    days = [(pct(c[d[i]], c[d[i - 1]]), d[i]) for i in range(1, len(d)) if d[i] >= "2026-01-01"]
    worst = min(days)
    assert worst[1] == "2026-02-04"
    need("feb", f"Their worst day this year was 4 February, when they fell {abs(worst[0]):.1f}%")
    may = dict((dd, v) for v, dd in days)["2026-05-14"]
    need("may", f"On 14 May, the day of Xero's full-year results, they fell {abs(may):.1f}%")
    need("since low", f"By 12 November they had risen {pct(c12, lo):.1f}% from the October low, but they were still {abs(f['below_ath']):.1f}% below the record, and down {abs(f['ytd']):.1f}% since the start of 2026")
    need("answer below", f"are still {abs(f['below_ath']):.1f}% below their record")
    falls = f["big_falls"]
    assert len(falls) == 7 and f["fall_threshold"] == -20 and f["first_bar"].startswith("2012-11")
    need("falls n", "fallen 20% or more seven times in our price history for its ASX shares, which starts in November 2012")
    for e in falls:
        rec = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {rec} |")
    done = [e for e in falls if e["recovery_date"]]
    yrs = lambda a, b: (int(b[:4]) - int(a[:4])) + (int(b[5:7]) - int(a[5:7])) / 12  # noqa: E731
    longest = max(yrs(e["peak_date"], e["recovery_date"]) for e in done)
    assert len(done) == 6 and 4 < longest < 4.5, longest
    need("falls back", "The six earlier falls all got back to their record, the longest after more than four years")
    # Rating (mc-video-tools/video22/rating_XRO_1112.json, the site engine, Medium preset, prices to 12 Nov)
    rt = json.loads((Path.home() / "mc-video-tools" / "video22" / "rating_XRO_1112.json").read_text(encoding="utf-8"))
    assert rt["last_bar"] == "2026-11-12" and rt["overall_label"] == "Constructive"
    need("rating", f"Our model rates Xero **{rt['overall_label']}**, {rt['overall_rating']} out of 100")
    need("rating parts", f"Its Financial Health score is {rt['financial_health_score']}, its Valuation score {rt['valuation_score']} and its Cycle Payoff score {rt['cycle_payoff_score']}")


if __name__ == "__main__":
    main()
