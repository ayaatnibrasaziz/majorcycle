"""Assert every figure and quote in draft 38 (the 13 biggest IPOs before Anthropic) against its source.

  * LIST      — the 13 companies are exactly the post-2008 rows of Renaissance Capital's top-25 table;
  * OFFER     — every IPO price appears, as written, in that company's final prospectus;
  * PRICES    — every price is recomputed from the saved daily history; from Nov 2016 on, each one quoted must be a
                checkpoint that matched Nasdaq's own quote, and earlier ones must match reporting from the day;
  * DERIVED   — every percentage, count and date is recomputed here;
  * SWEEP     — every number in the body must come from a check; every quotation must be in a saved source.

    python -I reference/article-drafts/verify/assert_ipo14.py
"""

from __future__ import annotations

import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRAFT = Path(__file__).resolve().parents[1] / "38-biggest-ipos-before-anthropic.md"
SRC = ROOT / "earn-2026-nov-b" / "ipo14"
ANT_PRO = ROOT / "earn-2026-nov-b" / "anthropic" / "424b4.txt"

NAME = {"V": "Visa", "GM": "General Motors", "META": "Facebook", "BABA": "Alibaba", "UBER": "Uber", "CPNG": "Coupang",
        "RIVN": "Rivian", "ARM": "Arm", "LINE": "Lineage", "MDLN": "Medline", "CBRS": "Cerebras", "SPCX": "SpaceX",
        "SKHY": "SK hynix", "ANT": "Anthropic"}
RENAISSANCE = {"Visa": "V", "General Motors": "GM", "Facebook": "META", "Alibaba": "BABA", "Uber": "UBER",
               "Coupang": "CPNG", "Rivian Automotive": "RIVN", "Arm": "ARM", "Lineage": "LINE", "Medline": "MDLN",
               "Cerebras Systems": "CBRS", "SpaceX": "SPCX", "SK hynix": "SKHY", "Anthropic": "ANT"}
# offer price as the prospectus states it, and the multiplier to today's split-adjusted basis
OFFER = {"V": ("$44.00", 4), "GM": ("$33.00", 1), "META": ("$38", 1), "BABA": ("US$68.00 per ADS", 1),
         "UBER": ("$45.00", 1), "CPNG": ("$35.00", 1), "RIVN": ("$78.00", 1), "ARM": ("$51.00 per ADS", 1),
         "LINE": ("$78.00", 1), "MDLN": ("$29.00", 1), "CBRS": ("$185.00", 1), "SPCX": ("$135.00", 1),
         "SKHY": ("US$149.00 per ADS", 1), "ANT": ("$83.00", 1)}

