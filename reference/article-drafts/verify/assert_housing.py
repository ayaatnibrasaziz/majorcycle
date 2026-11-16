"""Assert every figure in draft 29 (home loans' record fall, and the banks) against its source.

Two kinds of figure:
  * MEASURED — re-derived by `housing_figures.all_figures()` from the saved ABS and APRA workbooks
    and the frozen share prices;
  * REPORTED — typed once below from the RBA, Treasury, CBA, NAB, Westpac and ANZ documents saved in
    reference/housing-2026-11/sources/, each with the document it came from.

Each expected string must appear in the answer box or body (whitespace-normalised). The fact-check
sheet and the video plan are not searched, so a figure that survives only there cannot pass. Then
every percentage and every dollar figure printed in the body must be one of those values, so a
number typed twice cannot be right in one place and wrong in the other.

    python -I reference/article-drafts/verify/assert_housing.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from housing_figures import all_figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "29-home-loans-record-fall-bank-shares.md"
SLUG = "home-loans-record-fall-bank-shares"

# --- REPORTED ----------------------------------------------------------------------------
RATE_BEFORE = 3.60  # before 3 Feb 2026 (RBA; article 11)
RATE_NOW = 4.85  # RBA mr-26-30, 3 Nov 2026
RISES_2026 = ["3 February", "17 March", "5 May", "29 September", "3 November"]
RBA_PRICES_BELOW_PEAK = 4.7  # SMP Nov 2026, p47
COTALITY_OCT = (1.2, 6.7)  # via CommBank economists, Nov 2026
NEW_BUILD = (10.4, 17.3, 27.6)  # CommBank newsroom, 11 Nov 2026
FORECASTS = {  # bank: (now, before)  — CBA/NAB newsroom pages, Westpac FY26 IDP p40, Westpac Wire 9 Sep
    "CBA": ("about 14% (national)", "about 9% (September)"),
    "NAB": ("about 14% (combined capital cities)", "11%"),
    "Westpac": ("10.9% (March 2026 to 2027)", "7.3% (September)"),
}
ANZ_BASE = (4.3, 3.4)  # ANZ FY26 presentation p84, CY26F and CY27F
CYCLE_FALLS = {"2008-09": 6.9, "2017-19": 8.6, "2022-23": 7.5}  # Westpac FY26 IDP p40
CYCLE_LABEL = {"2008-09": "2008–09", "2017-19": "2017–19", "2022-23": "2022–23", "2026": "2026 so far"}
CYCLE_DATES = (
    "January 2008 to January 2009, July 2017 to May 2019, January 2022 to January 2023, and March 2026"
    " to now (we measure to the close on 13 November 2026)"
)
WBC_CURRENT_FORECAST = 10.9
WBC_IMPAIRMENT = (104, 864)  # % up, $m — Westpac FY26 media release
NAB_IMPAIRMENT = (85.7, "1,547")  # NAB FY26 summary
ANZ_CP = (222, 108)  # ANZ FY26 news release
CBA_ARREARS_PP = 0.07  # CBA 1Q27 (7bpts)
CBA_APPS = 16  # CBA 1Q27
NAB_SYSTEM = ("~2.6% in FY27", "about 7% in FY26")
WBC_CREDIT = (3.8, 3.0)  # Westpac FY26 IDP p40
CBA_CREDIT_2027 = 2.0  # CommBank newsroom
DOWNSIDE = {"ANZ": 27.3, "NAB": 26.6}
FSR_NEG_EQUITY = ("Less than 1% of borrowers", "only around 5 per cent of mortgages")
CBA_NIM = (1.90, 2.10)  # CBA FY23 ASX announcement (article 11)
ASX200_ABS_DAY = 0.27  # AAP, 11 Nov 2026
APRA_BENCHMARK = 10  # APRA 9 Dec 2014


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s)


def sg(x: float) -> str:
    return f"{'+' if x >= 0 else '−'}{abs(x):.1f}%"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    text = DRAFT.read_text(encoding="utf-8")
    body = norm(text.split("## Fact-check sheet")[0].split("## The answer", 1)[1])
    F = all_figures()
    A, P, X = F["abs"], F["apra"], F["prices"]
    fails: list[str] = []
    checked = 0
    allowed: set[str] = set()

    def need(label: str, s: str) -> None:
        nonlocal checked
        checked += 1
        if norm(s) not in body:
            fails.append(f"{label}: {s!r} not found")

    def allow(*xs: float, places: int = 1) -> None:
        for x in xs:
            allowed.add(f"{abs(x):.{places}f}")

    def bn(m: float) -> str:
        return f"${m / 1000:.1f} billion"

    # ---- ABS: the headline table and the answer box
    assert A["quarter"] == "2026-09"
    rows = [
        ("All new home loans", "total"),
        ("Owner-occupiers", "oo"),
        ("First home buyers", "fhb"),
        ("Investors", "inv"),
    ]
    for name, k in rows:
        n, v = A[f"{k}_number_latest"], A[f"{k}_value_latest"]
        need(f"abs value {k}", f"| {name} | ${v / 1000:.1f}b | {sg(A[f'{k}_value_q_pct'])} | {sg(A[f'{k}_value_y_pct'])} |")
        need(f"abs number {k}", f"| {name} | {n:,.0f} | {sg(A[f'{k}_number_q_pct'])} |")
        allow(A[f"{k}_number_q_pct"], A[f"{k}_value_q_pct"], A[f"{k}_value_y_pct"])
    tv, iv = A["total_value_q_pct"], A["inv_value_q_pct"]
    need("answer", f"New home loans fell {abs(tv):.1f}% in the September quarter and investor loans {abs(iv):.1f}%, the biggest falls since the ABS series began in 2002")
    need("short total", f"**{bn(A['total_value_latest'])}** of new home loans in the September quarter, **{abs(tv):.1f}%** less")
    need("short inv", f"fell **{abs(iv):.1f}%** to **{bn(A['inv_value_latest'])}**")
    need("short oo", f"live in fell **{abs(A['oo_value_q_pct']):.1f}%**")
    need("reading row", f"investors took out {A['inv_number_latest']:,.0f} new home loans worth {bn(A['inv_value_latest'])}. That is {abs(A['inv_number_q_pct']):.1f}% fewer loans than in the June quarter, and {abs(iv):.1f}% less money")

    # Records — both must be the worst in the series, which must start in 2002.
    assert A["total_value_worst"][0] == A["inv_value_worst"][0] == "2026-09", "no longer a record"
    assert A["total_value_first_quarter"] == A["inv_value_first_quarter"] == "2002-09"
    t2, i2 = A["total_value_second_worst"], A["inv_value_second_worst"]
    assert (t2[0], i2[0]) == ("2008-06", "2015-12")
    need("prev record total", f"The previous largest was **{abs(t2[1]):.1f}%**, in mid-2008")
    need("prev record inv", f"previous record fall of **{abs(i2[1]):.1f}%** (late 2015)")
    need("record t1", f"| All home loans: largest fall | Sep 2026 | {sg(tv)} |")
    need("record t2", f"| All home loans: second largest | Jun 2008 | {sg(t2[1])} |")
    need("record i1", f"| Investor loans: largest fall | Sep 2026 | {sg(iv)} |")
    need("record i2", f"| Investor loans: second largest | Dec 2015 | {sg(i2[1])} |")
    allow(t2[1], i2[1])
    ratio = iv / i2[1]
    assert 1.6 <= ratio <= 2.0, f"'almost double' no longer true ({ratio:.2f})"
    need("almost double", "almost double the previous record")
    need("almost twice", "almost twice the one in late 2015")
    need("since 2002", "since the series began in 2002")

    # Investors' part of the fall, the peak, the share
    need("fall bn", f"fell by **${A['value_fall_bn']:.1f} billion** in the quarter, and **${A['inv_value_fall_bn']:.1f} billion** of that was investors")
    need("part pct", f"That is **{A['inv_part_of_value_fall_pct']:.1f}%** of the fall")
    assert 75 <= A["inv_part_of_value_fall_pct"] < 80, "'almost four-fifths' no longer true"
    need("four fifths", "Almost four-fifths of the fall came from investors")
    need("prev share", f"took out **{A['inv_share_value_prev_q']:.1f}%** of the money lent in the June quarter")
    assert A["inv_value_quarters_falling"] == 3
    need("third quarter", "It is the third quarter in a row of falling investor lending")
    assert A["inv_value_peak"][0] == "2025-12"
    need("peak", f"peaked at **${A['inv_value_peak'][1] / 1000:.1f} billion** in the December quarter of 2025. It is now **{abs(A['inv_value_from_peak_pct']):.1f}%** below that")
    need("share", f"investors took out **{A['inv_share_value_peak_q']:.1f}%** of the value of new home loans. In the September quarter it was **{A['inv_share_value_now']:.1f}%**")
    allow(A["inv_part_of_value_fall_pct"], A["inv_share_value_prev_q"], A["inv_value_from_peak_pct"],
          A["inv_share_value_peak_q"], A["inv_share_value_now"])

    # ---- APRA: each bank's book
    names = {"CBA": "CBA", "WBC": "Westpac", "ANZ": "ANZ", "NAB": "NAB"}
    order = sorted(names, key=lambda c: -P[c]["housing_share_of_loans_pct"])
    for c in order:
        b = P[c]
        need(f"apra {c}", f"| {names[c]} | ${b['housing_bn']}b | {b['housing_share_of_loans_pct']:.1f}% | {b['investor_share_of_housing_pct']:.1f}% |")
        allow(b["housing_share_of_loans_pct"], b["investor_share_of_housing_pct"])
    al = P["ALL"]
    need("apra all", f"| All lenders | ${al['housing_bn']:,}b | {al['housing_share_of_loans_pct']:.1f}% | {al['investor_share_of_housing_pct']:.1f}% |")
    allow(al["housing_share_of_loans_pct"], al["investor_share_of_housing_pct"], P["big4_share_of_all_housing_pct"])
    need("apra reading", f"CBA has ${P['CBA']['housing_bn']} billion of home loans in Australia. That is {P['CBA']['housing_share_of_loans_pct']:.1f}% of all its Australian loans, and {P['CBA']['investor_share_of_housing_pct']:.1f}% of those")
    need("big4 share", f"hold **{P['big4_share_of_all_housing_pct']:.1f}%** of all the home loans")
    assert min(P[c]["housing_share_of_loans_pct"] for c in names) > 50, "'more than half of each big bank'"
    need("more than half", "Home loans are more than half of each big bank's lending in Australia")
    assert order[-1] == "NAB", "NAB is no longer the least reliant"
    need("nab least", "NAB is the least reliant on home loans of the four")

    # ---- Prices: the downturn table and 2026
    cyc = X["cycles"]
    for k, lab in CYCLE_LABEL.items():
        c = cyc[k]
        fall = f"{CYCLE_FALLS[k]:.1f}%" if k in CYCLE_FALLS else f"{WBC_CURRENT_FORECAST:.1f}%"
        need(f"cycle {k}", f"| {lab} | {fall} | {sg(c['BIG4_AVG'])} | {sg(c['AXJO'])} |")
        need(f"cycle banks {k}", f"| {lab} | " + " | ".join(sg(c[t]) for t in ("CBA", "WBC", "NAB", "ANZ")) + " |")
        allow(*(c[t] for t in ("BIG4_AVG", "CBA", "WBC", "NAB", "ANZ", "AXJO")))
    allow(*CYCLE_FALLS.values(), WBC_CURRENT_FORECAST)
    need("cycle dates", CYCLE_DATES)
    c08 = cyc["2008-09"]
    need("cycle reading", f"house prices fell {CYCLE_FALLS['2008-09']:.1f}% (Westpac's figure). Over the same months, the big four's shares fell {abs(c08['BIG4_AVG']):.1f}% on average, and the ASX 200 fell {abs(c08['AXJO']):.1f}%")
    worse = sum(cyc[k]["BIG4_AVG"] < cyc[k]["AXJO"] for k in CYCLE_FALLS)
    assert worse == 2, "'worse than the index in two of the three'"
    need("two of three", "the banks did worse than the index in two of the three past downturns")
    assert cyc["2008-09"]["BIG4_AVG"] < -30 and abs(cyc["2017-19"]["BIG4_AVG"]) < 5 and cyc["2022-23"]["BIG4_AVG"] > 10
    need("no single pattern", "Bank shares fell hard in 2008–09, roughly stood still in 2017–19, and rose strongly in 2022–23")
    # Dividends flatter the banks: the 2022-23 lead must exceed a generous dividend allowance (7 points).
    assert cyc["2022-23"]["BIG4_AVG"] - cyc["2022-23"]["AXJO"] > 7
    now = cyc["2026"]
    assert now["start"] == "2026-03-31" and now["end"] == "2026-11-13"
    need("short since march", f"the big four's shares are up **{now['BIG4_AVG']:.1f}%** on average, including dividends")
    need("2026 bullet", f"the big four are up {now['BIG4_AVG']:.1f}% on average including dividends, behind the ASX 200's {now['AXJO']:.1f}% without them")
    assert now["BIG4_AVG"] < now["AXJO"], "'behind the ASX 200'"
    y = X["ytd"]
    need("ytd", f"they are up **{y['BIG4_AVG']:.1f}%**, against **{y['AXJO']:.1f}%** for the index")
    allow(y["BIG4_AVG"], y["AXJO"])
    need("apart", f"ANZ is up {now['ANZ']:.1f}% since March and NAB is down {abs(now['NAB']):.1f}%")
    assert now["ANZ"] == max(now[t] for t in ("CBA", "WBC", "NAB", "ANZ")) and now["NAB"] == min(now[t] for t in ("CBA", "WBC", "NAB", "ANZ"))

    # ---- REPORTED
    need("rate path", f"from {RATE_BEFORE:.2f}% to **{RATE_NOW:.2f}%**")
    need("rise dates", "on " + ", ".join(RISES_2026[:-1]) + f" and {RISES_2026[-1]}, from {RATE_BEFORE:.2f}% to {RATE_NOW:.2f}%, a total of {RATE_NOW - RATE_BEFORE:.2f} percentage points")
    need("five rises", "raised its cash rate five times this year")
    allow(RATE_BEFORE, RATE_NOW, places=2)
    allow(RATE_NOW - RATE_BEFORE, places=2)
    need("rba below peak", f"**{RBA_PRICES_BELOW_PEAK:.1f}%** below their recent peak in September")
    need("rba below peak short", f"**{RBA_PRICES_BELOW_PEAK:.1f}%** below their peak in September")
    need("cotality", f"fell another **{COTALITY_OCT[0]:.1f}%** in October, leaving them **{COTALITY_OCT[1]:.1f}%** below their March peak")
    need("new build", f"it fell **{NEW_BUILD[0]:.1f}%**, and its share of investor lending rose from **{NEW_BUILD[1]:.1f}%** in the March quarter to **{NEW_BUILD[2]:.1f}%** in September")
    allow(RBA_PRICES_BELOW_PEAK, *COTALITY_OCT, *NEW_BUILD)
    for bank, (nw, before) in FORECASTS.items():
        need(f"forecast {bank}", f"| {bank} | {nw} |")
        need(f"forecast before {bank}", f"| {before} |")
    need("forecast range", "about **11% to 14%** from the peak")
    need("anz base", f"Australian house prices fall **{ANZ_BASE[0]:.1f}%** in 2026 and **{ANZ_BASE[1]:.1f}%** in 2027")
    allow(*ANZ_BASE, WBC_CURRENT_FORECAST, 7.3)  # 7.3: Westpac's September forecast (Westpac Wire)
    need("nab system", f'NAB expects system growth of "{NAB_SYSTEM[0]}", down from {NAB_SYSTEM[1]}')
    need("wbc credit", f"housing credit growth of {WBC_CREDIT[0]:.1f}% in FY27, and {WBC_CREDIT[1]:.1f}% for investors")
    need("cba credit", f"slow to {CBA_CREDIT_2027:.1f}% by the end of 2027")
    need("cba apps", f'"remained lower by {CBA_APPS}%"')
    need("wbc imp", f"impairment charge rose **{WBC_IMPAIRMENT[0]}%** to **${WBC_IMPAIRMENT[1]} million**")
    need("nab imp", f"credit impairment charge rose **{NAB_IMPAIRMENT[0]:.1f}%** to **${NAB_IMPAIRMENT[1]} million**")
    need("anz cp", f"collective provision charge was **${ANZ_CP[0]} million**, ${ANZ_CP[1]} million higher")
    need("cba arrears", f"arrears rose {CBA_ARREARS_PP:.2f} percentage points")
    for b, v in DOWNSIDE.items():
        need(f"downside {b}", f"**{v:.1f}%**")
    allow(*WBC_CREDIT, CBA_CREDIT_2027, NAB_IMPAIRMENT[0], *DOWNSIDE.values())
    allow(CBA_ARREARS_PP, ASX200_ABS_DAY, *CBA_NIM, places=2)
    for s in FSR_NEG_EQUITY:
        need("fsr", s)
    need("cba nim", f"CBA's rose from {CBA_NIM[0]:.2f}% to {CBA_NIM[1]:.2f}% in the six months to December 2022")
    need("abs day", f"while the ASX 200 rose {ASX200_ABS_DAY:.2f}%")
    need("apra 2014", f"investor lending growing faster than {APRA_BENCHMARK}% a year")
    for d in ("Tuesday 8 December, 2:30pm", "10 February 2027", "1 July 2027", "7:30pm on 12 May 2026",
              "4 February 2019"):
        need(f"date {d}", d)

    # Every percentage and dollar figure printed in the body must be one of the values above.
    for p in set(re.findall(r"(\d+\.\d+)%", body)):
        checked += 1
        if p not in allowed:
            fails.append(f"percentage {p}% is not a derived or reported figure")
    dollars = {f"{A[k] / 1000:.1f}" for k in ("total_value_latest", "oo_value_latest", "fhb_value_latest", "inv_value_latest")}
    dollars |= {f"{A['value_fall_bn']:.1f}", f"{A['inv_value_fall_bn']:.1f}", f"{A['inv_value_peak'][1] / 1000:.1f}"}
    dollars |= {str(P[c]["housing_bn"]) for c in names} | {f"{al['housing_bn']:,}", str(WBC_IMPAIRMENT[1]),
                NAB_IMPAIRMENT[1], str(ANZ_CP[0]), str(ANZ_CP[1])}
    for d in set(re.findall(r"\$([\d,]+(?:\.\d+)?)", body)):
        checked += 1
        if d not in dollars:
            fails.append(f"dollar figure ${d} is not a derived or reported figure")
    # This article is about buying and selling HOMES, so those words are allowed about property. They
    # are forbidden wherever they touch shares: our views never use buy/sell/avoid (CLAUDE.md #2).
    for s in re.split(r"(?<=[.!?])\s+", body):
        if re.search(r"\b(buy|buying|sell|selling|bought|sold)\b", s, re.I) and re.search(r"\b(shares?|stocks?)\b", s, re.I):
            fails.append(f"buy/sell beside shares: {s[:120]!r}")
    for bad in ("avoid", "strong buy", "Yahoo", "yfinance"):
        if re.search(rf"\b{bad}\b", body, re.I):
            fails.append(f"forbidden word in body: {bad}")

    web = Path(__file__).resolve().parents[3] / "web"
    tsx = (web / "app" / "(public)" / "articles" / "content.tsx").read_text(encoding="utf-8")
    if SLUG in tsx:
        from md_to_tsx import convert  # noqa: E402

        checked += 1
        if convert(text, SLUG) not in tsx:
            fails.append(f"site body: content.tsx does not hold the conversion of this draft for {SLUG}")
    else:
        print("site copy: not built yet (checked once the article is added to content.tsx)")
    print(f"{checked} figures checked")
    if fails:
        print("\n".join(fails))
        sys.exit(1)
    print("ALL PASS")


if __name__ == "__main__":
    main()
