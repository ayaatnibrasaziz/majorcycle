"""Assert every figure in draft 12 (Microsoft, September quarter 2026) against its source.

Two kinds of figure:
  * REPORTED — Microsoft's own numbers, typed once below from its release (8-K Exhibit 99.1), with every
    DERIVED comparison computed here;
  * MEASURED — re-derived from the frozen price file via `earn_figures.figures()` (dividend-adjusted).

Each expected string must appear in the draft's answer box or body (whitespace-normalised).

    python -I reference/article-drafts/verify/assert_msft.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

SLUG = "microsoft-q1-fy27-results"
DRAFT = Path(__file__).resolve().parents[1] / "12-microsoft-q1-fy27-results.md"
SRC = Path(__file__).resolve().parents[2] / "earnings-2026-q3" / "sources"

# --- REPORTED, $ millions (release: Income Statements, Cash Flows, Segment Results, Product and Service) ---
Q = {"rev": 92279, "ai": 76795, "dc": 15484, "oi": 45915, "ni": 36629, "adj": 36422, "az": 33165, "win": 3551,
     "capex": 39367, "cfo": 58000, "da": 11744}
Y = {"rev": 77673, "ai": 61672, "dc": 16001, "oi": 37961, "ni": 27747, "adj": 30833, "az": 22384, "win": 4551,
     "capex": 19394, "cfo": 45057, "da": 8147}
OTHER = ["$4.92, or $4.89 adjusted", "| $4.92 | $3.72 |", "$677 billion, up 73%", "$63.9 billion, up 30%",
         "$10.2 billion", "cut net income by $3.1 billion", "it added $207 million",
         "Results exceeded expectations across revenue, operating income, and earnings per share.",
         "\"accelerating\"", "services fell 2%"]
WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s)


def B(x: float) -> str:
    return f"${x / 1000:.1f}B"


def bn(x: float) -> str:
    return f"${x / 1000:.1f} billion"


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def sgn(x: float) -> str:
    return f"{x:+.1f}%".replace("-", "−")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    release = (SRC / "MSFT-ex99_1-20261028.txt").read_text(encoding="utf-8")
    f = figures("MSFT")
    want: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for k in Q:   # every raw figure is in the saved release, as the release writes it
        for v in (Q[k], Y[k]):
            if f"{v:,}" not in release:
                want.append((f"release {k}", f"<{v:,} not in the saved release>"))
    need("revenue", f"{bn(Q['rev'])}, up {round(pct(Q['rev'], Y['rev']))}% from {bn(Y['rev'])}")
    for k, lbl in [("rev", "Revenue"), ("ai", "Agents and Infra"), ("dc", "Devices and Consumer"),
                   ("oi", "Operating income"), ("ni", "Net income"), ("adj", "Net income, excluding OpenAI")]:
        need(f"{lbl} row", f"| {lbl} | {B(Q[k])} | {B(Y[k])} | {sgn(pct(Q[k], Y[k]))} |")
    need("margin row", f"| {Q['oi'] / Q['rev'] * 100:.1f}% | {Y['oi'] / Y['rev'] * 100:.1f}% |")
    need("oi", f"{bn(Q['oi'])}, up {round(pct(Q['oi'], Y['oi']))}%")
    need("ni", f"{bn(Q['ni'])}, up {round(pct(Q['ni'], Y['ni']))}%")
    need("adj", f"{bn(Q['adj'])} and up {round(pct(Q['adj'], Y['adj']))}%")
    need("adj vs reported", f"grew {round(pct(Q['adj'], Y['adj']))}% rather than {round(pct(Q['ni'], Y['ni']))}%")
    need("azure", f"{bn(Q['az'])}, up {round(pct(Q['az'], Y['az']))}%")
    need("azure from", f"Azure brought in {bn(Q['az'])}, up from {bn(Y['az'])}")
    need("answer azure", f"Azure grew {round(pct(Q['az'], Y['az']))}%")
    need("windows", f"fell {round(abs(pct(Q['win'], Y['win'])))}%, to {bn(Q['win'])}")
    need("capex", f"{bn(Q['capex'])} on property and equipment, against {bn(Y['capex'])}")
    assert Q["capex"] > 2 * Y["capex"], "'more than double'"
    for k, lbl in [("cfo", "Cash from operations"), ("capex", "Spent on property and equipment"),
                   ("da", "Depreciation, amortisation and other")]:
        need(f"{lbl} row", f"| {lbl} | {B(Q[k])} | {B(Y[k])} |")
    fcf, fcf0 = Q["cfo"] - Q["capex"], Y["cfo"] - Y["capex"]
    need("fcf row", f"| Free cash flow | {B(fcf)} | {B(fcf0)} |")
    need("fcf fall", f"free cash flow fell {round(abs(pct(fcf, fcf0)))}%")
    need("cfo/capex", f"Cash from operations rose {round(pct(Q['cfo'], Y['cfo']))}%, but spending rose {round(pct(Q['capex'], Y['capex']))}%")
    need("da", f"rose {round(pct(Q['da'], Y['da']))}%")
    for s in ["Commercial remaining performance obligation increased 73% to $677 billion",
              "Microsoft Cloud revenue of $63.9 billion, with growth accelerating to 30%"]:
        if s not in release:
            want.append((f"release {s}", f"<{s} not in the saved release>"))
    for s in OTHER:
        need(s, s)
        if s.strip('"') not in release and not s.startswith("|") and "adjusted" not in s and "added" not in s \
                and "cut net" not in s and "services fell" not in s and ", up" not in s:
            want.append((f"release text {s}", f"<{s} not in the saved release>"))

    # Measured from the frozen series (dividend-adjusted).
    need("close 27 Oct", f"Microsoft closed at ${f['last_close']:.2f}")
    need("record", f"{abs(f['below_ath']):.1f}% below its record close** of ${f['ath_close']:.2f} on 13 October 2026")
    # Actual closes (Nasdaq history, saved): the record and 27 Oct match the stored series; the year start does not.
    hist = {r["date"]: float(r["close"][1:].replace(",", "")) for r in
            json.loads((SRC / "MSFT-hist-20261028.json").read_text(encoding="utf-8"))["data"]["tradesTable"]["rows"]}
    assert round(hist["10/27/2026"], 2) == round(f["last_close"], 2) and round(hist["10/13/2026"], 2) == round(f["ath_close"], 2)
    y0 = hist["12/31/2025"]
    need("ytd", f"{abs(pct(f['last_close'], y0)):.1f}% higher than at the start of 2026**, when it stood at ${y0:.2f}")
    need("releases", f"all {f['rx_n']} regular results releases")
    need("median", f"**{f['rx_median_abs']:.1f}%**")
    need("5%+", f"{f['rx_over5']} of the {f['rx_n']} moved by 5% or more, and {WORDS[f['rx_over10']]} by 10% or more")
    need("worst", f"**{abs(f['rx_worst']['move']):.1f}%** in January 2026")
    need("best", f"**{f['rx_best']['move']:.1f}%** in July 2026")
    need("up/down", f"rose after {f['rx_up']} of the {f['rx_n']} and fell after {f['rx_down']}")
    big = f["big_falls"]
    assert all(e["recovery_date"] for e in big), "every fall recovered"
    need("number of falls", f"30% or more {WORDS[len(big)]} times since it listed in March 1986")
    need("all recovered", f"All {WORDS[len(big)]} got back")
    for e in big:
        need(f"fall {e['peak_date']}", f"−{abs(e['depth_pct']):.1f}%")
    m = {e["peak_date"]: (date.fromisoformat(e["recovery_date"]) - date.fromisoformat(e["trough_date"])).days / 30.44
         for e in big}
    quick = min(big, key=lambda e: m[e["peak_date"]])
    slow = max(big, key=lambda e: m[e["peak_date"]])
    assert quick["recovery_date"].startswith("2026-10") and 3.5 <= m[quick["peak_date"]] < 4.5, "about four months, Oct 2026"
    assert slow["trough_date"].startswith("2009") and 4.5 <= m[slow["peak_date"]] / 12 < 5.5, "about five years from 2009"
    need("normal fall", f"about {abs(f['engine']['typical_drawdown']):.1f}%")
    need("engine now", f"it was {abs(f['engine']['current_drawdown_pct']):.1f}% below")

    # The after-hours move: the saved snapshot, 6:47pm New York (primary = last trade, secondary = regular close).
    snap = json.loads((SRC / "MSFT-post-20261028T2247Z.json").read_text(encoding="utf-8"))["info"]["data"]
    ah = float(snap["primaryData"]["lastSalePrice"][1:].replace(",", ""))
    rc = float(snap["secondaryData"]["lastSalePrice"][1:].replace(",", ""))
    assert "6:47 PM ET" in snap["primaryData"]["lastTradeTimestamp"], "after-hours snapshot time"
    mv = pct(ah, rc)
    word = "rose" if mv > 0 else "fell"
    need("ah answer", f"In after-hours trading, the shares {word} {abs(mv):.1f}%.")
    need("ah close", f"closed at ${rc:.2f} on 28 October, before the results came out")
    need("ah price", f"at 6:47pm New York time, ")
    need("ah level", f"at ${ah:.2f}, {'up' if mv > 0 else 'down'} {abs(mv):.1f}%.")

    miss = [(lbl, s) for lbl, s in want if s.startswith("<") or s not in text]
    # The SHIPPED copy (CLAUDE.md 11c): the site body must be exactly what md_to_tsx.py makes of this draft,
    # and the registry answer exactly its answer box.
    from md_to_tsx import convert, curly  # noqa: E402
    web = Path(__file__).resolve().parents[3] / "web"
    tsx = (web / "app" / "(public)" / "articles" / "content.tsx").read_text(encoding="utf-8")
    reg = (web / "lib" / "articles.ts").read_text(encoding="utf-8")
    if convert(raw, SLUG) not in tsx:
        miss.append(("site body", f"content.tsx does not hold the conversion of this draft for {SLUG}"))
    box = raw[raw.index("## The answer"):].split(chr(10) + "---", 1)[0].split(chr(10), 1)[1]
    entry = reg[reg.index(f"slug: '{SLUG}'"):]
    site_answer = entry[entry.index("answer:"):].split("'", 2)[1]
    if site_answer != curly(" ".join(x.strip() for x in box.strip().splitlines())).replace("'", "’"):
        miss.append(("site answer", f"the registry answer differs from the draft: {site_answer!r}"))
    if "AH_" in raw:
        miss.append(("after hours", "the after-hours placeholders are still in the draft"))
    print(f"{len(want) - len(miss)} of {len(want)} figures found (as at {f['as_of']})")
    for lbl, s in miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if miss else 0)


if __name__ == "__main__":
    main()
