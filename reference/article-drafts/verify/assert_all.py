"""Assert EVERY figure printed in the four drafts against the frozen data.

Reads only reference/drawdown-recovery-2026-08-27-DATA.json, so it reproduces the
same answer in a year with no database and no credentials.
"""
import json

import _data, sys, statistics as st
from pathlib import Path
import numpy as np

D = _data.load()
R = D["rows"]; TY = 252.0; EX = set(D["excluded"])
by = {r["ticker"]: r for r in R}
CHECKED = []


def chk(label, got, want, tol=0.051):
    ok = (abs(got - want) <= tol) if isinstance(want, float) else (got == want)
    CHECKED.append((label, got, want, ok))


def idx(i):
    return [r for r in R if r["index_id"] == i and r["ticker"] not in EX]


def km(dur, ev):
    o = np.argsort(dur); t = np.asarray(dur, float)[o]; e = np.asarray(ev, bool)[o]
    n = len(t); s = 1.0; prev = 1.0
    for ti, ei in zip(t, e):
        if ei:
            s *= (1.0 - 1.0 / n)
            if s <= 0.5 < prev:
                return ti / TY
            prev = s
        n -= 1
    return None


def clocks(i, sel=None):
    out = []
    for r in idx(i):
        if sel and r["ticker"] not in sel:
            continue
        for e in r["episodes"]:
            if e["cross20_date"] is None:
                continue
            dur = e["days_cross20_to_recovery"] if e["recovered"] else e["bars_after_cross20"]
            out.append((dur, e["recovered"], e["bars_after_cross20"], e["depth_pct"], r["ticker"]))
    return out


def band(L, y):
    need = int(y * TY); el = [c for c in L if c[2] >= need]
    return 100 * sum(1 for c in el if c[1] and c[0] <= need) / len(el), len(el)


def dd1(r):
    return 100 * (r["close"] / r["high_1y"] - 1)


def ddp(r):
    return 100 * (r["close"] / r["peak_high_since_2000"] - 1)


# structural: both columns are on the intraday-high basis, so the 20-year figure
# can never be shallower than the 1-year one. 435 rows broke this before the fix.
chk("no row where the 20y figure is shallower", sum(1 for r in R if dd1(r) < ddp(r) - 0.05), 0)


# ---------------- ARTICLE 2 ----------------
A = clocks("asx200")
chk("asx falls", len(A), 1260)
chk("asx companies with a fall", len({c[4] for c in A}), 198)
chk("asx never back pct", round(100 * sum(1 for c in A if not c[1]) / len(A), 1), 12.4)
for y, w, n in ((1, 51.7, 1170), (2, 68.5, 1107), (3, 75.9, 1072), (5, 84.4, 946), (10, 91.2, 650)):
    p, k = band(A, y); chk(f"asx within {y}y", round(p, 1), w); chk(f"asx within {y}y n", k, n)
for lo, hi, lab, n, med, w5, nb in [(-30, -20, "20-30", 489, 0.30, 100, 3.9), (-40, -30, "30-40", 254, 0.75, 99, 6.7),
                                    (-50, -40, "40-50", 157, 1.50, 94, 20.4), (-70, -50, "50-70", 190, 2.90, 73, 19.5),
                                    (-101, -70, "70+", 170, 8.31, 33, 30.0)]:
    G = [c for c in A if lo < c[3] <= hi]
    chk(f"ladder {lab} n", len(G), n)
    chk(f"ladder {lab} median", round(km([c[0] for c in G], [c[1] for c in G]), 2), med)
    chk(f"ladder {lab} within5", round(band(G, 5)[0]), w5)
    chk(f"ladder {lab} never", round(100 * sum(1 for c in G if not c[1]) / len(G), 1), nb)
S5 = clocks("sp500"); T6 = clocks("tsx60")
chk("sp500 never pct", round(100 * sum(1 for c in S5 if not c[1]) / len(S5), 1), 8.5)
chk("tsx never pct", round(100 * sum(1 for c in T6 if not c[1]) / len(T6), 1), 6.2)
chk("sp500 within1", round(band(S5, 1)[0], 1), 54.1)
chk("tsx within1", round(band(T6, 1)[0], 1), 55.9)
chk("sp500 within5", round(band(S5, 5)[0], 1), 90.4)
chk("tsx within5", round(band(T6, 5)[0], 1), 89.5)
chk("asx median yrs", round(km([c[0] for c in A], [c[1] for c in A]), 2), 0.94)
chk("sp500 median yrs", round(km([c[0] for c in S5], [c[1] for c in S5]), 2), 0.85)
chk("tsx median yrs", round(km([c[0] for c in T6], [c[1] for c in T6]), 2), 0.82)


