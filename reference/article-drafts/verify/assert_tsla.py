"""Assert every figure in draft 09 (Tesla Q3 2026) against its source.

Two kinds of figure:
  * REPORTED — Tesla's own numbers, typed once below from its Q3 Update and 10-Qs, with every
    DERIVED comparison (vs a year ago) computed here;
  * MEASURED — re-derived from the frozen price file via `tsla_figures.figures()`. Tesla pays no
    dividend, so the stored closes are its actual closes (older ones split-adjusted).

Each expected string must appear in the draft's answer box or body (whitespace-normalised).

    python -I reference/article-drafts/verify/assert_tsla.py
"""

from __future__ import annotations

import re
import sys
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tsla_figures import figures  # noqa: E402

SLUG = "tesla-q3-2026-results"
DRAFT = Path(__file__).resolve().parents[1] / "09-tesla-q3-2026-results.md"

# --- REPORTED, $ millions unless noted (Q3 2026 Update, Financial Summary and statements) ---
Q3 = {"rev": 28046, "auto": 20560, "energy": 2881, "services": 4605, "gp": 5494, "opex": 4776,
      "oi": 718, "ni": 787, "eps": 0.22, "eps_adj": 0.48, "cfo": 6263, "capex": 4732, "fcf": 1531,
      "cash": 45447, "rnd": 2761, "deliv": 486532, "prod": 464391, "fsd": 1.74}
Q3_25 = {"rev": 28095, "auto": 21205, "energy": 3415, "services": 3475, "gp": 5054, "opex": 3430,
         "oi": 1624, "ni": 1373, "eps": 0.39, "cfo": 6238, "capex": 2248, "fcf": 3990, "rnd": 1630,
         "deliv": 497099, "prod": 447450, "fsd": 1.04}
CAPEX_9M = 13014          # Q3 10-Q: purchases of property and equipment, nine months
CAPEX_FC = {"old": "in excess of $25 billion in 2026", "new": "in excess of $20 billion in 2026"}
Q2_FCF = -1092            # Q2 2026, same Update's table
OTHER = ["400 megawatts", "3 September", "nearly two million miles", "$2.00 billion", "less than 1%",
         "record quarterly deliveries in several markets, including Canada, Australia, Japan and Taiwan",
         "tariff-related customer refunds", "highest-ever order rate and backlog",
         "has formed a special committee", "there is no assurance that any such Transaction will be consummated",
         "29 January 2025 and 28 January 2026"]
WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s)


def half_up(x_m: float, dp: int) -> str:
    """$ millions as $ billions, rounded half up: 28,095 is $28.10B, where float formatting says 28.09."""
    return str((Decimal(str(x_m)) / 1000).quantize(Decimal(1).scaleb(-dp), rounding=ROUND_HALF_UP))


def B(x_m: float, dp: int = 2) -> str:
    return f"${half_up(x_m, dp)}B"


