"""Assert every figure and quote in draft 14 (Eli Lilly, third quarter 2026) against its source.

Same method as assert_msft.py / assert_googl.py:
  * SOURCE  — every raw number, quote and phrase taken from Lilly must appear, as written, in the saved source it
    is attributed to (release, 10-Q, slides, the four earlier results releases);
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (dividend-adjusted, frozen at 27 Oct), and the
    actual closes from the saved Nasdaq history;
  * EVERY number in the body must be one this file checks (a restated figure is a second copy);
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_lly.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "14-eli-lilly-q3-2026-results.md"
SRC = Path(__file__).resolve().parents[2] / "earnings-2026-q3" / "sources"
WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
REL = "LLY-ex99_1-20261029.txt"
TENQ = "LLY-10Q-20260930.txt"
SLIDES = "lly-ir/LLY-Q3-2026-presentation.txt"

# --- REPORTED, $ millions (release: Financial Results, Selected Revenue Highlights, Operating Results) ---
Q = {"rev": 24397, "rnd": 4247, "msa": 3125, "ipr": 4181, "oi": 8608, "ni": 6451, "mj": 10723, "zb": 5352,
     "fy": 184, "ks": 193, "jp": 228, "eb": 202}
Y = {"rev": 17601, "rnd": 3466, "msa": 2741, "ipr": 656, "oi": 7365, "ni": 5583, "mj": 6515, "zb": 3588,
     "ks": 70, "jp": 143, "eb": 127}
# 10-Q cash flow, nine months, $ millions
CF = {"cfo": (27420, 13588), "capex": (8437, 5294), "div": (4635, 4039), "rep": (4334, 2600)}
# Price / volume / growth by quarter (each release's "worldwide revenue was" sentence)
PV = {"LLY-ex99_1-20251030.txt": ("Third quarter 2025", 54, 62, 10), "LLY-ex99_1-20260204.txt": ("Fourth quarter 2025", 43, 46, 5),
      "LLY-ex99_1-20260430.txt": ("First quarter 2026", 56, 65, 13), "LLY-ex99_1-20260805.txt": ("Second quarter 2026", 48, 60, 13),
      REL: ("Third quarter 2026", 39, 53, 15)}
# Guidance path (each release's guidance table)
GUIDE = [("February", 80, 83, "LLY-ex99_1-20260204.txt", "$80 to $83 billion"),
         ("April", 82, 85, "LLY-ex99_1-20260430.txt", "$82 to $85 billion"),
         ("August", 85, 87, "LLY-ex99_1-20260805.txt", "$85 to $87 billion"),
         ("October", 91, 92, REL, "$91 to $92 billion")]
SOURCES = {
    REL: ["driven by a 53% increase in volume, partially offset by a 15% decrease in realized prices",
          "Revenue in the U.S. increased 34% to $15.1 billion, driven by a 41% increase in volume, partially offset by a 7% decrease in realized prices",
          "The decline in realized prices was primarily driven by Zepbound",
          "Revenue outside the U.S. increased 47% to $9.3 billion, driven by a 76% increase in volume, partially offset by a 29% decrease in realized prices",
          "inclusion of Mounjaro on the National Reimbursement Drug List (NRDL) in China",
          "approximately $900 million of benefits, primarily from $410 million of Jardiance milestones (no further milestones remain) and favorable adjustments to rebate and discount estimates",
          "Gross margin as a percent of revenue was 83.9%, an increase of 1.0 percentage points",
          "primarily related to the acquisitions of AtaiBeckley Inc. and Curevo Inc.",
          "$4.57 of acquired IPR&D charges", "| 7.48 | | | 7.02 | | | 7% |", "| 7.22 | | | 6.21 | | | 16% |",
          "U.S. revenue was $5.0 billion, an increase of 41%", "Revenue outside the U.S. increased 93% to $5.7 billion",
          "U.S. Zepbound revenue increased 48% to $5.3 billion",
          "Tirzepatide is marketed for obesity under the brand name Zepbound",
          "raised underlying non-GAAP EPS guidance for the full year by $4.07 at the midpoint, which was more than offset by $4.57",
          "$35.00 to $36.00", "$35.50 to $36.50", "Guidance does not include acquired in-process research and development (IPR&D) incurred after September 30, 2026",
          "advancing its build-out of 10 new U.S. sites since 2020", "Onswik", "once-weekly basal insulin",
          "Mounjaro to reduce cardiovascular risk in adults with type 2 diabetes", "Boehringer Ingelheim"],
    TENQ: ["Mounjaro, Zepbound, and Foundayo accounted for 66 percent of our total revenue for the nine months ended September 30, 2026",
           "In the second quarter of 2026, we launched Foundayo (orforglipron) in the U.S. for the treatment of obesity",
           "effective July 1, 2026 through December 31, 2027",
           "align domestic pharmaceutical pricing with international benchmarks",
           "may result in reduced revenue in certain markets",
           "HHS selected Jardiance, which is part of our collaboration with Boehringer Ingelheim, in August 2023 (effective 2026), and selected Trulicity and Verzenio in January 2026 (to be effective 2028)",
           "mass-compounded incretins",
           "we paid $18.2 billion related to business development activity, primarily driven by the acquisitions of Centessa, Kelonia, AtaiBeckley, Orna",
           "total debt was $49.5 billion, an increase of $7.0 billion", "| Cash and cash equivalents | $ | 4,885 |"],
    "LLY-ex99_1-20260430.txt": ["the only approved GLP-1 pill that can be taken any time of day, without food and water restrictions"],
    SLIDES: ["Lilly SOM 63.0 %", "Novo SOM 36.6%", "Lilly SOM 58.4%", "+32% Q3 2026 U.S. market growth",
             "+53% Q3 2026 market growth", "weekly data 9/25/2026", "Growth rate: July/August 2026",
             "Share of new patient starts exited Q3 at ~40%", "500K+", "7 out of 10", "222", "527",
             "Started construction on a $6.5B manufacturing site in Houston, TX and a $5B site in Richmond, VA",
             "- 9.5 kg - 20.1 kg - 21.5 kg - 1.8% - 2.2% - 2.2%", "HbA1c and Body Weight Change at 80 Weeks",
             "Treatment discontinuation rates due to AEs were 5 - 8% on retatrutide vs. 3% on Ozempic",
             "Ozempic 2.0 mg", "Under regulatory review in 40+ countries", "U.S. $15,136 (7)% - 41% 34%"],
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s)


def squash(s: str) -> str:
    """The PDF's text layer breaks lines mid-word ("Bod\\ny"), so slide phrases are matched with ALL whitespace gone."""
    return re.sub(r"\s+", "", s)