def top(i, n):
    co = [r for r in idx(i) if r.get("market_cap")]; co.sort(key=lambda r: -r["market_cap"])
    return {r["ticker"] for r in co[:n]}


for i, med, nb in (("asx200", 0.82, 10.1), ("sp500", 0.71, 7.1)):
    L = clocks(i, top(i, 60))
    chk(f"{i} top60 median", round(km([c[0] for c in L], [c[1] for c in L]), 2), med)
    chk(f"{i} top60 never", round(100 * sum(1 for c in L if not c[1]) / len(L), 1), nb)
NOT = {"BSL.AX", "SGM.AX", "JHX.AX", "FBU.AX", "ORI.AX", "DNL.AX"}
EN = {"WHC.AX", "NHC.AX", "YAL.AX", "PDN.AX", "DYL.AX", "NXG.AX"}
au = idx("asx200")
MIN = ({r["ticker"] for r in au if r["sector"] == "Basic Materials"} - NOT) | EN
BANK = {r["ticker"] for r in au if r["industry"] and "Bank" in r["industry"]}
REAL = {r["ticker"] for r in au if r["sector"] == "Real Estate"}
for sel, name, nf, med, w5, nb in ((MIN, "miners", 50, 0.52, 84, 11.8), (BANK, "banks", 7, 1.35, 84, 14.0),
                                   (REAL, "property", 19, 2.90, 61, 19.6)):
    chk(f"{name} count", len(sel), nf)
    L = clocks("asx200", sel)
    chk(f"{name} median", round(km([c[0] for c in L], [c[1] for c in L]), 2), med)
    chk(f"{name} within5", round(band(L, 5)[0]), w5)
    chk(f"{name} never", round(100 * sum(1 for c in L if not c[1]) / len(L), 1), nb)
chk("property falls never regained", sum(1 for c in clocks("asx200", REAL) if not c[1]), 11)
g = by["GPT.AX"]; chk("GPT below peak pct", round(100 * (g["close"] / g["peak_since_2000"] - 1), 1), -18.5)
l = by["LLC.AX"]; chk("LLC below peak pct", round(100 * (l["close"] / l["peak_since_2000"] - 1), 1), -83.2)
chk("asx cos never 20pct down", sum(1 for r in au if not r["episodes"]), 3)

# ---------------- ARTICLE 3 ----------------
au_s = sorted(au, key=dd1)
chk("asx n", len(au), 201)
chk("asx median dd", round(st.median([dd1(r) for r in au]), 1), -17.5)
for thr, w in ((-10, 144), (-20, 88), (-30, 46), (-50, 16)):
    chk(f"asx n{abs(thr)}", sum(1 for r in au if dd1(r) <= thr), w)
chk("asx near high", sum(1 for r in au if dd1(r) >= -2), 6)
for i, (t, w) in enumerate([("TUA.AX", -74.0), ("DRO.AX", -73.2), ("IPX.AX", -68.2), ("VUL.AX", -65.7), ("360.AX", -64.2),
                            ("WTC.AX", -60.4), ("PNR.AX", -58.9), ("GDG.AX", -58.1), ("LTR.AX", -56.8), ("COH.AX", -53.7),
                            ("ASB.AX", -53.4), ("PXA.AX", -52.1), ("4DX.AX", -51.8), ("JDO.AX", -51.0), ("XRO.AX", -50.8)]):
    chk(f"asx rank{i+1}", au_s[i]["ticker"], t); chk(f"asx {t} dd", round(dd1(by[t]), 1), w)
