"""Assert every figure and quote in draft 19 (NAB, full year to September 2026) against its source.

Same method as assert_now.py:
  * SOURCE  — every raw number and phrase taken from NAB must appear, as written, in the saved document it is
    attributed to (Results Summary, MD&A, investor presentation, the 20 Oct announcement), and every close in
    ASX's own saved quote;
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen data); actual (traded) closes are
    rebuilt from the dividend-adjusted series with the one 2026 dividend, and the rebuild is checked against a
    close reported independently (18 Feb 2026, $47.14);
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_nab.py
"""

from __future__ import annotations

import json
import os
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# The November batch freezes in its own file (11ad), so nothing published can move.
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-nab-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "19-nab-fy26-results.md"
SRC = ROOT / "nab-2026-fy" / "sources"
SUM, MDA, PRES, OCT = ("2026-full-year-results-summary.raw.txt", "2026-full-year-results-management-discussion-analysis.raw.txt",
                       "2026-full-year-results-investor-presentation.raw.txt", "nab-20261020-operating-model.raw.txt")
BULL, AAP = "news4.txt", "news5.txt"

# --- REPORTED, A$ millions (Results Summary page 6) ---
Y26 = {"nii": 18512, "noi": 22014, "opex": 10292, "lni": 1347, "up": 10375, "cic": 1547, "cash": 6141, "cashx": 7090,
       "stat": 6143, "lni_at": 949, "bpb": 3685, "cib": 1740}
Y25 = {"nii": 17398, "noi": 20813, "opex": 9848, "up": 10965, "cic": 833, "cash": 7091, "cashx": 7091, "stat": 6759,
       "bpb": 3330, "cib": 1854}