def B(x: float) -> str:
    return f"${x / 1000:.1f}B"


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("LLY")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    # SOURCE: raw numbers and phrases are in the files they are attributed to.
    release = (SRC / REL).read_text(encoding="utf-8")
    for k in Q:
        for v in (Q[k], Y.get(k)):
            if v is not None and f"{v:,}" not in release:
                bad.append((f"release {k}", f"{v:,} not in the saved release"))
    tenq = (SRC / TENQ).read_text(encoding="utf-8")
    for k, (a, b) in CF.items():
        for v in (a, b):
            if f"{v:,}" not in tenq:
                bad.append((f"10-Q {k}", f"{v:,} not in the saved 10-Q"))
    for fn, phrases in SOURCES.items():
        body = (SRC / fn).read_text(encoding="utf-8")
        hay = squash(body) if fn == SLIDES else norm(body)
        for p in phrases:
            if (squash(p) if fn == SLIDES else norm(p)) not in hay:
                bad.append((fn, p))
    for fn, (name, g, vol, pr) in PV.items():
        s = norm((SRC / fn).read_text(encoding="utf-8"))
        if not re.search(rf"an increase of {g}% compared with .{{0,40}}driven by a {vol}% increase in volume, partially offset by a {pr}% decrease", s):
            bad.append((fn, f"growth {g} / volume {vol} / price {pr}"))
        need(f"pv {name}", f"| {name} | +{g}% | +{vol}% | −{pr}% |")
    for month, lo, hi, fn, phrase in GUIDE:
        if phrase not in (SRC / fn).read_text(encoding="utf-8"):
            bad.append((fn, phrase))
        need(f"guide {month}", f"| {month} | ${lo} to ${hi} billion |")

    # DERIVED from the raw numbers.
    assert round(pct(Q["rev"], Y["rev"])) == 39
    need("rev row", f"| Revenue | {B(Q['rev'])} | {B(Y['rev'])} | +39% |")
    for k, label in (("rnd", "Research and development"), ("msa", "Marketing, selling and administrative"),
                     ("oi", "Operating income"), ("ni", "Net income")):
        need(label, f"| {label} | {B(Q[k])} | {B(Y[k])} | +{round(pct(Q[k], Y[k]))}% |")
    need("ipr row", f"| Acquired research (IPR&D) charges | {B(Q['ipr'])} | {B(Y['ipr'])} | |")
    need("ipr text", f"That charge was {B(Q['ipr'])[:-1]} billion this quarter")
    need("ipr yago", f"against ${Y['ipr']} million a year earlier")
    for k, name in (("mj", "Mounjaro"), ("zb", "Zepbound")):
        need(name, f"| {name} | {B(Q[k])} | {B(Y[k])} | +{round(pct(Q[k], Y[k]))}% |")
    # Lilly's own printed % (computed from unrounded figures: Kisunla 193/70 rounds to 176, Lilly prints 175%).
    for k, name in (("ks", "Kisunla"), ("jp", "Jaypirca"), ("eb", "Ebglyss")):
        ch = re.search(rf"{name}\s*\|\s*{Q[k]}\s*\|\s*\|\s*\|\s*{Y[k]}\s*\|\s*\|\s*\|\s*(\d+)%", release)
        assert ch and abs(int(ch.group(1)) - pct(Q[k], Y[k])) < 1, name
        need(name, f"| {name} | ${Q[k]}M | ${Y[k]}M | +{ch.group(1)}% |")
    need("Foundayo", f"| Foundayo | ${Q['fy']}M | none | new |")
    share = (Q["mj"] + Q["zb"]) / Q["rev"]
    assert 0.64 < share < 0.68, share
    need("two of three", "two dollars of every three Lilly earned")
    need("short mj zb", f"{B(Q['mj'])[:-1]} billion and {B(Q['zb'])[:-1]} billion, up {round(pct(Q['mj'], Y['mj']))}% and {round(pct(Q['zb'], Y['zb']))}%")
    need("short rev", f"$24.4 billion, up 39% from $17.6 billion a year earlier")
    need("short ni", f"net income of {B(Q['ni'])[:-1]} billion, up 16%")
    need("ni yago", "$6.5B | $5.6B")
    need("ous row", "| Outside the United States | $9.3B | +47% | −29% | +76% |")
    need("us row", "| United States | $15.1B | +34% | −7% | +41% |")
    need("total row", "| Total | $24.4B | +39% | −15% | +53% |")
    mid = (91 + 92) / 2 - (80 + 83) / 2
    assert mid == 10
    need("midpoint", "The middle of the range is now $91.5 billion, $10 billion higher than in February")
    need("raised thrice", "three times in all")
    need("answer third", "for a third time")
    need("deepest", "deepest of the five")
    for k, label in (("cfo", "Cash from operations"), ("capex", "Spent on property and equipment"),
                     ("div", "Dividends"), ("rep", "Shares bought back")):
        a, b = CF[k]
        need(f"cf {k}", f"| {label} | {B(a)} | {B(b)} |")
    assert 1.95 < CF["cfo"][0] / CF["cfo"][1] < 2.05
    need("cfo doubled", "Cash from operations doubled")
    out = CF["capex"][0] + 18200 + CF["div"][0] + CF["rep"][0]
    assert out > CF["cfo"][0], out
    need("bd row", "| Paid for acquisitions and research deals | $18.2B | |")
    need("returned", f"{B(CF['capex'][0])[:-1]} billion on property and equipment, and {B(CF['div'][0] + CF['rep'][0])[:-1]} billion returned to shareholders")
    need("debt", "Total debt rose $7.0 billion this year, to $49.5 billion, and cash fell to $4.9 billion")
    need("gm", "| Gross margin | 83.9% | 82.9% | +1.0 points |")
    need("eps rep", "| Earnings per share, reported | $7.22 | $6.21 | +16% |")
    need("eps ng", "| Earnings per share, non-GAAP | $7.48 | $7.02 | +7% |")
    need("ng 7", "Non-GAAP earnings per share rose only 7%, to $7.48")
    need("4.57", "$4.57 a share")
    need("eps guide", "to $35.00 to $36.00, from $35.50 to $36.50")
    need("4.07", "by $4.07 at the midpoint")
    need("medicare", "Monthly prescriptions rose from 222,000 in July to 527,000 in September")
    need("medicare n", "more than 500,000 patients")
    need("retatrutide", "weight loss of 20.1 kg and 21.5 kg on the two retatrutide doses against 9.5 kg on Ozempic")
    need("a1c", "2.2 points against 1.8")
    need("stop", "5% to 8%, against 3%")
    need("plants", "a $6.5 billion plant in Houston and a $5 billion plant in Richmond, Virginia")
    need("ten sites", "two of the ten US sites it has announced since 2020")
    need("share", "at 63.0% in the four weeks to 25 September, against 36.6%")
    need("intl", "Lilly's share was 58.4%")
    need("mkt", "The US market grew 32% in the quarter and the international market 53%")
    need("40", "more than 40 countries")

    # MEASURED: the reaction (Nasdaq) and the history (frozen series).
    rows = json.loads(sorted(SRC.glob("LLY-hist10y-*.json"))[-1].read_text(encoding="utf-8"))["payload"]["data"]["tradesTable"]["rows"]
    h = {r["date"]: float(r["close"][1:].replace(",", "")) for r in rows}
    c28, c29 = h["10/28/2026"], h["10/29/2026"]
    assert c29 == max(h.values()), "29 Oct is no longer the highest close in the Nasdaq window"
    assert c29 > f["ath_close"], "29 Oct is not above the frozen series' record (full history since 1972)"
    nxt = pct(c29, c28)
    need("28 close", f"Lilly closed at ${c28:,.2f} on 28 October")
    need("29 close", f"the shares were at ${c29:,.2f}, up {nxt:.1f}%, a record close")
    need("short shares", f"up {nxt:.1f}% on the day, to a record close of ${c29:,.2f}")
    need("answer shares", f"its shares rose {nxt:.1f}% to a record close")
    bigger = sum(1 for r in f["reactions"] if abs(r["move"]) > abs(nxt))
    need("bigger", f"{WORDS[bigger]} were followed by a bigger move")
    need("rx n", f"all {f['rx_n']} regular results releases from July 2016 to August 2026")
    need("median", f"**{f['rx_median_abs']:.1f}%**")
    need("5%+", f"{f['rx_over5']} of the {f['rx_n']} moved by 5% or more, and {WORDS[f['rx_over10']]} by 10% or more")
    need("worst", f"**{abs(f['rx_worst']['move']):.1f}%** in August 2025")
    need("best", f"**{f['rx_best']['move']:.1f}%** in August 2023")
    need("up/down", f"rose after {f['rx_up']} of the {f['rx_n']} and fell after {f['rx_down']}")
    assert f["rx_worst"]["release"].startswith("2025-08") and f["rx_best"]["release"].startswith("2023-08")
    big = f["big_falls"]
    assert all(e["recovery_date"] for e in big)
    need("n falls", f"35% or more {WORDS[len(big)]} times since 1972")
    need("all back", f"All {WORDS[len(big)]} got back")
    mon = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
           "November", "December"]
    md = lambda d: f"{mon[int(d[5:7])]} {d[:4]}"  # noqa: E731
    for e in big:
        need(f"fall {e['peak_date']}", f"| {md(e['peak_date'])} | {md(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {md(e['recovery_date'])} |")
    m = {e["peak_date"]: (date.fromisoformat(e["recovery_date"]) - date.fromisoformat(e["trough_date"])).days for e in big}
    quick, slow = min(big, key=lambda e: m[e["peak_date"]]), max(big, key=lambda e: m[e["peak_date"]])
    assert quick["trough_date"].startswith("2000") and 3.5 <= m[quick["peak_date"]] / 30.44 < 4.5
    assert slow["trough_date"].startswith("1977") and 5.5 <= m[slow["peak_date"]] / 365.25 < 6
    need("quick", "The quickest was back about four months after its low, in 2000")
    need("slow", "slowest, after the 1977 low, took almost six years")

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"1972", "1973", "1977", "1983", "1987", "1989", "1992", "1993", "1995", "1999", "2000", "2009", "2014",
               "2016", "2020", "2023", "2025", "2026", "2027", "2028", "28", "29", "30", "1", "2", "3", "7", "10", "25",
               "80", "66", "900", "410", "41", "93", "5.0", "5.7", "5.3", "48", "47", "76", "34", "35", "65", "49"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8")) for fn in SOURCES if fn != SLIDES)
    corpus = corpus.replace("’", "'").replace("“", '"').replace("”", '"')
    for q in re.findall(r'"([^"]{12,})"', text):
        if norm(q).rstrip(",.") not in corpus and squash(q).lower() not in squash((SRC / SLIDES).read_text(encoding="utf-8")).lower():
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values())} source phrases, {len(bad)} failed (as at {f['as_of']})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


if __name__ == "__main__":
    main()
