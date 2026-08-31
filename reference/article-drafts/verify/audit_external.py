"""AUDIT LAYER C - against a fresh pull from outside our database.

Layers A and B both read our own stored prices. If those prices are wrong, both
agree and both are wrong. This re-fetches every company printed in the three
ranking tables straight from the provider and recomputes BOTH printed columns.

The second column (distance below the highest intraday high since 2000) was added
late in the process and has never been checked against anything external.
"""
import sys, time, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _data
import engine, yfinance as yf, pandas as pd
from concurrent.futures import ThreadPoolExecutor

AS_AT = pd.Timestamp("2026-08-27")
D = _data.load()
by = {r["ticker"]: r for r in D["rows"]}

PRINTED = {
    "asx200": ["TUA.AX", "DRO.AX", "IPX.AX", "VUL.AX", "360.AX", "WTC.AX", "PNR.AX", "GDG.AX",
               "LTR.AX", "COH.AX", "ASB.AX", "PXA.AX", "4DX.AX", "JDO.AX", "CNI.AX",
               "WOW.AX", "COL.AX", "CBA.AX", "GPT.AX", "LLC.AX"],
    "sp500": ["TTD", "CSGP", "FISV", "PODD", "APP", "BSX", "ORCL", "BLDR", "COIN", "ZTS",
              "NKE", "INTU", "LULU", "APTV", "CHTR", "NVDA", "MSFT", "AAPL", "AMZN", "INTC",
              "META", "TSLA", "AVGO", "V", "MA", "MPC", "VST"],
    "tsx60": ["TRI.TO", "OTEX.TO", "T.TO", "WSP.TO", "CLS.TO", "CSU.TO", "FSV.TO", "CAE.TO",
              "GIL.TO", "GIB-A.TO", "SHOP.TO", "RY.TO", "TD.TO", "BNS.TO", "BMO.TO", "CM.TO",
              "NA.TO", "FNV.TO", "WPM.TO", "ABX.TO", "AEM.TO", "K.TO", "CNQ.TO", "SU.TO",
              "IMO.TO", "CVE.TO", "TOU.TO", "TECK-B.TO", "FM.TO"],
}
ALL = [t for v in PRINTED.values() for t in v]
print(f"re-fetching {len(ALL)} companies from the provider\n")


def fetch(t):
    for _ in range(4):
        try:
            h = yf.Ticker(t).history(start="2000-01-01", end="2026-08-28", auto_adjust=True)
            if h.empty:
                return (t, None)
            h.index = h.index.tz_localize(None)
            h = h[h.index <= AS_AT]
            return (t, h)
        except Exception:
            time.sleep(1.5)
    return (t, None)


with ThreadPoolExecutor(max_workers=6) as ex:
    got = dict(ex.map(fetch, ALL))

bad, nodata = [], []
print(f"{'ticker':11s} {'col1 ours':>10s} {'col1 fresh':>11s} {'col2 ours':>10s} {'col2 fresh':>11s}  verdict")
for t in ALL:
    h = got.get(t)
    r = by[t]
    if h is None or h.empty:
        nodata.append(t)
        print(f"{t:11s} {'':>10s} {'NO DATA':>11s}")
        continue
    c = float(h["Close"].iloc[-1])
    hi1 = float(h["High"].tail(252).max())
    hiall = float(h["High"].max())
    ours1 = 100 * (r["close"] / r["high_1y"] - 1)
    ours2 = 100 * (r["close"] / r["peak_high_since_2000"] - 1)
    fresh1 = 100 * (c / hi1 - 1)
    fresh2 = 100 * (c / hiall - 1)
    g1, g2 = abs(ours1 - fresh1), abs(ours2 - fresh2)
    ok = g1 < 1.0 and g2 < 1.0
    if not ok:
        bad.append((t, round(g1, 2), round(g2, 2)))
    print(f"{t:11s} {ours1:10.1f} {fresh1:11.1f} {ours2:10.1f} {fresh2:11.1f}  {'ok' if ok else '*** DIFFERS'}")

print()
print(f"companies checked      : {len(ALL) - len(nodata)}")
print(f"no data from provider  : {len(nodata)} {nodata}")
print(f"disagreements over 1pp : {len(bad)} {bad}")