H2, H1 = {"cashx": 3502, "cic": 841, "nim": 1.79}, {"cashx": 3588, "cic": 706, "nim": 1.81}
CIC_HIST = {"2022": 125, "2023": 802, "2024": 728, "2025": 833, "2026": 1547}  # Results Summary page 1 chart
SOURCES = {
    SUM: ["Net interest income 18,512 17,398 6.4 9,349 9,163 2.0",
          "Net operating income 22,014 20,813 5.8 11,144 10,870 2.5",
          "Operating expenses excluding large notable items (10,292) (9,848) 4.5 (5,274) (5,018) 5.1",
          "Large notable items before tax (1,347) - large - (1,347) large",
          "Credit impairment charge (1,547) (833) 85.7 (841) (706) 19.1",
          "Cash earnings 6,141 7,091 (13.4) 3,502 2,639 32.7",
          "Adjusted for: large notable items after tax 949 - large - 949 large",
          "Cash earnings excluding large notable items(2) 7,090 7,091 - 3,502 3,588 (2.4)",
          "Company 6,143 6,759 (9.1) 3,393 2,750 23.4",
          "Business and Private Banking 3,685 3,330 10.7 1,835 1,850 (0.8)",
          "Corporate and Institutional Banking 1,740 1,854 (6.1) 819 921 (11.1)",
          "Dividend per share (cents) 170 170 - 85 85 -",
          "Net interest margin (NIM) increased by 6 basis points (bps) to 1.80%",
          "6.9% underlying profit growth over FY26, excluding large notable items (LNIs)",
          "Australian business lending balances rose 9.8% in FY26",
          "The FY26 charge includes individually assessed charges of $1,083 million and collective provision charges of $464 million",
          "a net increase in forward-looking provisions of $403 million reflecting a more challenging economic outlook",
          "Group CET1 ratio of 11.87%", "approximately $0.9 billion",
          "Pro forma Group CET1 ratio of 12.07% reflecting expected impact of a 1.5% discount applied to the 2H26 dividend reinvestment plan",
          "compared with our target of greater than 11.25%",
          "expect underlying cost growth of less than 3%",
          "to 1.4% over 2026 and 1.0% over 2027",
          "in the unemployment rate to around 5.5% by early 2028",
          "1,381 (7.0)", "85 cps", "100% franked"],
    MDA: ["an increase in the threshold at which software is to be capitalised from $5 million to $20 million to align to peer practice",
          "a reduction in the useful life of capitalised software assets",
          "There is no impact on the Group's CET1 capital ratio given capitalised software balances are already deducted from Group CET1 capital",
          "Net interest margin 1.80% 1.74% 6 bps 1.79% 1.81% (2 bps)"],
    PRES: ["early signs of stress primarily across B&PB business lending",
           "impact of house price declines on", "APRA minimum CET1 ratio is currently 10.25%",
           "New Zealand Banking3 1,381 (7.0%)"],
    OCT: ["reduce its internal workforce by up to 2,500 roles or ~6%", "in FY27",
          "We are particularly focused on reducing the size of corporate functions",
          "restructuring charge of approximately $300m pre-tax in FY27", "Tuesday, 20 October 2026"],
    BULL: ["consensus estimates of approximately $6,382 million", "consensus estimates of $1,327 million"],
    AAP: ["it’s probably increased in terms of its probability of an occurrence",
          "Irvine said the bank was not predicting a recession, but admitted the chances were growing"],
}
# Ex-dividend 7 May 2026, 85 cents (nab.com.au, saved for the RBA article).
DIV_2026 = ("2026-05-07", 0.85)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def M(x: int) -> str:
    return f"${x:,}M"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("NAB.AX")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    # DERIVED
    a, b = Y26, Y25
    assert round(pct(a["cash"], b["cash"]), 1) == -13.4 and round(pct(a["stat"], b["stat"]), 1) == -9.1
    assert round(pct(a["nii"], b["nii"]), 1) == 6.4 and round(pct(a["noi"], b["noi"]), 1) == 5.8
    assert round(pct(a["opex"], b["opex"]), 1) == 4.5 and round(pct(a["cic"], b["cic"]), 1) == 85.7
    assert a["cashx"] - a["cash"] == a["lni_at"] and abs(a["cashx"] - b["cashx"]) <= 1
    assert round(pct(a["up"] + a["lni"], b["up"]), 1) == 6.9
    assert round(pct(a["bpb"], b["bpb"]), 1) == 10.7 and round(pct(a["cib"], b["cib"]), 1) == -6.1
    assert 1083 + 464 == a["cic"]
    need("answer", "cash earnings fell 13.4% to $6.14 billion in the year to September 2026, mostly because of a $1.35 billion software write-down")
    need("short cash", "of $6,141 million, down 13.4% from $7,091 million")
    need("short lni", "a $1,347 million charge, $949 million after tax")
    need("short cashx", "cash earnings were $7,090 million, flat on a year earlier")
    need("short cic", "a credit impairment charge of $1,547 million, up from $833 million")
    need("short div", "a final dividend of 85 cents, fully franked, the same as a year ago, for 170 cents for the year")
    for lbl, k, ch in [("Net interest income", "nii", "+6.4%"), ("Net operating income", "noi", "+5.8%"),
                       ("Operating expenses, without the write-down", "opex", "+4.5%"), ("Credit impairment charge", "cic", "+85.7%"),
                       ("Cash earnings", "cash", "−13.4%"), ("Cash earnings, without the write-down", "cashx", "Flat"),
                       ("Statutory net profit", "stat", "−9.1%")]:
        need(f"row {k}", f"| {lbl} | {M(a[k])} | {M(b[k])} | {ch} |")
    need("row div", "| Dividend per share | 170c | 170c | Flat |")
    need("nim", "was 1.80% for the year, up 0.06 of a percentage point")
    need("up", "its underlying profit, before bad debts and tax, rose 6.9%")
    need("sw threshold", "from $5 million to $20 million")
    need("sw charge", "That produced the $1,347 million charge")
    for y, v in CIC_HIST.items():
        need(f"cic {y}", f"| {y} | {M(v)} |")
    need("cic split", "$1,083 million was for individual customers, mainly businesses, and $464 million was")
    need("flp", "including $403 million set aside")
    assert round(pct(H2["cashx"], H1["cashx"]), 1) == -2.4 and round(pct(H2["cic"], H1["cic"]), 1) == 19.1
    need("h cashx", f"| Cash earnings, without the write-down | {M(H2['cashx'])} | {M(H1['cashx'])} | −2.4% |")
    need("h cic", f"| Credit impairment charge | {M(H2['cic'])} | {M(H1['cic'])} | +19.1% |")
    need("h nim", "| Net interest margin | 1.79% | 1.81% | −0.02 points |")
    need("consensus", "a charge of about $1,327 million and cash earnings of about $6,382 million")
    need("consensus vs", "NAB reported $1,547 million and $6,141 million")
    need("bpb", "Business and Private Banking division earned $3,685 million, up 10.7%")
    need("aus bl", "business lending grew 9.8% over the year")
    need("cib", "earned $1,740 million, down 6.1%")
    need("nz", "earned NZ$1,381 million, down 7.0% in New Zealand dollars")
    need("jobs", "On 20 October, two weeks before the results, NAB said it would cut up to 2,500 roles, about 6% of its workforce")
    need("jobs fy", "in the year to September 2027")
    need("restructure", "a restructuring charge of about $300 million")
    need("costs", "underlying costs to grow by less than 3%")
    need("gdp", "grow 1.4% in 2026 and 1.0% in 2027")
    need("unemp", "to rise to about 5.5% by early 2028")
    need("ceo", "Chief executive Andrew Irvine said he did not see a recession as the most likely outcome")
    need("cet1", "was 11.87% at 30 September, against a regulatory minimum of 10.25% and NAB's own target of more than 11.25%")
    need("drp", "at a 1.5% discount")
    need("drp raise", "about $0.9 billion and lift the ratio to about 12.07%")
    need("next costs", "by less than the 3% NAB expects, as it cuts up to 2,500 roles")
    need("next div", "The final dividend of 85 cents goes ex-dividend on 10 November and is paid on 15 December 2026")

    if "MOVE_" in raw or "PENDING" in raw:
        bad.append(("placeholder", "placeholders still in the draft"))
    else:
        measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2025", "2026", "2027", "2016", "2020", "1988", "30", "4", "5", "8", "12", "1", "20", "10", "15",
               "2023", "2028", "2030"}
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


