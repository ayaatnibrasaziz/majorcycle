"""Assert every figure and quote in draft 12 (Microsoft, September quarter 2026) against its source.

Three kinds of check:
  * SOURCE  — every raw number, quote and phrase taken from Microsoft must appear, as written, in the saved
    source it is attributed to (release, 10-Q, the three call transcripts);
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (dividend-adjusted, frozen at 27 Oct), and
    the closes from the saved Nasdaq history.
Each expected string must then appear in the draft's answer box or body (whitespace-normalised).

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
WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]

# --- REPORTED, $ millions (release: Income Statements, Cash Flows, Segment Results, Product and Service) ---
Q = {"rev": 92279, "ai": 76795, "dc": 15484, "gm": 62559, "oi": 45915, "ni": 36629, "adj": 36422, "opex": 16644,
     "cfo": 58000, "capex_cash": 39367,
     "az": 33165, "m365": 27778, "psl": 8407, "search": 6554, "xbox": 5379, "ind": 5337, "win": 3551, "fss": 2108}
Y = {"rev": 77673, "ai": 61672, "dc": 16001, "gm": 53630, "oi": 37961, "ni": 27747, "adj": 30833, "opex": 15669,
     "cfo": 45057, "capex_cash": 19394,
     "az": 22384, "m365": 23694, "psl": 8678, "search": 5942, "xbox": 5508, "ind": 4894, "win": 4551, "fss": 2022}
LINES = [("az", "Azure"), ("m365", "Microsoft 365 cloud"), ("psl", "Productivity and server licensing"),
         ("search", "Search and advertising"), ("xbox", "Xbox"), ("ind", "Industry solutions"),
         ("win", "Windows OEM and devices"), ("fss", "Frontier and support services")]

# --- Phrases that must be in each saved source, verbatim ---
SOURCES = {
    "MSFT-ex99_1-20261028.txt": [
        "Commercial remaining performance obligation increased 73% to $677 billion",
        "Microsoft Cloud revenue of $63.9 billion, with growth accelerating to 30%",
        "Search and advertising revenue excluding traffic acquisition costs increased 12%",
        "XBOX content and services revenue decreased 2%", "Windows OEM and Devices revenue decreased 22%",
        "$207 million", "$3.1 billion", "$4.92", "$3.72",
        "Results exceeded expectations across revenue, operating income, and earnings per share."],
    "MSFT-10Q-20260930.txt": [
        "had not yet commenced of $ 364.6 billion", "fiscal year 2027 and fiscal year 2034",
        "primarily for datacenters", "approximate 24 % interest",
        "with OpenAI, inclusive of revenue-sharing payments, of $ 10.0 billion",
        "$ 7.2 billion and $ 6.0 billion", "total funding commitments of $ 13.0 billion",
        "of which $ 12.0 billion has been funded", "weighted average duration of approximately 2.3 years",
        "approximately 30 % of both", "Total company headcount decreased 2%",
        "Operating expenses increased $975 million or 6%"],
    "msft-ir/TranscriptQandAFY27Q1.txt": [
        "Capital expenditures were $45.2 billion", "some third-party capacity deliveries we expected in Q1 were delayed",
        "short-lived assets, primarily CPUs and GPUs", "Windows OEM revenue was below expectations and decreased 27%",
        "Inventory levels remain elevated.", "Commercial bookings decreased 12%",
        "large Azure commitments in the prior year", "weaker sales execution in our M365 E3 and standalone SKUs",
        "We expect revenue from Agents and Infra of $80.1 to $80.7 billion",
        "we expect revenue growth of 49 to 50% in constant currency",
        "we expect revenue to be $15.9 to $16.4 billion", "should decline in the mid-thirties",
        "revenue should be between $96 and $97.1 billion or growth of 18 to 19%",
        "Operating margins should be down slightly year-over-year", "voluntary exit offer",
        "we expect CapEx spend will be over $50 billion", "spend should be approximately $170 billion",
        "Customer demand continues to exceed available supply.", "remain free cash flow positive in FY27",
        "access additional sources of funding", "Bing and Edge once again took share",
        "declines in third-party content and XBOX Game Pass",
        "based on the demand we see, the strength of our products, and the efficiencies we are driving across the "
        "stack, I have never been more confident in the long-term returns on our investments."],
    "msft-ir/TranscriptFY26Q4.txt": [
        "revenue should be between $89.85 and $90.95 billion",
        "we expect revenue growth of approximately 45% in constant currency",
        "operating expense of $16.8 to $16.9 billion", "We expect CapEx spend will be over $50 billion"],
    "msft-ir/TranscriptFY26Q1.txt": ["Capital expenditures were $34.9 billion"],
    "MSFT-ex99_1-20260729.txt": ["Azure and other cloud services revenue increased 43%"],
}


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
    f = figures("MSFT")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    # SOURCE checks.
    release = (SRC / "MSFT-ex99_1-20261028.txt").read_text(encoding="utf-8")
    for k in Q:
        for v in (Q[k], Y[k]):
            if f"{v:,}" not in release:
                bad.append((f"release {k}", f"{v:,} not in the saved release"))
    for fn, phrases in SOURCES.items():
        src = norm((SRC / fn).read_text(encoding="utf-8").replace("’", "'").replace("�", "'"))
        for p in phrases:
            if norm(p) not in src:
                bad.append((fn, f"not found: {p!r}"))

    # DERIVED, and present in the draft.
    need("answer revenue", f"was {bn(Q['rev'])}, up {round(pct(Q['rev'], Y['rev']))}% and above its own forecast")
    need("answer azure", f"Azure grew {round(pct(Q['az'], Y['az']))}%")
    assert Q["capex_cash"] > 2 * Y["capex_cash"], "'doubled'"
    need("answer capex", f"doubled, to {bn(Q['capex_cash'])}")
    fcf, fcf0 = Q["cfo"] - Q["capex_cash"], Y["cfo"] - Y["capex_cash"]
    need("answer fcf", f"free cash flow fell {round(abs(pct(fcf, fcf0)))}%")
    need("above top", f"was ${(Q['rev'] - 90950) / 1000:.1f} billion above the top of the range")
    need("forecast row revenue", f"| $89.85B to $90.95B | ${Q['rev'] / 1000:.2f}B |")
    assert Q["opex"] < 16800
    need("forecast row opex", f"| $16.8B to $16.9B | ${Q['opex'] / 1000:.2f}B |")
    need("forecast row capex", "| over $50B | $45.2B |")
    for k, lbl in [("rev", "Revenue"), ("ai", "Agents and Infra"), ("dc", "Devices and Consumer"), ("gm", "Gross margin"),
                   ("oi", "Operating income"), ("ni", "Net income"), ("adj", "Net income, excluding OpenAI")]:
        need(f"{lbl} row", f"| {lbl} | {B(Q[k])} | {B(Y[k])} | {sgn(pct(Q[k], Y[k]))} |")
    for k, lbl in LINES:
        need(f"{lbl} line row", f"| {lbl} | {B(Q[k])} | {B(Y[k])} | {sgn(pct(Q[k], Y[k]))} |")
    assert max(LINES, key=lambda kl: Q[kl[0]])[0] == "az", "Azure the largest line"
    need("margin row", f"| {Q['oi'] / Q['rev'] * 100:.1f}% | {Y['oi'] / Y['rev'] * 100:.1f}% |")
    need("opex vs rev", f"Operating expenses rose {round(pct(Q['opex'], Y['opex']))}% while revenue rose {round(pct(Q['rev'], Y['rev']))}%")
    need("oi", f"{bn(Q['oi'])}, up {round(pct(Q['oi'], Y['oi']))}%")
    need("ni", f"{bn(Q['ni'])}, up {round(pct(Q['ni'], Y['ni']))}%, or up {round(pct(Q['adj'], Y['adj']))}%")
    need("ni vs adj", f"grew {round(pct(Q['adj'], Y['adj']))}% rather than {round(pct(Q['ni'], Y['ni']))}%")
    need("search total", f"grew {round(pct(Q['search'], Y['search']))}% in total, or 12%")
    need("xbox", f"revenue fell {round(abs(pct(Q['xbox'], Y['xbox'])))}%")
    need("win", f"fell {round(abs(pct(Q['win'], Y['win'])))}%. Within it, Windows OEM revenue")
    need("dc fall", f"segment fell {round(abs(pct(Q['dc'], Y['dc'])))}%, to {bn(Q['dc'])}")
    need("openai share", f"about {round(10000 / Q['rev'] * 100)}% of Microsoft's revenue")
    need("capex cash row", f"| Cash spent on property and equipment | {B(Q['capex_cash'])} | {B(Y['capex_cash'])} | +{round(pct(Q['capex_cash'], Y['capex_cash']))}% |")
    need("capex total row", f"| Capital spending, including finance leases | $45.2B | $34.9B | +{round(pct(45.2, 34.9))}% |")
    need("cfo row", f"| Cash from operations | {B(Q['cfo'])} | {B(Y['cfo'])} | +{round(pct(Q['cfo'], Y['cfo']))}% |")
    need("fcf row", f"| Free cash flow | {B(fcf)} | {B(fcf0)} | −{round(abs(pct(fcf, fcf0)))}% |")
    need("capex total short", f"$45.2 billion, up {round(pct(45.2, 34.9))}%")
    for s in ["$364.6 billion", "$10.0 billion of revenue", "$7.2 billion at the end of September, up from $6.0 billion",
              "$13.0 billion of funding", "$12.0 billion has been", "rose 73% to $677 billion", "about 30% of it",
              "about 2.3 years", "Commercial bookings fell 12%", "| $96.0B to $97.1B (growth of 18% to 19%) |",
              "| $80.1B to $80.7B |", "| $15.9B to $16.4B |", "| 49% to 50% (constant currency) |", "about 24% of OpenAI",
              "it grew 43%", "$63.9 billion, up 30%", "fell 27%. Microsoft puts", "headcount fell 2%",
              "\"approximately $170 billion\"", "added $207 million", "| $4.92 | $3.72 |", "net income by $3.1 billion"]:
        need(s, s)

    # MEASURED.
    hist = {r["date"]: float(r["close"][1:].replace(",", "")) for r in
            json.loads((SRC / "MSFT-hist10y-20261030T0142Z.json").read_text(encoding="utf-8"))["payload"]["data"]["tradesTable"]["rows"]}
    assert round(hist["10/29/2026"], 2) == round(f["last_close"], 2) and round(hist["10/13/2026"], 2) == round(f["ath_close"], 2)
    need("releases", f"all {f['rx_n']} regular results releases")
    # The reaction: 28 Oct close, the 6:47pm after-hours quote and the 29 Oct close (Nasdaq, saved 30 Oct).
    ah = json.loads((SRC / "MSFT-post-20261028T2247Z.json").read_text(encoding="utf-8"))["info"]["data"]
    nd = json.loads((SRC / "MSFT-info-20261029T2025Z.json").read_text(encoding="utf-8"))["data"]["secondaryData"]
    assert nd["lastTradeTimestamp"] == "Closed at Oct 29, 2026 4:00 PM ET"
    c28 = float(ah["secondaryData"]["lastSalePrice"][1:]); last = float(ah["primaryData"]["lastSalePrice"][1:])
    c29 = float(nd["lastSalePrice"][1:]); assert c28 == hist["10/28/2026"] if "10/28/2026" in hist else True
    up_ah, nxt = (last / c28 - 1) * 100, (c29 / c28 - 1) * 100
    assert up_ah > 0 > nxt
    need("ah answer", f"the shares rose {up_ah:.1f}%, but by the next day's close they were {abs(nxt):.1f}% lower")
    need("28 Oct close", f"closed at ${c28:.2f} on 28 October")
    need("ah quote", f"the shares were at ${last:.2f}, up {up_ah:.1f}%")
    t = ah["primaryData"]["lastTradeTimestamp"]; assert t.startswith("Oct 28, 2026") and t.endswith("PM ET"), t
    hh, mm = t.split(" ")[3].split(":")
    need("ah time", f"at {hh}:{mm}pm New York time")
    need("29 Oct close", f"they finished at ${c29:.2f}, down {abs(nxt):.1f}%")
    smaller = sum(1 for r in f["reactions"] if abs(r["move"]) < abs(nxt))
    need("smaller moves", f"only {WORDS[smaller]} were followed by a smaller move")
    need("median", f"**{f['rx_median_abs']:.1f}%**")
    need("5%+", f"{f['rx_over5']} of the {f['rx_n']} moved by 5% or more, and {WORDS[f['rx_over10']]} by 10% or more")
    need("worst", f"**{abs(f['rx_worst']['move']):.1f}%** in January 2026")
    need("best", f"**{f['rx_best']['move']:.1f}%** in July 2026")
    need("up/down", f"rose after {f['rx_up']} of the {f['rx_n']} and fell after {f['rx_down']}")
    big = f["big_falls"]
    assert all(e["recovery_date"] for e in big)
    need("number of falls", f"30% or more {WORDS[len(big)]} times since it listed in March 1986")
    need("all recovered", f"All {WORDS[len(big)]} got back")
    for e in big:
        need(f"fall {e['peak_date']}", f"−{abs(e['depth_pct']):.1f}%")
    m = {e["peak_date"]: (date.fromisoformat(e["recovery_date"]) - date.fromisoformat(e["trough_date"])).days / 30.44 for e in big}
    quick = min(big, key=lambda e: m[e["peak_date"]])
    slow = max(big, key=lambda e: m[e["peak_date"]])
    assert quick["recovery_date"].startswith("2026-10") and 3.5 <= m[quick["peak_date"]] < 4.5
    assert slow["trough_date"].startswith("2009") and 4.5 <= m[slow["peak_date"]] / 12 < 5.5
    need("normal fall", f"about {abs(f['engine']['typical_drawdown']):.1f}%")
    need("engine now", f"it was {abs(f['engine']['current_drawdown_pct']):.1f}% below")

    miss = [(lbl, s) for lbl, s in want if s not in text]
    # EVERY number in the body must be one this file checks (a figure restated in a second place is a second
    # copy, and changing only one copy must fail — found by sabotage, 29 Oct). Years, dates and counts listed
    # in ALLOWED are the non-figure numbers the prose uses.
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2026", "2027", "2025", "2034", "1986", "1987", "1989", "1990", "1991", "1999", "2009", "2014", "2021",
               "2022", "2023", "2016", "10", "12", "27", "28", "29", "30", "13", "3", "1", "365", "24", "6", "50", "18",
               "19", "35", "4", "43", "45", "48", "49", "11", "17.2", "3.6", "96", "97.1", "8", "2", "22", "5", "9"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    # EVERY quotation in the body must appear word for word in one of the saved sources (a changed word inside
    # quotes, "four" -> "five", is invisible to the number checks; found by sabotage, 30 Oct).
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8").replace("’", "'").replace("�", "'")
                          .replace("“", '"').replace("”", '"').replace("‑", "-")) for fn in SOURCES)
    corpus = re.sub(r"(\w) [-\u2011] (\w)", r"\1-\2", corpus)  # the PDF transcript spaces its hyphens: "near - term"
    for q in re.findall(r'"([^"]{12,})"', text):
        if norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    pend = [ph for ph in ("MOVE_ANSWER", "MOVE_SECTION") if ph in raw]
    print(f"{len(want) - len(miss)} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values()) + 2 * len(Q)} source checks, {len(bad)} failed (as at {f['as_of']})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    for ph in pend:
        print(f"  PENDING {ph} (needs the 29 Oct close)")
    sys.exit(1 if bad or miss or pend else 0)


if __name__ == "__main__":
    main()