for t, w in (("TUA.AX", -74.0), ("DRO.AX", -73.2), ("IPX.AX", -68.2), ("VUL.AX", -84.5), ("360.AX", -64.2),
             ("WTC.AX", -71.9), ("PNR.AX", -68.0), ("GDG.AX", -58.1), ("LTR.AX", -64.2), ("COH.AX", -59.3),
             ("ASB.AX", -53.4), ("PXA.AX", -61.1), ("4DX.AX", -51.8), ("JDO.AX", -60.2), ("XRO.AX", -58.4)):
    chk(f"asx {t} col2", round(ddp(by[t]), 1), w)
cd = [r for r in au if r["sector"] == "Consumer Defensive"]
chk("consumer defensive n", len(cd), 9)
chk("consumer defensive gt20 down", sum(1 for r in cd if dd1(r) <= -20), 6)
chk("WOW dd", round(dd1(by["WOW.AX"]), 1), -4.0)
chk("COL dd", round(dd1(by["COL.AX"]), 1), -3.5)
ins = {r["ticker"] for r in au if r["industry"] and "Insurance" in r["industry"]}
chk("insurers n", len(ins), 9)
chk("insurers gt20", sum(1 for t in ins if dd1(by[t]) <= -20), 1)
chk("banks gt20", sum(1 for t in BANK if dd1(by[t]) <= -20), 3)
chk("CBA dd", round(dd1(by["CBA.AX"]), 1), -15.1)
chk("miners gt20", sum(1 for t in MIN if dd1(by[t]) <= -20), 22)
chk("miners rate", round(100 * sum(1 for t in MIN if dd1(by[t]) <= -20) / len(MIN)), 44)
chk("asx no-sector", sum(1 for r in au if not r["sector"]), 2)
for sec, n, d in (("Technology", 13, 9), ("Communication Services", 12, 8), ("Consumer Defensive", 9, 6),
                  ("Consumer Cyclical", 19, 11), ("Real Estate", 19, 8), ("Energy", 13, 6),
                  ("Healthcare", 13, 6), ("Basic Materials", 50, 20), ("Financial Services", 27, 8),
                  ("Industrials", 21, 5), ("Utilities", 3, 0)):
    gg = [r for r in au if r["sector"] == sec]
    chk(f"asx sector {sec} n", len(gg), n)
    chk(f"asx sector {sec} down", sum(1 for r in gg if dd1(r) <= -20), d)

# ---------------- ARTICLE 4 ----------------
us = idx("sp500"); us_s = sorted(us, key=dd1)
chk("sp n", len(us), 499)
chk("sp median dd", round(st.median([dd1(r) for r in us]), 1), -11.7)
for thr, w in ((-10, 283), (-20, 143), (-30, 63), (-50, 12)):
    chk(f"sp n{abs(thr)}", sum(1 for r in us if dd1(r) <= thr), w)
chk("sp near high", sum(1 for r in us if dd1(r) >= -2), 25)
for i, (t, w) in enumerate([("TTD", -76.2), ("CSGP", -65.9), ("FISV", -62.1), ("PODD", -59.6), ("APP", -58.1), ("BSX", -57.4),
                            ("ORCL", -55.6), ("BLDR", -55.5), ("COIN", -52.6), ("ZTS", -51.1), ("NKE", -50.3), ("INTU", -50.1),
                            ("LULU", -49.1), ("APTV", -48.9), ("CHTR", -48.1)]):
    chk(f"sp rank{i+1}", us_s[i]["ticker"], t); chk(f"sp {t} dd", round(dd1(by[t]), 1), w)
for t, w in (("TTD", -90.5), ("CSGP", -69.0), ("FISV", -78.0), ("PODD", -59.6), ("APP", -58.1), ("BSX", -57.4),
             ("ORCL", -55.6), ("BLDR", -68.7), ("COIN", -57.1), ("ZTS", -68.2), ("NKE", -76.7), ("INTU", -56.8),
             ("LULU", -77.7), ("APTV", -74.9), ("CHTR", -82.0)):
    chk(f"sp {t} col2", round(ddp(by[t]), 1), w)
for t, w in (("NVDA", -3.5), ("MSFT", -8.0), ("AAPL", -8.6), ("AMZN", -10.8), ("INTC", -35.3), ("META", -27.5),
             ("TSLA", -28.9), ("AVGO", -24.8), ("V", -1.5), ("MA", -1.6), ("MPC", -1.1)):
    chk(f"sp {t} dd", round(dd1(by[t]), 1), w)
