"""Assert every figure and quote in draft 26 (Novo Nordisk, third quarter 2026) against its source.

Same method as assert_alab.py: SOURCE phrases in the saved reports and CNBC; DERIVED comparisons recomputed;
MEASURED share-price history from earn_figures.figures() (frozen data, dividend-adjusted) with the November 2026
closes checked against Nasdaq's saved history to the cent (no dividend since August); every number in the body
must be one this file checks; every quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_nvo.py
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
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-nvo-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "26-novo-nordisk-q3-2026-results.md"
SRC = ROOT / "nvo-2026-q3" / "sources"
Q3, Q2, CNBC = "NVO-caq32026.txt", "NVO-caq22026.txt", "cnbc-20261104.txt"
SOURCES = {
    Q3: ["Net sales 79,195 6% 4%", "Adjusted operating profit 1 31,720 34% 27%", "Operating profit 23,011 (3%) (9%)",
         "a favourable comparison base following DKK 9 billion of company-wide transformation costs recognised in Q3 2025",
         "DKK 8.7 billion of non-cash impairment charges in the quarter, related to ziltivekimab (DKK 4.6 billion) and right-sizing of manufacturing network (DKK 4.1 billion)",
         "uptake driving Q3 2026 sales of DKK 5,394 million", "increased the total number of launched markets to eight",
         "with more than 50% share in the branded obesity market",
         "Wegovy® injectable 20,407", "Wegovy® pill 5,394", "Ozempic® 29,706", "Ozempic® pill / Rybelsus® 4,938",
         "Adjusted sales growth for 2026 is now expected to be -2% to +2% at CER and adjusted operating profit growth is now expected to be -2% to +2% at CER",
         "We delivered a stronger-than-expected third quarter and are raising our full-year outlook for adjusted sales and adjusted operating profit",
         "said Mike Doustdar, president and CEO of Novo",
         "preparing for the US launch of CagriSema in early 2027, subject to regulatory approval",
         "We are particularly pleased to see both US Operations and International Operations deliver sales growth this quarter",
         "delivered encouraging weight loss of 21% at week 68 in the REDEFINE 9 trial",
         "The improved outlook is driven by increased expectations for GLP-1 product sales",
          # owner 7 Nov, "more juice": where the sales came from, profit and cash, the CEO in his words
          "Ziltivekimab phase 3 trials ZEUS and HERMES did not meet the primary endpoint",
          "US Operations 41,880 2% 1%", "International Operations 37,315 10% 8%", "Obesity 26,146 24% 22%", "Diabetes 47,545 (3%) (5%)",
          "driven by GLP-1 volume growth in both operating units, partly offset by lower realised prices",
          "Ozempic® pill was launched in the US in May, with encouraging early momentum",
          "currently up around 100% compared with pre-launch levels under the Rybelsus",
          "Adjusted gross margin 82.1%", "Net profit 16,740 (16%)", "Free cash flow 1,2 28,483 (13%)",
          "9M 2026 cash from operations of DKK 121.0 billion",
          "DKK 61.9 billion returned to shareholders via: ◦ DKK 51.9 billion in dividends ◦ DKK 10.0 billion in share repurchases",
          "Our focus is on sustaining this progress through disciplined execution and broader access to our medicines",
          "CagriSema (1.0/1.0 mg) achieved superior weight loss of 12.4% compared with 9.1% for tirzepatide 5 mg"],
    Q2: ["Adjusted sales growth for 2026 is now expected to be 0% to -6% at CER and adjusted operating profit growth is now expected to be 0% to -6% at CER"],
    CNBC: ["Published Wed, Nov 4 2026 1:40 AM EST", "ahead of FactSet estimates of 73.6 billion kroner",
           "Adjusted operating profit (EBIT) was 31.7 billion kroner, compared with the expected 28.6 billion kroner"],
}
# owner 7 Nov: lawsuits and other risks the company itself reports (added to the file's own list, not replacing it)
SOURCES["NVO-caq32026.txt"] = SOURCES.get("NVO-caq32026.txt", []) + [
        'Novo is a defendant in multiple putative class action lawsuits in the U.S. District Court for the District of New Jersey related to an IT security incident that was disclosed by the company on 11 June 2026',
        "On 9 September, at the plaintiffs' request, the District Court dismissed the putative class actions without prejudice to refiling",
        "On 27 August 2026, the Fifth Circuit affirmed the Federal Court in Texas's dismissal decision",
        "challenging FDA's resolution of the semaglutide injectables shortage",
        'Novo Nordisk Inc. intervened in the litigation to oppose the relief sought by OFA and NACL',
        "Novo does not expect this matter to have a material impact on Novo's financial position, operating profit or cash flow",
    ]


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("−", "-").replace("®", "").replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("NVO")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))
    assert 4.6 + 4.1 == 8.7
    need("answer", "Novo Nordisk's sales rose 4% at constant exchange rates in the third quarter of 2026, to DKK 79.2 billion, and its new Wegovy pill sold DKK 5.4 billion")
    need("short sales", "DKK 79,195 million, up 4% at constant exchange rates")
    need("short dkk", "and up 6% in Danish kroner")
    need("short pill", "sales of DKK 5,394 million in the quarter")
    need("short profit", "adjusted operating profit of DKK 31,720 million, up 27% at constant exchange rates. Reported operating profit fell 9%, after DKK 8.7 billion of impairment charges")
    need("short outlook", "between −2% and +2% at constant exchange rates, up from 0% to −6% in August")
    for row in ("| Net sales | 79,195M | +6% | +4% |", "| Adjusted operating profit | 31,720M | +34% | +27% |",
                "| Operating profit | 23,011M | −3% | −9% |", "| Ozempic | 29,706M |", "| Wegovy, injectable | 20,407M |",
                "| Wegovy pill | 5,394M |", "| Ozempic pill and Rybelsus | 4,938M |",
                "| Adjusted sales growth | 0% to −6% | −2% to +2% |", "| Adjusted operating profit growth | 0% to −6% | −2% to +2% |"):
        need(row, row)
    need("impair", "DKK 8.7 billion of non-cash impairment charges: DKK 4.6 billion for ziltivekimab, a drug in development, and DKK 4.1 billion for")
    need("q3 2025", "DKK 9 billion of company-wide transformation costs recognised in Q3 2025")
    need("markets", "launched in eight markets")
    need("share", "\"more than 50% share in the branded obesity market\"")
    need("cons", "analysts had expected sales of DKK 73.6 billion and adjusted operating profit of DKK 28.6 billion, according to FactSet figures reported by CNBC. Novo reported DKK 79,195 million and DKK 31,720 million")
    need("next", "land within the −2% to +2% Novo now expects")
    need("cagri", "US launch in early 2027")
    need("redefine", "In the REDEFINE 9 trial it gave weight loss of 21% at week 68, Novo said")
    need("ceo", "Chief executive Mike Doustdar said: \"We delivered a stronger-than-expected third quarter")

    need("zilti", "did not meet the primary endpoint")
    for row in ("| US Operations | 41,880M | +1% |", "| International Operations | 37,315M | +8% |",
                "| Obesity medicines | 26,146M | +22% |", "| Diabetes medicines | 47,545M | −5% |"):
        need(row, row)
    need("ozp", "launched in the US in May")
    need("nbrx", "\"currently up around 100% compared with pre-launch levels under the Rybelsus\"")
    need("gm", "Novo's adjusted gross margin was 82.1%. Its net profit fell 16% to DKK 16,740 million")
    need("fcf", "its free cash flow was DKK 28,483 million, down 13%")
    need("9m", "DKK 121.0 billion of cash from its operations and returned DKK 61.9 billion to shareholders: DKK 51.9 billion in dividends and DKK 10.0 billion in share buybacks")
    need("rei5", "weight loss of 12.4% against 9.1% for tirzepatide 5 mg")
    need("t2d", "adults with type 2 diabetes")
    need("legal 0", 'disclosed on 11 June 2026. On 9 September')
    need("legal 1", 'on 27 August 2026 a US appeals court upheld the dismissal')
    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, norm(" ".join(s for _, s in want))))
    ALLOWED = {"2026", "2024", "1981", "3", "4", "5", "30", "1"}  # "1": GLP-1, a drug class
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
    c = dict(zip(f["full_dates"], f["full_closes"]))
    nq = {}
    for r in json.loads((SRC / "NVO-hist10y-20261106.json").read_text(encoding="utf-8"))["data"]["tradesTable"]["rows"]:
        mm, dd, yy = r["date"].split("/")
        nq[f"{yy}-{mm}-{dd}"] = float(r["close"].strip("$").replace(",", ""))
    for day in ("2026-11-03", "2026-11-04", "2026-11-05"):
        assert abs(c[day] - nq[day]) < 0.006, day
    c3, c4, c5 = nq["2026-11-03"], nq["2026-11-04"], nq["2026-11-05"]
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    mv = pct(c4, c3)
    assert this["release"] == "2026-11-04" and this["to"] == "2026-11-04" and abs(this["move"] - mv) < 0.01
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    ix = {k: {r[0]: float(r[3]) for r in full[k]} for k in ("^IXIC", "^GSPC")}
    sp4 = pct(ix["^GSPC"]["2026-11-04"], ix["^GSPC"]["2026-11-03"])
    nq5, sp5 = (pct(ix[k]["2026-11-05"], ix[k]["2026-11-04"]) for k in ("^IXIC", "^GSPC"))
    need("answer move", f"its US-listed shares rose {mv:.1f}% on results day, though they remain about {round(abs(f['below_ath'])):.0f}% below their 2024 record")
    need("short move", f"Novo's US-listed shares rose {mv:.1f}% on 4 November, to ${c4:.2f}")
    need("closes", f"closed at ${c3:.2f} on 3 November. On 4 November, the day of the results, they closed at ${c4:.2f}, up {mv:.1f}%. The S&P 500 rose {sp4:.1f}% the same day")
    need("5 nov", f"On 5 November, when the Nasdaq Composite fell {abs(nq5):.1f}% and the S&P 500 {abs(sp5):.1f}%, the shares fell back to ${c5:.2f}")
    assert f["ath_date"][:7] == "2024-06"
    need("record", f"Counting dividends, that leaves them {abs(f['below_ath']):.1f}% below their record close in June 2024")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 34 and before[0]["release"] == "2018-05-02" and before[-1]["release"] == "2026-08-04"
    need("rx n", f"all {n} of Novo's results from May 2018 to August 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    assert (sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)) == (9, 2)
    need("rx 5", f"Nine of the {n} moved the shares 5% or more, and two 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in {my(w['release'])}")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in {my(b['release'])}")
    need("rx updown", f"The shares rose on {sum(v > 0 for v in m)} of the {n} days and fell on {sum(v < 0 for v in m)}")
    assert sum(abs(v) > abs(mv) for v in m) == 9
    need("bigger", f"only nine of the {n} earlier results moved the shares more")
    falls = f["big_falls"]
    assert len(falls) == 6 and f["fall_threshold"] == -40 and falls[-1]["recovery_date"] is None and f["first_bar"].startswith("1981")
    need("falls n", "fallen 40% or more six times since 1981, the start of our price history, counting this one")
    for e in falls:
        back = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {back} |")
    yrs = max((int(e["recovery_date"][:4]) - int(e["peak_date"][:4])) + (int(e["recovery_date"][5:7]) - int(e["peak_date"][5:7])) / 12 for e in falls[:-1])
    assert 7 < yrs < 8, yrs
    need("falls back", "The five earlier falls all got back to their record, the longest after more than seven years")


if __name__ == "__main__":
    main()
