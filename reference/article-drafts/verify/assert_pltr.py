"""Assert every figure and quote in draft 23 (Palantir, third quarter 2026) against its source.

Same method as assert_wbc.py:
  * SOURCE  — every raw number and phrase taken from Palantir must appear, as written, in the saved filing it is
    attributed to (Q3 and Q2 releases, three 10-Qs); every analyst figure in the saved XTB page; the coverage quote
    in the saved Gotrade page;
  * DERIVED — every comparison is recomputed here from those raw numbers;
  * MEASURED — share-price history from `earn_figures.figures()` (frozen data), and every close and the day's range
    checked against Nasdaq's saved price history to the cent (Palantir pays no dividend);
  * EVERY number in the body must be one this file checks;
  * EVERY quotation must appear word for word in a saved source.

    python -I reference/article-drafts/verify/assert_pltr.py
"""

from __future__ import annotations

import gzip
import json
import os
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("EARN_DATA", str(ROOT / "earn-nov-pltr-2026-DATA.json.gz"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from earn_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "23-palantir-q3-2026-results.md"
SRC = ROOT / "pltr-2026-q3" / "sources"
Q3, Q2, K3, K2, K25, XTB, GOT = ("PLTR-ex99_1-20261102.txt", "PLTR-ex99_1-20260803.txt", "PLTR-10Q-20260930.txt",
                                 "PLTR-10Q-20260630.txt", "PLTR-10Q-20250930.txt", "xtb-2026-11-02.txt",
                                 "gotrade-november-4-2026.txt")
# Owner 7 Nov: the article needed what management said. The results call (Motley Fool transcript) and Karp's
# letter to shareholders (palantir.com, checked against the live page by SHA-256).
TR, LT = "PLTR-Q3-2026-transcript-fool.txt", "PLTR-Q3-2026-letter.txt"
# --- REPORTED, US$ thousands (Q3 release, Consolidated Statements of Operations) ---
REV, REV0 = 2313411, 1181092
OPI, OPI0 = 1084845, 393256
NI, NI0 = 1128012, 475599
SOURCES = {
    Q3: ["Revenue $ 2,313,411 $ 1,181,092", "Income from operations 1,084,845 393,256",
         "Net income attributable to common stockholders $ 1,128,012 $ 475,599",
         "U.S. revenue grew 119% year-over-year and 23% quarter-over-quarter to $1.937 billion",
         "U.S. commercial revenue grew 148% year-over-year and 29% quarter-over-quarter to $984 million",
         "U.S. government revenue grew 96% year-over-year and 18% quarter-over-quarter to $953 million",
         "Revenue grew 96% year-over-year and 20% quarter-over-quarter to $2.313 billion",
         "Quarterly revenue surpassed $2 billion for the first time ever",
         "Closed total contract value (“TCV”) of $2.918 billion, up 6% year-over-year",
         "Closed $1.463 billion of U.S. commercial TCV, up 11% year-over-year",
         "Adjusted income from operations of $1.427 billion, representing a 62% margin",
         "Adjusted EPS of $0.44",
         "Revenue of between $2.649 - $2.653 billion",
         "We are raising our revenue guidance to between $8.530 - $8.534 billion",
         "We are raising our U.S. commercial revenue guidance to in excess of $3.559 billion, representing a growth rate of at least 143%",
         "which excludes stock-based compensation and related employer payroll taxes",
         "said Alex Karp, Co-Founder and Chief Executive Officer",
         "Our U.S. commercial revenue has surpassed our U.S. government revenue for the first time in our company’s history",
         "Closed 212 deals of at least $1 million, 107 deals of at least $5 million, and 64 deals of at least $10 million",
         "GAAP income from operations of $1.085 billion, representing a 47% margin",
         "GAAP net income of $1.128 billion, representing a 49% margin",
         "Rule of 40 score of 158%",
         "Adjusted free cash flow of $1.216 billion, representing a 53% margin",
         "Cash, cash equivalents, and U.S. Treasury securities of $10.4 billion",
         "We are raising our adjusted income from operations guidance to between $5.245 - $5.249 billion",
         "We are raising our adjusted free cash flow guidance to between $4.8 - $5.0 billion",
         "remaining deal value (“RDV”) is the total remaining value of contracts as of the end of the reporting period",
         "The term “Rule of 40” refers to the sum of our revenue growth rate year-over-year and our adjusted operating margin"],
    TR: ["Our U.S. commercial customer count grew to 686 customers, reflecting growth of 29% year-over-year",
         "Third quarter trailing 12-month revenue from our top 20 customers increased 76% year-over-year to $146 million per customer",
         "Net dollar retention was 165%, an increase of 800 basis points from last quarter",
         "An industrial materials company piloted a nearly $3 million engagement in Q2 2026 before converting to a $29 million ACV deal last quarter",
         "We signed multiple 8-figure deals in the quarter that were shorter in duration than usual, as customers rapidly adopted initial Sovereign AI capabilities in their enterprise",
         "over time, we expect both the duration and size of these contracts to increase",
         "Over the past 12 months, we closed $6.114 billion of U.S. commercial TCV bookings, a 62% increase from the prior 12 months",
         "$13.4 billion in total remaining deal value, an increase of 55% year-over-year and 2% sequentially",
         "$4.9 billion in remaining performance obligations, an increase of 88% year-over-year and flat sequentially",
         "does not take into account contracts with an initial term of less than 12 months and contractual obligations that fall beyond termination for convenience clauses, both of which are common in most of our government business",
         "Net income has increased nearly eightfold over the last 24 months from $144 million in the third quarter of 2024",
         "we really cannot satiate demand",
         "Chief Financial Officer - Dave Glazer", "Chief Revenue Officer and Chief Legal Officer - Ryan Taylor"],
    LT: ["It would be an understatement to say that our results this past quarter were extraordinary",
         "has been absolutely ravenous and remains far from sated in the United States",
         "What may have taken months and years",
         "can now take days and weeks",
         "It is our firm and unwavering intent to take the entire market, the whole thing"],
    Q2: ["Closed total contract value (“TCV”) of $3.373 billion, up 49% year-over-year",
         "Closed a record-setting $2.132 billion of U.S. commercial TCV, up 153% year-over-year",
         "Revenue of between $2.160 – $2.164 billion",
         "We are raising our revenue guidance to between $8.150 – $8.158 billion"],
    K3: ["remaining performance obligations were $ 4.9 billion as of September 30, 2026"],
    K2: ["remaining performance obligations were $ 4.9 billion as of June 30, 2026"],
    K25: ["remaining performance obligations were $ 2.6 billion as of September 30, 2025"],
    XTB: ["Revenue increased 96% year over year to $2.31 billion, beating analysts' consensus estimate of $2.18 billion",
          "Adjusted earnings per share (EPS) reached $0.44, compared with expectations of $0.41",
          "comfortably above the consensus estimate of approximately $2.46 billion"],
    GOT: ["The Motley Fool tied the drop to slowing contract growth, with total contract value up 6% and remaining performance obligations unchanged at $4.9 billion"],
}
# owner 7 Nov: lawsuits and other risks the company itself reports (added to the file's own list, not replacing it)
SOURCES["PLTR-10Q-20260930.txt"] = SOURCES.get("PLTR-10Q-20260930.txt", []) + [
        'The suits allege false and misleading statements about our business and prospects',
        'On April 4, 2025, the Court dismissed the Cupat matter with prejudice',
        'On March 16, 2026, the United States Court of Appeals for the Tenth Circuit held oral arguments for the case',
        'As of September 30, 2026, the Company was not aware of any currently pending legal matters or claims, individually or in the aggregate, that were expected to have a material adverse impact',
    ]


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("�", "")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures("PLTR")
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    m = lambda x: round(x / 1000)  # noqa: E731  thousands -> millions
    assert (m(REV), m(REV0), m(OPI), m(OPI0), m(NI), m(NI0)) == (2313, 1181, 1085, 393, 1128, 476)
    assert (round(pct(REV, REV0)), round(pct(OPI, OPI0)), round(pct(NI, NI0))) == (96, 176, 137)
    assert round(1937 / 2313 * 100) == 84 and 984 > 953
    need("answer", "Palantir's revenue rose 96% to $2.31 billion in the third quarter of 2026, above analysts' forecasts, and it raised its forecast for the year. But the value of the new contracts it signed grew just 6%")
    need("short rev", "$2,313 million, up 96% from $1,181 million a year earlier, and its first quarter above $2 billion")
    need("short usc", "revenue from American companies of $984 million, up 148%, more than it earned from the American government, $953 million, for the first time")
    need("short ni", "net income of $1,128 million, up from $476 million")
    need("short tcv", "$2,918 million, up 6%")
    need("short guide", "revenue for 2026 of $8,530 million to $8,534 million, up from the $8,150 million to $8,158 million it forecast in August")
    need("row rev", "| Revenue | $2,313M | $1,181M | +96% |")
    need("row opi", "| Income from operations | $1,085M | $393M | +176% |")
    need("row ni", "| Net income | $1,128M | $476M | +137% |")
    need("adj", "put operating income at $1,427 million, a 62% margin")
    need("seg usc", "| US commercial | $984M | +148% | +29% |")
    need("seg usg", "| US government | $953M | +96% | +18% |")
    need("seg us", "| All US revenue | $1,937M | +119% | +23% |")
    need("seg all", "| All revenue | $2,313M | +96% | +20% |")
    need("us share", "So 84% of Palantir's revenue came from the United States")
    need("cons", "analysts' average forecast was revenue of $2.18 billion and adjusted earnings per share of $0.41, according to XTB. Palantir reported $2,313 million and $0.44")
    need("q3 guide", "Palantir itself had forecast third-quarter revenue of $2,160 million to $2,164 million")
    need("q4", "Palantir forecast revenue of $2,649 million to $2,653 million. Analysts had expected about $2.46 billion, according to XTB")
    need("tcv row", "| Contract value signed | $2,918M | $3,373M |")
    need("tcv ch", "| Change on a year earlier | +6% | +49% |")
    need("usc tcv", "| Signed with US companies | $1,463M | $2,132M |")
    need("usc tcv ch", "| Change on a year earlier | +11% | +153% |")
    need("rpo", "were $4.9 billion at 30 September, the same as at 30 June. A year earlier they were $2.6 billion")
    need("next q4", "lands in the $2,649 million to $2,653 million Palantir expects")
    need("next usc", "more than $3,559 million of US commercial revenue in 2026, growth of at least 143%")
    need("ceo", "Chief executive Alex Karp said: \"Our U.S. commercial")
    # --- owner 7 Nov additions: margins, customers, management's explanation, cash, Karp ---
    assert round(OPI / REV * 100) == 47 and round(NI / REV * 100) == 49
    need("margins", "an operating margin of 47% and a net margin of 49%")
    assert 7.5 < NI / 1000 / 144 < 8
    need("8x", "Net income was $144 million in the same quarter of 2024, so in two years it has grown nearly eightfold")
    need("deals", "Palantir closed 212 deals worth at least $1 million in the quarter, including 107 worth at least $5 million and 64 worth at least $10 million")
    need("cfo", "its chief financial officer, Dave Glazer, said")
    need("cust", "it had 686 US commercial customers, up 29% on a year earlier")
    need("top20", "its 20 largest customers each spent an average of $146 million with it over the past 12 months, up 76%")
    need("ndr", "was 165%, up 8 points on the quarter before")
    need("cro", "Its chief revenue officer, Ryan Taylor")
    need("pilot", "\"piloted a nearly $3 million engagement in Q2 2026 before converting to a $29 million ACV deal last quarter\"")
    need("glazer", "\"We signed multiple 8-figure deals in the quarter that were shorter in duration than usual")
    need("glazer2", "\"over time, we expect both the duration and size of these contracts to increase.\"")
    need("ttm", "had a total value of $6,114 million, up 62% on the 12 months before")
    need("rdv", "was $13.4 billion, up 55% on a year earlier but only 2% on the quarter before")
    assert round((4.9 / 2.6 - 1) * 100) == 88
    need("rpo88", "Its remaining performance obligations were up 88% on a year earlier")
    need("fcf", "Palantir generated $1,216 million of adjusted free cash flow in the quarter, 53% of its revenue")
    need("cash", "with $10.4 billion of cash and US Treasury securities")
    assert 96 + 62 == 158
    need("r40 name", "Its \"Rule of 40\" score, which adds its revenue growth to its adjusted operating margin")  # release definition
    need("r40", "was 158%: growth of 96% plus a margin of 62%")
    need("guide fy", "adjusted operating income of $5,245 million to $5,249 million, and adjusted free cash flow of $4.8 billion to $5.0 billion")
    need("karp1", "Karp called the quarter's results \"extraordinary\"")
    need("karp ravenous", "\"has been absolutely ravenous and remains far from sated in the United States\"")
    need("karp market", "\"to take the entire market, the whole thing\"")
    need("karp call", "\"we really cannot satiate demand.\"")
    need("views", "These are Palantir's views of its own business, not ours")

    if "MOVE_" in raw or "PENDING" in raw:
        bad.append(("placeholder", "placeholders still in the draft"))
    else:
        need("legal 0", 'In 2022, shareholders filed a lawsuit')
        need("legal 1", 'A court dismissed it in April 2025')
        need("legal 2", 'heard arguments on 16 March 2026')
        need("legal 3", 'As of 30 September 2026, Palantir said it was not aware of any pending legal matters')
        measured(f, need)

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2025", "2026", "2020", "3", "2", "4", "30", "500", "24"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8", errors="replace")) for fn in SOURCES)
    for q in re.findall(r'"([^"]+)"', text):
        if len(q) >= 8 and norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values())} source phrases, {len(bad)} failed (as at {f['as_of']})")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