usm = [r for r in us if r.get("market_cap")]; usm.sort(key=lambda r: -r["market_cap"])
chk("sp top50 gt20 down", sum(1 for r in usm[:50] if dd1(r) <= -20), 14)
for sec, n, d in (("Technology", 83, 44), ("Energy", 21, 2), ("Utilities", 31, 3), ("Financial Services", 70, 8)):
    gg = [r for r in us if r["sector"] == sec]
    chk(f"sp {sec} n", len(gg), n); chk(f"sp {sec} down", sum(1 for r in gg if dd1(r) <= -20), d)
chk("sp no-sector", sum(1 for r in us if not r["sector"]), 1)
for lo, hi, lab, n, w5, nb in [(-30, -20, "20-30", 1630, 100, 4.5), (-40, -30, "30-40", 877, 99, 7.0), (-50, -40, "40-50", 512, 97, 12.3),
                               (-70, -50, "50-70", 537, 79, 14.9), (-101, -70, "70+", 296, 34, 16.6)]:
    G = [c for c in S5 if lo < c[3] <= hi]
    chk(f"sp ladder {lab} n", len(G), n)
    chk(f"sp ladder {lab} within5", round(band(G, 5)[0]), w5)
    chk(f"sp ladder {lab} never", round(100 * sum(1 for c in G if not c[1]) / len(G), 1), nb)
chk("VST dd", round(dd1(by["VST"]), 1), -36.1)

# ---------------- ARTICLE 5 ----------------
ca = idx("tsx60"); ca_s = sorted(ca, key=dd1)
chk("ca n", len(ca), 60)
chk("ca median dd", round(st.median([dd1(r) for r in ca]), 1), -10.2)
chk("ca gt20", sum(1 for r in ca if dd1(r) <= -20), 10)
chk("ca gt40", sum(1 for r in ca if dd1(r) <= -40), 0)
chk("ca deepest", round(dd1(ca_s[0]), 1), -39.1)
chk("ca near high", sum(1 for r in ca if dd1(r) >= -2), 1)
for i, (t, w) in enumerate([("TRI.TO", -39.1), ("OTEX.TO", -35.8), ("T.TO", -35.6), ("WSP.TO", -34.4), ("CLS.TO", -32.9),
                            ("CSU.TO", -32.4), ("FSV.TO", -32.2), ("CAE.TO", -27.6), ("GIL.TO", -25.5), ("GIB-A.TO", -22.9)]):
    chk(f"ca rank{i+1}", ca_s[i]["ticker"], t); chk(f"ca {t} dd", round(dd1(by[t]), 1), w)
for t, w in (("TRI.TO", -49.3), ("OTEX.TO", -41.9), ("T.TO", -48.0), ("WSP.TO", -34.4), ("CLS.TO", -32.9),
             ("CSU.TO", -40.9), ("FSV.TO", -32.2), ("CAE.TO", -27.6), ("GIL.TO", -25.5), ("GIB-A.TO", -40.6)):
    chk(f"ca {t} col2", round(ddp(by[t]), 1), w)
for t, w in (("RY.TO", -6.9), ("TD.TO", -4.3), ("BNS.TO", -2.2), ("BMO.TO", -7.9), ("CM.TO", -7.9), ("NA.TO", -10.2),
             ("FNV.TO", -2.7), ("WPM.TO", -3.4), ("ABX.TO", -10.2), ("AEM.TO", -14.5), ("K.TO", -15.5),
             ("CNQ.TO", -2.6), ("SU.TO", -4.0), ("IMO.TO", -4.2), ("CVE.TO", -4.4), ("TOU.TO", -10.6),
             ("TECK-B.TO", -2.0), ("FM.TO", -1.8), ("SHOP.TO", -15.6)):
    chk(f"ca {t} dd", round(dd1(by[t]), 1), w)