def bn(x_m: float, dp: int = 2) -> str:
    return f"${half_up(x_m, dp)} billion"


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def sgn(x: float, dp: int = 1) -> str:
    return f"{x:+.{dp}f}%".replace("-", "−")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures()
    want: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    # Reported, and derived from reported.
    need("revenue", bn(Q3["rev"]))
    need("revenue a year earlier", f"against {bn(Q3_25['rev'])} a year earlier")
    for k, lbl in [("rev", "Revenue"), ("auto", "Car sales"), ("energy", "Energy"), ("services", "Services"),
                   ("gp", "Gross profit"), ("opex", "Operating expenses")]:
        need(f"{lbl} row", f"| {B(Q3[k])} | {B(Q3_25[k])} | {sgn(pct(Q3[k], Q3_25[k]))} |")
    need("oi row", f"| ${Q3['oi'] / 1000:.2f}B | ${Q3_25['oi'] / 1000:.2f}B | {sgn(pct(Q3['oi'], Q3_25['oi']))} |")
    need("oi", f"${Q3['oi']} million, down {round(abs(pct(Q3['oi'], Q3_25['oi'])))}% from ${Q3_25['oi'] / 1000:.2f} billion")
    need("oi answer", f"operating profit fell {round(abs(pct(Q3['oi'], Q3_25['oi'])))}%")
    need("opex body", f"Operating expenses rose {round(pct(Q3['opex'], Q3_25['opex']))}%")
    need("ni", f"${Q3['ni']} million, down {round(abs(pct(Q3['ni'], Q3_25['ni'])))}%")
    need("eps", f"${Q3['eps']:.2f}, or ${Q3['eps_adj']:.2f}")
    need("eps row", f"| ${Q3['eps']:.2f} | ${Q3_25['eps']:.2f} |")
    need("margin row", f"| {Q3['oi'] / Q3['rev'] * 100:.1f}% | {Q3_25['oi'] / Q3_25['rev'] * 100:.1f}% |")
    need("gross margin", f"rose to {Q3['gp'] / Q3['rev'] * 100:.1f}%, from {Q3_25['gp'] / Q3_25['rev'] * 100:.1f}%")
    need("rnd", f"{bn(Q3['rnd'])}, up from {bn(Q3_25['rnd'])}, a rise of {round(pct(Q3['rnd'], Q3_25['rnd']))}%")
    need("fcf", f"{bn(Q3['fcf'])} of free cash flow")
    need("cash", f"{bn(Q3['cash'])} of cash and investments")
    for k in ("cfo", "capex", "fcf"):
        need(f"{k} row", f"| {B(Q3[k])} | {B(Q3_25[k])} |")
    need("deliveries", f"{Q3['deliv']:,} delivered, {round(abs(pct(Q3['deliv'], Q3_25['deliv'])))}% fewer")
    need("production", f"Production rose {round(pct(Q3['prod'], Q3_25['prod']))}%, to {Q3['prod']:,}")
    need("fsd", f"reached {Q3['fsd']:.2f} million, up from {Q3_25['fsd']:.2f} million")
    need("fsd is car revenue", "Within car revenue, Tesla points to higher sales of Full Self-Driving")
    need("services growth", f"Services and other grew {pct(Q3['services'], Q3_25['services']):.1f}%")
    for k in ("old", "new"):
        need(f"capex forecast {k}", CAPEX_FC[k])
    need("capex nine months", f"spent {bn(CAPEX_9M)} in the first nine months")
    need("implied Q4", f"about ${round((20000 - CAPEX_9M) / 1000)} billion or more")
    need("July fcf", f"negative {bn(abs(Q2_FCF))}")
    for s in OTHER:
        need(s, s)

    # Measured from the frozen series (no dividend: stored closes are actual closes).
    last, rec = f["last_close"], f["ath_close"]
    need("close", f"${last:.2f}")
    need("record close", f"${rec:.2f}")
    need("below record", f"{abs(pct(last, rec)):.1f}% below its record close")
    need("one-year high", f"${f['high_52w']:.2f}")
    need("below one-year high", f"{abs(pct(last, f['high_52w'])):.1f}% below its highest price")
    need("ytd", f"{abs(f['ytd']):.1f}% {'higher' if f['ytd'] >= 0 else 'lower'} than at the start of 2026")
    prev = f["prev_close"]
    need("results-day close", f"Tesla closed at ${last:.2f}, down {abs(pct(last, prev)):.1f}% from ${prev:.2f}")
    need("answer box move", f"The shares fell {abs(pct(last, prev)):.1f}% the next day")
    need("S&P that day", f"S&P 500 lost {abs(f['index']['^GSPC']['day_move']):.1f}%")
    need("Nasdaq that day", f"Nasdaq Composite {abs(f['index']['^IXIC']['day_move']):.1f}%")
    need("streak", f"the {['', 'first', 'second', 'third', 'fourth', 'fifth'][f['down_streak']]} results day in a row on which Tesla's shares fell")
    big = f["big_falls"]
    cur = big[-1]
    assert not cur["recovery_date"], "the current fall should be the open one"
    need("current low", f"${cur['trough']:.2f}")
    need("current depth", f"{abs(cur['depth_pct']):.1f}% below")
    need("S&P below high", f"{abs(f['index']['^GSPC']['below_high']):.1f}% below its record")
    need("releases", f"all {f['rx_n']} regular")
    need("median move", f"{f['rx_median_abs']:.1f}%")
    need("median move since 2022", f"{f['rx_median_abs_since_2022']:.1f}%")
    need("10%+ moves", f"{f['rx_over10']} of the {f['rx_n']}")
    need("worst", f"{abs(f['rx_worst']['move']):.1f}%")
    need("best", f"{f['rx_best']['move']:.1f}%")
    need("falls after", f"fell after {f['rx_down']} of the {f['rx_n']}")
    for r in f["reactions"][-4:]:
        need(f"reaction {r['release']}", f"({sgn(r['move'])})")
    done = [e for e in big if e["recovery_date"]]
    need("number of falls", f"35% or more {WORDS[len(big)]} times")
    need("finished falls", f"The first {WORDS[len(done)]} all got back")
    for e in big:
        need(f"fall from {e['peak_date']}", f"−{abs(e['depth_pct']):.1f}%")
    months = {e["peak_date"]: (date.fromisoformat(e["recovery_date"]) - date.fromisoformat(e["trough_date"])).days / 30.44
              for e in done}
    deepest = min(done, key=lambda e: e["depth_pct"])
    covid = [e for e in done if e["peak_date"].startswith("2020-02")][0]
    assert round(abs(deepest["depth_pct"]), 1) == 73.6 and 22 <= months[deepest["peak_date"]] < 24, "almost two years"
    assert round(abs(covid["depth_pct"]), 1) == 60.6 and 2.5 <= months[covid["peak_date"]] < 3.5, "about three months"
    need("deepest", f"{abs(deepest['depth_pct']):.1f}% fall of 2021–23 took almost two years")
    need("2020 fall", f"{abs(covid['depth_pct']):.1f}% fall of 2020 was back about three months")
    larger = sum(abs(e["depth_pct"]) > abs(cur["depth_pct"]) for e in done)
    need("smaller than", f"smaller than {WORDS[larger]} of the {WORDS[len(done)]} before it")
    need("normal fall", f"about {abs(f['engine']['typical_drawdown']):.1f}%")
    need("engine now", f"it was {abs(f['engine']['current_drawdown_pct']):.1f}% below")

    miss = [(lbl, s) for lbl, s in want if s not in text]

    # The SHIPPED copy (CLAUDE.md 11c: two copies of one set of figures is how they drift). The site
    # body must be exactly what md_to_tsx.py makes of this draft, and the registry answer exactly its
    # answer box, so every figure checked above is the figure a reader sees.
    from md_to_tsx import convert, curly  # noqa: E402
    web = Path(__file__).resolve().parents[3] / "web"
    tsx = (web / "app" / "(public)" / "articles" / "content.tsx").read_text(encoding="utf-8")
    reg = (web / "lib" / "articles.ts").read_text(encoding="utf-8")
    shipped = convert(raw, SLUG)
    if shipped not in tsx:
        miss.append(("site body", f"content.tsx does not hold the conversion of this draft for {SLUG}"))
    box = raw[raw.index("## The answer"):].split(chr(10) + "---", 1)[0].split(chr(10), 1)[1]
    entry = reg[reg.index(f"slug: '{SLUG}'"):]
    site_answer = entry[entry.index("answer:"):].split("'", 2)[1]
    if site_answer != curly(" ".join(x.strip() for x in box.strip().splitlines())):
        miss.append(("site answer", f"the registry answer differs from the draft: {site_answer!r}"))
    print(f"{len(want) - len(miss)} of {len(want)} figures found (as at {f['as_of']})")
    for lbl, s in miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if miss else 0)


if __name__ == "__main__":
    main()
