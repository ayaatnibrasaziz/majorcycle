"""Assert every figure and quote in draft 32 (Applied Materials, fourth quarter of fiscal 2026) against its source.

Same method as assert_ko.py:
  * SOURCE  — every raw number and phrase taken from Applied must appear, as written, in the saved document it is
    attributed to (the Q4 and Q3 releases, the Besi announcement), the results call as The Motley Fool transcribed it,
    Trefis (on Yahoo Finance) and GuruFocus (on TradingView);
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen, dividend-adjusted: the reactions, the falls)
    and the traded closes from Nasdaq's saved history (the record, the year, the week);
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_amat.py
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
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-amat-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "32-applied-materials-q4-fy26-results.md"
SRC = ROOT / "earn-2026-nov-b" / "amat"
REL, Q3, BESI, CALL, TREFIS, GURU = ("q4-release.txt", "q3-release.txt", "oct26-release.txt", "call-fool.txt",
                                     "news-yahoo.txt", "news-tradingview.txt")

REV, REV0, NI, NI0, EPS, EPS0, AEPS, AEPS0 = 10409, 6800, 2718, 1897, 3.40, 2.38, 4.16, 2.17
SEG = {"Chip-making machines": (7996, 4879), "Services and parts": (1896, 1506), "Other, mainly display": (517, 415)}
SOURCES = {
    REL: ["Revenue | $ | 10,409 | $ | 6,800 | $ | 34,446 | $ | 28,368 | 53% | 21%",
          "Gross margin | 50.4 | % | 48.0 | % | 50.0 | % | 48.7 | % | 2.4 points | 1.3 points",
          "Operating margin | 35.1 | % | 25.2 | % | 32.2 | % | 29.2 | % | 9.9 points | 3.0 points",
          "Net income | $ | 2,718 | $ | 1,897 | $ | 10,088 | $ | 6,998 | 43% | 44%",
          "Diluted earnings per share | $ | 3.40 | $ | 2.38 | $ | 12.62 | $ | 8.66 | 43% | 46%",
          "Non-GAAP diluted EPS | $ | 4.16 | $ | 2.17 | $ | 12.89 | $ | 9.42 | 92% | 37%",
          "Unrealized loss (gain) on strategic investments, net | 653 | (467) | (296) | (755)",
          "Semiconductor Systems | Q4 FY2026 | Q4 FY2025 | FY2026 | FY2025 (in millions, except percentages) Revenue | $ | 7,996 | $ | 4,879",
          "Foundry and logic | 58 | % | 66 | %", "DRAM | 33 | % | 28 | %", "Flash memory | 9 | % | 6 | %",
          "Applied Global Services | Q4 FY2026 | Q4 FY2025 | FY2026 | FY2025 (in millions, except percentages) Revenue | $ | 1,896 | $ | 1,506",
          "Revenue | $ | 517 | $ | 415 | $ | 1,403 | $ | 1,185",
          "Display operating segment financial results are included in the Other category",
          "Taiwan | $ | 2,916 | $ | 1,834 | $ | 8,818 | $ | 6,857 % of Total | 28 | % | 27 | %",
          "China | $ | 2,642 | $ | 1,964 | $ | 9,330 | $ | 8,529 % of Total | 25 | % | 29 | %",
          "Korea | $ | 1,811 | $ | 1,219 | $ | 6,362 | $ | 5,608 % of Total | 17 | % | 18 | %",
          "Total revenue | $ | 11,100 | +/- | $ | 500", "Non-GAAP diluted EPS | $ | 4.35 | +/- | $ | 0.20",
          "results for its fourth quarter and fiscal year ended Oct. 25, 2026",
          "Cash provided by operating activities | 3,300 | 2,828",
          "Common stock repurchases | (2,000) | (851)", "Payments of dividends to stockholders | (421) | (365)"],
    Q3: ["Total revenue | $ | 10,250 | +/- | $ | 500", "Non-GAAP diluted EPS | $ | 4.02 | +/- | $ | 0.20"],
    BESI: ["increasing its investment in BE Semiconductor Industries N.V. (Besi) (Euronext Amsterdam: BESI)",
           "to approximately 20 percent of Besi’s outstanding shares", "Oct. 26, 2026"],
    CALL: ["Applied delivered a record fiscal 2026 and our seventh consecutive year of growth",
           "we posted record revenue in both DRAM and advanced packaging",
           "So our share that's related to China or shipments to China will probably be less than 25% of the business as we look into '27",
           "We expect company revenue of $11.1 billion, plus or minus $500 million, which is up 58% year-over-year at the midpoint",
           "We expect non-GAAP EPS of $4.35, plus or minus $0.20, which is up 83% year-over-year",
           "we expect Semiconductor Systems revenue of around $8.7 billion, up 69% year-over-year",
           "to help with your modeling after the 14-week quarter",
           "We expect 2027 to be another record year for the market and for Applied",
           "wafer fab equipment demand will be up more than 30% year-over-year",
           "all the way from clean room construction to equipment components and raw material supply",
           "we're investing to be able to double our systems output from Q4 '26 levels by 2028",
           "with more than 10 major fabs and expansion projects added to our tracker for the third quarter in a row",
           "we're tracking more than 20 fab ramps and line expansions in 2027 alone",
           "Our largest customers are giving us rolling 8-quarter forecasts",
           "including the largest quarterly share buyback in over 8 years"],
    TREFIS: ["Applied Materials reported adjusted earnings per share of $4.16 for the quarter. Analysts expected $4.06. Revenue reached a company record of $10.4 billion, beating the $10.3 billion estimate"],
    GURU: ["The weak share reaction looks tied to the wider chip selloff after Nvidia's leadership change rather than to Applied's numbers"],
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
    f = figures("AMAT")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    assert (round(pct(REV, REV0)), round(pct(NI, NI0)), round(pct(EPS, EPS0)), round(pct(AEPS, AEPS0))) == (53, 43, 43, 92)
    need("t rev", "| Revenue | $10,409M | $6,800M | +53% |")
    need("t gm", "| Gross margin | 50.4% | 48.0% | +2.4 points |")
    need("t om", "| Operating margin | 35.1% | 25.2% | +9.9 points |")
    need("t ni", "| Net income | $2,718M | $1,897M | +43% |")
    need("t eps", "| Earnings per share | $3.40 | $2.38 | +43% |")
    need("t aeps", "| Adjusted earnings per share | $4.16 | $2.17 | +92% |")
    need("fy", "For the full financial year, revenue rose 21% to a record $34,446 million, and earnings per share rose 46% to $12.62")
    need("loss", "This quarter it recorded an unrealised loss of $653 million on them, which counts against reported profit. A year earlier it had recorded a gain of $467 million")
    for k, (a, b) in SEG.items():
        need(f"seg {k}", f"| {k} | ${a:,}M | ${b:,}M | +{round(pct(a, b))}% |")
    need("mix", "58% went to makers of logic chips, 33% to makers of DRAM memory and 9% to makers of flash memory. A year earlier the DRAM share was 28%")
    need("geo", "Taiwan was the largest customer at 28% of revenue, then China at 25%, down from 29% a year earlier, then Korea at 17%")
    need("s rev", "**Revenue:** $10,409 million, a record, up 53% from $6,800 million a year earlier")
    need("s semi", "revenue of $7,996 million, up 64%")
    need("s eps", "earnings per share of $3.40, up 43%. On Applied's own adjusted measure, $4.16, up 92%")
    lo, hi = 11.1 - 0.5, 11.1 + 0.5
    need("s fc", f"revenue of ${lo:.1f} billion to ${hi:.1f} billion in the next quarter, up 58% at the middle")
    need("s wfe", "Applied expects spending on chip-making equipment across the industry to rise more than 30% in 2027")
    need("answer", "Applied Materials' revenue rose 53% to a record $10.41 billion in the quarter to October 2026, above analysts' forecasts, and it expects 58% growth in the next quarter")
    need("est", "Analysts had expected adjusted earnings per share of $4.06 and revenue of $10.3 billion, Trefis reported. Applied reported $4.16 and $10,409 million")
    need("aug", f"revenue of ${10.25 - 0.5:.2f} billion to ${10.25 + 0.5:.2f} billion and adjusted earnings per share of ${4.02 - 0.2:.2f} to ${4.02 + 0.2:.2f}")
    need("q1 rev", "revenue of $11.1 billion, give or take $500 million, which Hill said is up 58% at the middle")
    need("q1 eps", "adjusted earnings per share of $4.35, give or take $0.20, which he said is up 83%")
    need("q1 semi", "revenue from chip-making machines of about $8.7 billion, up 69%, Hill said")
    need("14", "Hill described it as a 14-week quarter, a week longer than usual")
    need("10", "He said more than 10 new chip-factory projects had been added to Applied's tracker for the third quarter running")
    need("8q", "now give it rolling forecasts eight quarters ahead")
    need("besi", "On 26 October Applied agreed to raise its stake to about 20%")
    need("cash", "Applied generated a record $3,300 million of cash from operations in the quarter. It spent $2,000 million buying back its own shares")
    need("div", "and $421 million on dividends")
    need("next fc", f"Whether revenue for the quarter to January lands within ${lo:.1f} billion to ${hi:.1f} billion")

    measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2016", "2025", "2026", "2027", "2028", "1980", "2000", "4", "8", "12", "13", "17"}  # "4": Q4 inside a checked quote
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
    with open(SRC / "nasdaq-hist-AMAT-20261119.csv", encoding="utf-8") as fh:
        lines = list(fh)
    meta = lines[0]
    nq = {r["date"]: r for r in csv.DictReader(x for x in lines if not x.startswith("#"))}
    c = {k: float(v["close"]) for k, v in nq.items()}
    for d_ in ["11/11/2026", "11/12/2026", "11/13/2026", "11/05/2026"]:
        iso = f"{d_[6:]}-{d_[:2]}-{d_[3:5]}"
        assert abs(adj[iso] - c[d_]) < 0.006, (iso, adj[iso], c[d_])
    assert "max_close_in_window = 06/30/2026 723.00" in meta and "min_close_after_record = 11/05/2026 319.25" in meta
    assert f["ath_date"] == "2026-06-30"
    c11, c12, c13, rec, low, ye = (c["11/11/2026"], c["11/12/2026"], c["11/13/2026"], c["06/30/2026"], c["11/05/2026"],
                                   c["12/31/2025"])
    mv = pct(c13, c12)
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    assert this["release"] == "2026-11-12" and (this["from"], this["to"]) == ("2026-11-12", "2026-11-13")
    assert abs(this["move"] - mv) < 1e-3 and f["as_of"] == "2026-11-13"
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    sx = {r[0]: float(r[3]) for r in full["^GSPC"]}
    nx = {r[0]: float(r[3]) for r in full["^IXIC"]}
    spx, ndq = pct(sx["2026-11-13"], sx["2026-11-12"]), pct(nx["2026-11-13"], nx["2026-11-12"])
    need("answer move", f"Its shares still fell {abs(mv):.1f}% the next day, leaving them {abs(pct(c13, rec)):.1f}% below their June record, though up {pct(c13, ye):.1f}% this year")
    need("s move", f"down {abs(mv):.1f}% on 13 November, to ${c13:.2f}, after falling {abs(pct(c12, c11)):.1f}% on 12 November before the results")
    r13 = nq["11/13/2026"]
    need("day", f"Applied closed at ${c11:.2f} on 11 November. On 12 November, before the results came out, it fell {abs(pct(c12, c11)):.1f}% to ${c12:.2f}. On 13 November it opened at ${float(r13['open']):.2f}, fell as low as ${float(r13['low']):.2f}, and closed at ${c13:.2f}, down {abs(mv):.1f}%. The S&P 500 fell {abs(spx):.1f}% and the Nasdaq Composite {abs(ndq):.1f}% the same day")
    need("rec", f"That leaves the shares {abs(pct(c13, rec)):.1f}% below their record close of ${rec:.2f} on 30 June 2026, though still up {pct(c13, ye):.1f}% since the end of 2025. On 5 November they closed at ${low:.2f}, {abs(pct(low, rec)):.1f}% below the record")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 43 and before[0]["release"] == "2016-02-18" and before[-1]["release"] == "2026-08-13"
    assert any(r["release"] == "2024-05-16" for r in before)
    need("rx n", f"We measured all {n} of Applied's results releases before this one, from February 2016 to August 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    o5, o10 = sum(abs(v) >= 5 for v in m), sum(abs(v) >= 10 for v in m)
    need("rx 5", f"{o5} of the {n} moved the shares by 5% or more, and {o10} by 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2025-08-14" and b["release"] == "2016-05-19"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in August 2025")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in May 2016")
    assert all(v != 0 for v in m)
    need("rx updown", f"The shares rose after {sum(v > 0 for v in m)} of the {n} and fell after {sum(v < 0 for v in m)}")
    aug = before[-1]
    assert abs(aug["move"] - pct(c["08/14/2026"], c["08/13/2026"])) < 0.05  # the August bars carry one later dividend
    need("rx aug", f"The last results, in August 2026, sent the shares down **{abs(aug['move']):.1f}%**")
    need("bigger", f"So a {abs(mv):.1f}% fall is a small move for Applied: {sum(abs(v) > abs(mv) for v in m)} of the {n} earlier results moved the shares more")
    falls = f["big_falls"]
    assert len(falls) == 9 and f["fall_threshold"] == -55 and f["first_bar"] == "1980-03-17"
    need("falls n", "Counting dividends, Applied's shares have fallen 55% or more nine times since 1980, the start of our price history, including this year")
    for e in falls:
        rec_ = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {rec_} |")
    cur = falls[-1]
    assert cur["peak_date"] == "2026-06-30" and cur["trough_date"] == "2026-11-05" and not cur["recovery_date"]
    mon = lambda a, b: (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])  # noqa: E731
    done = falls[:-1]
    assert sum(mon(e["peak_date"], e["recovery_date"]) < 24 for e in done) == 6
    big = max(done, key=lambda e: mon(e["peak_date"], e["recovery_date"]))
    assert big["peak_date"].startswith("2000") and mon(big["peak_date"], big["recovery_date"]) // 12 == 17
    need("back", "The eight earlier falls all got back to their record. Six of them took less than two years from the record; the one that began in 2000 took 17 years")


if __name__ == "__main__":
    main()
