"""Assert every figure in draft 11 (the RBA's rate rises and the big four banks) against its source.

Two kinds of figure:
  * REPORTED — typed once below from the RBA, the ABS and each bank's own results releases
    (saved in reference/rba-2026-10/sources/);
  * MEASURED — re-derived from the frozen price file via `rba_figures.figures()`.

Each expected string must appear in the draft's answer box or body (whitespace-normalised). The
fact-check sheet and the video plan are not searched, so a figure that survives only there cannot
pass. Then every percentage and every dollar figure printed in the body must be one of those
values, so a number typed twice cannot be right in one place and wrong in the other.

    python -I reference/article-drafts/verify/assert_rba.py
"""

from __future__ import annotations

import datetime as dt
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rba_figures import BANKS, INDEX, RISES, figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "11-rba-rate-rises-bank-shares.md"
SLUG = "rba-rate-rises-asx-bank-shares"
NAME = {"CBA.AX": "CBA", "WBC.AX": "Westpac", "NAB.AX": "NAB", "ANZ.AX": "ANZ"}

# --- REPORTED ----------------------------------------------------------------------------
#: RBA cash-rate table: the rate before the 2022 rises, and the rate at period ends used for CBA.
RATE_BEFORE_2022 = 0.10
RATE_BEFORE_2026 = 3.60
RATE_NOW = 4.60
#: CBA net interest margin (CBA FY23 and FY26 ASX announcements; FY24 via AAP) with the cash rate
#: at the end of each period (RBA table).
CBA_NIM = [
    ("Year to June 2022", 1.90, 0.85),
    ("Six months to December 2022", 2.10, 3.10),
    ("Year to June 2023", 2.07, 4.10),
    ("Year to June 2024", 1.99, 4.35),
    ("Year to June 2025", 2.08, 3.85),
    ("Year to June 2026", 2.05, 4.35),
]
NIM_LATEST = {"Westpac": 1.89, "NAB": 1.81, "ANZ": 1.53}
WBC_NIM_FALL_1H26 = 0.06
CBA_IMPAIRMENT = (788, 9)  # $m, % up on FY25
CBA_PROFIT = (11.0, 7)  # $bn (10,982m), % up
WBC_OVERLAY_BN = 2.0
NAB_EXTRA_PROVISION_M = 300
NAB_CASH_EX_LNI_PCT = 2.3
ANZ_ME_CHARGE_M = 175
ANZ_REPLICATING_PP = 0.02
ANZ_COST_CUT_PCT = 9
ANZ_ROLES = 3500
ANZ_PROFIT_PCT = 14
CPI_AUG = 4.0
#: ABS, CPI Australia, September 2026 (released 28 Oct 2026): annual CPI.
CPI_SEP = 4.3
TARGET = "2–3%"
#: The two surprise days, as reported (Reuters / Broker Daily; Market Index).
JUNE_2022_EXPECTED = ("0.25", "0.40")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s)


def sgn(x: float) -> str:
    return f"{'+' if x >= 0 else '−'}{abs(x):.2f}%"