SOURCES = {
    "renaissance-largest.txt": ["1 Anthropic|11/18/26|Nasdaq|Technology|Goldman|$81,340",
                                "2 SpaceX|06/11/26|Nasdaq|Industrials|Goldman|$75,000"],
    "excerpts-read-in-chrome.txt": [
        "General Motors Co. shares closed at $34.19",
        "As the market closed today, the company finished at $21.78 a share.",
        "General Motors Company stock closed December 30, 2011, at $20.27, down almost 39 percent from the initial offering.",
        "Alibaba saw its shares slide below its IPO price for first time since its public offering in September of 2014",
        "shares ended Friday's session at $93.89, significantly above the $68 price set last night and also slightly above the opening trading price of $92.70",
        "The shares gained 56 cents to finish Friday's session at $38.05. That's the stock's highest closing price since ending its first day of trading at $38.23",
        "closing Tuesday at yet another record low of $17.73",
        "The shares closed Thursday at $19.87",
        "At $44 a share, the IPO raised nearly $18 billion.",
        "The stock opened up 35 percent at $59.50",
        "General Motors returned to the New York Stock exchange today with shares opening at $35 per share",
        "The stock opened at 11:30 a.m. at $42.05",
        "06/16/2026 open $200.51 high $225.64 low $195.13 close $201.80"],
    "news-fox-visa-history.txt": ["the stock closed at $56.50 per share", "On Jan. 20, 2009, Visa shares ended the day at their all-time closing low of $42.42"],
    "news-ibtimes-baba-day2.txt": ["Alibaba's stock finished 4.26% lower at $89.89 on 22 September"],
    "news-fortune-rivian-day1.txt": ["opened at $106.75, up 37%", "close at around $100.73"],
    "sec-nasdaq-facebook.txt": ["a design limitation in NASDAQ's system to match IPO buy and sell orders caused disruptions to the Facebook IPO",
                                "paying a $10 million penalty - the largest ever against an exchange"],
    "jpm-bear-stearns.txt": ["The Fed has agreed to fund up to $30 billion of Bear Stearns' less liquid assets", "March 16, 2008"],
    "sec-nasdaq-62m.txt": ["in an amount not to exceed $62 million"],
    "fb-blbg-settlement.txt": ["the parties reached an agreement in principle to settle the action for $35 million in cash"],
    "baba-6k-settlement.txt": ["referred to a meeting between Alibaba and certain regulators in July 2014",
                               "On April 26, 2019, Defendants entered into a definitive settlement agreement pursuant to which we agreed to pay US$250 million",
                               "the settlement does not constitute an admission or finding that the claims asserted had any merit",
                               "State Administration for Industry and Commerce"],
    "uber-labaton-settlement.txt": ["October 4, 2024", "$200 million settlement", "Uber's May 2019 IPO"],
    "rivn-8k-settlement.txt": ["October 23, 2025", "Rivian will pay $250M to settle the claims brought on behalf of purchasers of Rivian class A common stock between November 10, 2021, and March 10, 2022",
                               "The company denies the allegations in the suit"],
    "cpng-dismissal-paulweiss.txt": ["September 10, 2025", "dismissed a putative securities class action concerning Coupang's 2021 IPO"],
    "line-labaton-case.txt": ["Updated: February 6, 2026", "The action is pending before the Honorable Denise Page Hood in the U.S. District Court for the Eastern District of Michigan"],
    "treasury-gm-ipo-pricing.txt": ["agreed to sell 358,546,795 shares of its General Motors (GM) common stock at $33.00 per share, as part of GM's initial public offering"],
    "treasury-gm-final.txt": ["December 9, 2013", "Treasury has recouped a total of $39 billion from the original GM investment"],
    "cbrs-rw-2025.txt": ["October 3, 2025", "Request for Withdrawal of Registration Statement on Form S-1", "on September 30, 2024"],
    "sec/CBRS.txt": ["In July 2024, the Company and G42 filed a Joint Voluntary Notice with the Committee on Foreign Investment in the United States",
                     "CFIUS granted the Company's request to withdraw the Joint Voluntary Notice on March 27, 2025",
                     "the United Arab Emirates, where our strategic partners, G42 and MBZUAI, are headquartered",
                     "to remove G42 as a party"],
    "sec/META.txt": ["91 days after the date of this prospectus, 271,123,815 shares held by the selling stockholders other than Mr. Zuckerberg"],
    "sec/SPCX.txt": ["on or after December 8, 2026 (the date that is 180 days after the date of this prospectus), all of the shares may be Transferred",
                     "the shares held by our founder (which are subject to a 366-day lock-up period)"],
}
ANT_PHRASES = ["27th day after the date of this prospectus (December 15, 2026)"]

bad: list[tuple[str, str]] = []
want: list[tuple[str, str]] = []


def norm(s: str) -> str:
    s = re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("�", "")
    return s.replace("‐", "-").replace("−", "-").replace("–", "-").replace("—", "-")


def need(label: str, s: str) -> None:
    want.append((label, s))


def money(v: float) -> str:
    return f"${v:,.2f}"


def sgn(p: float) -> str:
    body = f"{abs(p):,.0f}" if abs(p) >= 1000 else f"{abs(p):.1f}"
    return ("+" if p >= 0 else "−") + body + "%"


