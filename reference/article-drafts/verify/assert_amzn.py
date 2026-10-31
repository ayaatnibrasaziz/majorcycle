"""Assert every figure and quote in draft 16 (Amazon, third quarter 2026) against its source.

Same method as assert_msft.py / assert_intc.py:
  * SOURCE  — every raw number, quote and phrase taken from Amazon must appear, as written, in the saved source it
    is attributed to (release, 10-Q, the four earlier results releases);
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen data, batch 2) and the actual closes from
    the saved Nasdaq history;
  * EVERY number in the body must be one this file checks (a restated figure is a second copy);
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_amzn.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

# Amazon is in batch 2: its reaction is the 30 Oct close, frozen in its own file (see earn_figures.DATA).
os.environ.setdefault("EARN_DATA", str(Path(__file__).resolve().parents[2] / "earn-q3-2026b-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "16-amazon-q3-2026-results.md"
SRC = Path(__file__).resolve().parents[2] / "earnings-2026-q3" / "sources"
WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
REL = "AMZN-ex99_1-20261029.txt"
TENQ = "AMZN-10Q-20261030.txt"
JULY = "AMZN-ex99_1-20260730.txt"

# --- REPORTED, $ millions (release: statement of operations, segment information, cash flows, supplemental) ---
Q = {"rev": 201944, "aws": 45984, "intl": 43108, "oi": 28076, "ni": 20685, "aws_oi": 17773, "ads": 19637,
     "capex": 77259, "proc": 1381, "cfo": 42422}
Y = {"rev": 180169, "aws": 33006, "intl": 40896, "oi": 17422, "ni": 21187, "aws_oi": 11434, "ads": 17703,
     "capex": 35095}
# Five quarters: (label, AWS growth %, FCF TTM $M) from the release's supplemental table
HIST = [("Third quarter 2025", 20, 14788), ("Fourth quarter 2025", 24, 11194), ("First quarter 2026", 28, 1232),
        ("Second quarter 2026", 37, -7604), ("Third quarter 2026", 39, -42357)]
AWS_SRC = {"Third quarter 2025": ("AMZN-ex99_1-20251030.txt", "AWS segment sales increased 20% year-over-year to $33.0 billion"),
           "Fourth quarter 2025": ("AMZN-ex99_1-20260205.txt", "AWS segment sales increased 24% year-over-year to $35.6 billion"),
           "First quarter 2026": ("AMZN-ex99_1-20260429.txt", "AWS segment sales increased 28% year-over-year to $37.6 billion"),
           "Second quarter 2026": ("AMZN-ex99_1-20260730.txt", "AWS segment sales increased 37% year-over-year to $42.2 billion"),
           "Third quarter 2026": (REL, "AWS segment sales increased 39% year-over-year to $46.0 billion")}
DEBT = (65648, 173125)  # 10-Q balance sheet, long-term debt, Dec 2025 / Sep 2026
SOURCES = {
    REL: ["Operating income was $28.1 billion and operating margin was 13.9%—Amazon's highest operating margin ever",
          "its fastest growth in nearly five years",
          "Excluding this shift, third quarter year-over-year growth would have been approximately 400 basis points higher",
          "North America segment sales increased 6% year-over-year to $112.9 billion",
          "pre-tax gains of $9.5 billion in third quarter 2025 included in non-operating income (expense) from our investments in Anthropic",
          "a year-over-year increase of $94.8 billion in purchases of property and equipment",
          "This increase primarily reflects investments in artificial intelligence",
          "projected revenue growth rates of over 40% both in 2027 and in 2028",
          "Net sales are expected to be between $240.0 billion and $247.0 billion, or to grow between 12% and 16%",
          "Operating income is expected to be between $28.5 billion and $33.5 billion, compared with $25.0 billion in fourth quarter 2025",
          "We continue to expect 2026 cash capital expenditures to be approximately $220 billion",
          "We expect year-over-year advertising revenue to grow in the high teens in fourth quarter 2026",
          "Advertising revenue grew 12% year-over-year excluding changes in foreign exchange rates in the third quarter 2026 impacted by timing anomalies primarily related to Prime Day",
          "Operating margin -- % of AWS net sales | 32.9 | % | 34.6 | % | 35.0 | % | 37.7 | % | 39.4 | % | 38.7 | %",
          "Free cash flow is cash flow from operations reduced by"],
    JULY: ["Net sales are expected to be between $197.0 billion and $202.0 billion",
           "Operating income is expected to be between $22.5 billion and $26.5 billion"],
    TENQ: ["those commitments not yet recognized were estimated to be approximately $ 578 billion as of September 30, 2026",
           "The weighted-average remaining life of our long-term contracts is 6.1 years",
           "existing $ 38.0 billion multi-year commitment and commercial arrangement with OpenAI by $ 100.0 billion over 8.0 years",
           "by more than $ 100.0 billion over 10.0 years",
           "we invested $50.0 billion in OpenAI's Series C Preferred Stock",
           "and $10.0 billion in Anthropic nonvoting preferred stock",
           "had a carrying value of $ 16.2 billion and $ 143.7 billion",
           "We expect to undertake additional financing activities in 2026",
           "Long-term debt | 65,648 | 173,125 |"],
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
    f = figures("AMZN")
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
        body = norm((SRC / fn).read_text(encoding="utf-8"))
        for p in phrases:
            if norm(p) not in body:
                bad.append((fn, p))
    fcf_row = norm(release)
    for name, g, fcf in HIST:
        fn, phrase = AWS_SRC[name]
        if norm(phrase) not in norm((SRC / fn).read_text(encoding="utf-8")):
            bad.append((fn, phrase))
        cell = f"({abs(fcf):,})" if fcf < 0 else f"{fcf:,}"
        if cell not in fcf_row:
            bad.append((REL, f"FCF TTM {cell}"))
        need(f"hist {name}", f"| {name} | +{g}% | {'−' if fcf < 0 else ''}{B(abs(fcf))} |")

    # DERIVED
    assert round(pct(Q["rev"], Y["rev"])) == 12 and round(pct(Q["aws"], Y["aws"])) == 39
    need("rev row", f"| Revenue | {B(Q['rev'])} | {B(Y['rev'])} | +12% |")
    need("aws row", f"| AWS | {B(Q['aws'])} | {B(Y['aws'])} | +39% |")
    na, na0 = Q["rev"] - Q["intl"] - Q["aws"], Y["rev"] - Y["intl"] - Y["aws"]
    assert round(pct(na, na0)) == 6
    need("na row", f"| North America | {B(na)} | {B(na0)} | +6% |")
    need("intl row", f"| International | {B(Q['intl'])} | {B(Y['intl'])} | +{round(pct(Q['intl'], Y['intl']))}% |")
    need("ads row", f"| Advertising | {B(Q['ads'])} | {B(Y['ads'])} | +{round(pct(Q['ads'], Y['ads']))}% |")
    need("oi row", f"| Operating income | {B(Q['oi'])} | {B(Y['oi'])} | +{round(pct(Q['oi'], Y['oi']))}% |")
    need("ni row", f"| Net income | {B(Q['ni'])} | {B(Y['ni'])} | {round(pct(Q['ni'], Y['ni']))}% |".replace("| -", "| −"))
    need("eps row", f"| Earnings per share | $1.89 | $1.95 | {round(pct(1.89, 1.95))}% |".replace("| -", "| −"))
    need("oi 61", f"operating income rose {round(pct(Q['oi'], Y['oi']))}%")
    need("9.5", "$9.5 billion of pre-tax gains")
    need("short rev", f"$201.9 billion, up 12% from $180.2 billion a year earlier")
    need("short aws", f"{B(Q['aws'])[:-1]} billion, up 39%")
    need("short oi", f"operating income of {B(Q['oi'])[:-1]} billion, up from {B(Y['oi'])[:-1]} billion, and an operating margin of 13.9%")
    need("short capex", f"{B(Q['capex'])[:-1]} billion on property and equipment in the quarter, more than double the {B(Y['capex'])[:-1]} billion")
    assert Q["capex"] > 2 * Y["capex"]
    need("prime 4", "about 4 points")
    need("july rev", "| Revenue | $197.0B to $202.0B | $201.9B |")
    need("july oi", "| Operating income | $22.5B to $26.5B | $28.1B |")
    above = (Q["oi"] - 26500) / 1000
    assert round(above, 1) == 1.6
    need("above", f"operating income ${above:.1f} billion above the top of it")
    need("aws om", "operating margin was 38.7%")
    need("fcf from to", "went from a $14.8 billion inflow to a $42.4 billion outflow")
    need("94.8", "$94.8 billion rise")
    net = Q["capex"] - Q["proc"]
    q_fcf = Q["cfo"] - net
    need("q cfo", f"cash from operations was {B(Q['cfo'])[:-1]} billion")
    need("q net capex", f"net of sales and incentives, was {B(net)[:-1]} billion")
    need("q fcf", f"an outflow of {B(-q_fcf)[:-1]} billion in three months")
    need("debt row", f"| Long-term debt | {B(DEBT[0])} | {B(DEBT[1])} |")
    need("debt rise", f"long-term debt rose {(DEBT[1] - DEBT[0]) / 1000:.1f} billion".replace("rose ", "rose $"))
    need("220", "about $220 billion on capital this year")
    need("openai", "$50.0 billion into OpenAI and $10.0 billion into Anthropic")
    need("143.7", "carried at $143.7 billion")
    need("578", "about $578 billion")
    need("6.1", "6.1 years")
    need("deals", "by $100.0 billion over 8.0 years, and Anthropic expanded its commitment by more than $100.0 billion over 10.0 years")
    need("answer", "rose 12% to $201.9 billion, AWS grew 39%")
    need("answer capex", "it spent $77.3 billion on property and equipment")
    need("answer fcf", "an outflow of $42.4 billion")
    need("fc rev", "| Revenue | $240.0B to $247.0B | growth of 12% to 16% |")
    need("fc oi", "| Operating income | $28.5B to $33.5B | $25.0B |")
    need("ads 12", "after 12% growth this")
    need("about 100", "added about $100 billion each")

    if "MOVE_" in raw or "FALLS_SECTION" in raw:
        bad.append(("placeholder", "MOVE_/FALLS_ placeholders still in the draft (the 30 Oct close is not in)"))
    else:
        measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2025", "2026", "2027", "2028", "29", "30", "31", "40", "12", "1", "2", "3", "5", "10"}  # 10 = "10-Q"
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
    rows = json.loads(sorted(SRC.glob("AMZN-hist10y-*.json"))[-1].read_text(encoding="utf-8"))["payload"]["data"]["tradesTable"]["rows"]
    h = {r["date"]: float(r["close"][1:].replace(",", "")) for r in rows}
    c29, c30 = h["10/29/2026"], h["10/30/2026"]
    mv = (c30 / c29 - 1) * 100
    rx = f["reactions"][-1]
    assert rx["release"] == "2026-10-29" and abs(rx["move"] - mv) < 0.01, rx
    need("answer move", f"and its shares fell {abs(mv):.1f}% the next day.")
    need("short move", f"down {abs(mv):.1f}% the next day, to ${c30:,.2f}.")
    import datetime as dt
    from earn_history import history, w as nw
    H = history(f, need)
    need("29 close", f"Amazon closed at ${c29:,.2f} on 29 October")
    need("30 close", f"shares were at ${c30:,.2f}, down {abs(mv):.1f}%. Of the {H['n']} earlier results measured below, {H['bigger']} were followed by a bigger move")
    rec = max(h.values())
    assert abs(rec - f["ath_close"]) < 0.01 and f["ath_date"] == "2026-08-03", (rec, f["ath_close"], f["ath_date"])
    need("record", f"Amazon is now {abs(f['below_ath']):.1f}% below its record close of ${rec:,.2f}, set on 3 August 2026")
    need("rx n", f"all {H['n']} regular results releases before this one, from January 2016 to July 2026")
    need("rx 5/10", f"{H['over5']} of the {H['n']} moved by 5% or more, and {nw(H['over10'])} by 10% or more")
    need("rx updown", f"The shares rose after {H['up']} of the {H['n']} and fell after {H['down']}")
    falls = f["big_falls"]
    assert len(falls) == 5 and all(e["recovery_date"] for e in falls) and f["first_bar"].startswith("1997")
    need("falls n", "Amazon has fallen 40% or more five times since it listed in 1997")
    days = lambda e: (dt.date.fromisoformat(e["recovery_date"]) - dt.date.fromisoformat(e["trough_date"])).days  # noqa: E731
    q, sl = min(falls, key=days), max(falls, key=days)
    assert q["trough_date"].startswith("1999") and days(q) <= 62, q
    assert sl["trough_date"].startswith("2001") and 8 * 365 <= days(sl) < 8.5 * 365, sl
    need("falls q", "The quickest, in 1999, was back within about two months of its low; the")
    need("falls s", "slowest, after the 2001 low, took eight years")


if __name__ == "__main__":
    _ = json
    main()
