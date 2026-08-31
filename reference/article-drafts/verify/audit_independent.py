"""AUDIT LAYER B - an independent second implementation.

The frozen data file and the 459 assertions both come from one function,
engine.episodes(). If that function is wrong, the file is wrong, the assertions
agree with it, and everything reports green. The only way to test it is to write
the measurement a second time, differently, and compare.

This version is vectorised: it finds underwater runs by run-length encoding a
boolean mask, rather than by walking indices with a while loop. Different shape,
same question.
"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _data
import engine
import numpy as np
import pandas as pd

TY = 252.0
D = _data.load()
FROZEN = {r["ticker"]: r for r in D["rows"]}
B = engine.bars()


def episodes_v2(close: pd.Series, thr=-20.0):
    """Underwater runs, found by run-length encoding rather than an index walk."""
    v = close.to_numpy(dtype=float)
    d = close.index
    peak = np.maximum.accumulate(v)
    under = v < peak
    if not under.any():
        return []
    # boundaries of contiguous True runs
    edges = np.diff(under.astype(np.int8))
    starts = np.flatnonzero(edges == 1) + 1
    ends = np.flatnonzero(edges == -1) + 1          # first index back at/above the peak
    if under[0]:
        starts = np.r_[0, starts]
    open_at_end = len(starts) > len(ends)
    out = []
    for k, s in enumerate(starts):
        e = ends[k] if k < len(ends) else len(v)
        seg = v[s:e]
        pk = peak[s]                                 # constant across an underwater run
        depth = seg.min() / pk - 1.0
        if depth * 100.0 > thr:
            continue
        recovered = not (open_at_end and k == len(starts) - 1)
        cross = s + int(np.flatnonzero(seg <= pk * (1.0 + thr / 100.0))[0])
        out.append({
            "peak": float(pk),
            "peak_date": str(d[np.flatnonzero(v[:s + 1] == pk)[-1]].date()),
            "depth_pct": float(depth * 100.0),
            "recovered": bool(recovered),
            "recovery_date": str(d[e].date()) if recovered else None,
            "dur": (e - cross) if recovered else (len(v) - cross),
            "follow": len(v) - cross,
        })
    return out


print("comparing 761 companies, episode by episode\n")
mismatch = {"count": 0, "depth": 0, "recovered": 0, "dur": 0, "peak_date": 0, "recovery_date": 0}
examples = []
tot_v1 = tot_v2 = 0
for t, row in FROZEN.items():
    v1 = [e for e in row["episodes"] if e["depth_pct"] <= -20.0 and e["cross20_date"] is not None]
    v2 = episodes_v2(B[t]["Close"])
    tot_v1 += len(v1); tot_v2 += len(v2)
    if len(v1) != len(v2):
        mismatch["count"] += 1
        if len(examples) < 6:
            examples.append(f"{t}: {len(v1)} vs {len(v2)} episodes")
        continue
    for a, b in zip(v1, v2):
        # ⚠️ 1e-4, not 1e-6, and the difference is the FILE's precision rather than
        # a disagreement. Episodes are stored rounded to four decimals, so a perfect
        # second implementation still differs by up to 0.00005 percentage points on
        # nearly every row. At 1e-6 this reported 5,514 "disagreements" of which the
        # largest was 0.0000499975 — a guard crying wolf loudly enough that a real
        # difference would be lost in it.
        if abs(a["depth_pct"] - b["depth_pct"]) > 1e-4:
            mismatch["depth"] += 1
        if a["recovered"] != b["recovered"]:
            mismatch["recovered"] += 1
        if a["peak_date"] != b["peak_date"]:
            mismatch["peak_date"] += 1
        if a["recovery_date"] != b["recovery_date"]:
            mismatch["recovery_date"] += 1
        d1 = a["days_cross20_to_recovery"] if a["recovered"] else a["bars_after_cross20"]
        if d1 != b["dur"]:
            mismatch["dur"] += 1

print(f"episodes found: frozen file {tot_v1}, independent implementation {tot_v2}")
print("disagreements:")
for k, n in mismatch.items():
    print(f"   {k:14s} {n}")
for e in examples:
    print("   e.g.", e)

# and re-derive the article's headline numbers from the SECOND implementation only
print("\nheadline figures, computed only from the independent implementation:")
uni = {u["ticker"]: u for u in engine.universe()}
EX = set(D["excluded"])
# ⚠️ EXPECTED VALUES DERIVED FROM THE FROZEN FILE, not typed in. They were literals
# (1261, 12.8, 51.6 …) until 2026-08-30, which made this audit a third copy of the
# numbers it exists to check — so when the dividend correction moved them, the two
# implementations agreed with each other and only the AUDIT disagreed, printing
# "*** DIFFERS" at a system that was entirely correct (CLAUDE.md 11c).
def _from_file(idx):
    L = [e for r in D["rows"] if r["index_id"] == idx and r["ticker"] not in EX
         for e in r["episodes"] if e["depth_pct"] <= -20.0 and e["cross20_date"] is not None]
    el = [c for c in L if (c["bars_after_cross20"] or 0) >= TY]
    return (len(L),
            round(100 * sum(1 for c in L if not c["recovered"]) / len(L), 1),
            round(100 * sum(1 for c in el if c["recovered"]
                            and (c["days_cross20_to_recovery"] or 0) <= TY) / len(el), 1))


for idx, lab in (("asx200", "ASX 200"), ("sp500", "S&P 500"), ("tsx60", "TSX 60")):
    want_falls, want_never, want_1y = _from_file(idx)
    L = []
    for t, u in uni.items():
        if u["index_id"] != idx or t in EX:
            continue
        L += episodes_v2(B[t]["Close"])
    never = 100 * sum(1 for c in L if not c["recovered"]) / len(L)
    el = [c for c in L if c["follow"] >= TY]
    w1 = 100 * sum(1 for c in el if c["recovered"] and c["dur"] <= TY) / len(el)
    ok = (len(L) == want_falls) and (abs(never - want_never) < 0.05) and (abs(w1 - want_1y) < 0.05)
    print(f"   {lab:9s} falls {len(L):5d} (article {want_falls})   still down {never:.1f}% ({want_never})"
          f"   back in 1y {w1:.1f}% ({want_1y})   {'MATCH' if ok else '*** DIFFERS'}")