def measured(f: dict, need) -> None:  # noqa: ANN001
    MON = "January February March April May June July August September October November December".split()
    my = lambda d: f"{MON[int(d[5:7]) - 1]} {d[:4]}"  # noqa: E731
    d, c = f["full_dates"], dict(zip(f["full_dates"], f["full_closes"]))
    nq = {}
    for r in json.loads((SRC / "PLTR-hist10y-20261105T2300Z.json").read_text(encoding="utf-8"))["data"]["tradesTable"]["rows"]:
        mm, dd, yy = r["date"].split("/")
        nq[f"{yy}-{mm}-{dd}"] = {k: float(r[k].strip("$").replace(",", "")) for k in ("close", "open", "high", "low")}
    for day in ("2026-10-09", "2026-10-30", "2026-11-02", "2026-11-03", "2026-11-04"):
        assert abs(c[day] - nq[day]["close"]) < 0.006, day
    c2, c3, c4 = nq["2026-11-02"]["close"], nq["2026-11-03"]["close"], nq["2026-11-04"]["close"]
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    mv = pct(c3, c2)
    assert this["release"] == "2026-11-02" and this["to"] == "2026-11-03" and abs(this["move"] - mv) < 0.01
    with gzip.open(os.environ["EARN_DATA"], "rt", encoding="utf-8") as fh:
        full = json.load(fh)["full"]
    ix = {k: {r[0]: float(r[3]) for r in full[k]} for k in ("^IXIC", "^GSPC")}
    nqm, spm = (pct(ix[k]["2026-11-03"], ix[k]["2026-11-02"]) for k in ("^IXIC", "^GSPC"))
    need("answer move", f"its shares fell {abs(mv):.1f}% the next day, the smallest move after any of its results since it listed")
    need("short move", f"down {abs(mv):.1f}% on 3 November, to ${c3:.2f}, while the Nasdaq Composite rose {nqm:.1f}%")
    pre = pct(c2, nq["2026-10-30"]["close"])
    low = pct(nq["2026-11-03"]["low"], c2)
    need("2 close", f"Palantir closed at ${c2:.2f} on 2 November, already down {abs(pre):.1f}% that day before the results came out")
    need("3 range", f"it opened at ${nq['2026-11-03']['open']:.2f} and was as low as ${nq['2026-11-03']['low']:.2f}, down {abs(low):.1f}%, before closing at ${c3:.2f}, down {abs(mv):.1f}%")
    need("idx", f"The Nasdaq Composite rose {nqm:.1f}% and the S&P 500 {spm:.1f}% the same day")
    assert f["ath_date"] == "2026-10-09" and abs(f["ath_close"] - 209.05) < 0.006 and f["as_of"] == "2026-11-04"
    need("4 nov", f"On 4 November the shares fell again, to ${c4:.2f}. That leaves them {abs(f['below_ath']):.1f}% below their record close of ${f['ath_close']:.2f}, set on 9 October 2026, and down {abs(f['ytd']):.1f}% this year")
    mvs = [r["move"] for r in before]
    n = len(before)
    assert n == 24 and before[0]["release"] == "2020-11-12" and before[-1]["release"] == "2026-08-03"
    assert f["first_bar"] == "2020-09-30"
    need("rx n", f"all {n} quarterly results Palantir released from November 2020, after it listed in September 2020, to August 2026")
    need("rx med", f"The middle move, up or down, was **{statistics.median(abs(v) for v in mvs):.1f}%**")
    assert all(abs(v) >= 5 for v in mvs)
    need("rx 5", f"Every one of the {n} moved the shares by 5% or more, and {sum(abs(v) >= 10 for v in mvs)} by 10% or more")
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    assert w["release"] == "2022-05-09" and b["release"] == "2024-02-05"
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in May 2022")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in February 2024")
    need("rx last", f"The last results, in August 2026, sent the shares up **{before[-1]['move']:.1f}%**")
    need("rx updown", f"The shares rose after {sum(v > 0 for v in mvs)} of the {n} and fell after {sum(v < 0 for v in mvs)}")
    assert all(abs(v) > abs(mv) for v in mvs)
    need("smallest", "So this was the smallest results-day move in Palantir's history as a listed company")
    falls = f["big_falls"]
    assert len(falls) == 5 and f["fall_threshold"] == -20
    need("falls n", "fallen 20% or more five times since they listed")
    for e in falls:
        assert e["recovery_date"]
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {my(e['recovery_date'])} |")
    yrs = lambda a, b: (int(b[:4]) - int(a[:4])) + (int(b[5:7]) - int(a[5:7])) / 12  # noqa: E731
    longest = max(yrs(e["peak_date"], e["recovery_date"]) for e in falls)
    assert 3.5 < longest < 4, longest
    need("falls back", "All five got back to their record. The longest took more than three and a half years from the record")


if __name__ == "__main__":
    main()
