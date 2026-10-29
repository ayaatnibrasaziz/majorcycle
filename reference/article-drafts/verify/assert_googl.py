"""Assert every figure in draft 13 (Alphabet, third quarter 2026) against its source.

Two kinds of figure:
  * REPORTED — Alphabet's own numbers, typed once below from its release (8-K Exhibit 99.1), with every
    DERIVED comparison computed here;
  * MEASURED — re-derived from the frozen price file via `earn_figures.figures()` (dividend-adjusted),
    except the closes the article prints, which are Alphabet's ACTUAL closes from the saved Nasdaq history.

Each expected string must appear in the draft's answer box or body (whitespace-normalised).

    python -I reference/article-drafts/verify/assert_googl.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

SLUG = "alphabet-q3-2026-results"
DRAFT = Path(__file__).resolve().parents[1] / "13-alphabet-q3-2026-results.md"
SRC = Path(__file__).resolve().parents[2] / "earnings-2026-q3" / "sources"

# --- REPORTED, $ millions (release: Financial Highlights, Supplemental Information, statements) ---
Q = {"rev": 127577, "srch": 63350, "yt": 11207, "subs": 14290, "cl": 30709, "cloi": 11121, "oi": 40576, "ni": 26468,
     "capex": 51355, "cfo": 42290, "eq": 8664}
Y = {"rev": 102346, "srch": 56567, "yt": 10261, "subs": 12870, "cl": 15157, "cloi": 3594, "oi": 31228, "ni": 34979,
     "capex": 23953, "cfo": 48414, "eq": 10734}
OTHER = ["$2.12, down from $2.87", "| $2.12 | $2.87 |", "$28.7 billion from new bonds", "$12.4 billion of new shares",
         "against $11.5 billion", "cut its net income by $6.7 billion", "negative $5.9 billion the quarter before",
         "were also a meaningful contributor to revenue growth", "now on a half-trillion dollar revenue run rate",
         "has reached one billion users"]
RELEASE = ["$ 2.12", "$ 2.87", "$28.7 billion", "$4.3 billion", "$8.1 billion", "11,504", "$6.7 billion", "(5,855)",
           "(9,065)", "TPU systems sales were also a meaningful contributor to revenue growth",
           "are now on a half-trillion dollar revenue run rate", "the Gemini app has reached one billion users"]
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
    release = (SRC / "GOOGL-ex99_1-20261028.txt").read_text(encoding="utf-8")
    f = figures("GOOGL")
    want: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for k in Q:   # every raw figure is in the saved release, as the release writes it
        for v in (Q[k], Y[k]):
            if f"{v:,}" not in release:
                want.append((f"release {k}", f"<{v:,} not in the saved release>"))
    for s in RELEASE:
        if s not in release:
            want.append((f"release {s}", f"<{s} not in the saved release>"))
    need("answer", f"third-quarter revenue was {bn(Q['rev'])}, up {round(pct(Q['rev'], Y['rev']))}%")
    need("revenue", f"{bn(Q['rev'])}, up {round(pct(Q['rev'], Y['rev']))}% from {bn(Y['rev'])}")
    for k, lbl in [("rev", "Revenue"), ("srch", "Google Search & other"), ("yt", "YouTube ads"),
                   ("subs", "Google subscriptions, platforms and devices"), ("cl", "Google Cloud"),
                   ("oi", "Operating income"), ("ni", "Net income")]:
        need(f"{lbl} row", f"| {lbl} | {B(Q[k])} | {B(Y[k])} | {sgn(pct(Q[k], Y[k]))} |")
    need("cloud", f"revenue of {bn(Q['cl'])}, up {round(pct(Q['cl'], Y['cl']))}%, and operating income of {bn(Q['cloi'])}, up from {bn(Y['cloi'])}")
    assert Q["cl"] > 2 * Y["cl"] and Q["cloi"] > 3 * Y["cloi"], "'more than doubled', 'more than tripled'"
    need("oi", f"{bn(Q['oi'])}, up {round(pct(Q['oi'], Y['oi']))}%")
    need("oi rose", f"rose {round(pct(Q['oi'], Y['oi']))}%.")
    need("ni", f"{bn(Q['ni'])}, down {round(abs(pct(Q['ni'], Y['ni'])))}%")
    need("ni answer", f"cut net income {round(abs(pct(Q['ni'], Y['ni'])))}%")
    need("eq loss", f"an {bn(Q['eq'])} loss on shares")
    need("eq", f"added {bn(Y['eq'])}. This quarter they lost {bn(Q['eq'])}")
    need("capex", f"{bn(Q['capex'])} on property and equipment, against {bn(Y['capex'])}")
    need("capex rise", f"Spending rose {round(pct(Q['capex'], Y['capex']))}%")
    assert Q["capex"] > Q["cfo"], "spending more than the business brought in"
    for k, lbl in [("cfo", "Cash from operations"), ("capex", "Spent on property and equipment")]:
        need(f"{lbl} row", f"| {lbl} | {B(Q[k])} | {B(Y[k])} |")
    fcf, fcf0 = Q["cfo"] - Q["capex"], Y["cfo"] - Y["capex"]
    assert fcf == -9065
    need("fcf row", f"| Free cash flow | −{B(-fcf)} | {B(fcf0)} |")
    need("fcf", f"negative {bn(-fcf)}")
    for s in OTHER:
        need(s, s)

    # Actual closes (Nasdaq history, saved); the stored series is dividend-adjusted.
    hist = {r["date"]: float(r["close"][1:].replace(",", "")) for r in
            json.loads((SRC / "GOOGL-hist-20261028.json").read_text(encoding="utf-8"))["data"]["tradesTable"]["rows"]}
    last, rec, y0 = hist["10/27/2026"], hist["05/13/2026"], hist["12/31/2025"]
    assert round(last, 2) == round(f["last_close"], 2) and f["ath_date"] == "2026-05-13"
    assert rec == max(hist.values()), "13 May is the actual record too"
    need("close 27 Oct", f"Class A shares closed at ${last:.2f}")
    need("record", f"{abs(pct(last, rec)):.1f}% below their record close** of ${rec:.2f} on 13 May 2026")
    need("ytd", f"{abs(pct(last, y0)):.1f}% higher than at the start of 2026**, when they stood at ${y0:.2f}")
    need("releases", f"all {f['rx_n']} regular results releases")
    need("median", f"**{f['rx_median_abs']:.1f}%**")
    need("5%+", f"{f['rx_over5']} of the {f['rx_n']} moved by 5% or more, and {WORDS[f['rx_over10']]} by 10% or more")
    need("worst", f"**{abs(f['rx_worst']['move']):.1f}%** in October 2023")
    need("best", f"**{f['rx_best']['move']:.1f}%** in April 2024")
    need("up/down", f"rose after {f['rx_up']} of the {f['rx_n']} and fell after {f['rx_down']}")
    big = f["big_falls"]
    done = [e for e in big if e["recovery_date"]]
    assert len(big) - len(done) == 1 and not big[-1]["recovery_date"]
    need("number of falls", f"20% or more {WORDS[len(big)]} times since it listed in August 2004")
    need("finished", f"The first {WORDS[len(done)]} all got back")
    for e in big:
        need(f"fall {e['peak_date']}", f"−{abs(e['depth_pct']):.1f}%")
    m = {e["peak_date"]: (date.fromisoformat(e["recovery_date"]) - date.fromisoformat(e["trough_date"])).days / 30.44
         for e in done}
    quick = min(done, key=lambda e: m[e["peak_date"]])
    slow = max(done, key=lambda e: m[e["peak_date"]])
    assert quick["recovery_date"].startswith("2026-04") and 0.5 <= m[quick["peak_date"]] < 1.5, "about a month, Apr 2026"
    assert slow["trough_date"].startswith("2008") and 3.5 <= m[slow["peak_date"]] / 12 < 4, "almost four years from 2008"
    need("normal fall", f"about {abs(f['engine']['typical_drawdown']):.1f}%")
    need("engine now", f"it was {abs(f['engine']['current_drawdown_pct']):.1f}% below, past its normal fall")
    assert f["engine"]["current_drawdown_pct"] < f["engine"]["typical_drawdown"]

    # The after-hours move: the saved snapshot, 6:47pm New York (primary = last trade, secondary = regular close).
    snap = json.loads((SRC / "GOOGL-post-20261028T2247Z.json").read_text(encoding="utf-8"))["info"]["data"]
    ah = float(snap["primaryData"]["lastSalePrice"][1:].replace(",", ""))
    rc = float(snap["secondaryData"]["lastSalePrice"][1:].replace(",", ""))
    assert "6:47 PM ET" in snap["primaryData"]["lastTradeTimestamp"], "after-hours snapshot time"
    mv = pct(ah, rc)
    word = "rose" if mv > 0 else "fell"
    need("ah answer", f"In after-hours trading, the shares {word} {abs(mv):.1f}%.")
    need("ah close", f"closed at ${rc:.2f} on 28 October, before the results came out")
    need("ah price", f"at 6:47pm New York time, ")
    need("ah level", f"at ${ah:.2f}, {'up' if mv > 0 else 'down'} {abs(mv):.1f}%.")
    need("ah vs record", f"That is {abs(pct(ah, rec)):.1f}% below their record close.")

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
