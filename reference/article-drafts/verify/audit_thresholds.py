"""AUDIT LAYER C2 - could the dividend-adjustment lag move a published COUNT?

Our stored history is not back-adjusted for each company's most recent dividend,
so bars before that date sit 1.7-3.5% high for the affected companies. That makes
our drawdown up to 2 points more negative than a freshly adjusted series.

The articles print counts at 10%, 20%, 30% and 50%. A company sitting within a
couple of points of one of those lines could be on the wrong side of it. Re-fetch
exactly those companies and see.
"""
import sys, time, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _data
import yfinance as yf, pandas as pd
from concurrent.futures import ThreadPoolExecutor

AS_AT = pd.Timestamp("2026-08-27")
D = _data.load()
R = [r for r in D["rows"] if r["ticker"] not in D["excluded"]]
THRESH = [10, 20, 30, 50]
MARGIN = 5.0


def dd(r):
    return 100 * (r["close"] / r["high_1y"] - 1)


at_risk = []
for r in R:
    v = dd(r)
    for t in THRESH:
        if abs(v + t) <= MARGIN:
            at_risk.append(r["ticker"])
            break
at_risk = sorted(set(at_risk))
print(f"companies within {MARGIN}pp of a published threshold: {len(at_risk)}")
print("re-fetching each one from the provider\n")


def fetch(t):
    for _ in range(4):
        try:
            h = yf.Ticker(t).history(start="2025-06-01", end="2026-08-28", auto_adjust=True)
            if h.empty:
                return (t, None)
            h.index = h.index.tz_localize(None)
            h = h[h.index <= AS_AT]
            return (t, 100 * (float(h["Close"].iloc[-1]) / float(h["High"].tail(252).max()) - 1))
        except Exception:
            time.sleep(1.5)
    return (t, None)


with ThreadPoolExecutor(max_workers=6) as ex:
    fresh = dict(ex.map(fetch, at_risk))

by = {r["ticker"]: r for r in R}
flips = []
for t in at_risk:
    f = fresh.get(t)
    if f is None:
        print(f"   {t:11s} NO DATA")
        continue
    o = dd(by[t])
    for th in THRESH:
        if (o <= -th) != (f <= -th):
            flips.append((t, by[t]["index_id"], round(o, 2), round(f, 2), th))

print(f"{'ticker':11s} {'ours':>8s} {'fresh':>8s} {'gap':>7s}")
for t in at_risk:
    f = fresh.get(t)
    if f is None:
        continue
    o = dd(by[t])
    mark = "  <<< crosses a line" if any(x[0] == t for x in flips) else ""
    if abs(o - f) > 0.5 or mark:
        print(f"{t:11s} {o:8.2f} {f:8.2f} {o-f:7.2f}{mark}")


# the published counts, both ways
print()
print("=" * 78)
print("PUBLISHED COUNTS, ours vs freshly re-adjusted")
print("=" * 78)
merged = {}
for r in R:
    merged[r["ticker"]] = (dd(r), fresh.get(r["ticker"], dd(r)))
for idx, lab, label_counts in (("asx200", "ASX 200", [10, 20, 30, 50]),
                               ("sp500", "S&P 500", [10, 20, 30, 50]),
                               ("tsx60", "TSX 60", [10, 20, 30, 50])):
    rows = [merged[r["ticker"]] for r in R if r["index_id"] == idx]
    print(f"  {lab}")
    for th in label_counts:
        a = sum(1 for o, f in rows if o <= -th)
        b = sum(1 for o, f in rows if f <= -th)
        flag = "" if a == b else f"   <-- article says {a}, fresh gives {b}"
        print(f"     more than {th}% below : {a:4d}  ->  {b:4d}{flag}")
    import statistics as st
    print(f"     median               : {st.median([o for o,_ in rows]):.1f}%  ->  {st.median([f for _,f in rows]):.1f}%")

print()
print("=" * 70)
print(f"COUNTS THAT WOULD CHANGE: {len(flips)}")
for t, idx, o, f, th in flips:
    print(f"   {t} ({idx}): ours {o}%, fresh {f}% - moves across the {th}% line")
if not flips:
    print("   none - every published count is the same on freshly adjusted prices")
