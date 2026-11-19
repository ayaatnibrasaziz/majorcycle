"""Assert every figure and quote in draft 34 (Nebius, third quarter 2026) against its source.

Same method as assert_ko.py, with one difference: Nebius is not in our stock database, so its prices come from
Nasdaq's full saved history (nasdaq-hist-NBIS-20261119.txt) rather than from earn_figures. The reactions, the record
and the falls are recomputed here from that file, with the same rules (a before-the-open release reacts on the same
day's close against the day before; a fall runs from a record close to the lowest close before the record is
regained). Nebius pays no dividend, so the traded closes are the whole story.

    python -I reference/article-drafts/verify/assert_nbis.py
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
DATA = Path(os.environ.get("EARN_DATA") or ROOT / "earn-nov-nbis-2026-DATA.json.gz")
DRAFT = Path(__file__).resolve().parents[1] / "34-nebius-q3-2026-results.md"
SRC = ROOT / "earn-2026-nov-b" / "nbis"
REL, LET, OFR, Q2, CITI, INV, IHUB = ("q3-ex991.txt", "q3-ex992.txt", "q3-fin-ex991.txt", "q2-ex991.txt",
                                      "oct22-ex991.txt", "news-yahoo-beat.txt", "news-yahoo-why.txt")
RESUME, FORMER = "resume-0001104659-24-110042.txt", "resume-0001104659-24-108214.txt"
#: Every quarterly results release since trading resumed (hist-*.txt), each with an 8:00 a.m. ET webcast that day.
RELEASES = ["2024-10-31", "2025-02-20", "2025-05-20", "2025-08-07", "2025-11-11", "2026-02-12", "2026-05-13",
            "2026-08-12", "2026-11-12"]
AS_OF = "2026-11-16"

SOURCES = {
    REL: ["Revenues | 146.1 | 980.8 | 571 | %", "Adjusted EBITDA / (loss) | (5.2 | ) | 465.8",
          "Income / (loss) from operations | (130.2 | ) | 50.4",
          "Net income / (loss) from continuing operations | (119.6 | ) | (37.5 | )",
          "Basic | (0.50 | ) | (0.13 | )", "Depreciation and amortization | 99.0 | 354.7",
          "as a percentage of revenues | 68 | % | 36 | %",
          "Purchases of property and equipment and intangible assets | (955.5 | ) | (7,300.4 | )",
          "Cash and cash equivalents | 3,678.1 | 7,425.6"],
    LET: ["Group revenue in Q3 of $980.8 million was up 571% year-over-year, and up 68% compared to Q2",
          "In Q3, we recognized approximately $325 million of non-recurring revenue as part of our asset-light model",
          "as we engage partners to deploy Nebius architecture and the Nebius AI Cloud platform on their funded capacity",
          "some third-party capacity we expected to come online this year is now scheduled for the first half of 2027. The contracts behind that capacity remain in place",
          "Revenue: We now expect revenue at the low end of our $3.0-3.4 billion range",
          "This includes in New Jersey, where we are transitioning the power source to Bloom Energy",
          "We had guided to $7-9 billion by December. We now expect ARR to exceed $7 billion for the month of February",
          "Annualized run-rate revenue (ARR) of $6.4 billion as of the end of September was up 1,062% year-over-year and up 113% from the $3.0 billion reported at the end of June",
          "We no longer see ARR as the right measure of our business",
          "From 2027, we will provide guidance for revenue and pre-tax earnings",
          "ARR annualizes a single month",
          "Capital expenditures: Approximately $27 billion, above our $20-25 billion range, as we invest in capacity for 2027",
          "Revenue: $12-13 billion, approximately four times our 2026 revenue",
          "Pre tax profit: breakeven in Q4 2027", "Capital expenditures: $40-$45 billion",
          "We expect $10 billion in committed customer prepayments in 2026, rising to $17 20 billion in 2027",
          "We expect prepayments and financing against existing contracts with investment-grade customers to cover 75%-85% of our 2027 capex",
          "Since the start of Q3, our customers have committed over $12 billion in contract value to Nebius",
          "Prepayments on deals signed in Q3 covered over 100% of associated capital expenditures, up from 50%-60% in Q2",
          "Remaining performance obligations (RPO) were $38.7 billion as of the end of September, up 3% from $37.5 billion reported at the end of June",
          "We use a five-year useful life for our server and network equipment based on usage patterns and current utilization commitments, up from the four-year useful life used prior to 2026"],
    OFR: ["Nebius AI cloud revenues included revenue from strategic partnerships of $325.1 million",
          "such revenues are by their nature non-recurring and the timing and amounts of such revenues are hard to predict"],
    Q2: ["Revenues | 105.1 | 582.3 | 454 | %"],
    CITI: ["Nebius secures $3.5 billion financing facility with Citi"],
    INV: ["The company posted a loss of $0.13 per share for the quarter ended September 30, beating the consensus estimate of a $0.63 loss. Revenue surged 571% YoY to $980.8 million, topping the $907.2 million analyst estimate",
          "with the midpoint of $12.5 billion exceeding the consensus of $11.98 billion"],
    IHUB: ["The company's updated guidance prompted analysts to reduce their share price targets, while broader uncertainty surrounding artificial intelligence infrastructure companies added to market pressure"],
    RESUME: ["is scheduled to resume at 9:00 a.m. Eastern Time today", "October 21, 2024"],
    FORMER: ["Nebius Group N.V. (formerly known as Yandex N.V.)"],
}


def norm(s: str) -> str:
    s = s.replace("\\\"", '"')
    s = re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"')
    return s.replace("�", " ").replace("–", " ").replace("  ", " ")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def prices() -> dict[str, dict[str, float]]:
    line = (SRC / "nasdaq-hist-NBIS-20261119.txt").read_text(encoding="utf-8").splitlines()[1]
    out = {}
    for rec in line.split(";"):
        d, c, h, lo, o = rec.split(",")
        m, dd, y = d.split("/")
        out[f"{y}-{m}-{dd}"] = {"close": float(c), "high": float(h), "low": float(lo), "open": float(o)}
    return dict(sorted(out.items()))


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))
    for d in RELEASES:  # each release is a results release with a same-day 8:00 a.m. ET webcast
        hits = [f for f in SRC.glob("hist-*.txt") if "8:00" in (t := f.read_text(encoding="utf-8", errors="replace"))
                and "financial results" in t]
        assert len(hits) >= 7, len(hits)

    assert round(pct(980.8, 146.1)) == 571 and round(pct(980.8, 582.3)) == 68
    need("t rev", "| Revenue | $980.8M | $146.1M | +571% |")
    need("t ebitda", "| Adjusted EBITDA | $465.8M | −$5.2M | |")
    need("t oi", "| Income from operations | $50.4M | −$130.2M | |")
    need("t ni", "| Net loss | −$37.5M | −$119.6M | |")
    need("t eps", "| Loss per share | −$0.13 | −$0.50 | |")
    need("da", "Depreciation, the cost of its equipment spread over its life, was $354.7 million, 36% of revenue against 68% a year earlier")
    need("life", "Nebius now spreads the cost of its servers and network equipment over five years rather than four")
    need("s rev", "**Revenue:** $980.8 million, up 571% from $146.1 million a year earlier, and up 68% on the quarter before")
    need("s one", "about $325 million of it came from a partnership")
    need("s ni", "a net loss of $37.5 million, smaller than the $119.6 million lost a year earlier")
    need("s fc", "revenue for 2026 at the low end of its $3.0 billion to $3.4 billion range")
    need("s capex", "about $27 billion this year, more than the $20 billion to $25 billion it had planned, and $40 billion to $45 billion in 2027")
    need("answer", "Nebius's revenue rose 571% to $980.8 million in the third quarter of 2026, above analysts' forecasts")
    need("one", "Its quarterly review gives the exact figure, $325.1 million")
    assert round(980.8 - 325.1, 1) == 655.7
    need("ex", "Leaving that out, revenue was about $655.7 million, against $582.3 million in the quarter to June")
    need("arr", "It had aimed for $7 billion to $9 billion by December; it now expects more than $7 billion in February. At the end of September the figure was $6.4 billion, up from $3.0 billion at the end of June")
    need("capex26", "It now expects to spend about $27 billion in 2026, above its range of $20 billion to $25 billion")
    for row in ["| Revenue | $12 billion to $13 billion |", "| Capital spending | $40 billion to $45 billion |",
                "| Customer prepayments | $17 billion to $20 billion |", "| Pre-tax profit | Breakeven in the fourth quarter |"]:
        need(f"27 {row}", row)
    need("cover", "cover 75% to 85% of its 2027 spending")
    need("tcv", "customers had committed more than $12 billion in contract value since the start of the third quarter")
    need("prepay", "covered more than 100% of the spending on the capacity behind them, up from 50% to 60%")
    need("rpo", "were $38.7 billion at the end of September, up 3% from $37.5 billion at the end of June")
    need("est", "Analysts had expected a loss of $0.63 a share and revenue of $907.2 million, Investing.com reported. Nebius reported a loss of $0.13 and revenue of $980.8 million. For 2027 analysts had expected revenue of $11.98 billion")
    need("cash", "Nebius spent $7,300.4 million on equipment and other assets in the quarter. It ended September with $7,425.6 million of cash, against $3,678.1 million at the end of 2025. In October it agreed a $3.5 billion financing facility with Citi")
    need("next", "Whether revenue lands at the low end of $3.0 billion to $3.4 billion")
    need("next cap", "How Nebius funds $40 billion to $45 billion of spending in 2027")

    measured(need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2024", "2025", "2026", "2027", "12", "21", "30"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8", errors="replace")) for fn in SOURCES)
    for q in re.findall(r'"([^"]+)"', text):
        if len(q) >= 8 and norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values())} source phrases, {len(bad)} failed (as at {AS_OF})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


def measured(need) -> None:  # noqa: ANN001
    MON = "January February March April May June July August September October November December".split()
    my = lambda d: f"{MON[int(d[5:7]) - 1]} {d[:4]}"  # noqa: E731
    px = {d: v for d, v in prices().items() if "2024-10-21" <= d <= AS_OF}
    c = {d: v["close"] for d, v in px.items()}
    ds = list(c)
    assert ds[0] == "2024-10-21" and ds[-1] == AS_OF
    rx = []
    for d in RELEASES:
        i = ds.index(d)
        rx.append((d, pct(c[d], c[ds[i - 1]])))
    this, before = rx[-1], rx[:-1]
    mv = this[1]
    with gzip.open(DATA, "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    nx = {r[0]: float(r[3]) for r in full["^IXIC"]}
    ndq = pct(nx["2026-11-12"], nx["2026-11-11"])
    rec_d = max(c, key=c.get)
    rec = c[rec_d]
    assert rec_d == "2026-06-18"
    need("answer move", f"Its shares fell {abs(mv):.1f}% on results day, their biggest results-day fall since trading resumed in 2024")
    need("s move", f"down {abs(mv):.1f}% on 12 November, to ${c['2026-11-12']:.2f}, and down another {abs(pct(c['2026-11-13'], c['2026-11-12'])):.1f}% the next day")
    p12 = px["2026-11-12"]
    need("day", f"Nebius closed at ${c['2026-11-11']:.2f} on 11 November, up {pct(c['2026-11-11'], c['2026-11-10']):.1f}% that day. On 12 November it opened at ${p12['open']:.2f}, fell as low as ${p12['low']:.2f}, and closed at ${c['2026-11-12']:.2f}, down {abs(mv):.1f}%. The Nasdaq Composite fell {abs(ndq):.1f}% the same day. On 13 November it fell another {abs(pct(c['2026-11-13'], c['2026-11-12'])):.1f}%, to ${c['2026-11-13']:.2f}, and on 16 November it closed at ${c['2026-11-16']:.2f}")
    need("rec", f"That leaves the shares {abs(pct(c[AS_OF], rec)):.1f}% below their record close of ${rec:.2f}, set on 18 June 2026, though still up {pct(c[AS_OF], c['2025-12-31']):.1f}% since the end of 2025")
    m = [v for _, v in before]
    assert len(m) == 8
    need("rx n", "We measured all eight of its results releases since then, from October 2024 to August 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    need("rx ud", f"The shares rose after {sum(v > 0 for v in m)} of the 8 and fell after {sum(v < 0 for v in m)}")
    w, b = min(before, key=lambda r: r[1]), max(before, key=lambda r: r[1])
    assert w[0] == "2025-11-11" and b[0] == "2026-08-12" == before[-1][0]
    need("rx worst", f"The largest fall was **{abs(w[1]):.1f}%** in November 2025")
    need("rx best", f"The largest rise was **{b[1]:.1f}%** in August 2026, after the last results")
    assert abs(mv) > 2 * abs(w[1])
    need("rx this", f"So this {abs(mv):.1f}% fall was more than twice the size of any earlier results-day fall")
    # Falls of 30% or more: record close -> lowest close before the record is regained.
    eps, peak, trough = [], (ds[0], c[ds[0]]), None
    for d in ds[1:]:
        if c[d] > peak[1]:
            if trough and pct(trough[1], peak[1]) <= -30:
                eps.append((peak, trough, d))
            peak, trough = (d, c[d]), None
        elif trough is None or c[d] < trough[1]:
            trough = (d, c[d])
    if trough and pct(trough[1], peak[1]) <= -30:
        eps.append((peak, trough, None))
    assert len(eps) == 4
    need("falls n", "Nebius's shares have fallen 30% or more four times since trading resumed")
    for p, t, r in eps:
        need(f"fall {p[0]}", f"| {my(p[0])} | {my(t[0])} | −{abs(pct(t[1], p[1])):.1f}% | {my(r) if r else 'Not yet'} |")
    mon = lambda a, b: (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])  # noqa: E731
    assert max(mon(p[0], r) for p, _, r in eps[:-1]) == 6
    need("back", "The three earlier falls all got back to their record, the slowest about six months after it was set")


if __name__ == "__main__":
    main()