five = [r for r in ca if r["sector"] in ("Financial Services", "Energy", "Basic Materials", "Consumer Defensive", "Utilities")]
chk("ca five groups n", len(five), 38)
chk("ca five groups gt20 down", sum(1 for r in five if dd1(r) <= -20), 0)
tech = [r for r in ca if r["sector"] == "Technology"]
chk("ca tech n", len(tech), 5)
chk("ca tech gt20", sum(1 for r in tech if dd1(r) <= -20), 4)
chk("ca no-sector", sum(1 for r in ca if not r["sector"]), 1)
for sec, n in (("Financial Services", 12), ("Energy", 9), ("Basic Materials", 8), ("Consumer Defensive", 5), ("Utilities", 4)):
    gg = [r for r in ca if r["sector"] == sec]
    chk(f"ca {sec} n", len(gg), n)
    chk(f"ca {sec} none down", sum(1 for r in gg if dd1(r) <= -20), 0)
for lo, hi, lab, n, w5, nb in [(-30, -20, "20-30", 195, 100, 2.6), (-40, -30, "30-40", 74, 100, 8.1)]:
    G = [c for c in T6 if lo < c[3] <= hi]
    chk(f"ca ladder {lab} n", len(G), n)
    chk(f"ca ladder {lab} within5", round(band(G, 5)[0]), w5)
    chk(f"ca ladder {lab} never", round(100 * sum(1 for c in G if not c[1]) / len(G), 1), nb)
G = [c for c in T6 if -40 < c[3] <= -20]
chk("ca 20-40 falls total", len(G), 269)
chk("ca 20-40 still under water", sum(1 for c in G if not c[1]), 11)

# ---------------- THE REBUILT "STILL DOWN" COLUMNS ----------------
# The old "never back" column mixed two populations: falls judged over 5 years and
# falls that started last month. It read as a contradiction (100% back within 5
# years beside 4.5% never back) because it was one. These columns are the SAME
# falls counted two ways and must add to 100%.
def still_down_at_5(L, lo, hi):
    G = [c for c in L if lo < c[3] <= hi]
    el = [c for c in G if c[2] >= 5 * TY]
    back = sum(1 for c in el if c[1] and c[0] <= 5 * TY)
    return round(100 * (len(el) - back) / len(el)), round(100 * back / len(el)), len(el)


for lo, hi, lab, want in [(-30, -20, "20-30", 0), (-40, -30, "30-40", 1), (-50, -40, "40-50", 6),
                          (-70, -50, "50-70", 27), (-101, -70, "70+", 67)]:
    down, back, n = still_down_at_5(A, lo, hi)
    chk(f"asx still down at 5y {lab}", down, want)
    chk(f"asx columns add to 100 {lab}", down + back, 100)
for lo, hi, lab, want in [(-30, -20, "20-30", 0), (-40, -30, "30-40", 1), (-50, -40, "40-50", 3),
                          (-70, -50, "50-70", 21), (-101, -70, "70+", 66)]:
    down, back, n = still_down_at_5(S5, lo, hi)
    chk(f"sp still down at 5y {lab}", down, want)
    chk(f"sp columns add to 100 {lab}", down + back, 100)
for lo, hi, lab, want in [(-30, -20, "20-30", 0), (-40, -30, "30-40", 0)]:
    down, back, n = still_down_at_5(T6, lo, hi)
    chk(f"ca still down at 5y {lab}", down, want)
chk("asx 20-30 judgeable", still_down_at_5(A, -30, -20)[2], 376)
chk("ca 20-40 judgeable", still_down_at_5(T6, -30, -20)[2] + still_down_at_5(T6, -40, -30)[2], 206)

# the long stragglers, which is what "never" was trying and failing to say
for L, lab, tot, old in ((A, "asx", 12.4, 3.6), (S5, "sp", 8.5, 0.8), (T6, "ca", 6.2, 0.3)):
    u = [c for c in L if not c[1]]
    o = [c for c in u if c[2] >= 5 * TY]
    chk(f"{lab} still down today pct", round(100 * len(u) / len(L), 1), tot)
    chk(f"{lab} down over 5 years pct", round(100 * len(o) / len(L), 1), old)
uA = [c for c in A if not c[1]]
oA = [c for c in uA if c[2] >= 5 * TY]
chk("asx still down count", len(uA), 156)
chk("asx under water 5+ yrs count", len(oA), 45)
chk("asx of those, deeper than 70%", sum(1 for c in oA if c[3] <= -70), 38)
chk("asx of those, shallower than 40%", sum(1 for c in oA if c[3] > -40), 0)
chk("asx still down and under 1 year old", sum(1 for c in uA if c[2] < TY), 63)
chk("sp under water 5+ yrs count", sum(1 for c in S5 if not c[1] and c[2] >= 5 * TY), 32)
RL = clocks("asx200", REAL)
chk("property still down", sum(1 for c in RL if not c[1]), 11)
chk("property down over 5 years", sum(1 for c in RL if not c[1] and c[2] >= 5 * TY), 4)

