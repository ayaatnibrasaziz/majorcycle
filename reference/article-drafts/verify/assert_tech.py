"""Assert every figure in draft 05 (ASX tech) against the frozen data AND the text.

Each check derives a value from the frozen file, formats it exactly as the article
prints it, and fails if that string is missing from the draft. So a figure can drift
in either place — data or prose — and this goes red.

    python -I reference/article-drafts/verify/assert_tech.py
"""

from __future__ import annotations

import json
import re
import statistics as st
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from asx_tech_figures import TY, derive, fmt_wait, load_derived, per_company  # noqa: E402
from recovery_episodes import back_within, clocks_for, km_median_years  # noqa: E402

DRAFT = (HERE.parent / "05-asx-tech-shares-how-unusual-is-the-fall.md").read_text(encoding="utf-8")
#: Line breaks in the markdown are not meaningful, so compare with whitespace collapsed.
FLAT = " ".join(DRAFT.split())

#: The SHIPPED body — the copy a reader actually sees. Checked as well as the draft,
#: because two copies of one set of figures is exactly how they drift (CLAUDE.md 11c).
_TSX = (HERE.parents[2] / "web" / "app" / "(public)" / "articles" / "content.tsx").read_text(encoding="utf-8")
_start = _TSX.index("const TECH_AS_AT")
_end = _TSX.index("export const FIGURES")
SITE = _TSX[_start:_end]
_body = SITE[SITE.index("'asx-tech-shares-how-far-have-they-fallen': () => ("):]
SITE_FLAT = " ".join(_body.replace("{' '}", " ").replace("’", "'").replace("’", "'")
                     .replace("“", '"').replace("”", '"').replace("<strong>", "**").replace("</strong>", "**").split())
SITE_FLAT = SITE_FLAT.replace("** ", "** ").replace(" **", " **")
FAILED: list[str] = []
COUNT = 0


def need(label: str, text: str) -> None:
    """The formatted figure must appear in the draft, verbatim."""
    global COUNT
    COUNT += 1
    t = " ".join(text.split())
    if t not in FLAT:
        FAILED.append(f"{label}: expected to find {text!r}")
    # Table rows are arrays on the site, not markdown, so they are checked separately.
    if not t.startswith("|") and t.replace("’", "'") not in SITE_FLAT:
        FAILED.append(f"{label} [site]: expected to find {text!r} in content.tsx")


def site_obj(label: str, fragment: str) -> None:
    """An object-style table row as content.tsx writes it."""
    global COUNT
    COUNT += 1
    if fragment not in SITE:
        FAILED.append(f"{label} [site]: expected {fragment!r}")


def site_row(label: str, cells: list[str]) -> None:
    """A table row as content.tsx writes it: one array literal."""
    global COUNT
    COUNT += 1
    lit = "[" + ", ".join(f"'{c}'" for c in cells) + "]"
    if lit not in SITE:
        FAILED.append(f"{label} [site]: expected the row {lit}")


