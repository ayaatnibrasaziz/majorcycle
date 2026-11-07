"""Assert every figure and quote in draft 21 (Apple, fourth quarter of fiscal 2026) against its source.

Same method as assert_amd.py: SOURCE phrases in the saved releases and call transcript; DERIVED figures recomputed
from the releases' own tables; MEASURED share-price history from `earn_figures.figures()` (frozen data) and closes
from the saved Nasdaq history; every number in the body must be one this file checks; every quotation word for
word in a saved source.

    python -I reference/article-drafts/verify/assert_aapl.py
"""

from __future__ import annotations

import json
import os
import re
import statistics
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-aapl-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "21-apple-q4-2026-results.md"
SRC = ROOT / "aapl-2026-q4" / "sources"
REL, CALL = "AAPL-ex99_1-20261102.txt", "AAPL-Q4-2026-transcript-fool.txt"
JUL, APR, JAN, OCT = ("AAPL-ex99_1-20260730.txt", "AAPL-ex99_1-20260430.txt", "AAPL-ex99_1-20260129.txt",
                      "AAPL-ex99_1-20251030.txt")
CNBC, GOT = "cnbc-20261104.txt", "gotrade-20261104.txt"

#: Three months to Sep 2026 against Sep 2025, $M, from the release's first table (each one is also a SOURCE phrase).
Q = {"rev": 114477, "prod": 82904, "serv": 31573, "gm": 54820, "opex": 19189, "rd": 11730, "ni": 30711,
     "iphone": 57583, "mac": 10792, "ipad": 6229, "wear": 8300, "china": 17539, "fy": 478834}
Y = {"rev": 102466, "prod": 73716, "serv": 28750, "gm": 48341, "opex": 15914, "rd": 8866, "ni": 27466,
     "iphone": 49025, "mac": 8726, "ipad": 6952, "wear": 9013, "china": 14493, "fy": 416161}
#: Gross margin and total net sales by quarter, $M (each release's first table).
GM = {"September 2025": (48341, 102466), "December 2025": (69231, 143756), "March 2026": (54781, 111184),
      "June 2026": (54770, 109417), "September 2026": (54820, 114477)}
SOURCES = {
    REL: ["Products $ 82,904 $ 73,716", "Services 31,573 28,750", "Total net sales (1) 114,477 102,466 478,834 416,161",
          "Gross margin 54,820 48,341", "Research and development 11,730 8,866", "Total operating expenses 19,189 15,914",
          "Net income $ 30,711 $ 27,466", "Diluted $ 2.10 $ 1.85", "Greater China 17,539 14,493",
          "iPhone $ 57,583 $ 49,025", "Mac 10,792 8,726", "iPad 6,229 6,952", "Wearables, Home and Accessories 8,300 9,013",
          "September quarter records for total company revenue", "Services revenue reaches new all-time high",
          "including a favorable impact of approximately 1 percentage point from tariff refunds",
          "and included a favorable impact of $0.05 from tariff refunds",
          "fiscal 2026 fourth quarter ended September 26, 2026"],
    JUL: ["Total net sales (1) 109,417 94,036", "Gross margin 54,770 43,718"],
    APR: ["Total net sales (1) 111,184 95,359", "Gross margin 54,781 44,867"],
    JAN: ["Total net sales (1) 143,756 124,300", "Gross margin 69,231 58,275", "Total operating expenses 18,379 15,443",
          "All-time records for total company revenue"],
    OCT: ["Total net sales (1) 102,466 94,930", "Gross margin 48,341 43,879"],
    CALL: ["We expect our December quarter total company revenue to grow between 7% and 10% year-over-year",
           "We expect this to be the best quarter for revenue in the history of the company",
           "We expect services revenue to grow between 8% and 9% year-over-year in the December quarter",
           "We expect gross margin to be between 45% and 46%",
           "We expect operating expenses to be between $20.4 billion and $20.8 billion",
           "including Mac and iPad at the end of June and iPhone in September",
           "we do expect OpEx to grow between 11% and 13% year-over-year"],
    CNBC: ["Apple shares rose 6%, reaching an all-time high", "Magnificent Seven stocks rallied Wednesday morning",
           "its iPad sales in the fiscal fourth-quarter missed the Street's estimates",
           "stands to benefit from the sweeping Democratic win"],
    GOT: ["rose 5.31% to close at $349.51 on November 4, 2026", "as big tech shares rallied",
          "after Democrats swept the midterm elections"],
}
#: Speaker of each attributed quotation (turns in the call transcript).
SPEAKER = {"supply constraints on iPhone, Mac and iPad": "Kevan Parekh", "a continued difficult compare": "Kevan Parekh",
           "memory pricing right now is unprecedented": "John Ternus", "even higher memory costs": "John Ternus",
           "includes primarily the impact of higher memory costs as well as some costs related to the ramp of Siri AI":
           "Kevan Parekh", "reflects our best view of constrained supply": "Kevan Parekh",
           "the best quarter for revenue in the history of the company": "Kevan Parekh",
           "including Mac and iPad at the end of June and iPhone in September": "John Ternus",
           "driven by increased and continued investment in R&D, in particular, AI": "Kevan Parekh",
           "installed base of over 2.5 billion active devices has reached another all-time high": "Kevan Parekh"}


