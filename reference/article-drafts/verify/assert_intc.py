"""Assert every figure and quote in draft 15 (Intel, third quarter 2026) against its source.

Same method as assert_msft.py / assert_googl.py / assert_lly.py:
  * SOURCE  — every raw number, quote and phrase taken from Intel must appear, as written, in the saved source it
    is attributed to (release, 10-Q, slides, call transcript, the four earlier results releases);
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (dividend-adjusted, frozen data), and the actual
    closes from the saved Nasdaq history;
  * EVERY number in the body must be one this file checks (a restated figure is a second copy);
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_intc.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

import os  # noqa: E402
# Intel is in batch 2: its reaction is the 30 Oct close, frozen in its own file (see earn_figures.DATA).
os.environ.setdefault("EARN_DATA", str(Path(__file__).resolve().parents[2] / "earn-q3-2026b-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "15-intel-q3-2026-results.md"
SRC = Path(__file__).resolve().parents[2] / "earnings-2026-q3" / "sources"
WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
REL = "INTC-ex99_1-20261029.txt"
TENQ = "INTC-10Q-20261030.txt"
SLIDES = "intc-ir/INTC-Q3-2026-presentation.txt"
CALL = "intc-ir/INTC-Q3-2026-transcript-investing.txt"
JULY = "INTC-ex99_2-20260723.txt"

# --- REPORTED, $ millions (release: statement of operations, supplemental segment results, cash flow) ---
Q = {"rev": 16513, "oi": 2522, "ni": 3320, "dcai": 7318, "ccpg": 8097, "fdy": 6697, "fdy_oi": -1853,
     "dcai_oi": 3039, "cash": 21846, "sti": 32159, "std": 3817, "ltd": 46317}
Y = {"rev": 13653, "oi": 683, "ni": 4063, "dcai": 4117, "ccpg": 8535, "fdy": 4235, "fdy_oi": -2321}
# Quarterly cash flow (release, adjusted free cash flow reconciliation), $ millions: (Q3 2026, Q3 2025)
CF = {"cfo": (5082, 2546), "capex": (4219, 2956), "fcf": (1639, 896)}
# Five-quarter segment history: each release's business-unit table (DCAI $B, DCAI change %, CCPG $B)
HIST = [("Third quarter 2025", "INTC-ex99_2-20251023.txt", "$4.1 billion | | down | 1%", 4.1, -1, 8.5),
        ("Fourth quarter 2025", "INTC-ex99_2-20260122.txt", "4.7 billion | | up | 9%", 4.7, 9, 8.2),
        ("First quarter 2026", "INTC-ex99_2-20260423.txt", "5.1 billion | | up | 22%", 5.1, 22, 7.7),
        ("Second quarter 2026", "INTC-ex99_2-20260723.txt", "6.3 billion | | up | 59%", 6.3, 59, 8.9),
        ("Third quarter 2026", REL, "7.3 | | up 78%", 7.3, 78, 8.1)]
SOURCES = {
    REL: ["Third-quarter revenue was $16.5 billion, up 21% year-over-year",
          "| Gross margin | 43.0% | 38.2% | up 4.8 ppts | | 44.1% | 40.0% | up 4.1 ppts |",
          "Earnings per share attributable to Intel—diluted | $0.60 | $0.90 | down 33% | | $0.52 | $0.23 | up 126% |",
          "Net income attributable to Intel ($B) | $3.3 | $4.1 | down 18% |",
          "Revenue ($B) | | $15.0 - $16.0", "| 37.1% | | 38.0% |", "| $0.10 | | $0.25 |",
          "Despite near-term headwinds across the PC industry",
          "we see the PC slowdown continuing at least through the first half of next year",
          "Altera, previously a wholly owned subsidiary, was deconsolidated following the sale of 51% of its common stock",
          "Released Intel 14A 0.9 process design kit (PDK) in October",
          "Adjusted free cash flow | | $ | 1,639 | | | $ | 896 |"],
    JULY: ["Forecasting third-quarter 2026 revenue of $15.8 billion to $16.8 billion",
           "non-GAAP EPS attributable to Intel of $0.38", "Gross margin | | 41.0% | | 42.0% |"],
    TENQ: ["demand for certain data center products continued to exceed available supply",
           "due to industry-wide impacts from higher component prices, particularly memory, constrained IT budgets and tighter inventory management",
           "We expect these trends to worsen in Q4 2026 and persist in 2027",
           "resulted in employee casualties and injuries and halted manufacturing operations",
           "an accident at our manufacturing facility in Kiryat Gat, Israel",
           "we issued an aggregate of approximately 242 million shares of common stock in exchange for gross proceeds of $ 23.0 billion",
           "We received net proceeds of $ 22.6 billion", "at a price of $ 95.00 per share",
           "we recognized a $1.0 billion gain related to the net change in the fair value of shares",
           "driven by a decrease in our stock price",
           "In YTD 2026, we recognized a loss of $12.6 billion",
           "held in escrow to be released to the U.S. Department of Commerce (DOC)",
           "Secure Enclave"],
    SLIDES: ["$0.2B above July outlook", "2.1 ppts above July outlook", "$0.14 above July outlook",
             "Up $1.8B YoY", "23.4%", "41.5%", "(Gains) losses from divestiture (1.20)"],
    CALL: ["the strongest revenue growth for the segment in 15 years",
           "This marks the eighth consecutive quarter of exceeding our financial expectations",
           "We expect the 2026 PC unit TAM to decline approximately 12%, with second-half units down more than 20%",
           "For 2027, we're planning for the PC unit TAM to decline roughly 10%",
           "We expect CCPG revenue to decline greater than 20% sequentially",
           "an impact of roughly $300 million to revenue and 200 basis points to gross margin",
           "That is likely to be similar in the first quarter",
           "primarily reflects lower overall revenue against our fixed cost base",
           "we expect DCAI revenue to grow mid-teens percent sequentially",
           "External foundry revenue was $411 million",
           "I have consistently maintained that we will not disclose customer details",
           "Our 2026 gross capital expenditures remains on track to be $20 billion, and we expect 2027 gross capital spending to be up strongly",
           "So I don't think that this will be a year in which we see positive cash flow",
           "We expect the industry to remain supply constrained throughout 2027 and into 2028",
           "Intel Foundry reported an operating loss of $1.9 billion"],
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"')


def squash(s: str) -> str:
    """The PDF's text layer breaks lines mid-word, so slide phrases are matched with ALL whitespace gone."""
    return re.sub(r"\s+", "", s)


