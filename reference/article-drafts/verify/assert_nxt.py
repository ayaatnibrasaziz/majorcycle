"""Assert every figure in draft 10 (NEXTDC, the power poles) against its source.

Two kinds of figure:
  * REPORTED — NEXTDC's own numbers, typed once below from its ASX releases (21 Oct, 27 Aug,
    20 Apr and 10 Sep 2026), with every DERIVED comparison computed here;
  * MEASURED — re-derived from the frozen price file via `nxt_figures.figures()`.

Each expected string must appear in the draft's answer box or body (whitespace-normalised).
The fact-check sheet and the video plan are not searched, so a figure that survives only there
cannot pass.

    python -I reference/article-drafts/verify/assert_nxt.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nxt_figures import SHARES, figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "10-nextdc-power-poles.md"
SLUG = "nextdc-shares-power-poles"

# --- REPORTED, A$ millions unless noted (21 Oct 2026 release) --------------------------
REV = {"old": (615, 640), "new": (475, 500)}
EBITDA = {"old": (385, 410), "new": (245, 265)}
CAPEX = {"old": (5250, 5750), "new": (4500, 5000)}
M3_CONTRACTS = 140
LIQUIDITY = 8675
UNDRAWN_SENIOR = 6700
# 27 Aug 2026 release (FY26 results)
MW = {"contracted": 740.1, "billing": 175.0, "book": 565.1, "m3_added": 42, "m3_progress": 165}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    text = DRAFT.read_text(encoding="utf-8")
    body = norm(text.split("## Fact-check sheet")[0])
    f = figures()
    fails: list[str] = []
    checked = 0

    def need(label: str, s: str) -> None:
        nonlocal checked
        checked += 1
        if norm(s) not in body:
            fails.append(f"{label}: {s!r} not found")

    def r1(x: float) -> str:
        return f"{abs(x):.1f}%"

    # Reported
    need("revenue old", f"A${REV['old'][0]}–{REV['old'][1]}M")
    need("revenue new", f"A${REV['new'][0]}–{REV['new'][1]}M")
    need("ebitda old table", f"A${EBITDA['old'][0]}–{EBITDA['old'][1]}M")
    need("ebitda new table", f"A${EBITDA['new'][0]}–{EBITDA['new'][1]}M")
    need("ebitda new", f"A${EBITDA['new'][0]}–{EBITDA['new'][1]} million")
    need("ebitda old", f"A${EBITDA['old'][0]}–{EBITDA['old'][1]} million")
    need("capex old", f"A${CAPEX['old'][0] / 1000:.2f}–{CAPEX['old'][1] / 1000:.2f}B")
    need("capex new", f"A${CAPEX['new'][0] / 1000:.1f}–{CAPEX['new'][1] / 1000:.1f}B")
    need("M3 contracts", f"A${M3_CONTRACTS} million")
    need("liquidity", f"A${LIQUIDITY / 1000:.1f} billion")
    need("undrawn senior", f"A${UNDRAWN_SENIOR / 1000:.1f} billion")
    need("contracted MW", f"{MW['contracted']} megawatts")
    need("billing MW", f"{MW['billing']} megawatts")
    need("book MW", f"{MW['book']} megawatts")
    need("M3 added", f"{MW['m3_added']} megawatts")
    need("M3 in progress", f"{MW['m3_progress']} megawatts")
    mid_old, mid_new = sum(EBITDA["old"]) / 2, sum(EBITDA["new"]) / 2
    cut = (1 - mid_new / mid_old) * 100
    assert 33 <= cut <= 37, f"'about a third' no longer true: {cut:.1f}%"
    need("about a third", "about a third of the earnings forecast")
    assert MW["book"] / MW["billing"] > 3, "'more than three times' no longer true"
    need("three times", "more than three times what it bills today")
    assert abs(MW["contracted"] - MW["billing"] - MW["book"]) < 0.05, "740.1 - 175.0 != 565.1"

    # Measured
    need("pre close", f"${f['pre']:.2f}")
    need("crash close", f"${f['crash']:.2f}")
    need("crash move", r1(f["crash_move"]))
    need("crash low", f"${f['crash_low']:.2f}, −{r1(f['crash_low_move'])}")
    need("22 Oct", f"${f['d22']:.2f} | +{r1(f['d22_move'])}")
    need("23 Oct", f"${f['d23']:.2f} | −{r1(f['d23_move'])}")
    need("shares", f"{SHARES / 1e6:.1f} million shares")
    need("lost", f"A${f['lost_m'] / 1000:.1f} billion")
    need("cap before/after", f"from about A${f['cap_pre_m'] / 1000:.1f} billion to A${f['cap_crash_m'] / 1000:.1f} billion")
    assert f["first_trade"] == "2010-12-13", f["first_trade"]
    assert [w[0] for w in f["days_down_10"]] == ["2026-10-21", "2020-11-10"], f["days_down_10"]
    need("previous worst", f"**{r1(f['days_down_10'][1][1])}** in November 2020")
    assert 2.9 < f["crash_move"] / f["days_down_10"][1][1] < 3.1, "'three times' no longer true"
    need("record close", f"**${f['ath_close']:.2f}** on 9 July 2024")
    assert f["ath_date"] == "2024-07-09"
    need("below record 21 Oct", f"{r1(f['below_ath_crash'])} below it")
    need("below record 23 Oct", f"{r1(f['below_ath_last'])} below on 23 October")
    for x in (f["vs_entitlement"], f["vs_convertible"]):
        assert abs(x) > 55, x
    need("55% below", "more than 55% below both")
    falls = f["falls"]
    assert len(falls) == 8 and sum(e["recovered"] for e in falls) == 7 and not falls[-1]["recovered"], len(falls)
    need("seven falls", "seven falls of 20% or more before this one, and came back from all seven")
    for e in falls:
        mon = lambda d: pd_month(d)  # noqa: E731
        back = mon(e["recovery_date"]) if e["recovered"] else "Not yet"
        if e["recovered"]:
            need(f"fall {e['peak_date']}", f"| {mon(e['peak_date'])} | {mon(e['trough_date'])} | −{r1(e['depth_pct'])} | {back} |")
        else:
            need("open fall", f"| **{mon(e['peak_date'])}** | **{mon(e['trough_date'])} (so far)** | **−{r1(e['depth_pct'])}** | **Not yet** |")
    deepest_back = min((e for e in falls if e["recovered"]), key=lambda e: e["depth_pct"])
    need("deepest recovered", f"before was {r1(deepest_back['depth_pct'])}, in 2013–14")
    need("engine typical", f"**{r1(f['engine_typical'])}**")
    need("engine current", f"**{r1(f['engine_current'])}** below")
    need("nasdaq", f"the Nasdaq fell {r1(f['nasdaq_22'])}")

    # Every share price and every one-decimal percentage printed anywhere in the body must be one
    # of the derived values, so a figure typed twice cannot be wrong in one place and right in the
    # other.
    prices = {f"{x:.2f}" for x in (f["pre"], f["crash"], f["crash_low"], f["d22"], f["d23"], f["ath_close"])}
    prices |= {"12.70", "12.60"}
    for p in set(re.findall(r"(?<!A)\$(\d+\.\d{2})\b", body)):  # A$5.25–5.75B is a capex range
        checked += 1
        if p not in prices:
            fails.append(f"price ${p} is not a derived price")
    pcts = {f"{abs(x):.1f}" for x in (f["crash_move"], f["crash_low_move"], f["d22_move"], f["d23_move"],
                                      f["days_down_10"][1][1], f["below_ath_crash"], f["below_ath_last"],
                                      f["engine_typical"], f["engine_current"], f["nasdaq_22"])}
    pcts |= {f"{abs(e['depth_pct']):.1f}" for e in falls} | {"52.0"}  # 52.0: the 15 Oct article
    for p in set(re.findall(r"(\d+\.\d)%", body)):
        checked += 1
        if p not in pcts:
            fails.append(f"percentage {p}% is not a derived figure")
    for p in set(re.findall(r"(\d+\.\d) megawatts", body)):
        checked += 1
        if float(p) not in (MW["contracted"], MW["billing"], MW["book"]):
            fails.append(f"{p} megawatts is not a reported figure")

    for bad in ("buy", "sell", "avoid", "Yahoo", "yfinance", "strong buy"):
        if re.search(rf"\b{bad}\b", body, re.I):
            fails.append(f"forbidden word in body: {bad}")
    # The SHIPPED copy (CLAUDE.md 11c): the site body must be exactly what md_to_tsx.py makes of this
    # draft, and the registry answer exactly its answer box, so every figure checked above is the one
    # a reader sees.
    from md_to_tsx import convert, curly  # noqa: E402
    web = Path(__file__).resolve().parents[3] / "web"
    tsx = (web / "app" / "(public)" / "articles" / "content.tsx").read_text(encoding="utf-8")
    reg = (web / "lib" / "articles.ts").read_text(encoding="utf-8")
    checked += 2
    if convert(text, SLUG) not in tsx:
        fails.append(f"site body: content.tsx does not hold the conversion of this draft for {SLUG}")
    box = text[text.index("## The answer"):].split("\n---", 1)[0].split("\n", 1)[1]
    entry = reg[reg.index(f"slug: '{SLUG}'"):]
    site_answer = entry[entry.index("answer:"):].split("'", 2)[1]
    if site_answer != curly(" ".join(x.strip() for x in box.strip().splitlines())):
        fails.append(f"site answer differs from the draft: {site_answer!r}")
    print(f"{checked} figures checked")
    if fails:
        print("\n".join(fails))
        sys.exit(1)
    print("ALL PASS")


def pd_month(d: str) -> str:
    import datetime as dt

    return dt.date.fromisoformat(d).strftime("%b %Y")


if __name__ == "__main__":
    main()
