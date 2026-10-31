"""Assert every figure and quote in draft 18 (ServiceNow, third quarter of 2026) against its source.

Same method as assert_sndk.py / assert_intc.py:
  * SOURCE  — every raw number, quote and phrase taken from ServiceNow must appear, as written, in the saved source it
    is attributed to (release, 10-Q, call transcript, the four earlier results releases);
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen data), and the actual closes from the
    saved Nasdaq history;
  * EVERY number in the body must be one this file checks (a restated figure is a second copy);
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_now.py
"""

from __future__ import annotations

import json
import os
import re
import statistics
import sys
from pathlib import Path

# ServiceNow is frozen with batch 2 (30 Oct), in its own file (see earn_figures.DATA).
os.environ.setdefault("EARN_DATA", str(Path(__file__).resolve().parents[2] / "earn-q3-2026b-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "18-servicenow-q3-2026-results.md"
SRC = Path(__file__).resolve().parents[2] / "earnings-2026-q3" / "sources"
REL = "NOW-ex99_1-20261028.txt"
TENQ = "NOW-10Q-20261028.txt"
CALL = "now-ir/NOW-Q3-2026-transcript-fool.txt"
OCT25, JAN, APR, JUL = "NOW-ex99_2-20251029.txt", "NOW-ex99_2-20260128.txt", "NOW-ex99_2-20260422.txt", "NOW-ex99_2-20260722.txt"

# --- REPORTED, $ millions (release: statement of operations, balance sheet, cash flows, reconciliation) ---
Q = {"sub": 3988, "rev": 4106, "oi": 385, "ni": 277, "fcf": 822, "amort": 198, "int": 81, "sev": 87,
     "goodwill": 10012, "acq9m": 9167, "bb9m": 2225}
Y = {"sub": 3299, "rev": 3407, "oi": 572, "ni": 502, "fcf": 592, "amort": 33, "int": 6, "sev": 24,
     "goodwill": 3578, "bb": 584}
# Forecast for growth in revenue under contract (cRPO, constant currency) and the actual, quarter by quarter:
# (quarter, file holding the forecast, forecast phrase, file holding the actual, actual phrase)
CRPO = [("December 2025", OCT25, "cRPO 23 % 19 %", JAN, "representing 25% year-over-year growth, 21% in constant currency"),
        ("March 2026", JAN, "cRPO 22.5 % 20 %", APR, "representing 22.5% year-over-year growth, 21% in constant currency"),
        ("June 2026", APR, "cRPO 19 % 19.5 %", JUL, "representing 21% year-over-year growth, 21.5% in constant currency"),
        ("September 2026", JUL, "cRPO 19.5 % 20 %", REL, "representing 20.5% year-over-year growth, 21% in constant currency"),
        ("December 2026", REL, "cRPO 18.5 % 18.5 %", None, None)]
SOURCES = {
    REL: ["Subscription revenues of $3,988 million in Q3 2026, representing 21% year-over-year growth",
          "Total revenues of $4,106 million in Q3 2026, representing 20.5% year-over-year growth",
          "raises AI annual contract value target again for 2026 to $1.7 billion",
          "Subscription | $ | 3,988 | | | $ | 3,299", "Total revenues | 4,106 | | | 3,407",
          "Income from operations | 385 | | | 572", "Net income | $ | 277 | | | $ | 502",
          "Net income per share - diluted (2) | $ | 0.27 | | | $ | 0.48",
          "Non-GAAP net income per share - diluted (2)(3) | $ | 1.00 | | | $ | 0.95",
          "Non-GAAP free cash flow | $ | 822 | | | $ | 592",
          "Non-GAAP operating margin | 32.5 | % | | 33.5 | %",
          "Amortization of purchased intangibles | 198 | | | 33",
          "Interest expense | (81) | | | (6)", "Severance costs | 87 | | | 24",
          "Goodwill | 10,012 | | | 3,578",
          "Business combinations, net of cash acquired | (391) | | (139) | | (9,167)",
          "Repurchases of common stock | — | | (584) | | (2,225)",
          "Subscription revenues | $4,245 - $4,255", "Subscription revenues | $15,780 - $15,790",
          "Income from operations | | | | | 31.5 | %", "Free cash flow | | | | | 36 | %",
          "five-for-one stock split, which was effective December 17, 2025",
          "from $1 billion at the start of the year to $1.7 billion now"],
    JUL: ["Subscription revenues | $3,975 - $3,980", "Income from operations | | | | | 31 | %"],
    TENQ: ["On April 20, 2026, we acquired all outstanding shares of Armis Security Ltd.",
           "preliminary purchase price consideration of approximately $ 7.6 billion, settled in cash",
           "a privately held AI identity security company", "for approximately $ 1.2 billion",
           "In April 2026, we borrowed an aggregate principal amount of $ 4.0 billion under a senior unsecured term loan",
           "In May 2026, we issued five series of fixed-rate senior unsecured notes for an aggregate principal amount of $ 4.0 billion",
           "Total senior notes | $ | 5,500 | $ | 1,500", "Commercial paper | $ | 2,100 | $ | —"],
    CALL: ["we saw strong early renewals in Q3 that contributed about half of the beat in Q3",
           "because we pulled those deals out of Q4 and into Q3",
           "Strong public sector demand is driving higher on-prem mix in Q4",
           "both of which contribute to revenue but not cRPO",
           "incremental investments in deployment expertise",
           "whether AI is cannibalistic or accretive to software companies",
           "but also in 2027, as Gina said, the true acceleration",
           "we've crossed $1 billion in efficiency gains",
           "our ultimate headcount has actually slightly declined",
           "raising our full year free cash flow margin target by 100 basis points from 35% to 36%"],
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"')


def B(x: float, d: int = 2) -> str:
    return f"${x / 1000:.{d}f}B"


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("NOW")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))
    for q, ffn, fp, afn, ap in CRPO:
        fc = re.search(r"cRPO [\d.]+ % ([\d.]+) %", fp).group(1)
        if norm(fp) not in norm((SRC / ffn).read_text(encoding="utf-8")).replace("| ", ""):
            bad.append((ffn, f"forecast for {q}: {fp}"))
        if afn:
            act = re.search(r"([\d.]+)% in constant currency", ap).group(1)
            if norm(ap) not in norm((SRC / afn).read_text(encoding="utf-8")):
                bad.append((afn, f"actual for {q}: {ap}"))
            assert 1 <= float(act) - float(fc) <= 2, (q, fc, act)
            need(f"crpo {q}", f"| {q} | {fc}% | {act}% |")
        else:
            need(f"crpo {q}", f"| {q} | {fc}% | |")

    # DERIVED
    assert round(pct(Q["sub"], Y["sub"])) == 21 and Q["sub"] - 3980 == 8
    need("answer", "subscription revenue rose 21% to $3.99 billion in the third quarter of 2026, above the top of its own")
    need("short rev", "subscription revenue of $3.99 billion, up 21% from $3.30 billion a year earlier, and $8 million")
    need("short ni", "net income of $277 million, down from $502 million a year earlier")
    need("short ai", "for the second time this year, to $1.7 billion")
    need("short fc", "to grow 18.5% in the fourth quarter, the lowest")
    need("sub row", f"| Subscription revenue | {B(Q['sub'])} | {B(Y['sub'])} | +21% |")
    assert round(pct(Q["rev"], Y["rev"]) * 2) / 2 == 20.5
    need("rev row", f"| Total revenue | {B(Q['rev'])} | {B(Y['rev'])} | +20.5% |")
    assert round(pct(Q["oi"], Y["oi"])) == -33 and round(pct(Q["ni"], Y["ni"])) == -45 and round(pct(Q["fcf"], Y["fcf"])) == 39
    need("oi row", "| Operating income | $385M | $572M | −33% |")
    need("ni row", "| Net income | $277M | $502M | −45% |")
    need("eps", "| Earnings per share, reported | $0.27 | $0.48 | |")
    need("eps ng", "| Earnings per share, non-GAAP | $1.00 | $0.95 | |")
    need("fcf row", "| Free cash flow (ServiceNow's measure) | $822M | $592M | +39% |")
    need("margin", "its operating margin was 32.5%, against 33.5% a year earlier")
    need("jul sub", "| Subscription revenue | $3,975M to $3,980M | $3,988M |")
    need("jul crpo", "| Revenue under contract for the next 12 months, growth | 20% | 21% |")
    need("jul om", "| Operating margin, non-GAAP | 31% | 32.5% |")
    need("amort", "| Amortisation of purchased intangibles | $198M | $33M |")
    need("int", "| Interest expense | $81M | $6M |")
    need("sev", "| Severance costs | $87M | $24M |")
    need("bb", "| Shares bought back | None | $584M |")
    need("gw", f"| Goodwill | {B(Q['goodwill'], 1)} | {B(Y['goodwill'], 1)} |")
    assert 5500 + 2100 == 7600
    need("debt", "| Debt (principal) | $7.6B | $1.5B |")
    need("acq", f"spent {B(Q['acq9m'], 1)[:-1]} billion on acquisitions in the first nine months of 2026")
    need("armis", "bought in April for about $7.6 billion in cash")
    need("veza", "about $1.2 billion")
    need("loan", "borrowed $4.0 billion in April, then issued $4.0 billion of bonds in May")
    need("debt mix", "$5.5 billion of bonds and $2.1 billion of commercial paper")
    need("bb9m", f"bought back {B(Q['bb9m'], 1)[:-1]} billion of its own shares earlier in the year")
    need("beat 1-2", "beat its own forecast by one or two points")
    need("ai target", "to $1.7 billion by the end of 2026, from $1 billion at the start of the year")
    need("q4 sub", "| Subscription revenue, fourth quarter | $4,245M to $4,255M |")
    need("fy sub", "| Subscription revenue, 2026 | $15,780M to $15,790M |")
    need("fy om", "| Operating margin, non-GAAP, 2026 | 31.5% |")
    need("fy fcf", "| Free cash flow margin, 2026 | 36%, up from 35% |")
    need("next", "by more than the 18.5% ServiceNow has forecast, as it has in each of the last four quarters")
    need("next debt", "How fast the $7.6 billion is paid down")

    if "MOVE_" in raw or "FALLS_SECTION" in raw:
        bad.append(("placeholder", "MOVE_/FALLS_ placeholders still in the draft"))
    else:
        measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2025", "2026", "2027", "2012", "2016", "1", "28", "29", "30", "12", "3", "4", "5"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8")) for fn in SOURCES)
    for q in re.findall(r'"([^"]+)"', text):
        if len(q) >= 8 and norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values()) + 2 * len(CRPO) - 1} source phrases, {len(bad)} failed (as at {f['as_of']})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