def B(x: float) -> str:
    return f"${x / 1000:.1f}B"


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("INTC")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    # SOURCE: raw numbers and phrases are in the files they are attributed to.
    release = (SRC / REL).read_text(encoding="utf-8")
    for k in Q:
        for v in (Q[k], Y.get(k)):
            if v is not None and f"{abs(v):,}" not in release:
                bad.append((f"release {k}", f"{v:,} not in the saved release"))
    for k, (a, b) in CF.items():
        for v in (a, b):
            if f"{v:,}" not in release:
                bad.append((f"release cf {k}", f"{v:,} not in the saved release"))
    for fn, phrases in SOURCES.items():
        body = (SRC / fn).read_text(encoding="utf-8")
        hay = squash(body) if fn == SLIDES else norm(body)
        for p in phrases:
            if (squash(p) if fn == SLIDES else norm(p)) not in hay:
                bad.append((fn, p))
    for name, fn, phrase, dc, ch, cc in HIST:
        s = norm((SRC / fn).read_text(encoding="utf-8"))
        if norm(phrase) not in s:
            bad.append((fn, phrase))
        need(f"hist {name}", f"| {name} | ${dc}B | {'+' if ch > 0 else '−'}{abs(ch)}% | ${cc}B |")
    for fn, cc in (("INTC-ex99_2-20260122.txt", "$8.2 billion"), ("INTC-ex99_2-20260423.txt", "$7.7 billion"),
                   ("INTC-ex99_2-20260723.txt", "$8.9 billion")):
        if cc not in (SRC / fn).read_text(encoding="utf-8"):
            bad.append((fn, f"CCPG {cc}"))

    # DERIVED from the raw numbers.
    assert round(pct(Q["rev"], Y["rev"])) == 21
    need("rev row", f"| Revenue | {B(Q['rev'])} | {B(Y['rev'])} | +21% |")
    need("gm row", "| Gross margin, non-GAAP | 44.1% | 40.0% | +4.1 points |")
    need("oi row", f"| Operating income, reported | {B(Q['oi'])} | {B(Y['oi'])} | |")
    assert round(pct(Q["ni"], Y["ni"])) == -18
    need("ni row", f"| Net income, reported | {B(Q['ni'])} | {B(Y['ni'])} | −18% |")
    need("eps rep", "| Earnings per share, reported | $0.60 | $0.90 | −33% |")
    need("eps ng", "| Earnings per share, non-GAAP | $0.52 | $0.23 | +126% |")
    need("altera", "worth $1.20 a share, from selling 51% of its Altera business")
    need("short rev", f"$16.5 billion, up 21% from $13.7 billion a year earlier, and $0.2 billion above the middle")
    assert round(pct(Q["dcai"], Y["dcai"])) == 78 and round(pct(Q["ccpg"], Y["ccpg"])) == -5
    need("short dcai", "$7.3 billion, up 78%")
    need("short pc", "$8.1 billion, down 5%")
    need("answer", "rose 21% to $16.5 billion")
    need("answer dc", "data-centre sales rose 78%")
    need("answer gm", "a gross margin six points lower")
    assert round(44.1 - 38.0) == 6
    need("july range", "$15.8 billion to $16.8 billion and non-GAAP earnings per share of $0.38")
    need("july rev row", "| Revenue | $16.3B | $16.5B | +$0.2B |")
    need("july gm row", "| Gross margin, non-GAAP | 42.0% | 44.1% | +2.1 points |")
    need("july eps row", "| Earnings per share, non-GAAP | $0.38 | $0.52 | +$0.14 |")
    need("dcai om", "from 23.4% to 41.5%")
    assert round(Q["dcai_oi"] / Q["dcai"] * 100, 1) == 41.5
    need("fc rev", "| Revenue | $16.5B | $15.0B to $16.0B |")
    need("fc gm", "| Gross margin, non-GAAP | 44.1% | 38.0% |")
    need("fc eps", "| Earnings per share, non-GAAP | $0.52 | $0.25 |")
    need("short fc", "fourth-quarter revenue of $15.0 billion to $16.0 billion, a non-GAAP gross margin of 38.0%")
    assert (16.5 - 15.5) == 1.0 and round(15.5 - 13.7, 1) == 1.8
    need("mid", "fourth-quarter revenue would be $1.0 billion lower than the third quarter's, though still $1.8 billion higher")
    need("pc tam", "fall about 12% in 2026, with the second half \"down more than 20%\", and \"roughly 10%\" in 2027")
    need("ccpg q4", "more than 20% from the third quarter")
    need("israel", "about $300 million of fourth-quarter revenue and 2 points of gross margin")
    need("fdy rev", f"| Revenue | {B(Q['fdy'])} | {B(Y['fdy'])} |")
    need("fdy oi", f"| Operating loss | −{B(-Q['fdy_oi'])} | −{B(-Y['fdy_oi'])} |")
    need("fdy ext", "| Sales to outside customers | $411M | |")
    need("fdy text", "still lost $1.9 billion")
    need("fdy ext text", "sales to outside customers were $411 million")
    need("14a", "0.9 version")
    for k, label in (("cfo", "Cash from operations"), ("capex", "Spent on property and equipment"),
                     ("fcf", "Adjusted free cash flow (Intel's measure)")):
        a, b = CF[k]
        need(f"cf {k}", f"| {label} | {B(a)} | {B(b)} |")
    need("offering", "about 242 million new shares at $95 each, raising $23.0 billion before costs, and $22.6 billion after")
    assert round((Q["cash"] + Q["sti"]) / 1000, 1) == 54.0 and round((Q["std"] + Q["ltd"]) / 1000, 1) == 50.1
    need("cash debt", "$54.0 billion of cash and short-term investments, and $50.1 billion of debt")
    need("capex 20", "on track to be $20 billion")
    need("escrow", "a $1.0 billion gain in the third quarter")
    need("escrow ytd", "a $12.6 billion loss for the first nine months")
    need("15 years", "in 15 years")
    need("eighth", "eighth consecutive quarter")

    # MEASURED: the history (frozen series) and the reaction (Nasdaq, after the 30 Oct close). The release-history
    # statistics are the 43 results BEFORE this one (earn_history.history), checked in measured().
    if "MOVE_" in raw or "FALLS_SECTION" in raw:
        bad.append(("placeholder", "MOVE_/FALLS_ placeholders still in the draft (the 30 Oct close is not in)"))
    else:
        measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2016", "2024", "2025", "2026", "2027", "2028", "26", "29", "30", "1", "2", "3", "5", "10", "14",
               "15", "20", "12", "0.9", "51", "4"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8")) for fn in SOURCES if fn != SLIDES)
    # Every quoted span, short ones included, so a short quote cannot shift the pairing of the ones after it.
    for q in re.findall(r'"([^"]+)"', text):
        if len(q) >= 8 and norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values())} source phrases, {len(bad)} failed (as at {f['as_of']})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