def pct(v: float) -> str:
    return f"{v:.1f}%".replace("-", "−")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    d = load_derived()
    if "--from-raw" in sys.argv:
        # Prove the committed extract is still exactly what the raw freeze produces.
        fresh = json.loads(json.dumps(derive()))
        if fresh != d:
            sys.exit("The committed DERIVED file no longer matches the raw freeze: rebuild it with --derive")
        print("DERIVED file matches the raw freeze exactly")
    meta = d["meta"]
    res = d["metrics"]
    now = {t: res[t]["current_drawdown_pct"] for t in res}
    typ = {t: res[t]["typical_drawdown"] for t in res}
    low = {t: res[t]["lower_bound"] for t in res}
    members = [t for t in d["members"] if typ.get(t) is not None]
    tech = d["tech"]
    rest = [t for t in members if t not in tech]

    # ── index and market ──
    need("index now", f"**{abs(now['^AXJO']):.1f}% below its high of 6 August**")
    assert res["^AXJO"]["peak_date"] == "2026-08-06", res["^AXJO"]["peak_date"]
    need("index normal", f"the index normally falls {abs(typ['^AXJO']):.1f}%")
    need("market median", f"**{abs(st.median(now[t] for t in members)):.1f}%\nbelow its own one-year high**")
    need("market down 20", f"{sum(now[t] < -20 for t in members)} of the {len(members)} were down more than 20%")
    for t, nm in (("CBA.AX", "Commonwealth\nBank"), ("BHP.AX", "BHP"), ("CSL.AX", "CSL")):
        need(f"{t} now", f"{nm} {abs(now[t]):.1f}%")

    # ── sector table ──
    by: dict[str, list[float]] = {}
    for t in members:
        if meta[t]["sector"]:
            by.setdefault(meta[t]["sector"], []).append(now[t])
    for s, v in by.items():
        need(f"sector {s}", f"| {s} | {len(v)} | {pct(st.median(v))} |")
        site_obj(f"sector {s}", f"sector: '{s}', n: '{len(v)}', mid: '{pct(st.median(v))}'")
    order = sorted(by, key=lambda s: st.median(by[s]))
    rows_in_text = re.findall(r"^\| ([A-Z][A-Za-z ]+) \| \d+ \| −", DRAFT, flags=re.M)
    if rows_in_text[: len(order)] != order:
        FAILED.append(f"sector order: text {rows_in_text[:len(order)]} vs data {order}")
    need("tech >20", f"Twelve of the fifteen technology companies are more than 20% below")
    assert sum(now[t] < -20 for t in tech) == 12 and sum(now[t] < -50 for t in tech) == 8

    # ── the normal-fall table ──
    names = {
        "NWL.AX": "Netwealth", "XRO.AX": "Xero", "PXA.AX": "PEXA", "NXT.AX": "NEXTDC", "IRE.AX": "Iress",
        "WTC.AX": "WiseTech Global", "360.AX": "Life360", "SLX.AX": "Silex Systems", "ELS.AX": "Elsight",
        "WBT.AX": "Weebit Nano", "TNE.AX": "Technology One", "MP1.AX": "Megaport", "CDA.AX": "Codan",
        "XYZ.AX": "Block", "DTL.AX": "Data#3",
    }
    assert set(names) == set(tech), set(tech) ^ set(names)
    for t in tech:
        need(f"{t} row", f"| {names[t]} | {pct(now[t])} | {pct(typ[t])} | {now[t] / typ[t]:.1f}× | {pct(low[t])} |")
        site_row(f"{t} row", [names[t], pct(now[t]), pct(typ[t]), f"{now[t] / typ[t]:.1f}×", pct(low[t])])
    six = sorted(t for t in tech if now[t] < 2 * typ[t])
    assert six == sorted(["NWL.AX", "XRO.AX", "PXA.AX", "NXT.AX", "IRE.AX", "WTC.AX"]), six
    beyond = [t for t in tech if now[t] <= low[t]]
    assert beyond == ["NWL.AX"], beyond

    # ── tech vs rest ──
    def ct(ts, f):
        return sum(1 for t in ts if f(t))

    need("past normal", f"| Past their normal fall | {ct(tech, lambda t: now[t] < typ[t])} (80%) | {ct(rest, lambda t: now[t] < typ[t])} (47%) |")
    need("twice", f"| More than twice their normal fall | {ct(tech, lambda t: now[t] < 2*typ[t])} (40%) | {ct(rest, lambda t: now[t] < 2*typ[t])} (8%) |")
    need("whole past normal", f"{ct(members, lambda t: now[t] < typ[t])} of the 200 companies are past their own normal fall")
    need("whole twice", f"— {ct(members, lambda t: now[t] < 2*typ[t])} companies —")
    need("rest median", f"| Middle company, below its one-year high | {pct(st.median(now[t] for t in tech))} | {pct(st.median(now[t] for t in rest))} |")
    site_obj("past normal", f"tech: '{ct(tech, lambda t: now[t] < typ[t])} (80%)', rest: '{ct(rest, lambda t: now[t] < typ[t])} (47%)'")
    site_obj("twice", f"tech: '{ct(tech, lambda t: now[t] < 2*typ[t])} (40%)', rest: '{ct(rest, lambda t: now[t] < 2*typ[t])} (8%)'")
    site_obj("rest median", f"tech: '{pct(st.median(now[t] for t in tech))}', rest: '{pct(st.median(now[t] for t in rest))}'")
    site_obj("rest normal", f"tech: '{pct(st.median(typ[t] for t in tech))}', rest: '{pct(st.median(typ[t] for t in rest))}'")
    need("rest normal", f"| Middle company, normal fall | {pct(st.median(typ[t] for t in tech))} | {pct(st.median(typ[t] for t in rest))} |")

    # ── recovery: tech vs whole ──
    eps = d["episodes"]
    T = [c for t in tech for c in clocks_for(eps[t])]
    W = [c for t in d["members"] for c in clocks_for(eps[t])]
    need("falls", f"| Falls measured | {len(T)} | {len(W):,} |")
    need("wait", f"| Typical wait to get back | {fmt_wait(km_median_years(T))} | {fmt_wait(km_median_years(W))} |")
    for y in (1, 3, 5):
        need(f"within {y}", f"| Back within {y} year{'s' if y > 1 else ''} | {back_within(T, y)[0]:.1f}% | {back_within(W, y)[0]:.1f}% |")
    need("not back", f"| Not back yet | {sum(not c[1] for c in T)} | {sum(not c[1] for c in W)} |")
    site_obj("falls", f"what: 'Falls measured', tech: '{len(T)}', all: '{len(W):,}'")
    site_obj("wait", f"what: 'Typical wait to get back', tech: '{fmt_wait(km_median_years(T))}', all: '{fmt_wait(km_median_years(W))}'")
    for y in (1, 3, 5):
        site_obj(f"within {y}", f"what: 'Back within {y} year{'s' if y > 1 else ''}', tech: '{back_within(T, y)[0]:.1f}%', all: '{back_within(W, y)[0]:.1f}%'")
    site_obj("not back", f"what: 'Not back yet', tech: '{sum(not c[1] for c in T)}', all: '{sum(not c[1] for c in W)}'")

    # ── ladder ──
    for lo, hi, lab in [(-30, -20, "20% to 30%"), (-40, -30, "30% to 40%"), (-50, -40, "40% to 50%"),
                        (-70, -50, "50% to 70%"), (-101, -70, "More than 70%")]:
        GT = [c for c in T if lo < c[3] <= hi]
        GW = [c for c in W if lo < c[3] <= hi]
        need(f"ladder {lab}", f"| {lab} | {fmt_wait(km_median_years(GT))} | {back_within(GT, 5)[0]:.0f}% | "
                             f"{fmt_wait(km_median_years(GW))} | {back_within(GW, 5)[0]:.0f}% |")
        site_row(f"ladder {lab}", [lab, fmt_wait(km_median_years(GT)), f"{back_within(GT, 5)[0]:.0f}%",
                                   fmt_wait(km_median_years(GW)), f"{back_within(GW, 5)[0]:.0f}%"])
    need("ladder small 50-70", f"{back_within([c for c in T if -70 < c[3] <= -50], 5)[1]} falls of 50% to 70%")
    need("ladder small 70+", f"and {back_within([c for c in T if c[3] <= -70], 5)[1]} past\n70%")

    # ── per company ──
    pc = {r["ticker"]: r for r in per_company(d)}
    for t, r in pc.items():
        mid = fmt_wait(r["mid_wait"]) if r["mid_wait"] is not None else "—"
        lon = fmt_wait(r["longest"]) if r["longest"] is not None else "—"
        if r["open_now"] is not None:
            from datetime import date
            when = date.fromisoformat(r["open_peak_date"]).strftime("%b %Y")
            tail = f"{pct(r['open_now'])} | {when} |"
        else:
            tail = "— | — |"
        need(f"{t} history", f"| {names[t]} | {r['falls']} | {r['back']} | {mid} | {lon} | {tail}")
        cells = tail.strip(" |").split(" | ") if r["open_now"] is not None else ["—", "—"]
        site_row(f"{t} history", [names[t], str(r["falls"]), str(r["back"]), mid, lon, *cells])
    in_fall = [t for t, r in pc.items() if r["open_now"] is not None]
    assert len(in_fall) == 13 and set(tech) - set(in_fall) == {"CDA.AX", "DTL.AX"}
    deeper = sorted(t for t, r in pc.items() if r["open_deepest"] is not None
                    and (r["deepest_recovered"] is None or r["open_deepest"] < r["deepest_recovered"]))
    assert deeper == sorted(["XYZ.AX", "IRE.AX", "NXT.AX", "NWL.AX", "PXA.AX", "SLX.AX", "WTC.AX", "XRO.AX"]), deeper
    need("eight deeper", "**Eight of the fifteen are already deeper than any fall they have come back from.**")
    for t, a, b in (("WTC.AX", "worst recovered fall was 72.7%", "now been 79.2% down"),):
        assert f"{pc[t]['deepest_recovered']:.1f}" == "-72.7" and f"{pc[t]['open_deepest']:.1f}" == "-79.2"
        need(t, a); need(t, b)
    for t, nm in (("NWL.AX", "Netwealth's was"), ("NXT.AX", "NEXTDC's"), ("IRE.AX", "Iress's"), ("XYZ.AX", "Block's")):
        need(t, f"{nm} {abs(pc[t]['deepest_recovered']):.1f}% against")
        need(t, f"{abs(pc[t]['open_deepest']):.1f}% now" if t == "NWL.AX" else f"against {abs(pc[t]['open_deepest']):.1f}%")
    need("xero", f"just past the {abs(pc['XRO.AX']['deepest_recovered']):.1f}% fall it came back from in 2018, to {abs(pc['XRO.AX']['open_deepest']):.1f}%")
    xr = [e for e in eps["XRO.AX"] if e["cross20_date"] and e["recovered"] and round(e["depth_pct"], 1) == -71.1][0]
    assert xr["recovery_date"].startswith("2018"), xr
    need("silex", f"Silex has been down {abs(pc['SLX.AX']['open_deepest']):.1f}% in a fall that began in 2007")
    need("silex wait", f"Silex has waited {pc['SLX.AX']['open_years']:.1f} years and is still {abs(pc['SLX.AX']['open_now']):.1f}% below")
    need("old", f"Iress has waited {pc['IRE.AX']['open_years']:.1f} years, PEXA {pc['PXA.AX']['open_years']:.1f} and Block {pc['XYZ.AX']['open_years']:.1f}")
    for t in ("SLX.AX", "IRE.AX", "XYZ.AX"):
        assert pc[t]["open_years"] > pc[t]["longest"], t
    bands = {t: pc[t]["open_deepest"] for t in in_fall}
    assert sum(1 for v in bands.values() if -70 < v <= -50) == 8
    assert sorted(t for t, v in bands.items() if v <= -70) == sorted(["SLX.AX", "WBT.AX", "WTC.AX", "XRO.AX"])
    need("xero two highs", f"Xero is {abs(now['XRO.AX']):.1f}% below its one-year high and {abs(pc['XRO.AX']['open_now']):.1f}% below its record")
    peaks = [t for t in tech if res[t]["peak_date"][:7] in ("2025-10", "2025-11")]
    assert len(peaks) == 8, peaks
    need("eight peaks", "Eight of the fifteen set their one-year high in October or November 2025")

    # ── house rules ──
    body = DRAFT.split("## Body", 1)[1].split("## Video script", 1)[0]
    for w in ("buy", "sell", "avoid", "Yahoo", "yfinance", "S&P/ASX"):
        if re.search(rf"\b{re.escape(w)}\b", body, flags=re.I):
            FAILED.append(f"house rule: {w!r} in the body")
    if re.search(r"(?<![*\w])\*[^*\n]+\*(?!\*)", body):
        FAILED.append("house rule: italics in the body")
    if "S&P/ASX" in DRAFT:
        FAILED.append("naming: the house name is 'ASX 200', and 'S&P/ASX' appears in the file")

    print(f"{COUNT} figures checked against the text, {len(FAILED)} FAILED")
    for f in FAILED:
        print("  x", f)
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
