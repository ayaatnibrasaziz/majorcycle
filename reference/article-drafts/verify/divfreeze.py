"""AUDIT - re-run the dividend comparison and freeze it.

Two figures in article 2 come from here rather than from the frozen data file:
"86.7% against 81.8%" and Westpac's "2.1 years against 5.1". They were measured
once, in a scratch script, and nothing has re-checked them since. Re-run, confirm
they reproduce, and write them into a file the assertion script can read.
"""
import sys, time, json, statistics as st
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import engine, yfinance as yf, pandas as pd
from engine import TY

AS_AT = pd.Timestamp("2026-08-27")
uni = [u for u in engine.universe() if u["index_id"] == "asx200" and u.get("market_cap")]
uni.sort(key=lambda u: -u["market_cap"])
SAMPLE = uni[:40]


def eps20(close):
    return [e for e in engine.episodes(close) if e["depth_pct"] <= -20.0]


rows, controls = [], []
for u in SAMPLE:
    t = u["ticker"]
    h = None
    for _ in range(3):
        try:
            h = yf.Ticker(t).history(start="2000-01-01", end="2026-08-28", auto_adjust=False)
            break
        except Exception:
            time.sleep(2)
    if h is None or h.empty:
        continue
    h.index = h.index.tz_localize(None)
    h = h[h.index <= AS_AT]
    px, tr = h["Close"].dropna(), h["Adj Close"].dropna()
    if len(px) < 300:
        continue
    a, b = eps20(tr), eps20(px)
    if not a or not b:
        continue
    ma = [e["recovery_i"] - e["cross20_i"] for e in a if e["recovered"] and e["cross20_i"] is not None]
    mb = [e["recovery_i"] - e["cross20_i"] for e in b if e["recovered"] and e["cross20_i"] is not None]
    divs = float(h["Dividends"].sum())
    rec = {"ticker": t, "dividends_total": round(divs, 4),
           "recovered_with_dividends": sum(1 for e in a if e["recovered"]) / len(a),
           "recovered_price_only": sum(1 for e in b if e["recovered"]) / len(b),
           "median_yrs_with_dividends": round(st.median(ma) / TY, 3) if ma else None,
           "median_yrs_price_only": round(st.median(mb) / TY, 3) if mb else None}
    rows.append(rec)
    if divs == 0.0:
        controls.append((t, len(a) == len(b) and rec["median_yrs_with_dividends"] == rec["median_yrs_price_only"]))

with_d = 100 * st.mean([r["recovered_with_dividends"] for r in rows])
px_only = 100 * st.mean([r["recovered_price_only"] for r in rows])
md = st.median([r["median_yrs_with_dividends"] for r in rows if r["median_yrs_with_dividends"] is not None])
mp = st.median([r["median_yrs_price_only"] for r in rows if r["median_yrs_price_only"] is not None])
wbc = [r for r in rows if r["ticker"] == "WBC.AX"][0]

print(f"companies compared        : {len(rows)}")
print(f"recovered, with dividends : {with_d:.1f}%   (article says 86.7%)")
print(f"recovered, price only     : {px_only:.1f}%   (article says 81.8%)")
print(f"median wait with dividends: {md:.2f} yr")
print(f"median wait price only    : {mp:.2f} yr")
print(f"Westpac with dividends    : {wbc['median_yrs_with_dividends']:.2f} yr  (article says 2.1)")
print(f"Westpac price only        : {wbc['median_yrs_price_only']:.2f} yr  (article says 5.1)")
print()
print(f"zero-dividend controls (must be identical on both series): {len(controls)}")
for t, ok in controls:
    print(f"   {t:9s} {'identical - PASS' if ok else 'DIFFERS - FAIL'}")
allok = all(ok for _, ok in controls) and len(controls) >= 3

out = Path(__file__).resolve().parent.parent / "dividend-check.json"
out = Path(r"C:/Users/Ayaat Nibras Aziz/Desktop/Stock Website/reference/drawdown-recovery-2026-08-27-DIVIDENDS.json")
json.dump({"as_at": "2026-08-27", "sample": "the 40 largest ASX 200 companies by market cap",
           "companies_compared": len(rows),
           "recovered_with_dividends_pct": round(with_d, 1),
           "recovered_price_only_pct": round(px_only, 1),
           "median_years_with_dividends": round(md, 2),
           "median_years_price_only": round(mp, 2),
           "westpac_with_dividends_years": wbc["median_yrs_with_dividends"],
           "westpac_price_only_years": wbc["median_yrs_price_only"],
           "zero_dividend_controls": [{"ticker": t, "identical": ok} for t, ok in controls],
           "controls_all_passed": allok,
           "note": "Article 2's dividend comparison. The control is that a company which has "
                   "never paid a dividend must give identical results on both series.",
           "rows": rows}, open(out, "w"), indent=1)
print(f"\nwritten {out.name}")