def measured(f: dict, need) -> None:  # noqa: ANN001
    """Filled in once the 30 October close is saved (MOVE_ / FALLS_ sections)."""
    rows = json.loads(sorted(SRC.glob("INTC-hist10y-*.json"))[-1].read_text(encoding="utf-8"))["payload"]["data"]["tradesTable"]["rows"]
    h = {r["date"]: float(r["close"][1:].replace(",", "")) for r in rows}
    c29, c30 = h["10/29/2026"], h["10/30/2026"]
    nxt = pct(c30, c29)
    need("29 close", f"Intel closed at ${c29:.2f} on 29 October")
    need("30 close", f"${c30:.2f}")
    need("answer move", f"its shares fell {abs(nxt):.1f}% the next day, their worst day since at least 1980")
    title = re.search(r"\*\*Title tag\*\* \| (.*?) \|", DRAFT.read_text(encoding="utf-8")).group(1)
    assert title == f"Intel beat its forecast. Its shares fell {abs(nxt):.1f}%.", title
    need("short move", f"down {abs(nxt):.1f}% the next day, to ${c30:.2f}, their worst day since at least 1980")
    need("section", f"the shares were at ${c30:.2f}, down {abs(nxt):.1f}%. That was Intel's worst day since at least March 1980")
    # The record claim: the worst one-day fall in the whole frozen series, which starts in March 1980.
    closes, dates = f["full_closes"], f["full_dates"]
    assert dates[0].startswith("1980-03") and dates[-1] == "2026-10-30", (dates[0], dates[-1])
    ch = sorted(((closes[i] / closes[i - 1] - 1) * 100, dates[i]) for i in range(1, len(closes)))
    assert ch[0][1] == "2026-10-30" and abs(ch[0][0] - nxt) < 0.01, ch[:2]
    assert ch[1][1] == "2024-08-02", ch[1]
    need("prev worst", f"the previous worst was a {abs(ch[1][0]):.1f}% fall on 2 August 2024")
    need("share sale", "investors paid $95 a share for $23.0 billion of new Intel stock")
    from earn_history import history, w as nw
    H = history(f, need)
    assert H["this"]["release"] == "2026-10-29" and abs(H["this"]["move"] - nxt) < 0.01, H["this"]
    need("rx n", f"all {H['n']} regular results releases from January 2016 to July 2026")
    need("rx 5/10", f"{H['over5']} of the {H['n']} moved by 5% or more, and {nw(H['over10'])} by 10% or more")
    need("rx updown", f"The shares rose after {H['up']} of the {H['n']} and fell after {H['down']}")
    falls = f["big_falls"]
    assert len(falls) == 7 and falls[-1]["recovery_date"] is None and f["first_bar"].startswith("1980")
    need("falls n", "Intel has fallen 40% or more seven times since 1980, the start of our price history")
    assert abs(f["ath_close"] - 140.94) < 0.01 and f["ath_date"] == "2026-06-22"
    need("falls now", f"record close of ${f['ath_close']:.2f} on 22 June 2026, and Intel is now {abs(f['below_ath']):.1f}% below it")
    closed = [e for e in falls if e["recovery_date"]]
    days = lambda e: (__import__("datetime").date.fromisoformat(e["recovery_date"]) - __import__("datetime").date.fromisoformat(e["trough_date"])).days  # noqa: E731
    q, sl = min(closed, key=days), max(closed, key=days)
    assert q["recovery_date"].startswith("1991") and 130 < days(q) < 165, q
    assert sl["trough_date"].startswith("2002") and days(sl) > 15 * 365, sl
    need("falls q", "The quickest was back about five months after its low, in 1991; the")
    need("falls s", "slowest, after the 2002 low, took more than 15 years")
    _ = date


if __name__ == "__main__":
    main()
