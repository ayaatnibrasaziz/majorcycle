"""Assert every figure and quote in draft 22 (Westpac, full year to September 2026) against its source.

Same method as assert_nab.py:
  * SOURCE  — every raw number and phrase taken from Westpac must appear, as written, in the saved document it is
    attributed to (results, media release, investor pack, dividend notice), and every analyst figure in the saved
    ABC News blog;
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen data); actual (traded) closes are rebuilt
    from the dividend-adjusted series with Westpac's two 2026 dividends, and the rebuild is checked against ASX's
    own quote for 5 November (last $36.64, change -$0.37, so $37.01 on 4 November);
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_wbc.py
"""

from __future__ import annotations

import json
import os
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-wbc-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "22-westpac-fy26-results.md"
SRC = ROOT / "wbc-2026-fy" / "sources"
RES, MED, PACK, DIV, ABC = ("wbc-fy26-results-announcement.raw.txt", "wbc-fy26-media-release.raw.txt",
                            "wbc-fy26-investor-pack.raw.txt", "wbc-fy26-dividend.raw.txt", "abc-2026-11-02.txt")

# --- REPORTED, A$ millions, excluding Notable Items (media release, Financial Summary) ---
Y26 = {"nii": 19687, "noi": 22708, "opex": 11781, "ppp": 10927, "imp": 864, "np": 6992, "stat": 6813,
       "cons": 3616, "bw": 3755, "inst": 2342, "nz": 1298}
Y25 = {"nii": 19473, "noi": 22464, "opex": 11916, "ppp": 10548, "imp": 424, "np": 6972, "stat": 6916,
       "cons": 3437, "bw": 3383, "inst": 2161, "nz": 1472}
H2, H1 = {"imp": 421, "nim": 1.86}, {"imp": 443, "nim": 1.89}
SOURCES = {
    MED: ["Net interest income 19,687 19,473 1 9,924 9,763 2",
          "Net operating income 22,708 22,464 1 11,424 11,284 1",
          "Operating expenses (11,781) (11,916) (1) (5,951) (5,830) 2",
          "Pre-provision profit 10,927 10,548 4 5,473 5,454 -",
          "Impairment (charges)/benefits (864) (424) 104 (421) (443) (5)",
          "Net profit excluding Notable Items 6,992 6,972 - 3,509 3,483 1",
          "Fully franked ordinary dividends per share (cents) 154 153 1 77 77 -",
          "NIM 1.87% 1.94% (7 bps) 1.86% 1.89% (3 bps)",
          "Core NIM 1.76% 1.81% (5 bps)",
          "CET1 capital ratio (Level 2) 12.46% 12.53%",
          "Total stressed exposures as a % of TCE 1.17% 1.28% (11 bps)",
          "Consumer 3,616 3,437 5", "Business & Wealth 3,755 3,383 11", "Institutional 2,342 2,161 8",
          "Westpac New Zealand (AUD) 1,298 1,472 (12)",
          "723.0 745.2 766.2", "856.4 890.3 901.3",
          "The strong growth in deposits and lending was a highlight, at 6% and 5% respectively",
          "Business and Institutional lending increasing 12% and 18% respectively",
          "This equates to $2.9 billion of capital above the target after payment of the 2026 final dividend",
          "The CET1 capital ratio of 12.5% is above our target ratio of 11.25%",
          "the Australian economy is holding up relatively well",
          "inflation remains above the Reserve Bank's target range and interest rates are likely to remain elevated into 2027",
          "through new overlays for energy-intensive sectors and discretionary spending",
          "Given economic and geopolitical uncertainty",
          "Anthony Miller, Chief Executive Officer", "transformation agenda to simplify the bank"],
    RES: ["Net profit attributable to owners of WBC 6,813 6,916 (1)",
          "Notable Items reduced net profit after tax in 2026 by $179 million",
          "Separation and transaction costs associated with the sale of RAMS loan portfolio",
          "Large items $104 million reduction", "Hedging items $75 million reduction",
          "Credit impairment charges represented 10 basis points of average gross loans compared to 5 basis points of average gross loans in the prior year",
          "The increase reflected the revised economic outlook, new portfolio overlays and an increase in new IAPs"],
    PACK: ["2025 2026F 2027F 2028F",
           "Australia GDP2 2.1 2.6 2.5 2.1 2.2 1.5 1.6 1.5 1.4 1.6 2.6 1.5 1.6 2.4",
           "Unemployment - end period 4.3 4.3 4.2 4.4 4.6 4.7 4.7 4.8 4.8 4.7 4.3 4.7 4.7 4.5",
           "Interest rates - cash rate 3.60 3.60 4.10 4.35 4.60 4.85 4.85 4.85 4.60 4.35 3.60 4.85 4.35 3.85",
           "Increase in UNITE investment spend"],
    DIV: ["AUD 0.77000000", "Ex Date 5/11/2026", "Payment Date 21/12/2026"],
    ABC: ["slightly above the consensus figure of $6.96 billion calculated by analysts",
          "marginally below analyst expectations of the NIM coming in at 1.89%",
          "JP Morgan's veteran bank analyst Andrew Triggs says the result was softer than expected",
          "0.7% miss at NPAT (net profit after tax) level ex notable items, driven by weakness in core NIM",
          "UBS bank analyst John Storey",
          "Our first take on the results is weaker revenue trends in 2H 26 were offset by cost discipline and lower than expected credit impairment charges",
          "The ASX 200 lost ground across the session to close 0.6% lower",
          "Westpac managed a gain (+1.0%)"],
}
# Westpac's two 2026 dividends: 77c interim ex 8 May (wbc-div-03090206.txt), 77c final ex 5 Nov.
DIVS = [("2026-05-08", 0.77), ("2026-11-05", 0.77)]


