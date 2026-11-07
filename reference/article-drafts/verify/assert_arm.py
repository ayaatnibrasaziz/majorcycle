"""Assert every figure and quote in draft 24 (Arm, quarter to September 2026) against its source.

Same method as assert_pltr.py: SOURCE phrases in the saved letter and coverage; DERIVED comparisons recomputed;
MEASURED share-price history from earn_figures.figures() (frozen data) and checked against Nasdaq's saved history
to the cent (Arm pays no dividend); every number in the body must be one this file checks; every quotation must
appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_arm.py
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
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-arm-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "24-arm-q2-fy27-results.md"
SRC = ROOT / "arm-2026-q2" / "sources"
LET, FOOL, PRO = "ARM-exhibit992fye27q230-sepx26.txt", "fool-20261105.txt", "proactive-20261105.txt"
SOURCES = {
    LET: ["Total revenue (2) $1,443 $1,135 27%", "License and other revenue 773 515 50%", "Royalty revenue 670 620 8%",
          "Operating income (loss) 201 163 23% 638 467 37%", "Net income (loss) $ 130 $ 238",
          "Non-GAAP operating margin increased to 44.2% from 41.1%",
          "Non-GAAP earnings per share reached $0.52, up 33% year over year",
          "Total revenue increased 27% year-over-year to $1,443 million, representing our best ever second-quarter revenue",
          "partially offset by the impact of memory pricing on the smartphone market",
          "with data center royalties doubling year over year",
          "Arm-based server market share at the top hyperscalers more than tripled—from 15% in calendar 2024 to more than 50% in calendar 2025",
          "Revenue $1.38bn +/- $50m $1.443bn $1.54bn +/- $50m",
          "purchase orders secured from multiple customers extending through calendar 2027 and first commercial deliveries on track for fiscal Q4’27",
          "achieving up to $2 billion in Arm AGI CPU revenue over FY27–28",
          # owner 7 Nov, "more juice": the explanation, customers, cash and the forecast, and the CEO in his words
          "Other non-operating income (loss), net (2) 128", "Income (loss) before income taxes 208 302",
          "an important leading indicator of future royalty growth as these new designs enter production where we expect royalty revenue to accelerate",
          "Annualized contract value (ACV), a metric for normalized license and other revenue, increased 12% year-over-year to $1,790 million",
          "Physical AI royalty revenue grew 50% year over year",
          "our partners reported more than 10 billion Arm-based chips shipped during the quarter, an increase of 1.5 billion chips year over year",
          "Based on current ramps across Google Axion, AWS Graviton, Microsoft Cobalt, and NVIDIA platforms, we expect that share to exceed 60% by the end of calendar 2026",
          "Amazon recently reported that Graviton revenue commitments increased more than 20x year over year",
          "Arm-based PCs have now reached approximately 20% of global shipments",
          "already adopted by major smartphone vendors like OPPO and vivo", "with Xiaomi adopting the technology",
          "which equates to a GAAP gross margin of 97.1%", "Research and development (857) (691) 24%",
          "Net cash provided by (used for) operating activities 207 567", "Non-GAAP free cash flow trailing twelve months (TTM) 1,096",
          "short-term investments totaled $3,621", "$0.52 $0.56 +/- $0.04",
          "Our IP business continues to grow, with 50% licensing growth demonstrating the increasing investment in the power efficient Arm compute platform which will drive even higher royalty growth in the future",
          "Arm is becoming the compute platform of choice as AI transforms every market"],
    FOOL: ["handily topped estimates of $1.38 billion", "versus a consensus of $0.47",
           "Chief among the red flags behind today's sizable sell-off is Arm Holdings' Q2 royalty revenue"],
    PRO: ["with a midpoint of $1.54 billion against the $1.53 billion consensus"],
    # owner 7 Nov: lawsuits and other risks the company itself reports
    "ARM-6K-20260930.txt": [
        'On August 31, 2022, we sued Qualcomm Inc.',
        'On September 30, 2025, the Court affirmed the jury verdict',
        'granted Qualcomm judgment as a matter of law in its favor',
        'We have filed an appeal with the United States Court of Appeals for the Third Circuit, which is currently pending',
        'On April 18, 2024, Qualcomm brought a new action',
        'In October 2026, the Court held a jury trial',
        'The jury found in favor of Arm on four claims and in favor of Qualcomm on two claims, awarding nominal damages to Qualcomm',
        'the Court held a bench trial to determine whether Qualcomm can withhold certain royalties from Arm. The Court has not yet made a determination on this claim',
        'intend to vigorously defend against them',
    ],
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("ARM")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))
    assert (round(pct(1443, 1135)), round(pct(773, 515)), round(pct(670, 620)), round(pct(201, 163)), round(pct(130, 238))) == (27, 50, 8, 23, -45)
    need("answer", "Arm's revenue rose 27% to a record $1.44 billion in the quarter to September 2026, above analysts' forecasts. But its royalties, the fee it earns on every chip made with its designs, grew just 8%")
    need("short rev", "$1,443 million, up 27% from $1,135 million a year earlier, its best second quarter")
    need("short lic", "licence and other revenue of $773 million, up 50%")
    need("short roy", "royalty revenue of $670 million, up 8%")
    need("short ni", "net income of $130 million, down from $238 million")
    need("short eps", "earnings per share rose 33% to $0.52")
    need("short fc", "revenue of $1.54 billion, give or take $50 million, for the three months to December")
    for row in ("| Revenue | $1,443M | $1,135M | +27% |", "| Licence and other revenue | $773M | $515M | +50% |",
                "| Royalty revenue | $670M | $620M | +8% |", "| Operating income | $201M | $163M | +23% |",
                "| Net income | $130M | $238M | −45% |"):
        need(row, row)
    need("adj", "put operating income at $638 million, a margin of 44.2%, up from 41.1%")
    need("lic", "Licence revenue grew 50%. Royalty revenue grew 8%")
    need("cons", "analysts had expected revenue of $1.38 billion and adjusted earnings of $0.47 a share, according to the Motley Fool. Arm reported $1,443 million and $0.52")
    need("cons q3", "forecast of $1.54 billion compared with an analysts' consensus of $1.53 billion, according to Proactive")
    need("agi", "\"achieving up to $2 billion in Arm AGI CPU revenue over FY27-28\"")
    need("next fc", "lands near the $1.54 billion Arm expects")
    need("dc share", "rose from 15% in calendar 2024 to more than 50% in calendar 2025")
    assert round(pct(857, 691)) == 24
    need("ni why", "Arm had $128 million of other non-operating income; this quarter that line was a $2 million loss. So its income before tax was $208 million, against $302 million")
    need("acv", "rose 12% to $1,790 million")
    need("phys", "which Arm calls physical AI, grew 50%")
    need("chips", "more than 10 billion Arm-based chips in a quarter, 1.5 billion more than a year earlier")
    need("dc 60", "to pass 60% by the end of 2026")
    need("graviton", "Graviton revenue commitments increased more than 20x year over year")
    need("pc", "Arm-based PCs, it said, are now about 20% of global shipments")
    need("gm", "its gross margin was 97.1%")
    need("rd", "$857 million on research and development, up 24%")
    need("ocf", "fell to $207 million, from $567 million a year earlier, and its free cash flow over the past 12 months was $1,096 million")
    need("cash", "$3,621 million in cash and short-term investments")
    need("q3 eps", "earnings of $0.56 a share, give or take $0.04")

    need("legal 0", "which Arm brought in 2022, the court ruled in Qualcomm's favour in September 2025")
    need("legal 1", 'brought by Qualcomm in 2024, a jury found in October 2026')
    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2026", "2023", "2027", "4", "5", "30", "12", "50"}
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
    for r in json.loads((SRC / "ARM-hist10y-20261106.json").read_text(encoding="utf-8"))["data"]["tradesTable"]["rows"]:
        mm, dd, yy = r["date"].split("/")
        nq[f"{yy}-{mm}-{dd}"] = {k: float(r[k].strip("$").replace(",", "")) for k in ("close", "low")}
    for day in ("2026-06-18", "2026-11-04", "2026-11-05"):
        assert abs(c[day] - nq[day]["close"]) < 0.006, day
    c4, c5 = nq["2026-11-04"]["close"], nq["2026-11-05"]["close"]
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    mv = pct(c5, c4)
    assert this["release"] == "2026-11-04" and this["to"] == "2026-11-05" and abs(this["move"] - mv) < 0.01
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    ix = {k: {r[0]: float(r[3]) for r in full[k]} for k in ("^IXIC", "^GSPC")}
    nqm, spm = (pct(ix[k]["2026-11-05"], ix[k]["2026-11-04"]) for k in ("^IXIC", "^GSPC"))
    need("answer move", f"its shares fell {abs(mv):.1f}% the next day, a day the Nasdaq Composite fell {abs(nqm):.1f}%")
    need("short move", f"down {abs(mv):.1f}% on 5 November, to ${c5:.2f}, on a day the Nasdaq Composite fell {abs(nqm):.1f}%")
    need("4 close", f"Arm closed at ${c4:.2f} on 4 November")
    need("5 range", f"the shares were as low as ${nq['2026-11-05']['low']:.2f}, before closing at ${c5:.2f}, down {abs(mv):.1f}%")
    need("idx", f"The Nasdaq Composite fell {abs(nqm):.1f}% and the S&P 500 {abs(spm):.1f}%")
    assert f["ath_date"] == "2026-06-18" and f["as_of"] == "2026-11-05"
    need("record", f"That leaves Arm {abs(f['below_ath']):.1f}% below its record close of ${f['ath_close']:.2f}, set on 18 June 2026, though still up {f['ytd']:.1f}% this year")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 12 and before[0]["release"] == "2023-11-08" and before[-1]["release"] == "2026-07-29" and f["first_bar"] == "2023-09-14"
    need("rx n", f"all {n} quarterly results Arm released from November 2023, soon after it listed in September 2023, to July 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    assert (sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)) == (8, 4)
    need("rx 5", f"Eight of the {n} moved the shares 5% or more, and four 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in {my(w['release'])}")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in {my(b['release'])}")
    need("rx updown", f"The shares rose after {sum(v > 0 for v in m)} of the {n} and fell after {sum(v < 0 for v in m)}")
    assert sum(v < mv for v in m) == 2
    need("third", "So this was Arm's third-largest fall after results since it listed")
    falls = f["big_falls"]
    assert len(falls) == 5 and f["fall_threshold"] == -20 and falls[-1]["recovery_date"] is None
    need("falls n", "fallen 20% or more five times since they listed, counting this one")
    for e in falls:
        back = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {back} |")
    mo = lambda a, b: (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])  # noqa: E731
    longest = max(mo(e["peak_date"], e["recovery_date"]) for e in falls[:-1])
    assert 20 <= longest < 24, longest
    need("falls back", "The four earlier falls all got back to their record, the longest after almost two years")


if __name__ == "__main__":
    main()
