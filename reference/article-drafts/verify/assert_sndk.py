"""Assert every figure and quote in draft 17 (Sandisk, first quarter of fiscal 2027) against its source.

Same method as assert_intc.py / assert_amzn.py:
  * SOURCE  — every raw number, quote and phrase taken from Sandisk must appear, as written, in the saved source it
    is attributed to (release, call transcript, the four earlier results releases, the May 2026 10-Q);
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen data), and the actual closes from the
    saved Nasdaq history;
  * EVERY number in the body must be one this file checks (a restated figure is a second copy);
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_sndk.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

# Sandisk is in batch 2: its reaction is the 30 Oct close, frozen in its own file (see earn_figures.DATA).
os.environ.setdefault("EARN_DATA", str(Path(__file__).resolve().parents[2] / "earn-q3-2026b-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "17-sandisk-q1-fy27-results.md"
SRC = Path(__file__).resolve().parents[2] / "earnings-2026-q3" / "sources"
WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
REL = "SNDK-ex99_1-20261029.txt"
CALL = "sndk-ir/SNDK-Q1FY27-transcript-fool.txt"
AUG = "SNDK-ex99_1-20260805.txt"
TENQ = "SNDK-10Q-20260501.txt"

# --- REPORTED, $ millions (release: highlights tables, end-market summary, cash flow, reconciliation) ---
Q = {"rev": 11031, "oi": 8780, "ni": 8101, "dc": 4802, "edge": 5832, "cons": 397, "prev_rev": 8965,
     "cfo": 6363, "afcf": 5696, "buyback": 5000, "cash": 5136}
Y = {"rev": 2308, "oi": 176, "ni": 112, "dc": 269, "edge": 1387, "cons": 652}
# Five-quarter history: (label, file, revenue $M, GAAP gross margin %, data centre $M)
HIST = [("October 2025", "SNDK-ex99_1-20251106.txt", 2308, "29.8%", 269),
        ("January 2026", "SNDK-ex99_1-20260129.txt", 3025, "50.9%", 440),
        ("April 2026", "SNDK-ex99_1-20260430.txt", 5950, "78.4%", 1467),
        ("July 2026", AUG, 8965, "84.6%", 2977),
        ("October 2026", REL, 11031, "85.0%", 4802)]
SOURCES = {
    REL: ["Revenue | $11,031 | | $2,308 | | up 378%",
          "Gross Margin | 85.0% | | 29.8% | | up 55.2 ppt",
          "| $52.60 | | $0.75 |", "| $49.51 | | $1.22 |",
          "Edge | $5,832 | | $5,432 | | up 7% | | $1,387 | | up 320%",
          "Consumer | $397 | | $556 | | down 29% | | $652 | | down 39%",
          "Datacenter | $4,802 | | $2,977 | | up 61% | | $269",
          "Revenue | $12,200 - $12,600 |", "| 84.5% - 85.5% |", "| $55.00 - $57.00 |",
          "repurchase of approximately 3.2 million shares",
          "an eight-for-one forward stock split, effective November 19, 2026",
          "Cash and cash equivalents | $ | 5,136",
          "Adjusted free cash flow | $ | 5,696",
          "Net cash provided by operating activities | 6,363",
          "October 2,"],
    AUG: ["Expect first quarter 2027 revenue to be in the range of $10.30 billion to $10.80 billion",
          "in the range of $44.00 to $46.00"],
    TENQ: ["completed on February 21, 2025"],
    CALL: ["approximately 20% of industry bits early in the decade to roughly half of the industry bits today",
           "approximately 60% of the increase attributable to volume growth and 40% to higher pricing",
           "This compares favorably with our guidance range of 83% to 85%",
           "as the market adjusts to higher pricing",
           "partially offset by contraction at the lower end",
           "about 50% of our bits are under NBM for '27 and about 2/3 for '28",
           "Our NBM pipeline exceeds our supply throughout the end of the decade",
           "which includes modest like-for-like price increases",
           "pricing to continue to increase modestly throughout the year",
           "returning 100% of excess cash to shareholders",
           "Gross capital expenditures totaled $378 million, representing 3.4% of revenue",
           "represent mid-single-digit percentage of revenue for fiscal year 2027",
           "$5.1 billion in cash and cash equivalents and no debt",
           "non-GAAP EPS between $6.88 and $7.13",
           "trading on a split-adjusted basis is expected to begin on November 20",
           "bit demand growing about 40% year-on-year",
           "This is after more than doubling in 2026",
           "Non-GAAP gross margin for the first quarter was 85.1%"],
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"')


def B(x: float) -> str:
    return f"${x / 1000:.1f}B"


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("SNDK")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    release = (SRC / REL).read_text(encoding="utf-8")
    for d in (Q, Y):
        for k, v in d.items():
            if f"{v:,}" not in release:
                bad.append((f"release {k}", f"{v:,} not in the saved release"))
    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))
    for name, fn, rev, gm, dc in HIST:
        s = (SRC / fn).read_text(encoding="utf-8")
        for v in (f"{rev:,}", gm, f"{dc:,}"):
            if v not in s:
                bad.append((fn, f"history {name}: {v}"))
        need(f"hist {name}", f"| {name} | {B(rev)} | {gm} | {B(dc)} |")

    # DERIVED
    assert round(pct(Q["rev"], Y["rev"])) == 378 and round(pct(Q["rev"], Q["prev_rev"])) == 23
    need("answer", "revenue rose 378% to $11.0 billion in the three months to 2 October, its gross margin was 85.0%")
    need("answer ni", "$8.1 billion of net income, against $112 million a year earlier")
    need("short rev", "$11.0 billion, up 378% from $2.3 billion a year earlier, and up 23% from $9.0 billion")
    need("short gm", "a gross margin of 85.0%, against 29.8% a year earlier, and net income of $8.1 billion")
    assert round(pct(Q["dc"], 2977)) == 61
    need("short dc", "$4.8 billion of revenue, up 61% in three months, from $269 million a year earlier")
    need("short fc", "second-quarter revenue of $12.2 billion to $12.6 billion")
    need("short split", "eight shares for every one held, with split-adjusted trading expected to begin on 20 November")
    need("rev row", f"| Revenue | {B(Q['rev'])} | {B(Y['rev'])} | +378% |")
    need("gm row", "| Gross margin | 85.0% | 29.8% | +55.2 points |")
    need("oi row", f"| Operating income | {B(Q['oi'])} | {B(Y['oi'])} | |")
    need("ni row", f"| Net income | {B(Q['ni'])} | {B(Y['ni'])} | |")
    need("eps rep", "| Earnings per share, reported | $52.60 | $0.75 | |")
    need("eps ng", "| Earnings per share, non-GAAP | $49.51 | $1.22 | |")
    need("mix", "about 60% of the rise in revenue from the quarter before came from selling more and about 40% from higher prices")
    need("aug rev", "| Revenue | $10.3B to $10.8B | $11.0B |")
    need("aug gm", "| Gross margin, non-GAAP | 83% to 85% | 85.1% |")
    need("aug eps", "| Earnings per share, non-GAAP | $44 to $46 | $49.51 |")
    assert 11031 > 10800 and 49.51 > 46
    assert 4.5 < Q["rev"] / Y["rev"] < 5 and 17.5 < Q["dc"] / Y["dc"] < 18
    need("fivefold", "nearly fivefold and data-centre revenue nearly eighteenfold")
    need("dc row", f"| Data centre | {B(Q['dc'])} | {B(Y['dc'])} | |")
    assert round(pct(Q["edge"], Y["edge"])) == 320 and round(pct(Q["cons"], Y["cons"])) == -39
    need("edge row", f"| Edge (phones, PCs, cars) | {B(Q['edge'])} | {B(Y['edge'])} | +320% |")
    need("cons row", f"| Consumer | {B(Q['cons'])} | {B(Y['cons'])} | −39% |")
    need("cons q", "were $397 million, down 29% from the quarter before")
    need("nbm", "about 50% of its bits are under these agreements for 2027 and about two-thirds for 2028")
    need("cfo", f"| Cash from operations | {B(Q['cfo'])} |")
    need("afcf", f"| Adjusted free cash flow (Sandisk's measure) | {B(Q['afcf'])} |")
    need("bb", f"| Shares bought back | {B(Q['buyback'])} |")
    need("cash", f"| Cash at the end of the quarter | {B(Q['cash'])} |")
    need("bb text", "$5.0 billion buying back about 3.2 million of its own shares")
    need("100%", "returning \"100% of excess cash to shareholders\"")
    need("capex", "$378 million in the quarter, 3.4% of revenue")
    need("fc rev", "| Revenue | $12.2B to $12.6B | $11.0B |")
    need("fc gm", "| Gross margin, non-GAAP | 84.5% to 85.5% | 85.1% |")
    need("fc eps", "| Earnings per share, non-GAAP | $55.00 to $57.00 | $49.51 |")
    assert round(55 / 8, 2) == 6.88 and round(57 / 8, 3) == 7.125
    need("split eps", "$6.88 to $7.13")
    need("dc 40", "grows about 40% in 2027")
    need("feb 2025", "only since February 2025")

    if "MOVE_" in raw or "FALLS_SECTION" in raw or "BELOW_PCT" in raw:
        bad.append(("placeholder", "MOVE_/FALLS_/BELOW_ placeholders still in the draft (the 30 Oct close is not in)"))
    else:
        measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2025", "2026", "2027", "2028", "2", "8", "1", "17", "29", "30", "20", "19", "5"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8")) for fn in SOURCES)
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
    rows = json.loads(sorted(SRC.glob("SNDK-hist10y-*.json"))[-1].read_text(encoding="utf-8"))["payload"]["data"]["tradesTable"]["rows"]
    h = {r["date"]: float(r["close"][1:].replace(",", "")) for r in rows}
    c29, c30 = h["10/29/2026"], h["10/30/2026"]
    mv = pct(c30, c29)
    rec = max(h.values())
    assert rec == 2335.00 and abs(rec - f["ath_close"]) < 0.01, (rec, f["ath_close"])  # Sandisk pays no dividend
    bl = (1 - c30 / rec) * 100
    need("29 close", f"Sandisk closed at ${c29:,.2f} on 29 October")
    need("answer move", f"The next day, its shares fell {abs(mv):.1f}%, to ${c30:,.2f}, {bl:.1f}% below their June record close.")
    need("short move", f"down {abs(mv):.1f}% the next day, to ${c30:,.2f}, still {bl:.1f}% below the record close of ${rec:,.2f} set in June")
    import datetime as dt
    from earn_history import history, w as nw
    H = history(f, need)
    assert H["n"] == 6 and H["bigger"] == 1, H
    need("30 close", f"the shares were at ${c30:,.2f}, down {abs(mv):.1f}%. Of its six earlier results, only one was followed by a bigger move")
    need("rx 5/10", f"{nw(H['over5']).capitalize()} of the six moved by 5% or more, and {nw(H['over10'])} by 10% or more")
    need("rx updown", f"The shares rose after {nw(H['up'])} of the six and fell after {nw(H['down'])}")
    falls = f["big_falls"]
    assert len(falls) == 5 and falls[-1]["recovery_date"] is None
    need("falls n", "Sandisk has fallen 20% or more five times since it listed in February 2025, counting the current fall")
    closed = [e for e in falls if e["recovery_date"]]
    sl = max(closed, key=lambda e: (dt.date.fromisoformat(e["recovery_date"]) - dt.date.fromisoformat(e["trough_date"])).days)
    sd = (dt.date.fromisoformat(sl["recovery_date"]) - dt.date.fromisoformat(sl["trough_date"])).days
    assert 3.5 * 30.4 < sd < 4.6 * 30.4, sd
    need("falls s", "The first four got back to their record, the slowest about four months after its low")
    cur = falls[-1]
    assert cur["peak_date"] == "2026-06-25" and cur["trough_date"] == "2026-07-29"
    need("falls now", f"a record close of ${rec:,.2f} on 25 June 2026; at its lowest, on 29 July, the shares were {abs(cur['depth_pct']):.1f}% below it")
    title = re.search(r"\*\*Title tag\*\* \| (.*?) \|", DRAFT.read_text(encoding="utf-8")).group(1)
    assert title == f"Sandisk made $8.1 billion in a quarter. Its shares are {bl:.1f}% off their high.", title


if __name__ == "__main__":
    main()