def norm(s: str) -> str:
    s = s.replace("\\\"", '"')
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def M(x: int) -> str:
    return f"${x:,}M"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("WBC.AX")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))
    interim = norm((SRC / "wbc-div-03090206.txt").read_text(encoding="utf-8", errors="replace"))
    if "0.77" not in interim or "8/5/2026" not in interim.replace("08/05/2026", "8/5/2026"):
        bad.append(("wbc-div-03090206.txt", "interim 77c ex 8 May 2026"))

    # DERIVED
    a, b = Y26, Y25
    r = lambda k: round(pct(a[k], b[k]))  # noqa: E731
    assert (r("nii"), r("noi"), r("opex"), r("ppp"), r("imp"), r("stat")) == (1, 1, -1, 4, 104, -1)
    assert abs(pct(a["np"], b["np"])) < 0.5 and a["np"] - a["stat"] == 179 == 75 + 104
    assert (r("cons"), r("bw"), r("inst"), r("nz")) == (5, 11, 8, -12)
    assert H2["imp"] < H1["imp"] and H2["nim"] < H1["nim"]
    need("answer", "Westpac's profit was flat at $7.0 billion, excluding one-off items, in the year to September 2026, and its charge for bad debts doubled to $864 million")
    need("answer ubs", "But one analyst said that charge was lower than he expected")
    need("short np", "of $6,992 million, against $6,972 million a year earlier. That is flat")
    need("short stat", "$6,813 million, down 1% from $6,916 million. The gap is $179 million after tax of Notable Items, mostly costs from selling its RAMS home-loan book")
    need("short imp", "an impairment charge of $864 million, up 104% from $424 million")
    need("short div", "a final dividend of 77 cents, fully franked, the same as the interim, for 154 cents for the year, up from 153 cents")
    for lbl, k, ch in [("Net interest income", "nii", "+1%"), ("Net operating income", "noi", "+1%"),
                       ("Operating expenses", "opex", "−1%"), ("Pre-provision profit", "ppp", "+4%"),
                       ("Impairment charges", "imp", "+104%"), ("Net profit excluding Notable Items", "np", "Flat"),
                       ("Statutory net profit", "stat", "−1%")]:
        need(f"row {k}", f"| {lbl} | {M(a[k])} | {M(b[k])} | {ch} |")
    need("row div", "| Dividend per share | 154c | 153c | +1% |")
    need("ppp", "Before bad debts and tax, profit rose 4%, because costs fell while income rose")
    need("bps", "The charge was 10 basis points of Westpac's average gross loans, against 5 a year earlier")
    need("halves", f"The charge was lower in the second half, ${H2['imp']} million, than in the first, ${H1['imp']} million")
    need("stress", "from 1.28% of its exposures to 1.17%")
    need("consensus", "analysts' average forecast for profit excluding one-off items was $6.96 billion, according to ABC News. Westpac reported $6,992 million, slightly above it")
    need("jpm", "with a \"0.7% miss\" on profit excluding Notable Items")
    need("nim", "was 1.87% for the year, down from 1.94%. Analysts had expected 1.89%")
    need("nim halves", "The margin was lower in the second half, 1.86%, than in the first, 1.89%")
    for lbl, k, ch in [("Consumer", "cons", "+5%"), ("Business & Wealth", "bw", "+11%"), ("Institutional", "inst", "+8%"),
                       ("Westpac New Zealand", "nz", "−12%")]:
        need(f"div {k}", f"| {lbl} | {M(a[k])} | {M(b[k])} | {ch} |")
    assert round(pct(901.3, 856.4)) == 5 and round(pct(766.2, 723.0)) == 6
    need("loans", "Its loans grew 5% over the year, to $901.3 billion, and its deposits 6%, to $766.2 billion")
    need("bus", "Business lending grew 12% and institutional lending 18%")
    need("econ", "grow 1.5% in 2026 and 1.6% in 2027, the unemployment rate to be 4.7% at the end of both years, and the Reserve Bank's cash rate to be 4.85% at the end of 2026")
    need("cet1", "was 12.46% at 30 September, against its own target of 11.25%")
    need("cet1 surplus", "$2.9 billion of capital above the target after paying the final dividend")
    need("pay", "The final dividend of 77 cents is paid on 21 December 2026")
    need("ceo", "Chief executive Anthony Miller said the economy was \"holding up relatively well\"")

    if "MOVE_" in raw or "PENDING" in raw:
        bad.append(("placeholder", "placeholders still in the draft"))
    else:
        measured(f, need)

    # Who said it: each quoted analyst phrase must sit in that analyst's own post.
    posts = {ln.split(" :: ")[0]: norm(ln) for ln in (SRC / ABC).read_text(encoding="utf-8").splitlines() if " :: " in ln}
    jpm = next(p for h, p in posts.items() if "JP Morgan" in h)
    ubs = next(p for h, p in posts.items() if "UBS" in h)
    for q in ("softer than expected", "0.7% miss", "driven by weakness in core NIM"):
        assert q in jpm and q not in ubs, q
    for q in ("weaker revenue trends", "were offset by cost discipline and lower than expected credit impairment charges"):
        assert q in ubs and q not in jpm, q
    need("jpm name", "JP Morgan's bank analyst, Andrew Triggs, said the result was \"softer than expected\"")
    need("ubs name", "UBS's bank analyst, John Storey, said \"weaker revenue trends\" in the second half \"were offset by cost discipline and lower than expected credit impairment charges\"")
    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2025", "2026", "2027", "2016", "1988", "30", "2", "5", "25", "200", "2021", "2019"}
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
    d, c = f["full_dates"], dict(zip(f["full_dates"], f["full_closes"]))
    hdr = json.loads(sorted(SRC.glob("WBC-asx-header-*.json"))[-1].read_text(encoding="utf-8"))["data"]
    assert d[-1] == "2026-11-05" and abs(c["2026-11-05"] - hdr["priceLast"]) < 0.006
    c4_actual = hdr["priceLast"] - hdr["priceChange"]
    assert abs(c4_actual - 37.01) < 0.006
    # Yahoo's factor for each dividend: 1 - dividend / the traded close the day before its ex-date.
    (exM, dM), (exN, dN) = DIVS
    kN = 1 - dN / c4_actual
    assert abs(c["2026-11-04"] / kN - c4_actual) < 0.006
    prevM = d[d.index(exM) - 1]
    kM = 1 - dM / (c[prevM] / kN)

    def actual(day: str) -> float:
        k = (kN if day < exN else 1) * (kM if day < exM else 1)
        return c[day] / k

    c30, c2, c5 = actual("2026-10-30"), actual("2026-11-02"), c["2026-11-05"]
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    mv = pct(c2, c30)
    assert this["release"] == "2026-11-02" and abs(this["move"] - mv) < 0.01
    import gzip
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        x = {r[0]: float(r[3]) for r in json.load(fh)["full"]["^AXJO"]}
    xjo = pct(x["2026-11-02"], x["2026-10-30"])
    assert round(xjo, 1) == -0.6
    need("answer move", f"its shares rose {mv:.1f}% on results day, while the ASX 200 fell {abs(xjo):.1f}%")
    need("short move", f"up {mv:.1f}% on the day, to ${c2:.2f}, while the S&P/ASX 200 fell {abs(xjo):.1f}%")
    need("30 close", f"Westpac closed at ${c30:.2f} on Friday 30 October")
    need("2 close", f"the shares closed that day at ${c2:.2f}, up {mv:.1f}%. The S&P/ASX 200 fell {abs(xjo):.1f}% the same day")
    peers = json.loads((SRC / "peers-2026-11-02.json").read_text(encoding="utf-8"))["closes"]
    pm = {k: pct(v["2026-11-02"], v["2026-10-30"]) for k, v in peers.items()}
    assert abs(pm["WBC.AX"] - mv) < 0.01 and all(pm[k] < 0 for k in ("CBA.AX", "ANZ.AX", "NAB.AX"))
    need("peers", f"Commonwealth Bank fell {abs(pm['CBA.AX']):.1f}%, ANZ fell {abs(pm['ANZ.AX']):.1f}%, and NAB, which reported three days later, fell {abs(pm['NAB.AX']):.1f}%")
    need("exdiv", "On 5 November, Westpac's shares went ex-dividend: from then, buyers no longer received its 77-cent final dividend")
    since = [x for x in d if x >= "2015-01-01"]
    rec = max(since, key=actual)
    assert rec == "2026-02-25" == f["ath_date"], rec
    lo, hi = (1 - c5 / (actual(rec) - 0.02)) * 100, (1 - c5 / actual(rec)) * 100  # the rebuild runs ~2c high
    assert round(lo, 1) == round(hi, 1) == 14.7, (lo, hi)
    need("record", f"They closed that day at ${c5:.2f}, which leaves them {hi:.1f}% below their record close, set on 25 February 2026")
    need("record adj", f"Counting dividends, the shares are now {abs(f['below_ath']):.1f}% below their February 2026 record")
    m = [r["move"] for r in before]
    n = len(before)
    assert n == 21 and before[0]["release"] == "2016-05-02" and before[-1]["release"] == "2026-05-05"
    need("rx n", f"all {n} half-year and full-year results Westpac released from May 2016 to May 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in m):.1f}%**")
    over5 = [r for r in before if abs(r["move"]) >= 5]
    assert len(over5) == 2
    need("rx 5", f"Only two of the {n} moved by 5% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2021-11-01" and b["release"] == "2021-05-03"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in November 2021")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in May 2021")
    flat = [r for r in before if r["move"] == 0]
    assert len(flat) == 1 and flat[0]["release"] == "2019-11-04"
    need("rx updown", f"The shares rose on {sum(v > 0 for v in m)} of the {n} days, fell on {sum(v < 0 for v in m)}, and closed unchanged on one, in November 2019")
    further = sum(abs(v) > abs(mv) for v in m)
    need("smaller", f"So this was a smaller move than usual: {further} of those {n} results moved the shares further")
    assert abs(mv) < statistics.median(abs(v) for v in m)
    falls = f["big_falls"]
    assert len(falls) == 5 and f["fall_threshold"] == -25 and f["first_bar"].startswith("1988")
    need("falls n", "fallen 25% or more five times since 1988")
    for e in falls:
        assert e["depth_pct"] <= -25 and e["recovery_date"]
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {my(e['recovery_date'])} |")
    yrs = lambda a, b: (int(b[:4]) - int(a[:4])) + (int(b[5:7]) - int(a[5:7])) / 12  # noqa: E731
    from_rec = max(yrs(e["peak_date"], e["recovery_date"]) for e in falls)
    from_low = max(yrs(e["trough_date"], e["recovery_date"]) for e in falls)
    assert 6.5 < from_rec < 7 and 3.5 < from_low < 4, (from_rec, from_low)
    need("falls back", "All five got back to their record. The longest took almost seven years from the record, and almost four from the low")


if __name__ == "__main__":
    main()
