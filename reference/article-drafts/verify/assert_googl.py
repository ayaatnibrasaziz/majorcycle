"""Assert every figure and quote in draft 13 (Alphabet, third quarter 2026) against its source.

Same method as assert_msft.py:
  * SOURCE  — every raw number, quote and phrase taken from Alphabet must appear, as written, in the saved source
    it is attributed to (release, 10-Q, slides, July call transcript, June equity-raise release);
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (dividend-adjusted, frozen at 27 Oct), and the
    actual closes from the saved Nasdaq history;
  * EVERY number in the body must be one this file checks (a restated figure is a second copy).

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
WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]

# --- REPORTED, $ millions (release: Financial Highlights, Supplemental Information, statements) ---
Q = {"rev": 127577, "svc": 96302, "cl": 30709, "srch": 63350, "yt": 11207, "net": 7455, "subs": 14290, "ob": 372,
     "oi": 40576, "ni": 26468, "cfo": 42290, "capex": 51355, "dep": 8369, "eq": 8664, "cloi": 11121, "costs": 87001,
     "rnd": 20640, "debt": 28996, "shares": 12371, "emp": 204757, "ob_oi": 2047}
Y = {"rev": 102346, "svc": 87052, "cl": 15157, "srch": 56567, "yt": 10261, "net": 7354, "subs": 12870, "ob": 344,
     "oi": 31228, "ni": 34979, "cfo": 48414, "capex": 23953, "dep": 5611, "eq": 10734, "cloi": 3594, "costs": 71118,
     "rnd": 15151, "debt": 6624, "rep": 11504, "emp": 190167, "ob_oi": 1426}
CAPEX_9M = 131953
SOURCES = {
    "GOOGL-ex99_1-20261028.txt": [
        "are now on a half-trillion dollar revenue run rate", "Our deep full stack approach is driving momentum across the business",
        "nearly 32 billion tokens per minute, more than four times what we processed a year ago",
        "the Gemini app has reached one billion users", "the highest it has been in the last five years",
        "150 million YouTube Music and Premium subscribers", "TPU systems sales were also a meaningful contributor to revenue growth",
        "$28.7 billion", "decreased the provision for income tax, net income, and diluted net income per common share by $1.9 billion, $6.7 billion",
        "(9,065)", "(5,855)", "$0.22 per share", "December 14, 2026", "$ 2.12", "$ 2.87", "131,953"],
    "GOOGL-10Q-20260930.txt": [
        "$ 75.2 billion of Space Exploration Technologies Corp. (\"SpaceX\") shares subject to short-term restrictions",
        "net unrealized losses in our marketable equity securities largely from SpaceX", "SpaceX prior to its initial public offering",
        "$ 567.7 billion of remaining performance obligations", "$ 560.8 billion related to Google Cloud", "just over 55 %",
        "primarily related to data centers and energy infrastructure", "future lease payments of $ 130.5 billion",
        "commence between 2026 and 2031", "$ 5.0 billion senior secured term loan that matures in October 2032",
        "Term SOFR plus 5.25 %", "not guaranteed by Alphabet or any of its other subsidiaries",
        "autonomous transportation services and internet services", "hardware, software, installation, support"],
    "googl-ir/2026q3-alphabet-earnings-slides.txt": ["Operating Margin 30.5% 31.8%"],
    "googl-ir/2026_Q2_Earnings_Transcript.txt": [
        "updating our full year 2026 CapEx guidance range to $195 ‑ 205 billion", "increase significantly in 2027",
        "reaching $514 billion"],
    "googl-ir/Alphabet-Pricing-Press-Release_2026-06-03.txt": [
        "represent a total equity raise of $84.75 billion", "invest $10 Billion in Alphabet",
        "Expand AI Infrastructure and Compute"],
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
    f = figures("GOOGL")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    release = (SRC / "GOOGL-ex99_1-20261028.txt").read_text(encoding="utf-8")
    for k in Q:
        for v in (Q[k], Y.get(k)):
            if v is not None and f"{v:,}" not in release:
                bad.append((f"release {k}", f"{v:,} not in the saved release"))
    if f"{Y['rep']:,}" not in release:
        bad.append(("release rep", "11,504 not in the saved release"))
    for fn, phrases in SOURCES.items():
        src = norm((SRC / fn).read_text(encoding="utf-8").replace("’", "'").replace("�", "'").replace("“", '"').replace("”", '"'))
        for p in phrases:
            if norm(p) not in src:
                bad.append((fn, f"not found: {p!r}"))

    # DERIVED, and present in the draft.
    need("answer", f"third-quarter revenue was {bn(Q['rev'])}, up {round(pct(Q['rev'], Y['rev']))}%")
    assert Q["cl"] > 2 * Y["cl"] and Q["cloi"] > 3 * Y["cloi"] and Q["capex"] > Q["cfo"]
    need("answer capex", f"{bn(Q['capex'])}, was more than its operations brought in")
    need("answer ni", f"cut net income {round(abs(pct(Q['ni'], Y['ni'])))}%")
    need("revenue", f"{bn(Q['rev'])}, up {round(pct(Q['rev'], Y['rev']))}% from {bn(Y['rev'])}")
    need("cloud", f"revenue of {bn(Q['cl'])}, up {round(pct(Q['cl'], Y['cl']))}%, and operating income of {bn(Q['cloi'])}, up from {bn(Y['cloi'])}")
    need("oi", f"{bn(Q['oi'])}, up {round(pct(Q['oi'], Y['oi']))}%")
    need("ni", f"{bn(Q['ni'])}, down {round(abs(pct(Q['ni'], Y['ni'])))}%")
    need("eq", f"an {bn(Q['eq'])} loss on shares")
    need("eq2", f"added {bn(Y['eq'])}. This quarter they lost {bn(Q['eq'])}")
    need("capex", f"{bn(Q['capex'])} of cash spent on property and equipment, against {bn(Y['capex'])}")
    for k, lbl in [("rev", "Revenue"), ("svc", "Google Services"), ("cl", "Google Cloud"), ("oi", "Operating income"), ("ni", "Net income")]:
        need(f"{lbl} row", f"| {lbl} | {B(Q[k])} | {B(Y[k])} | {sgn(pct(Q[k], Y[k]))} |")
    for k, lbl in [("srch", "Google Search & other"), ("yt", "YouTube ads"), ("net", "Google Network"),
                   ("subs", "Google subscriptions, platforms and devices"), ("ob", "Other Bets")]:
        need(f"{lbl} row", f"| {lbl} | {B(Q[k])} | {B(Y[k])} | {sgn(pct(Q[k], Y[k]))} |")
    need("costs", f"total costs and expenses rose {round(pct(Q['costs'], Y['costs']))}%, with research and development up {round(pct(Q['rnd'], Y['rnd']))}%")
    need("employees", f"{Q['emp']:,} employees at the end of September, {round(pct(Q['emp'], Y['emp']))}% more")
    share, share0 = Q["cl"] / Q["rev"] * 100, Y["cl"] / Y["rev"] * 100
    assert 23 <= share < 25 and 14.5 <= share0 < 15.5, (share, share0)
    need("cloud share", "almost a quarter of Alphabet's revenue, up from about 15%")
    need("cloud margin", f"rose to {Q['cloi'] / Q['cl'] * 100:.1f}%, from {Y['cloi'] / Y['cl'] * 100:.1f}%")
    fcf, fcf0 = Q["cfo"] - Q["capex"], Y["cfo"] - Y["capex"]
    assert fcf == -9065
    for k, lbl in [("cfo", "Cash from operations"), ("capex", "Cash spent on property and equipment"),
                   ("dep", "Depreciation of property and equipment")]:
        need(f"{lbl} row", f"| {lbl} | {B(Q[k])} | {B(Y[k])} |")
    need("fcf row", f"| Free cash flow | −{B(-fcf)} | {B(fcf0)} |")
    need("capex rise", f"Spending rose {round(pct(Q['capex'], Y['capex']))}%")
    need("dep rise", f"rose {round(pct(Q['dep'], Y['dep']))}%")
    need("9m", f"${CAPEX_9M / 1000:.1f} billion in the first nine months")
    lo, hi = 195000 - CAPEX_9M, 205000 - CAPEX_9M
    assert lo > Q["capex"], "more than in any quarter so far (Q1 $35.7B, Q2 $44.9B, Q3 $51.4B)"
    need("implied", f"leaves ${round(lo / 1000)} billion to ${round(hi / 1000)} billion for the last three")
    need("debt row", f"| New debt raised | {B(Q['debt'])} | {B(Y['debt'])} |")
    need("shares row", f"| New shares sold | {B(Q['shares'])} | $0 |")
    need("buyback row", f"| Shares bought back | $0 | {B(Y['rep'])} |")
    need("ob", f"brought in\n$372 million and lost {bn(Q['ob_oi'])}, against a\n{bn(Y['ob_oi'])} loss")
    for s in ["$75.2 billion of SpaceX shares", "$6.7 billion after tax", "negative $9.1 billion, after negative $5.9 billion",
              "$567.7 billion", "$560.8 billion", "just over 55%", "$514 billion", "$130.5 billion", "between 2026 and 2031",
              "$195 billion to $205 billion", "$28.7 billion", "$84.75 billion", "$10 billion investment by Berkshire Hathaway",
              "$0.22 a share", "14 December", "$5.0 billion senior secured loan", "October 2032", "Term SOFR plus 5.25%",
              "| 31.8% | 30.5% |", "| $2.12 | $2.87 |", "150 million", "nearly 32 billion tokens", "half-trillion dollar",
              "one billion users", "\"increase significantly in 2027\"", "$63 billion to $73 billion"]:
        need(s, s)

    # MEASURED (actual closes from the saved Nasdaq history; history from the frozen series).
    hist = {r["date"]: float(r["close"][1:].replace(",", "")) for r in
            json.loads((SRC / "GOOGL-hist10y-20261030T0142Z.json").read_text(encoding="utf-8"))["payload"]["data"]["tradesTable"]["rows"]}
    assert round(hist["10/29/2026"], 2) == round(f["last_close"], 2) and f["ath_date"] == "2026-05-13"
    need("releases", f"all {f['rx_n']} regular results releases")
    need("median", f"**{f['rx_median_abs']:.1f}%**")
    need("5%+", f"{f['rx_over5']} of the {f['rx_n']} moved by 5% or more, and {WORDS[f['rx_over10']]} by 10% or more")
    need("worst", f"**{abs(f['rx_worst']['move']):.1f}%** in October 2023")
    need("best", f"**{f['rx_best']['move']:.1f}%** in April 2024")
    need("up/down", f"rose after {f['rx_up']} of the {f['rx_n']} and fell after {f['rx_down']}")
    # The reaction: 28 Oct close -> 29 Oct close, from Nasdaq's own history (saved 30 Oct, includes 29 Oct) and the
    # 29 Oct quote stamped "Closed at Oct 29, 2026 4:00 PM ET".
    h10 = {r["date"]: float(r["close"][1:].replace(",", "")) for r in json.loads(sorted(SRC.glob("GOOGL-hist10y-*.json"))[-1]
           .read_text(encoding="utf-8"))["payload"]["data"]["tradesTable"]["rows"]}
    nd = json.loads((SRC / "GOOGL-info-20261029T2025Z.json").read_text(encoding="utf-8"))["data"]["secondaryData"]
    assert nd["lastTradeTimestamp"] == "Closed at Oct 29, 2026 4:00 PM ET"
    c28, c29 = h10["10/28/2026"], h10["10/29/2026"]
    assert c29 == float(nd["lastSalePrice"][1:]) and h10["10/27/2026"] == hist["10/27/2026"]
    nxt = (c29 / c28 - 1) * 100
    assert abs(nxt) > max(abs(r["move"]) for r in f["reactions"])
    need("28 Oct close", f"closed at ${c28:.2f} on 28 October")
    need("29 Oct close", f"they were at ${c29:.2f}, down {abs(nxt):.1f}%")
    need("answer", f"its shares fell {abs(nxt):.1f}%, their biggest fall after results in more than ten years")
    need("none larger", f"Of the {f['rx_n']} earlier results measured below, going back to February 2016, none")
    need("prev worst", f"the largest fall was {abs(f['rx_worst']['move']):.1f}%, in October 2023")
    need("prev best", f"largest rise {f['rx_best']['move']:.1f}%, in April 2024")
    big = f["big_falls"]
    # The current fall, re-measured with the 29 Oct close (no dividend between 27 and 29 Oct: the adjusted and
    # actual 27 Oct closes are equal, asserted above).
    cur = [e for e in big if not e["recovery_date"]]
    assert len(cur) == 1
    cur[0] = dict(cur[0], depth_pct=(c29 / f["ath_close"] - 1) * 100)
    need("current fall row", f"| 29 October 2026, the day after these results | −{abs(cur[0]['depth_pct']):.1f}% | Not yet |")
    big = [e for e in big if e["recovery_date"]] + cur
    done = [e for e in big if e["recovery_date"]]
    assert len(big) - len(done) == 1
    need("number of falls", f"20% or more {WORDS[len(big)]} times since it listed in August 2004")
    need("finished", f"The first {WORDS[len(done)]} all got back")
    for e in big:
        need(f"fall {e['peak_date']}", f"−{abs(e['depth_pct']):.1f}%")
    m = {e["peak_date"]: (date.fromisoformat(e["recovery_date"]) - date.fromisoformat(e["trough_date"])).days / 30.44 for e in done}
    quick = min(done, key=lambda e: m[e["peak_date"]])
    slow = max(done, key=lambda e: m[e["peak_date"]])
    assert quick["recovery_date"].startswith("2026-04") and 0.5 <= m[quick["peak_date"]] < 1.5
    assert slow["trough_date"].startswith("2008") and 3.5 <= m[slow["peak_date"]] / 12 < 4
    need("normal fall", f"about {abs(f['engine']['typical_drawdown']):.1f}%")
    need("engine now", f"it was {abs(f['engine']['current_drawdown_pct']):.1f}% below, past its normal fall")

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2004", "2006", "2007", "2008", "2012", "2016", "2018", "2019", "2020", "2021", "2022", "2023", "2024",
               "2025", "2026", "2027", "2031", "2032", "30", "28", "29", "27", "22", "43", "24", "15", "100", "9", "2",
               "1", "3"}
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
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values())} source phrases, {len(bad)} failed (as at {f['as_of']})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    for ph in pend:
        print(f"  PENDING {ph} (needs the 29 Oct close)")
    sys.exit(1 if bad or miss or pend else 0)


if __name__ == "__main__":
    main()