def day(d: str) -> str:
    x = dt.date.fromisoformat(d)
    return f"{x.day} {x.strftime('%b')} {x.year}"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])

    # --- sources
    for fn, phrases in SOURCES.items():
        corpus = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for ph in phrases:
            if norm(ph) not in corpus:
                bad.append((fn, ph))
    antp = norm(ANT_PRO.read_text(encoding="utf-8", errors="replace"))
    for ph in ANT_PHRASES:
        if norm(ph) not in antp:
            bad.append(("anthropic 424b4", ph))

    # --- the list: every post-2008 row of the table, and nothing else
    rows = [r.split("|") for r in (SRC / "renaissance-largest.txt").read_text(encoding="utf-8").splitlines()[2:]]
    since = {re.sub(r"^\d+ ", "", r[0]) for r in rows if int(r[1][-2:]) < 50 and int(r[1][-2:]) >= 8}
    assert since == set(RENAISSANCE), since ^ set(RENAISSANCE)

    # --- offer prices in each prospectus
    for t, (phrase, _) in OFFER.items():
        f = ANT_PRO if t == "ANT" else SRC / "sec" / f"{t}.txt"
        body = norm(f.read_text(encoding="utf-8", errors="replace"))
        if not re.search(r"(initial )?public offering price (of |is |per share is )?" + re.escape(phrase.replace("$", "$")), body, re.I) \
                and norm(phrase) not in body:
            bad.append((f"offer {t}", phrase))

    # --- prices
    P = json.loads((SRC / "ipo_prices_final.json").read_text())
    nasdaq = json.loads((SRC / "nasdaq_checks.json").read_text())
    verified = {(t, d): c for t, lst in nasdaq.items() for d, _o, c in lst}
    verified[("SPCX", "2026-06-16")] = 201.80   # Nasdaq's quote, saved in the excerpts
    verified[("RIVN", "2021-11-10")] = 100.73   # Nasdaq's history starts a day later; Fortune
    opened = {(t, d): o for t, lst in nasdaq.items() for d, o, _c in lst}
    opened[("RIVN", "2021-11-10")] = 106.75
    off = {t: float(re.search(r"[\d.]+", p.replace("US$", "$")).group()) / m for t, (p, m) in OFFER.items()}

    def close(t: str, d: str) -> float:
        c = next(r[4] for r in P[t]["rows"] if r[0] == d)
        if d >= "2016-11-22":
            assert (t, d) in verified and abs(verified[(t, d)] - c) < 0.006, (t, d, c)
        return c

    stats = {}
    for t, v in P.items():
        r = v["rows"]
        d0, o0, c0 = r[0][0], r[0][1], r[0][4]
        close(t, d0)
        after = r[1:]
        yr = [x for x in after if dt.date.fromisoformat(x[0]) <= dt.date.fromisoformat(d0) + dt.timedelta(days=365)]
        fb = next(x for x in after if x[4] < c0)
        bo = next((x for x in after if x[4] < off[t]), None)
        lo = min(yr, key=lambda x: x[4])
        last = r[-1]
        for x in (fb, lo, last) + ((bo,) if bo else ()):
            close(t, x[0])
        stats[t] = dict(d0=d0, o0=o0, c0=c0, fb=fb, bo=bo, lo=lo, last=last, n_fb=after.index(fb) + 1,
                        within=bo is not None and dt.date.fromisoformat(bo[0]) <= dt.date.fromisoformat(d0) + dt.timedelta(days=365))

    prior = [t for t in P if t != "ANT"]
    assert len(prior) == 13
    next_day = [t for t in prior if stats[t]["n_fb"] == 1]
    below_ipo = [t for t in prior if stats[t]["bo"]]
    up_now = [t for t in prior if stats[t]["last"][4] > stats[t]["c0"]]
    assert len(next_day) == 8 and len(below_ipo) == 12 and all(stats[t]["within"] for t in below_ipo)
    assert set(prior) - set(below_ipo) == {"MDLN"} and set(up_now) == {"V", "GM", "META", "UBER", "ARM"}
    assert stats["ANT"]["n_fb"] == 1
    late = sorted((stats[t]["n_fb"], t) for t in prior if stats[t]["n_fb"] > 5)
    assert late == [(26, "RIVN"), (41, "LINE"), (139, "V")]

    need("answer", "Renaissance Capital lists 13 US IPOs since 2008 among the 25 largest ever. Every one later closed below its first-day close, eight of them the next trading day, and 12 fell below their IPO price. Five are above that first close today; eight are below it.")
    need("all13", "**All 13 later closed below their first-day close.** Eight of them did it the very next trading day.")
    need("12", "**12 of the 13 closed below the price the banks sold them at**, all within a year of listing. Medline is the only one that has not.")
    pc = {t: (stats[t]["last"][4] / stats[t]["c0"] - 1) * 100 for t in P}
    lowp = {t: (stats[t]["lo"][4] / stats[t]["c0"] - 1) * 100 for t in P}
    need("ending", f"Five are above their first-day close today, Visa by {sgn(pc['V'])[1:]} and Facebook by {sgn(pc['META'])[1:]}. Eight are below it, Rivian by {sgn(pc['RIVN'])[1:]}.")
    a = stats["ANT"]
    need("ant", f"Its shares were sold at ${off['ANT']:.2f}, opened at ${a['o0']:.2f}, closed the first day at ${a['c0']:.2f} and the second at ${a['last'][4]:.2f}.")
    need("size", "Anthropic tops the table at $81.3 billion, ahead of SpaceX's $75.0 billion")

    # the first trade: pre-2016 opens must match the reporting saved in the excerpts
    for t, o in [("V", 59.50), ("GM", 35.00), ("META", 42.05), ("BABA", 92.70)]:
        assert abs(stats[t]["o0"] * OFFER[t][1] - o) < 0.006, (t, stats[t]["o0"])
    for t in P:
        if stats[t]["d0"] >= "2016-11-22" and t != "RIVN":
            assert abs(opened[(t, stats[t]["d0"])] - stats[t]["o0"]) < 0.006, t
    assert abs(stats["RIVN"]["o0"] - opened[("RIVN", "2021-11-10")]) < 0.006
    # table 1: IPO price, first trade, first-day close
    for t in P:
        s, m, yr = stats[t], OFFER[t][1], stats[t]["d0"][:4]
        cells = [f"{NAME[t]} ({yr})", money(off[t] * m), money(s["o0"] * m), money(s["c0"] * m)]
        if t == "ANT":
            cells = [f"**{c}**" for c in cells]
        need(f"t1 {t}", "| " + " | ".join(cells) + " |")
    gaps = {t: (stats[t]["o0"] / off[t] - 1) * 100 for t in P}
    top = sorted((t for t in P if gaps[t] > 30), key=lambda t: -gaps[t])
    assert top == ["CBRS", "CPNG", "RIVN", "BABA", "V", "ANT"], top
    lst = ", ".join(f"{NAME[t]} by {gaps[t]:.1f}%" for t in top[:-1]) + f" and {NAME[top[-1]]} by {gaps[top[-1]]:.1f}%"
    need("six", f"Six first trades were more than 30% above it: {lst}.")
    assert [t for t in P if gaps[t] < 0] == ["UBER"]
    need("uber", "Uber was the only one whose first trade was below its IPO price.")

    # table 2: the day the first-day close gave way, and that day's close
    for t in P:
        s, m = stats[t], OFFER[t][1]
        cells = [NAME[t], day(s["fb"][0]), money(s["fb"][4] * m)]
        if t == "ANT":
            cells = [f"**{c}**" for c in cells]
        need(f"t2 {t}", "| " + " | ".join(cells) + " |")
    need("late", "Eight of the 13 did it the very next trading day, and so did Anthropic. Only three took more than a week: Rivian, on its 26th trading day after the first, Lineage on its 41st and Visa on its 139th.")

    # table 3
    for t in prior:
        need(f"t3 {t}", f"| {NAME[t]} | {sgn(lowp[t])} | {sgn(pc[t])} |")
    short = [t for t in prior if dt.date.fromisoformat(stats[t]["last"][0]) < dt.date.fromisoformat(stats[t]["d0"]) + dt.timedelta(days=365)]
    assert short == ["MDLN", "CBRS", "SPCX", "SKHY"]

    # Visa (pre-split prices: the history is split-adjusted, so x4)
    v = stats["V"]
    assert abs(v["lo"][4] * 4 - 42.42) < 0.01 and v["lo"][0] == "2009-01-20" and v["bo"][0] == "2009-01-20" and v["n_fb"] == 139
    need("visa", f"Visa priced its IPO at $44 on 18 March 2008, two days after JPMorgan Chase announced it would buy Bear Stearns, with the Federal Reserve agreeing to fund up to $30 billion of Bear Stearns' less liquid assets. The first day closed at $56.50. The shares first closed below that on 6 October 2008, at {money(v['fb'][4] * 4)}, and closed at $42.42 on 20 January 2009, their lowest close ever and {abs(lowp['V']):.1f}% below the first-day close. Today they are {sgn(pc['V'])[1:]} above it.")

    # Facebook
    f = stats["META"]
    c2 = P["META"]["rows"][1]
    d91 = (dt.date(2012, 5, 17) + dt.timedelta(days=91)).isoformat()
    assert d91 == "2012-08-16" and abs(close("META", d91) - 19.87) < 0.006 and abs(f["lo"][4] - 17.73) < 0.006 and f["lo"][0] == "2012-09-04"
    back = next(x for x in P["META"]["rows"][1:] if x[4] > 38)
    assert back[0] == "2013-08-02" and abs(back[4] - 38.05) < 0.006 and c2[0] == "2012-05-21" == f["fb"][0]
    need("fb1", "Nasdaq paid a $10 million penalty, \"the largest ever against an exchange\". It had also set aside up to $62 million to compensate trading firms for the failures, under a plan the SEC approved.")
    need("fb2", f"The shares opened at ${f['o0']:.2f}, closed the first day at ${f['c0']:.2f} and the second at ${c2[4]:.2f}, below the $38 IPO price. On 16 August 2012, the 91st day, 271,123,815 shares held by early investors became free to sell under Facebook's prospectus; that day the shares closed at $19.87. On 4 September they closed at $17.73, their lowest, {abs(lowp['META']):.1f}% below the first-day close. The first close back above $38 came on 2 August 2013, at $38.05, more than 14 months after the listing. Today the shares are {sgn(pc['META'])[1:]} above their first-day close.")

    # Rivian
    rv = stats["RIVN"]
    pk = P["RIVN"]["rows"][4]
    assert pk[0] == "2021-11-16" and abs(pk[4] - 172.01) < 0.006 and close("RIVN", "2021-11-16")
    up = (pk[4] / rv["c0"] - 1) * 100
    need("rivn-h", f"Rivian: up {up:.1f}% in four trading days, then down {abs(pc['RIVN']):.1f}%")
    need("rivn", f"Rivian's first trade was ${rv['o0']:.2f}, {gaps['RIVN']:.1f}% above its $78 IPO price, and it closed its first day at ${rv['c0']:.2f}. Four trading days later it closed at ${pk[4]:.2f}, {up:.1f}% above that. It first closed below its first-day close on 17 December 2021, at ${rv['fb'][4]:.2f}, and below its IPO price on 18 January 2022. Its lowest close in the first year was ${rv['lo'][4]:.2f}, {abs(lowp['RIVN']):.1f}% below the first-day close, and on 20 November 2026 it closed at ${rv['last'][4]:.2f}, {abs(pc['RIVN']):.1f}% below it.")
    assert (rv["fb"][0], rv["bo"][0]) == ("2021-12-17", "2022-01-18")

    # SpaceX
    sx = stats["SPCX"]
    pk = max(P["SPCX"]["rows"], key=lambda x: x[4])
    back = next(x for x in P["SPCX"]["rows"][P["SPCX"]["rows"].index(sx["lo"]):] if x[4] >= sx["c0"])
    assert pk[0] == "2026-06-16" and P["SPCX"]["rows"][2][0] == pk[0]
    need("spcx", f"SpaceX's first trade was ${sx['o0']:.2f}, against an IPO price of $135, and it closed its first day at ${sx['c0']:.2f}. Two trading days later it closed at ${pk[4]:.2f}, its highest close.")
    need("s1", f"**22 June:** first close below its first-day close, at ${sx['fb'][4]:.2f}.")
    need("s2", f"**16 July:** first close below its IPO price, at ${sx['bo'][4]:.2f}.")
    need("s3", f"**5 August:** its lowest close, ${sx['lo'][4]:.2f}, {abs(lowp['SPCX']):.1f}% below its first-day close.")
    need("s4", f"**5 October:** back above its first-day close, at ${close('SPCX', back[0]):.2f}.")
    need("s5", f"**20 November:** ${sx['last'][4]:.2f}, {abs(pc['SPCX']):.1f}% below its first-day close.")
    assert (sx["fb"][0], sx["bo"][0], sx["lo"][0], back[0]) == ("2026-06-22", "2026-07-16", "2026-08-05", "2026-10-05")
    need("s6", "the last of them on 8 December 2026. Its founder's shares are locked for 366 days.")

    # regulators and courts
    need("c-fb", "the shareholders' lawsuit over the IPO was settled for $35 million in cash.")
    need("c-baba", "In April 2019 Alibaba agreed to pay $250 million to settle; the settlement \"does not constitute an admission or finding that the claims asserted had any merit\".")
    need("c-baba2", "referred to a meeting between Alibaba and regulators in July 2014, two months before its listing.")
    need("c-uber", "in 2024 a shareholders' lawsuit over the IPO documents was settled for $200 million.")
    need("c-rivn", "in October 2025 Rivian agreed to pay $250 million to settle a lawsuit brought for buyers of its shares between 10 November 2021 and 10 March 2022. It \"denies the allegations in the suit\".")
    need("c-cpng", "a lawsuit over its IPO was dismissed in September 2025.")
    need("c-line", "was pending in federal court in Michigan at the plaintiffs' lawyers' last update, in February 2026.")
    need("c-gm", "the US Treasury agreed to sell 358,546,795 of its own GM shares in the IPO, at $33. When it sold its last shares, on 9 December 2013, it said it had recouped $39 billion from its original investment in GM.")
    need("c-cbrs", "it first filed to list in September 2024, while a US national security committee, CFIUS, was reviewing an investment by G42, a partner headquartered in the United Arab Emirates. In March 2025, after G42's role was cut back, CFIUS let Cerebras withdraw the notice. Cerebras withdrew its filing in October 2025 and listed in May 2026.")

    # Anthropic now
    need("antnow", f"Anthropic closed at ${a['last'][4]:.2f} on 20 November, {abs(pc['ANT']):.1f}% below its first-day close and {(a['last'][4] / 83 - 1) * 100:.1f}% above its $83.00 IPO price. The first of its 23 lock-up release dates is 15 December 2026, a week after SpaceX's last.")
    assert abs(a["fb"][4] - a["last"][4]) < 1e-9

    # ONE VALUE PER FACT: wherever the prose names a company's IPO price, first trade or first-day close, it must be the
    # table's figure. A sentence is assigned to the company it names first (the article names one company a sentence).
    tbl = {t: {"close": stats[t]["c0"] * OFFER[t][1], "open": stats[t]["o0"] * OFFER[t][1], "ipo": off[t] * OFFER[t][1]} for t in P}
    pats = {"close": r"closed (?:its|the) first day at \$([\d,]+(?:\.\d+)?)|first day closed at \$([\d,]+(?:\.\d+)?)",
            "open": r"(?:first trade was|opened at) \$([\d,]+(?:\.\d+)?)",
            "ipo": r"IPO (?:price )?at \$([\d,]+(?:\.\d+)?)|IPO price of \$([\d,]+(?:\.\d+)?)|\$([\d,]+(?:\.\d+)?) IPO price"}
    body = re.sub(r"^\|.*$", "", raw[raw.index("## Body"):raw.index("## Fact-check sheet")], flags=re.M)
    owner = None
    paras = re.split(r"\n\s*\n|\n- ", body)
    for sent in (s2 for para in paras for s2 in re.split(r"(?<=[.!?])\s+", norm(para))):
        if sent.startswith("#"):
            owner = None
        names = [t for t in P if NAME[t] in sent]
        if names:
            owner = min(names, key=lambda t: sent.index(NAME[t]))
        for k, pat in pats.items():
            for m in re.finditer(pat, sent):
                v = float(next(g for g in m.groups() if g).replace(",", ""))
                if owner is None or abs(v - tbl[owner][k]) > 0.006:
                    bad.append(("consistency", f"{owner}: prose says {k} {v}, table says {owner and round(tbl[owner][k], 2)} :: {sent[:90]}"))
    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, norm(" ".join(s for _, s in want))))
    ALLOWED = {"2008", "2009", "2010", "2011", "2012", "2013", "2014", "2015", "2019", "2020", "2021", "2022", "2023",
               "2024", "2025", "2026", "25", "13", "14", "180", "4", "30", "10", "90", "15", "19", "8", "5", "12", "20"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8", errors="replace")) for fn in SOURCES)
    for q in re.findall(r'"([^"]+)"', text):
        if len(q) >= 8 and norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values()) + len(OFFER)} source phrases, {len(bad)} failed")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


if __name__ == "__main__":
    main()
