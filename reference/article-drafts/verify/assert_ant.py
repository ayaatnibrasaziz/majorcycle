"""Assert every figure and quote in draft 37 (Anthropic's lock-up dates) against its source.

  * SOURCE  — every number and phrase taken from Anthropic must appear, as written, in its final prospectus
    (Form 424(b)(4), `424b4.txt`); every number from the press in the article it is attributed to;
  * DERIVED — every percentage is recomputed here from those raw numbers;
  * MEASURED — the prices come from Nasdaq's saved history for ANT;
  * EVERY number in the body must be one this file checks; EVERY quotation must appear word for word in a source.

    python -I reference/article-drafts/verify/assert_ant.py
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRAFT = Path(__file__).resolve().parents[1] / "37-anthropic-lock-up-dates.md"
SRC = ROOT / "earn-2026-nov-b" / "anthropic"
PRO, PRICING, LIVE, FLIP, CBC, NPR = ("424b4.txt", "news-cnbc-pricing.txt", "news-cnbc-takeaways.txt",
                                      "news-cnbc-flipping.txt", "news-cbc-day1.txt", "news-npr.txt")
SEC, FH = "sec-lockup.txt", "field-hanka-2001.txt"

# the release table, in the prospectus's order: (trigger as the article words it, the prospectus's wording, total)
TABLE = [
    ("First trading day, 19 November 2026", "The first trading day following the date of this prospectus (November 19, 2026)", 315),
    ("15 December 2026 (day 27)", "27th day after the date of this prospectus (December 15, 2026)", 303),
    ("5 January 2027 (day 48)", "48th day after the date of this prospectus (January 5, 2027)", 303),
    ("19 January 2027 (day 62)", "62nd day after the date of this prospectus (January 19, 2027)", 353),
    ("2 February 2027 (day 76)", "76th day after the date of this prospectus (February 2, 2027)", 353),
]
LATER = [("FY26", 0, 1700), ("FY26", 13, 480), ("FY26", 27, 480), ("FY26", 41, 480), ("FY26", 55, 480), ("FY26", 69, 480),
         ("Q1", 0, 3000), ("Q1", 34, 447), ("Q1", 48, 447), ("Q1", 62, 447), ("Q1", 76, 447),
         ("Q2", 0, 558), ("Q2", 27, 502), ("Q2", 41, 502), ("Q2", 55, 502), ("Q2", 69, 502), ("Q2", 83, 502),
         ("Q3", 0, 1900)]

SOURCES = {
    PRO: ["Prospectus dated November 18, 2026",
          "980,000,000 Shares", "We are selling 956,351,354 shares", "an additional 23,648,646 shares",
          "The initial public offering price per share is $83.00", "under the symbol “ANT.”",
          "7,583,103,996 shares", "5,636,538,278 shares", "13,219,642,276 shares",
          "up to 10% of the aggregate number of lock-up securities held by our non-founder directors, officers, and current and former employees and consultants, which may be transferred or sold beginning on the first trading day",
          "including our Chief Financial Officer and Chief Accounting Officer, are eligible to sell shares on the first trading day",
          "approximately 2.7 billion shares of our Class A common stock", "approximately 8.0 billion shares of our Class A common stock",
          "Our seven co-founders, during the period ending upon the earlier to occur of (x) 6:00 AM Eastern Time on the second full trading day immediately following the Q3 Earnings Release Date or (y) immediately after the close of the trading day on the 365th day",
          "subject to timed automatic expirations", "are subject to a number of exceptions",
          "may Transfer up to 29% of the aggregate number of lock-up securities held by them",
          "The representatives, in their joint discretion, may release the lock-up securities described above in whole or in part at any time",
          "50.1% of the total voting power", "Founder LLC",
          "Advanced Micro Devices, Inc., Broadcom Inc., Google LLC", "Micron Technology, Inc., Microsoft Corporation, NVIDIA Corporation, and TSMC Partners, Ltd.",
          "an aggregate of $26.0 billion of our Class N common stock in a private placement at a price per share equal to the initial public offering price",
          "will not be subject to lock-up agreements with the underwriters, but will be “restricted securities”",
          "Amazon and Google will each hold greater than five percent of our outstanding capital stock",
          "will hold 1,936,452,353 and 1,774,959,745 shares of our C",
          "Although our Class N common stock is non-voting",
          "Class N common stock will automatically convert into an equal number of shares of Class A common stock upon a transfer effected through: (i) a registered offering or an open market sale",
          "Up to 1.7 billion shares of Class A and Class N common stock", "Up to 3.0 billion shares of Class A and Class N common stock",
          "Up to 558 million shares of Class A and Class N common stock", "Up to 1.9 billion shares of Class A and Class N common stock"]
         + [p for _, p, _ in TABLE],
    PRICING: ["an expected price range between $70 and $78 per share", "planning to sell 825 million shares",
              "raising $81.3 billion", "surpassing SpaceX", "raised $75 billion initially"],
    LIVE: ["Retail allocation came in at around 15%, the people said", "about 20% of the offering would go to retail",
           "More than 846 million shares changed hands, surpassing the 522 million shares that were traded on SpaceX's opening day",
           "opened at $111.50"],
    FLIP: ["selling IPO shares within 30 days of the IPO is considered flipping",
           "may be prevented from participating in IPO access for 60 days"],
    CBC: ["slightly before noon eastern time on Thursday, at $111.50", "the tech-heavy Nasdaq index fell on the day"],
    NPR: ["at $111.50, a whopping 34% above the IPO price"],
    SEC: ["most prevent insiders from selling their shares for 180 days",
          "a company's stock price may drop in anticipation that locked up shares will be sold into the market when the lockup ends"],
    FH: ["We examine 1,948 share lockup agreements", "there is little selling by insiders",
         "we find a permanent 40 percent increase in average trading volume",
         "three-day abnormal return of -1.5 percent",
         "The abnormal return and volume are much larger when the firm is financed by venture capital",
         "Laura Casares Field & Gordon Hanka, 2001", "Journal of Finance"],
}


def norm(s: str) -> str:
    s = re.sub(r"\s+", " ", s).replace("’", "'").replace("“", '"').replace("”", '"').replace("�", "")
    return s.replace("‐", "-").replace("−", "-")


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = DRAFT.read_text(encoding="utf-8")
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    want: list[tuple[str, str]] = []
    bad: list[tuple[str, str]] = []
    need = lambda lbl, s: want.append((lbl, s))  # noqa: E731

    for fn, phrases in SOURCES.items():
        hay = norm((SRC / fn).read_text(encoding="utf-8", errors="replace"))
        for p in phrases:
            if norm(p) not in hay:
                bad.append((fn, p))

    # the release table: the prospectus lists exactly these 23 rows, in this order
    pro = norm((SRC / PRO).read_text(encoding="utf-8", errors="replace"))
    a = pro.index("Earliest Date Available for Sale in the Public Market")
    b = pro.index("Lock-Up and Market Standoff Agreements All of our directors")
    tbl = pro[a:b]
    totals = re.findall(r"Up to ([\d.]+) (million|billion) shares of Class A and Class N common stock", tbl)
    got = [round(float(n) * (1000 if u == "billion" else 1)) for n, u in totals]
    assert got == [t for *_, t in TABLE] + [t for *_, t in LATER], got
    assert len(got) == 23
    with open(SRC / "nasdaq-hist-ANT-20261122.csv", encoding="utf-8") as fh:
        px = {r["date"]: r for r in csv.DictReader(x for x in fh if not x.startswith("#"))}
    close20 = float(px["11/20/2026"]["close"])
    val = lambda m: f"${m * 1e6 * close20 / 1e9:.1f}B"  # noqa: E731
    for i, (lab, _, tot) in enumerate(TABLE, 1):
        need(f"row {i}", f"| {i} | {lab} | {tot}M | {val(tot)} |")
    for i, (q, d, tot) in enumerate(LATER, 6):
        size = f"{tot / 1000:.1f}B" if tot >= 1000 else f"{tot}M"
        m = re.search(rf"\| {i} \| [^|]+ \| {re.escape(size)} \| {re.escape(val(tot))} \|", text)
        need(f"row {i}", m.group(0) if m else f"| {i} | (a trigger) | {size} | {val(tot)} |")
    # day 180 and day 365, counted from the prospectus date (the filing's own day-27 and day-76 dates prove the base)
    import datetime as dt
    base = dt.date(2026, 11, 18)
    assert base + dt.timedelta(days=27) == dt.date(2026, 12, 15) and base + dt.timedelta(days=76) == dt.date(2027, 2, 2)
    d180, d195, d365 = (base + dt.timedelta(days=n) for n in (180, 195, 365))
    assert (d180, d195, d365) == (dt.date(2027, 5, 17), dt.date(2027, 6, 1), dt.date(2027, 11, 18))
    assert d180.weekday() < 5 and d365.weekday() < 5  # weekdays, and neither is a US market holiday
    need("d180", "or 17 May 2027 (day 180) if earlier | 3.0B")
    need("d365", "or 18 November 2027 (day 365) if earlier | 1.9B")
    need("next dates", "**17 May 2027 and 18 November 2027.** Day 180 and day 365")
    need("d195", "from day 195 (1 June 2027) some holders may hedge up to 20% of their remaining locked-up shares, about 719 million shares in all")
    fixed = sum(t for *_, t in TABLE)
    need("cum", f"the five fixed dates add up to as many as {fixed:,} million shares, about {fixed / 980:.1f} times the 980 million sold in the offering")
    need("15.5", "about 15.5 billion shares are covered by lock-up agreements with the banks")
    need("3.7", "about 3.7 billion shares covered by the 180-day agreements may become eligible for sale")
    need("sydney", "The releases start at 6:00am New York time, 10pm the same day in Sydney through the Australian summer")
    for ph in ["up to 10% of the aggregate number of lock-up securities held by",
               "up to an additional 35% of lock-up securities held by such lock-up parties",
               "27 and 48 days, respectively, after the date of this prospectus, up to 6.0%",
               "27 and 48 days, respectively, after the date of this prospectus, up to 1.8%",
               "62 and 76 days, respectively, after the date of this prospectus, up to an additional 7.0%",
               "62 and 76 days, respectively, after the date of this prospectus, up to an additional 2.1%",
               "FY26 Earnings Release Date, up to an additional 12.5%", "FY26 Earnings Release Date, up to an additional 3.75%",
               "after the FY26 Earnings Release Date, up to an additional 9.5%", "after the FY26 Earnings Release Date, up to an additional 2.85%",
               "180th Day, up to an additional 4.2%", "after the Q1 Earnings Release Date, up to an additional 5.6%",
               "Q2 Earnings Release Date\u201d), up to an additional 7.0%", "after the Q2 Earnings Release Date, up to an additional 6.3%",
               "up to 20% of each such stockholder", "up to approximately 719 million shares in the aggregate",
               "15.5 billion shares of our Class A common stock (including shares issuable upon the conversion of our outstanding Class N common stock, upon the exercise or settlement of outstanding equity awards, and upon full conversion of outstanding convertible promissory notes)",
               "3.7 billion shares subject to the 180-day lock-up and market standoff period may become eligible for sale prior to the expiration of that period",
               "195 days after the date of this prospectus"]:
        if norm(ph) not in pro:
            bad.append((PRO, ph))
    need("staff%", "Up to 10% from the first trading day, including the finance chief and chief accounting officer; up to a further 35% two trading days after the results for 2026")
    need("2.7%", "Up to 6.0% on 15 December and again on 5 January; 7.0% on 19 January and again on 2 February; 12.5% after the results for 2026; 9.5% at each of the five steps after them")
    need("0.5%", "1.8% on 15 December and 5 January, 2.1% on 19 January and 2 February, 3.75% after the results for 2026, 2.85% at each of the five steps after them, 4.2% at the March 2027 results or day 180, then 5.6%, 7.0% and 6.3% in steps after later results")
    # the co-founders' own sale in the offering: seven rows of 3,378,378 in the ownership table, totalling the secondary
    assert 7 * 3_378_378 == 23_648_646
    for ph in ["Dario Amodei(1)", "Daniela Amodei(3)", "Tom Brown(12)", "Jack Clark(13)", "Jared Kaplan(14)", "Sam McCandlish(15)", "Christopher Olah(16)"]:
        k = pro.find(ph)
        if k < 0 or "3,378,378" not in pro[k:k + 260]:
            bad.append((PRO, f"{ph} sells 3,378,378"))
    need("founders sold", f"Each sold 3,378,378 shares in the offering itself, worth about ${round(3_378_378 * 83 / 1e6, -1):.0f} million each at the offer price")
    pp = [("Google", "Google LLC", 120_481_927, "$10.0B", "approximately $10.0 billion"),
          ("Nvidia", "NVIDIA Corporation (\u201cNVIDIA\u201d)", 120_481_927, "$10.0B", "approximately $10.0 billion"),
          ("AMD", "Advanced Micro Devices, Inc. (\u201cAMD\u201d)", 30_120_481, "$2.5B", "approximately $2.5 billion"),
          ("Broadcom", "Broadcom Inc. (\u201cBroadcom\u201d)", 12_048_192, "$1.0B", "approximately $1.0 billion"),
          ("Micron", "Micron Technology, Inc. (\u201cMicron\u201d)", 12_048_192, "$1.0B", "approximately $1.0 billion"),
          ("Microsoft", "Microsoft Corporation (\u201cMicrosoft\u201d)", 12_048_192, "$1.0B", "approximately $1.0 billion"),
          ("TSMC", "TSMC Partners, Ltd. (\u201cTSMC\u201d)", 6_024_096, "$500M", "approximately $500 million")]
    for short, full, n, v, w in pp:
        if norm(f"{full} will purchase {n:,} shares of our Class N common stock for {w}") not in pro:
            bad.append((PRO, f"{full} {n:,} {w}"))
        need(f"pp {short}", f"| {short} | {n:,} | {v} |")
    tot_pp = sum(n for _, _, n, _, _ in pp)
    assert abs(tot_pp * 83 / 1e9 - 26.0) < .05
    need("sec", 'most lock-ups prevent insiders from selling "for 180 days"')
    need("365", "Anthropic's ends in stages, and the last of them runs to day 365")
    need("fh", "looked at 1,948 lock-ups. It found \"little selling by insiders\" while they were in force. When they ended, trading volume rose by 40% for good and the shares fell 1.5% on average over the three days around the expiry")
    need("fh2", "by Laura Field and Gordon Hanka in the Journal of Finance in 2001")
    traded = 980 + fixed
    need("20%", f"at most about {traded / 1000:.1f} billion shares, about {round(traded / 13_219.642276 * 100, -1):.0f}% of the 13.2 billion, could be traded by 2 February")
    assert abs(traded / 13_219.642276 * 100 - 20) < 0.5  # 19.7%, so "about 20%"
    need("147", "the banks' option to buy 147 million more and the 313 million private-placement shares")
    if norm("lock-up agreements with Goldman Sachs & Co. LLC and Morgan Stanley & Co. LLC, on behalf of the underwriters") not in pro:
        bad.append((PRO, "Goldman / Morgan Stanley on behalf of the underwriters"))
    need("gs", "Goldman Sachs and Morgan Stanley, on behalf of the banks running the offering, may release locked-up shares")
    need("pp total", f"agreed to buy {tot_pp:,} Class N shares at the offer price, $26.0 billion in all")
    need("23", "Its prospectus lists 23 dates")
    need("5 fixed", "Only the first five dates are fixed. The other 18 depend on when Anthropic publishes its results")

    # the offering and the share count
    assert 956_351_354 + 23_648_646 == 980_000_000
    assert round(980_000_000 * 83 / 1e9, 1) == 81.3
    out = 13_219_642_276
    assert 7_583_103_996 + 5_636_538_278 + 2 == out  # plus one Class T and one Class F share; no Class E
    need("answer", f"Anthropic sold 980 million shares in its IPO, out of about {out / 1e9:.1f} billion")
    need("offering", "**The offering:** 980 million shares at $83.00, raising $81.3 billion, the largest initial public offering on record. It had planned to sell 825 million shares at $70 to $78")
    need("count", f"**How many shares exist:** 13,219,642,276 after the offering. The 980 million sold are about {980_000_000 / out * 100:.1f}% of them")
    need("next", "**The next date:** 15 December 2026, when up to 303 million more shares can be sold")

    # prices, from Nasdaq's history
    d1, d2 = px["11/19/2026"], px["11/20/2026"]
    o1, h1, c1 = float(d1["open"]), float(d1["high"]), float(d1["close"])
    l2, c2 = float(d2["low"]), float(d2["close"])
    need("2 days", f"the shares opened at ${o1:.2f} and closed the first day at ${c1:.2f}. On the second day they fell as low as ${l2:.2f}, five cents above the offer price, and closed at ${c2:.2f}")
    assert round(l2 - 83, 2) == .05
    for lbl, v in [("Opening trade, 19 November", o1), ("High, 19 November", h1), ("Close, 19 November", c1),
                   ("Low, 20 November", l2), ("Close, 20 November", c2)]:
        need(f"t {lbl}", f"| {lbl} | ${v:.2f} | +{pct(v, 83):.1f}% |")
    need("volume", "More than 846 million shares changed hands on the first day, CNBC reported, against 522 million on SpaceX's first day in June")

    # the holders
    need("2.7", "**Holders of about 2.7 billion shares.**")
    need("8.0", "**Holders of more than 0.5% of the shares, about 8.0 billion in all.**")
    need("50.1", "they hold 50.1% of the votes")
    need("29", "Of the rest, up to 29% from the March 2027 results or day 180, and the remainder at the September 2027 results or day 365")
    need("banks", "on behalf of the banks running the offering, may release locked-up shares \"in whole or in part at any time\"")
    need("amzn", "1,936,452,353 and 1,774,959,745 Class N shares after the offering")
    need("5%", "Amazon and Google will each hold more than 5% of Anthropic's shares")
    need("retail", "Retail investors received about 15% of the shares, CNBC reported, citing people familiar with the offering, below the roughly 20% Anthropic had expected")
    need("flip", "at Robinhood, selling within 30 days can bar a customer from new offerings for 60 days")
    need("1.7", "up to 1.7 billion shares become free to sell, the largest single release before the March 2027 results")
    assert 1700 == max(t for *_, t in TABLE + LATER[:6])
    big = sorted((t for *_, t in TABLE + LATER), reverse=True)[:2]
    assert big == [3000, 1900]  # the day-180 and day-365 releases

    miss = [(lbl, s) for lbl, s in want if norm(s) not in text]
    num = r"\d+(?:,\d{3})*(?:\.\d+)?"
    checked = set(re.findall(num, " ".join(s for _, s in want)))
    ALLOWED = {"2026", "2027", "18", "19", "20", "180", "365", "13", "27", "34", "41", "48", "55", "62", "69", "76", "83",
               "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "14", "15", "16", "17", "21", "22", "23"}
    for n in sorted(set(re.findall(num, text)) - checked - ALLOWED):
        miss.append(("unchecked number", f"{n} appears in the draft but no check produces it"))
    corpus = " ".join(norm((SRC / fn).read_text(encoding="utf-8", errors="replace")) for fn in SOURCES)
    for q in re.findall(r'"([^"]+)"', text):
        if len(q) >= 8 and norm(q).rstrip(",.") not in corpus:
            miss.append(("quote", f"not word for word in any saved source: {q!r}"))
    print(f"{len(want) - len([x for x in miss if x[0] != 'unchecked number'])} of {len(want)} draft figures found; "
          f"{sum(len(v) for v in SOURCES.values())} source phrases, {len(bad)} failed")
    for lbl, s in bad + miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if bad or miss else 0)


if __name__ == "__main__":
    main()