def measured(f: dict, need) -> None:  # noqa: ANN001
    rows = json.loads(sorted(SRC.glob("NOW-hist10y-*.json"))[-1].read_text(encoding="utf-8"))["payload"]["data"]["tradesTable"]["rows"]
    h = {r["date"]: float(r["close"][1:].replace(",", "")) for r in rows}
    c28, c29, c30 = h["10/28/2026"], h["10/29/2026"], h["10/30/2026"]
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    assert this["release"] == "2026-10-28" and abs(this["move"] - pct(c29, c28)) < 0.01, this
    mv = pct(c29, c28)
    need("28 close", f"ServiceNow closed at ${c28:,.2f} on 28 October")
    need("29 close", f"the shares were at ${c29:,.2f}, down {abs(mv):.1f}%, the worst day since it listed in June 2012")
    need("answer move", f"its shares fell {abs(mv):.1f}% the next day, their worst day since it listed in 2012")
    need("short move", f"down {abs(mv):.1f}% the next day, to ${c29:,.2f}, the worst day since ServiceNow listed in 2012")
    worst = min(range(1, len(f["full_closes"])), key=lambda i: f["full_closes"][i] / f["full_closes"][i - 1])
    assert f["full_dates"][worst] == "2026-10-29", f["full_dates"][worst]  # the worst one-day fall since the first bar
    assert f["first_bar"] == "2012-06-29"
    ath, ath_date = f["ath_close"], f["ath_date"]
    assert ath_date.startswith("2025-01") and abs(ath - h["01/28/2025"]) < 0.01
    need("30 close", f"On 30 October they closed at ${c30:,.2f}, {(1 - c30 / ath) * 100:.1f}% below their record close of ${ath:,.2f} in January 2025")
    last4 = [r["move"] for r in rx[-4:]]
    assert all(x < 0 for x in last4) and rx[-5]["move"] > 0
    need("four", f"by {abs(last4[0]):.1f}% in January, {abs(last4[1]):.1f}% in April, {abs(last4[2]):.1f}% in July")
    m = [r["move"] for r in before]
    n = len(before)
    need("rx n", f"all {n} regular results releases before this one, from January 2016 to July 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(x) for x in m):.1f}%**")
    need("rx 5/10", f"{sum(abs(x) >= 5 for x in m)} of the {n} moved by 5% or more, and eight by 10% or more")
    assert sum(abs(x) >= 10 for x in m) == 8
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"].startswith("2026-04") and b["release"].startswith("2025-04")
    assert all(abs(x) < abs(mv) for x in m)
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in April 2026")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in April 2025")
    need("rx updown", f"The shares rose after {sum(x > 0 for x in m)} of the {n} and fell after {sum(x < 0 for x in m)}")
    falls = f["big_falls"]
    assert len(falls) == 3 and f["fall_threshold"] == -40
    need("falls n", "ServiceNow has fallen 40% or more three times since it listed in 2012")
    MON = "January February March April May June July August September October November December".split()
    my = lambda d: f"{MON[int(d[5:7]) - 1]} {d[:4]}"  # noqa: E731
    for e in falls:
        back = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {back} |")
    assert falls[-1]["recovery_date"] is None and falls[-1]["depth_pct"] == min(e["depth_pct"] for e in falls)
    need("falls back", "about 12 and 14 months after their lows")


if __name__ == "__main__":
    main()