def day(d: str) -> str:
    x = dt.date.fromisoformat(d)
    return f"{x.day} {x.strftime('%b %Y')}"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    text = DRAFT.read_text(encoding="utf-8")
    body = norm(text.split("## Fact-check sheet")[0].split("## The answer", 1)[1])
    f = figures()
    fails: list[str] = []
    checked = 0
    allowed_pct: set[str] = set()

    def need(label: str, s: str) -> None:
        nonlocal checked
        checked += 1
        if norm(s) not in body:
            fails.append(f"{label}: {s!r} not found")

    def allow(*xs: float, places: int = 2) -> None:
        for x in xs:
            allowed_pct.add(f"{abs(x):.{places}f}")

    # The RBA's rises
    rises = list(RISES.items())
    assert len(rises) == 17 and f["n"] == 17
    n2026 = sum(d >= "2026" for d, _ in rises)
    assert n2026 == 4 and len(rises) - n2026 == 13
    need("four this year", "raised its cash rate in February, March, May and September 2026")
    need("rate path 2026", f"from **{RATE_BEFORE_2026:.2f}%** to **{RATE_NOW:.2f}%**")
    need("17 rises", "13 rises of 2022–23, that is **17 rises** since May 2022")
    assert abs(rises[0][1][1] - rises[0][1][0] - RATE_BEFORE_2022) < 1e-9 and rises[-1][1][1] == RATE_NOW
    need("start 0.10", f"started from a cash rate of {RATE_BEFORE_2022:.2f}%")
    allow(RATE_BEFORE_2026, RATE_NOW, RATE_BEFORE_2022)
    for d, (chg, rate) in rises:
        r = next(x for x in f["rows"] if x["day"] == d)
        need(f"row {d}", f"| {day(d)} | +{chg:.2f} | {rate:.2f}% | {sgn(r['avg'])} | {sgn(r['index'])} |")
        allow(rate, r["avg"], r["index"])

    # Counts and summary
    assert (f["n_up"], f["n"] - f["n_up"]) == (6, 11)
    need("6 up", "They closed higher on **6** of the 17 days and lower on **11**")
    need("fell on 11", "The banks fell on 11 of the 17 days and rose on 6")
    need("average", f"the average move was **{sgn(f['avg_day'])}**")
    allow(f["avg_day"])
    assert abs(f["avg_day"]) < 0.05, "'close to nothing' / 'almost exactly zero' no longer true"
    under1 = sum(abs(r["avg"]) < 1 for r in f["rows"])
    same = sum((r["avg"] > 0) == (r["index"] > 0) for r in f["rows"])
    need("under 1%", f"On {under1} of the 17 days the banks moved by less than 1% either way")
    need("same direction", f"on {same} of the 17 they moved in the same direction as the market")
    beat = f["n_beat_index"]
    need("vs market", f"The banks did better than the market on {beat} days and worse on {17 - beat}")
    worst, best = f["worst"], f["best"]
    assert (worst["day"], best["day"]) == ("2022-06-07", "2022-10-04")
    need("worst", f"The banks' worst decision day (**{sgn(worst['avg'])}**) was in June 2022")
    need("best", f"Their best (**{sgn(best['avg'])}**) was in October 2022")
    need("worked row", f"the big four's shares fell {abs(worst['avg']):.2f}% on average, while the market as a whole fell {abs(worst['index']):.2f}%")
    need("june 2022", f"The ASX 200 fell {abs(worst['index']):.2f}% and the four banks fell {abs(worst['avg']):.2f}% on average")
    need("oct 2022", f"The ASX 200 rose {best['index']:.2f}% and the four banks rose {best['avg']:.2f}% on average")
    need("june expected", f"split between a rise of {JUNE_2022_EXPECTED[0]} and {JUNE_2022_EXPECTED[1]} percentage points")
    assert [c for d, (c, _) in rises if "2022-06" <= d <= "2022-09-30"] == [0.5] * 4, "'four rises of 0.50 in a row'"
    need("four 0.50", "After four rises of 0.50 points in a row")

    # The September example
    fc = f["forecast"]
    need("8 Sep banks", f"the four banks' shares fell **{abs(f['forecast_avg']):.2f}%** on average and the ASX 200 fell **{abs(fc[INDEX]):.2f}%**")
    allow(f["forecast_avg"], fc[INDEX])
    sep = next(r for r in f["rows"] if r["day"] == "2026-09-29")
    need("29 Sep", f"moved **{sgn(sep['avg'])}** on average that day, while the ASX 200 rose {sep['index']:.2f}%")
    assert abs(f["forecast_avg"]) > abs(sep["avg"]), "'the bigger move came three weeks before'"
    need("90%", "put the chance of a rise at about 90%")
    need("29 economists", "all 29 economists surveyed by Bloomberg")

    # 2026, bank by bank
    for r in f["rows"]:
        if r["day"] >= "2026":
            cells = " | ".join(sgn(r["banks"][t]) for t in BANKS)
            need(f"2026 row {r['day']}", f"| {day(r['day'])} | {cells} |")
            allow(*r["banks"].values())
    max_2026 = max(abs(v) for r in f["rows"] if r["day"] >= "2026" for v in r["banks"].values())
    res = f["results"]
    for (t, d), (b, ix) in res.items():
        allow(b, ix)
        need(f"results {t} {d}", f"| {sgn(b)} | {sgn(ix)} |")
    wbc_aug = res[("WBC.AX", "2026-08-10")][0]
    anz_may = res[("ANZ.AX", "2026-05-01")][0]
    assert abs(wbc_aug) > max_2026 and abs(anz_may) > max_2026, "results days no longer beat every decision-day move"
    need("wbc aug", f"Westpac fell **{abs(wbc_aug):.2f}%** on the day of its August update and ANZ **{abs(anz_may):.2f}%**")
    need("wbc aug 2", f"Westpac's {abs(wbc_aug):.2f}% fall on 10 August is bigger than any move")

    # Year to date
    for t in BANKS:
        need(f"ytd {t}", f"| {NAME[t]} | {f['ytd'][t]:+.1f}% | {f['ytd_total'][t]:+.1f}% |".replace("-", "−"))
        allow(f["ytd"][t], f["ytd_total"][t], places=1)
    need("ytd index", f"| S&P/ASX 200 | {f['ytd'][INDEX]:+.1f}% |")
    allow(f["ytd"][INDEX], places=1)
    assert len({(v > 0) for v in f["ytd"].values()}) == 2, "'four different results'"

    # Reported: margins, provisions, results
    for label, nim, rate in CBA_NIM:
        need(f"cba nim {label}", f"| {label} | {nim:.2f}% | {rate:.2f}% |")
        allow(nim, rate)
    need("cba nim now", f"year to June 2026 was **{CBA_NIM[-1][1]:.2f}%**")
    need("cba $2.05", f"it kept about ${CBA_NIM[-1][1]:.2f} over the year")
    assert abs((CBA_NIM[1][1] - CBA_NIM[0][1]) - 0.2) < 0.005
    need("0.2 lift", "lifted CBA's margin by about 0.2 percentage points within six months")
    for bank, nim in NIM_LATEST.items():
        need(f"nim {bank}", f"{bank} **{nim:.2f}%**")
        allow(nim)
    need("wbc 1h26", f"margin fell {WBC_NIM_FALL_1H26:.2f} percentage points to {NIM_LATEST['Westpac']:.2f}%")
    need("cba impairment", f"Loan impairment expense up {CBA_IMPAIRMENT[1]}% to ${CBA_IMPAIRMENT[0]} million")
    need("cba profit", f"cash profit rose {CBA_PROFIT[1]}% to ${CBA_PROFIT[0]:.1f} billion")
    need("wbc overlay", f"rose to ${WBC_OVERLAY_BN:.1f} billion")
    need("wbc overlay 2", f"central forecast reached ${WBC_OVERLAY_BN:.1f} billion")
    need("nab provision", f"An extra ${NAB_EXTRA_PROVISION_M} million of forward-looking provisions")
    need("nab provision 2", f"set aside an extra ${NAB_EXTRA_PROVISION_M} million")
    need("nab cash", f"rose {NAB_CASH_EX_LNI_PCT}% in the half to March")
    need("anz charge", f"A ${ANZ_ME_CHARGE_M} million charge")
    need("anz replicating", f"added {ANZ_REPLICATING_PP:.2f} percentage points to the margin")
    need("anz costs", f"operating expenses fell {ANZ_COST_CUT_PCT}% in the half to March")
    need("anz roles", f"removes {ANZ_ROLES:,} roles")
    need("anz profit", f"cash profit rose {ANZ_PROFIT_PCT}% on the previous half")
    need("cpi", f"inflation is now **{CPI_SEP:.1f}%**, meaning prices in September were {CPI_SEP:.1f}% higher than a year earlier. A month ago, inflation was **{CPI_AUG:.1f}%**")
    allow(CPI_SEP, places=1)
    need("target", f"target range of {TARGET}")
    allow(NAB_CASH_EX_LNI_PCT, CPI_AUG, places=1)
    allow(WBC_NIM_FALL_1H26, ANZ_REPLICATING_PP, 2.05)
    for d in ("Monday 2 November", "Thursday 5 November", "Monday 9 November", "Tuesday 3 November, 2:30pm",
              "Wednesday 28 October, 11:30am"):
        need(f"date {d}", d)

    # Every percentage printed in the body must be one of the values above.
    for p in set(re.findall(r"(\d+\.\d+)%", body)):
        checked += 1
        if p not in allowed_pct:
            fails.append(f"percentage {p}% is not a derived or reported figure")
    for bad in ("buy", "buying", "sell", "selling", "avoid", "strong buy", "Yahoo", "yfinance"):
        if re.search(rf"\b{bad}\b", body, re.I):
            fails.append(f"forbidden word in body: {bad}")

    # The SHIPPED copy (CLAUDE.md 11c), once the article exists on the site.
    web = Path(__file__).resolve().parents[3] / "web"
    tsx = (web / "app" / "(public)" / "articles" / "content.tsx").read_text(encoding="utf-8")
    if SLUG in tsx:
        from md_to_tsx import convert, curly  # noqa: E402

        reg = (web / "lib" / "articles.ts").read_text(encoding="utf-8")
        checked += 2
        if convert(text, SLUG) not in tsx:
            fails.append(f"site body: content.tsx does not hold the conversion of this draft for {SLUG}")
        box = text[text.index("## The answer"):].split("\n---", 1)[0].split("\n", 1)[1]
        entry = reg[reg.index(f"slug: '{SLUG}'"):]
        site_answer = entry[entry.index("answer:"):].split("'", 2)[1]
        if site_answer != curly(" ".join(x.strip() for x in box.strip().splitlines())):
            fails.append(f"site answer differs from the draft: {site_answer!r}")
    else:
        print("site copy: not built yet (checked once the article is added to content.tsx)")
    print(f"{checked} figures checked")
    if fails:
        print("\n".join(fails))
        sys.exit(1)
    print("ALL PASS")


if __name__ == "__main__":
    main()