# deep falls judged level across the three markets (the claim I had to correct)
for L, lab, w5, w10 in ((A, "asx", 33, 56), (S5, "sp", 34, 61), (T6, "ca", 31, 62)):
    G = [c for c in L if c[3] <= -70]
    e5 = [c for c in G if c[2] >= 5 * TY]
    e10 = [c for c in G if c[2] >= 10 * TY]
    chk(f"{lab} 70%+ back in 5y", round(100 * sum(1 for c in e5 if c[1] and c[0] <= 5 * TY) / len(e5)), w5)
    chk(f"{lab} 70%+ back in 10y", round(100 * sum(1 for c in e10 if c[1] and c[0] <= 10 * TY) / len(e10)), w10)


# ---------------- AUDIT: the 24 printed numbers nothing was checking ----------------
# Found by extracting every number from the four bodies and diffing against what
# the assertions above actually cover. A figure nobody asserts reads exactly like
# a verified one, which is the whole problem (CLAUDE.md 14g).

# every row of BOTH sector tables, including the rate column (only counts were checked)
for sec, n, d, rate in (("Technology", 13, 9, 69), ("Consumer Defensive", 9, 6, 67),
                        ("Communication Services", 12, 8, 67), ("Consumer Cyclical", 19, 11, 58),
                        ("Real Estate", 19, 8, 42), ("Energy", 13, 6, 46), ("Healthcare", 13, 6, 46),
                        ("Basic Materials", 50, 20, 40), ("Financial Services", 27, 8, 30),
                        ("Industrials", 21, 5, 24), ("Utilities", 3, 0, 0)):
    gg = [r for r in au if r["sector"] == sec]
    chk(f"asx sector rate {sec}", round(100 * sum(1 for r in gg if dd1(r) <= -20) / len(gg)), rate)
for sec, n, d, rate in (("Technology", 83, 44, 53), ("Consumer Cyclical", 54, 25, 46),
                        ("Communication Services", 24, 9, 38), ("Industrials", 74, 25, 34),
                        ("Basic Materials", 20, 6, 30), ("Consumer Defensive", 32, 7, 22),
                        ("Healthcare", 59, 10, 17), ("Real Estate", 30, 3, 10),
                        ("Financial Services", 70, 8, 11), ("Utilities", 31, 3, 10),
                        ("Energy", 21, 2, 10)):
    gg = [r for r in us if r["sector"] == sec]
    chk(f"sp sector n {sec}", len(gg), n)
    chk(f"sp sector down {sec}", sum(1 for r in gg if dd1(r) <= -20), d)
    chk(f"sp sector rate {sec}", round(100 * sum(1 for r in gg if dd1(r) <= -20) / len(gg)), rate)

# index-level rates the articles quote as whole numbers
chk("asx rate quoted as 45", round(100 * sum(1 for r in au if dd1(r) <= -20) / len(au)), 44)
chk("sp rate quoted as 29", round(100 * sum(1 for r in us if dd1(r) <= -20) / len(us)), 29)
chk("ca rate quoted as 17", round(100 * sum(1 for r in ca if dd1(r) <= -20) / len(ca)), 17)

# named claims in prose that nothing covered
chk("GPT deepest fall quoted as 93", round(min(e["depth_pct"] for e in by["GPT.AX"]["episodes"]), 1), -93.1)
chk("Intel quoted as 35", round(dd1(by["INTC"]), 1), -35.3)
chk("Cochlear market cap A$bn", round(by["COH.AX"]["market_cap"] / 1e9, 1), 8.9)
chk("Vistra rise quoted as 162", round(100 * (by["VST"]["high_1y"] / by["VST"]["close_2y_before"] - 1)), 162)
chk("Vistra now quoted as 36", round(dd1(by["VST"]), 1), -36.1)
chk("Nike col2 quoted as 77", round(ddp(by["NKE"]), 1), -76.7)
chk("Vulcan col2 quoted as 85", round(ddp(by["VUL.AX"]), 1), -84.5)