def norm(s: str) -> str:
    s = re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"')
    return s.replace("‑", "-")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("AAPL")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))
    turns = re.split(r"\n\s*([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+)?): ", (SRC / CALL).read_text(encoding="utf-8"))
    for q, who in SPEAKER.items():
        said = {turns[i - 1] for i in range(2, len(turns), 2) if q in norm(turns[i])}
        if who not in said:
            bad.append((CALL, f"{q!r} not said by {who} (said by {sorted(said)})"))

    ch = {k: round(pct(Q[k], Y[k])) for k in Q}
    assert ch == {"rev": 12, "prod": 12, "serv": 10, "gm": 13, "opex": 21, "rd": 32, "ni": 12, "iphone": 17, "mac": 24,
                  "ipad": -10, "wear": -8, "china": 21, "fy": 15}, ch
    g = {k: round(a / b * 100, 1) for k, (a, b) in GM.items()}
    assert g == {"September 2025": 47.2, "December 2025": 48.2, "March 2026": 49.3, "June 2026": 50.1,
                 "September 2026": 47.9}, g
    gl = list(g.values())
    assert gl[0] < gl[1] < gl[2] < gl[3] > gl[4]  # three rises in a row, then a fall
    lo, hi = GM["December 2025"][1] * 1.07, GM["December 2025"][1] * 1.10
    assert round(lo / 1000, 1) == 153.8 and round(hi / 1000, 1) == 158.1 and lo > GM["December 2025"][1]
    eps = round(pct(2.10, 1.85))
    need("answer", f"Apple's revenue rose {ch['rev']}% to ${Q['rev'] / 1000:.1f} billion in its September quarter")
    need("answer best", "the best quarter for revenue in the history of the company")
    need("short rev", f"${Q['rev']:,} million, up {ch['rev']}% from ${Y['rev']:,} million a year earlier, a record for a September quarter")
    need("short iphone", f"${Q['iphone'] / 1000:.1f} billion, up {ch['iphone']}%")
    need("short ni", f"net income of ${Q['ni']:,} million, up {ch['ni']}%")
    need("short gm", f"{g['September 2026']}%, which Apple said included about 1 percentage point from tariff refunds, down from {g['June 2026']}%")
    need("short fc", "December-quarter revenue up 7% to 10%, with a gross margin of 45% to 46%")
    for row in [f"| Revenue | ${Q['rev']:,}M | ${Y['rev']:,}M | +{ch['rev']}% |",
                f"| Products | ${Q['prod']:,}M | ${Y['prod']:,}M | +{ch['prod']}% |",
                f"| Services | ${Q['serv']:,}M | ${Y['serv']:,}M | +{ch['serv']}% |",
                f"| Gross margin | {g['September 2026']}% | {g['September 2025']}% | +{g['September 2026'] - g['September 2025']:.1f} points |",
                f"| Operating expenses | ${Q['opex']:,}M | ${Y['opex']:,}M | +{ch['opex']}% |",
                f"| Net income | ${Q['ni']:,}M | ${Y['ni']:,}M | +{ch['ni']}% |",
                f"| Earnings per share | $2.10 | $1.85 | +{eps}% |",
                f"| iPhone | ${Q['iphone']:,}M | +{ch['iphone']}% |", f"| Mac | ${Q['mac']:,}M | +{ch['mac']}% |",
                f"| iPad | ${Q['ipad']:,}M | −{abs(ch['ipad'])}% |",
                f"| Wearables, Home and Accessories | ${Q['wear']:,}M | −{abs(ch['wear'])}% |",
                f"| Services | ${Q['serv']:,}M | +{ch['serv']}% |",
                f"| December 2026 (Apple's forecast) | 45% to 46% |",
                f"| Revenue | ${GM['December 2025'][1]:,}M | Up 7% to 10% |",
                f"| Gross margin | {g['December 2025']}% | 45% to 46% |",
                "| Operating expenses | $18,379M | $20.4B to $20.8B |"] + [f"| {k} | {v}% |" for k, v in g.items()]:
        need(row, row)
    need("serv ath", "Services revenue was an all-time high, and Parekh said Apple's \"installed base of over 2.5 billion active devices\"")
    need("eps tariff", "Apple said earnings per share included $0.05 from tariff refunds")
    need("rd", f"rose {ch['rd']}%, to ${Q['rd']:,} million")
    need("fy", f"revenue was a record ${Q['fy']:,} million, up {ch['fy']}%")
    need("china", f"sales in Greater China rose {ch['china']}%, to ${Q['china']:,} million")
    need("three rises", "It had risen for three quarters in a row before this one")
    need("fc $", f"revenue of about ${lo / 1000:.1f} billion to ${hi / 1000:.1f} billion, more than any quarter Apple has reported")
    need("serv fc", "services revenue to grow 8% to 9%")
    olo, ohi = 20400 / 18379 * 100 - 100, 20800 / 18379 * 100 - 100
    assert round(olo) == 11 and round(ohi) == 13
    need("opex g", 'He said operating expenses would grow 11% to 13%, "driven by increased and continued investment in R&D, in particular, AI"')
    # The draft names the same speaker as the transcript (SPEAKER), not just the right words.
    need("attr 1", 'Finance chief Kevan Parekh said the quarter had "supply constraints on iPhone, Mac and iPad"')
    need("attr 2", 'Chief executive John Ternus said "memory pricing right now is unprecedented"')
    need("attr 3", 'Parekh said the margin forecast "includes primarily the impact')
    need("attr 4", 'Ternus said Apple had changed the prices of many of its products')
    need("attr 5", 'Parekh said the forecast "reflects our best view of constrained supply"')
    need("next fc", "Whether December-quarter revenue grows 7% to 10%, to a record")
    need("next gm", "Whether it lands between 45% and 46%")
    need("next opex", "Operating expenses of $20.4 billion to $20.8 billion")

    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2025", "2026", "2016", "2019", "1980", "1", "26", "2", "3", "4", "500"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8", errors="replace")) for fn in SOURCES)
    for q in re.findall(r'"([^"]+)"', text):
        if len(q) >= 8 and norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values()) + len(SPEAKER)} source phrases, {len(bad)} failed (as at {f['as_of']})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