def asx(sym: str, kind: str = "header") -> dict:
    return json.loads(sorted(SRC.glob(f"{sym}-asx-{kind}-*.json"))[-1].read_text(encoding="utf-8"))["data"]


def measured(f: dict, need) -> None:  # noqa: ANN001
    MON = "January February March April May June July August September October November December".split()
    my = lambda d: f"{MON[int(d[5:7]) - 1]} {d[:4]}"  # noqa: E731
    d, c = f["full_dates"], dict(zip(f["full_dates"], f["full_closes"]))
    hdr, ks = asx("NAB"), asx("NAB", "keystats")
    c4, c5 = ks["priceClose"], hdr["priceLast"]
    # Our stored closes agree with ASX's to the cent (no dividend since 7 May, so they are the traded closes).
    assert d[-1] == "2026-11-05" and abs(c["2026-11-05"] - c5) < 0.006 and abs(c["2026-11-04"] - c4) < 0.006, (c5, c4)
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    mv = pct(c5, c4)
    assert this["release"] == "2026-11-05" and abs(this["move"] - mv) < 0.01 and abs(mv - hdr["priceChangePercent"]) < 0.01
    xjo = asx("XJO")["priceChangePercent"]
    peers = {k: asx(k)["priceChangePercent"] for k in ("CBA", "WBC", "ANZ")}
    assert abs(peers["CBA"]) < 0.05
    need("answer move", f"its shares fell {abs(mv):.1f}% on results day, while the ASX 200 rose {xjo:.1f}%")
    need("short move", f"down {abs(mv):.1f}% on the day, to ${c5:.2f}, while the S&P/ASX 200 rose {xjo:.1f}%")
    need("4 close", f"NAB closed at ${c4:.2f} on 4 November")
    need("5 close", f"the shares closed that day at ${c5:.2f}, down {abs(mv):.1f}%, having been as low as ${ks['priceDayLow']:.2f} during the day")
    need("xjo", f"The S&P/ASX 200 rose {xjo:.1f}% the same day")
    need("peers", f"Commonwealth Bank closed flat and ANZ fell {abs(peers['ANZ']):.1f}%. Westpac fell {abs(peers['WBC']):.1f}%")
    # 5 Nov was Westpac's ex-dividend day (its own Appendix 3A.1, saved with the Westpac sources).
    wdiv = norm((ROOT / "wbc-2026-fy" / "sources" / "wbc-fy26-dividend.raw.txt").read_text(encoding="utf-8"))
    assert "Ex Date 5/11/2026" in wdiv and "AUD 0.77000000" in wdiv
    need("wbc exdiv", "but 5 November was its ex-dividend day: from then, buyers no longer received its 77-cent final dividend")
    # Actual record close: undo the one 2026 dividend for days before its ex-date.
    ex, div = DIV_2026
    prev = c[d[d.index(ex) - 1]]
    k = prev / (prev + div)
    actual = lambda day: c[day] / (k if day < ex else 1)  # noqa: E731
    assert abs(actual("2026-02-18") - 47.14) < 0.006  # Motley Fool Australia, 18 Feb 2026
    since = [x for x in d if x >= "2015-01-01"]
    rec = max(since, key=actual)
    assert rec == "2026-02-25" == f["ath_date"], rec
    ath = actual(rec)
    need("record", f"That leaves NAB {(1 - c5 / ath) * 100:.1f}% below its record close of ${ath:.2f} on 25 February 2026")
    need("record adj", f"Counting dividends, the shares are now {abs(f['below_ath']):.1f}% below their February 2026 record")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 20 and before[0]["release"] == "2016-05-05" and before[-1]["release"] == "2026-05-04"
    need("rx n", f"all {n} half-year and full-year results NAB released from May 2016 to May 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(x) for x in m):.1f}%**")
    over5 = [r for r in before if abs(r["move"]) >= 5]
    assert len(over5) == 1 and over5[0]["release"] == "2023-05-04"
    need("rx 5", f"Only one of the {n} moved by 5% or more: May 2023")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2023-05-04" and b["release"] == "2020-11-05"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in May 2023")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in November 2020")
    need("rx updown", f"The shares rose on {sum(x > 0 for x in m)} of the {n} days and fell on {sum(x < 0 for x in m)}")
    assert sum(abs(x) > abs(mv) for x in m) == 1
    need("second", "So this was NAB's second-largest results-day fall in more than ten years")
    falls = f["big_falls"]
    assert len(falls) == 4 and f["fall_threshold"] == -30 and f["first_bar"].startswith("1988")
    need("falls n", "fallen 30% or more four times since 1988")
    for e in falls:
        back = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {back} |")
    assert all(e["recovery_date"] for e in falls)
    lows = [(int(e["recovery_date"][:4]) - int(e["trough_date"][:4])) for e in falls]
    assert max(lows) == 4 and falls[1]["trough_date"][:7] == "2009-03" and falls[1]["recovery_date"][:7] == "2013-03"
    need("falls back", "All four got back to their record, the longest four years after its low")


if __name__ == "__main__":
    main()