# printed roundings of values checked above at full precision
BK = clocks("asx200", BANK)
chk("banks wait printed as 1.4", km([c[0] for c in BK], [c[1] for c in BK]), 1.4)
DEEP = [c for c in A if c[3] <= -70]
chk("70%+ wait printed as 8.3", km([c[0] for c in DEEP], [c[1] for c in DEEP]), 8.3)
chk("sp within 1y printed as 54", round(band(S5, 1)[0]), 54)
chk("sp within 5y printed as 90", round(band(S5, 5)[0]), 90)

# band sizes quoted in prose
chk("asx 20-30 band size", len([c for c in A if -30 < c[3] <= -20]), 489)
chk("asx 70+ judgeable quoted as 153", len([c for c in A if c[3] <= -70 and c[2] >= 5 * TY]), 153)

# ---- article 2's dividend comparison, from its own frozen file ----
DV = _data.load(_data.DIVIDENDS)
chk("dividends: recovered with", DV["recovered_with_dividends_pct"], 86.7)
chk("dividends: recovered price only", DV["recovered_price_only_pct"], 81.8)
chk("dividends: median with", DV["median_years_with_dividends"], 0.81)
chk("dividends: median price only", DV["median_years_price_only"], 0.97)
chk("dividends: Westpac with", DV["westpac_with_dividends_years"], 2.1)
chk("dividends: Westpac price only", DV["westpac_price_only_years"], 5.1)
chk("dividends: control count", len(DV["zero_dividend_controls"]), 4)
chk("dividends: every control passed", DV["controls_all_passed"], True)


# every peak DATE printed in the three ranking tables (nothing was checking these)
for t, ym in (("TUA.AX", "2025-09"), ("DRO.AX", "2025-10"), ("IPX.AX", "2025-10"), ("VUL.AX", "2021-09"),
              ("360.AX", "2025-10"), ("WTC.AX", "2024-11"), ("PNR.AX", "2011-03"), ("GDG.AX", "2025-10"),
              ("LTR.AX", "2023-06"), ("COH.AX", "2024-07"), ("ASB.AX", "2026-01"), ("PXA.AX", "2022-01"),
              ("4DX.AX", "2026-03"), ("JDO.AX", "2021-11"), ("CNI.AX", "2022-01"),
              ("TTD", "2024-12"), ("CSGP", "2021-10"), ("FISV", "2025-03"), ("PODD", "2025-11"),
              ("APP", "2025-09"), ("BSX", "2025-09"), ("ORCL", "2025-09"), ("BLDR", "2024-03"),
              ("COIN", "2025-07"), ("ZTS", "2021-12"), ("NKE", "2021-11"), ("INTU", "2025-07"),
              ("LULU", "2023-12"), ("APTV", "2021-11"), ("CHTR", "2021-09")):
    chk(f"peak date {t}", by[t]["peak_high_date"][:7], ym)

# dates named in prose
chk("GPT peak month", min(by["GPT.AX"]["episodes"], key=lambda e: e["depth_pct"])["peak_date"][:7], "2007-02")
chk("LLC peak month", [e for e in by["LLC.AX"]["episodes"] if not e["recovered"]][0]["peak_date"][:7], "2018-08")


# the fifteenth place in the ASX table is a near-tie, which the article now says
au_sorted = sorted(au, key=dd1)
chk("asx 15/16 gap tiny", round(abs(dd1(au_sorted[14]) - dd1(au_sorted[15])), 4), 0.0659)
chk("asx 15th is Xero", au_sorted[14]["ticker"], "XRO.AX")
chk("asx 16th is ARB", au_sorted[15]["ticker"], "ARB.AX")
chk("asx 17th is SEEK", au_sorted[16]["ticker"], "SEK.AX")
chk("asx 15-17 spread", round(abs(dd1(au_sorted[14]) - dd1(au_sorted[16])), 2), 0.77)

bad = [c for c in CHECKED if not c[3]]
print(f"{len(CHECKED)} figures asserted, {len(bad)} FAILED")
for b in bad:
    print(f"   FAIL: {b[0]}  ->  data says {b[1]!r}, article says {b[2]!r}")