def measured(f: dict, need) -> None:  # noqa: ANN001
    MON = "January February March April May June July August September October November December".split()
    my = lambda d: f"{MON[int(d[5:7]) - 1]} {d[:4]}"  # noqa: E731
    rows = json.loads(sorted(SRC.glob("AAPL-hist10y-*.json"))[-1].read_text(encoding="utf-8"))["data"]["tradesTable"]["rows"]
    h = {r["date"]: float(r["close"][1:].replace(",", "")) for r in rows}
    c2, c3, c4 = h["11/02/2026"], h["11/03/2026"], h["11/04/2026"]
    d, c = f["full_dates"], dict(zip(f["full_dates"], f["full_closes"]))
    assert f["as_of"] == "2026-11-04" and abs(c["2026-11-03"] - c3) < 0.006 and abs(c["2026-11-02"] - c2) < 0.006
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    mv = pct(c3, c2)
    assert this["release"] == "2026-11-02" and abs(this["move"] - mv) < 0.01 and mv < 0
    need("answer move", f"its shares fell {abs(mv):.1f}% the next day, while the S&P 500 rose")
    need("short move", f"down {abs(mv):.1f}% the next day, to ${c3:,.2f}")
    need("2 close", f"Apple closed at ${c2:,.2f} on 2 November")
    need("3 close", f"the shares were at ${c3:,.2f}, down {abs(mv):.1f}%")
    from earn_figures import load
    full = load()["full"]
    ix = {t: {r[0]: float(r[3]) for r in full[t]} for t in ("^GSPC", "^IXIC")}
    sp, nq = pct(ix["^GSPC"]["2026-11-03"], ix["^GSPC"]["2026-11-02"]), pct(ix["^IXIC"]["2026-11-03"], ix["^IXIC"]["2026-11-02"])
    need("answer sp", f"while the S&P 500 rose {sp:.1f}%")
    need("idx", f"the S&P 500 rose {sp:.1f}% and the Nasdaq Composite {nq:.1f}%")
    m4 = pct(c4, c3)
    assert max(v for k, v in h.items() if k != "11/04/2026") < c4 and f["ath_date"] == "2026-11-04"
    need("4 nov", f"Apple rose {m4:.1f}% to ${c4:,.2f}, a record close")
    ye = h["12/31/2025"]
    need("ytd", f"the shares were up {pct(c4, ye):.0f}% since the end of 2025")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 43 and before[0]["release"] == "2016-01-26" and before[-1]["release"] == "2026-07-30"
    assert all(r["from"] == r["release"] for r in before)  # every one after the close
    assert "2019-01-02" not in [r["release"] for r in rx]
    need("rx n", f"all {n} results releases before this one, from January 2016 to July 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(x) for x in m):.1f}%**")
    o10 = sum(abs(x) >= 10 for x in m)
    need("rx 5/10", f"{sum(abs(x) >= 5 for x in m)} of the {n} moved by 5% or more, and {o10} by 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == before[-1]["release"]  # the largest fall followed the last results
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in {my(w['release'])}, after the last results")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in {my(b['release'])}")
    need("rx updown", f"The shares rose after {sum(x > 0 for x in m)} of the {n} and fell after {sum(x < 0 for x in m)}")
    need("more", f"{sum(abs(x) > abs(mv) for x in m)} of the {n} moved more than this one")
    falls = f["big_falls"]
    assert len(falls) == 8 and f["fall_threshold"] == -40 and f["first_bar"].startswith("1980")
    need("falls n", "Apple has fallen 40% or more eight times since 1980")
    for e in falls:
        back = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {back} |")
    yrs = lambda a, z: (date.fromisoformat(z) - date.fromisoformat(a)).days / 365.25  # noqa: E731
    assert all(e["recovery_date"] for e in falls)
    assert 8 < max(yrs(e["peak_date"], e["recovery_date"]) for e in falls) < 9
    assert max(yrs(e["trough_date"], e["recovery_date"]) for e in falls) < 2
    need("falls back", "The longest took more than eight years from the record; measured from the low, none took more than two years")


if __name__ == "__main__":
    main()
