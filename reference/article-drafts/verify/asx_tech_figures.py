"""Derive every figure in draft 05 (ASX tech) from the frozen file.

Uses the site's own engine (`analytics.major_cycle.calculate_cycle_metrics`, the
Medium preset) so "how far it normally falls" means exactly what a reader sees on
the stock page. No database, no credentials.

    python -I reference/article-drafts/verify/asx_tech_figures.py
"""

from __future__ import annotations

import gzip
import json
import statistics
import sys
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from analytics.major_cycle import CycleParams, calculate_cycle_metrics  # noqa: E402
from analytics.presets import PRESETS  # noqa: E402

DATA = ROOT / "reference" / "asx-tech-2026-10-15-DATA.json.gz"
#: The COMMITTED file. The raw price history above is 22 MB and is kept out of git
#: (owner's repo was 28 MB in total); this holds every value the article's figures
#: derive from — each company's drawdown figures and every one of its falls — and is
#: what `assert_tech.py` reads. `--derive` rebuilds it from the raw file, and
#: `assert_tech.py --from-raw` proves the two still agree.
DERIVED = ROOT / "reference" / "asx-tech-2026-10-15-DERIVED.json.gz"
P = PRESETS["medium"]
PARAMS = CycleParams(
    pullback_threshold=float(P["pullback_threshold"]),
    profit_threshold=float(P["profit_threshold"]),
    lookback_bars=int(P["lookback_bars"]),
)


#: Price history that belongs to a DIFFERENT business is cut off. Weebit Nano listed
#: by reverse takeover of Radar Iron, an iron-ore company: the shares were suspended
#: from 17 May 2016 and first traded as Weebit on 3 August 2016. Before that date the
#: series is Radar Iron's, so it cannot say how Weebit normally falls.
#: ⚠️ The stock page does NOT make this cut, so Weebit's figures here differ from it.
STARTS = {"WBT.AX": "2016-08-03"}


def load() -> dict[str, Any]:
    with gzip.open(DATA, "rt", encoding="utf-8") as fh:
        d = json.load(fh)
    for t, start in STARTS.items():
        d["full"][t] = [r for r in d["full"][t] if r[0] >= start]
    return d


def frame(rows: list[list[Any]]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["date", "High", "Low", "Close"])
    df["date"] = pd.to_datetime(df["date"])
    return df.set_index("date").astype(float)


def analyse(rows: list[list[Any]]) -> dict[str, Any]:
    df = frame(rows)
    m = calculate_cycle_metrics(df, PARAMS)
    window = df.tail(PARAMS.lookback_bars)
    m["peak_date"] = window["High"].idxmax().strftime("%Y-%m-%d")
    m["first_bar"] = df.index[0].strftime("%Y-%m-%d")
    return m


def main() -> None:
    d = load()
    meta = d["meta"]
    res = {t: analyse(rows) for t, rows in d["full"].items() if rows}

    def row(t: str) -> dict[str, Any]:
        m = res[t]
        now, typ, low = m["current_drawdown_pct"], m["typical_drawdown"], m["lower_bound"]
        return {
            "ticker": t,
            "name": meta.get(t, {}).get("name", t),
            "now": now,
            "typical": typ,
            "deepest": low,
            "multiple": (now / typ) if typ else None,
            "peak": m["peak_date"],
            "since": m["first_bar"],
        }

    tech = sorted((row(t) for t in d["tech"]), key=lambda r: r["now"])
    print(f"As at {d['as_of']} · Medium preset · {len(tech)} ASX 200 technology members\n")
    print(f"{'company':34} {'now':>7} {'normal':>7} {'deepest':>8} {'x':>5}  peak        data from")
    for r in tech:
        print(
            f"{r['name'][:34]:34} {r['now']:7.1f} {r['typical']:7.1f} {r['deepest']:8.1f} "
            f"{r['multiple']:5.2f}  {r['peak']}  {r['since']}"
        )

    ax = row("^AXJO")
    print(f"\nS&P/ASX 200 index: now {ax['now']:.1f} · normally {ax['typical']:.1f} · peak {ax['peak']}")

    all_rows = [row(t) for t in d["members"] if t in res and res[t]["typical_drawdown"] is not None]
    non_tech = [r for r in all_rows if meta[r["ticker"]]["sector"] != "Technology"]

    def summary(label: str, rs: list[dict[str, Any]]) -> None:
        print(
            f"\n{label}: n={len(rs)} · median now {statistics.median(r['now'] for r in rs):.1f} · "
            f"median normal {statistics.median(r['typical'] for r in rs):.1f}\n"
            f"  past their normal fall {sum(r['now'] < r['typical'] for r in rs)} · "
            f"more than twice it {sum(r['now'] < 2 * r['typical'] for r in rs)} · "
            f"below their deepest on record {sum(r['now'] <= r['deepest'] for r in rs)} · "
            f"down >20% {sum(r['now'] < -20 for r in rs)} · down >50% {sum(r['now'] < -50 for r in rs)}"
        )

    summary("Technology", tech)
    summary("Rest of the ASX 200", non_tech)
    summary("Whole ASX 200", all_rows)

    twice = sorted((r for r in all_rows if r["now"] < 2 * r["typical"]), key=lambda r: r["multiple"], reverse=True)
    print("\nEvery ASX 200 member more than twice its normal fall:")
    for r in twice:
        print(f"  {r['name'][:34]:34} {meta[r['ticker']]['sector'] or '-':22} {r['now']:7.1f} vs {r['typical']:6.1f}  x{r['multiple']:.2f}")

    by_sector: dict[str, list[float]] = {}
    for r in all_rows:
        by_sector.setdefault(meta[r["ticker"]]["sector"] or "-", []).append(r["now"])
    print("\nMedian fall below one-year high, by sector:")
    for s, v in sorted(by_sector.items(), key=lambda kv: statistics.median(kv[1])):
        print(f"  {s:24} n={len(v):3}  {statistics.median(v):6.1f}")



def recovery_section() -> None:
    """How tech falls have recovered, against the whole ASX 200, as at the same date."""
    from recovery_episodes import back_within, clocks_for, episodes, km_median_years

    d = load()
    meta = d["meta"]
    eps = {t: episodes(d["full"][t], d["as_of"]) for t in d["members"]}

    def stats(label: str, tickers: list[str]) -> None:
        C = [c for t in tickers for c in clocks_for(eps[t])]
        never = sum(1 for c in C if not c[1])
        print(f"\n{label}: {len(C)} falls of 20%+ since 2000 across {len({t for t in tickers if clocks_for(eps[t])})} companies")
        print(f"  typical wait (KM median) {km_median_years(C):.2f} years · not back yet {never} ({100*never/len(C):.1f}%)")
        for y in (1, 2, 3, 5):
            p, n = back_within(C, y)
            print(f"  back within {y}y: {p:.1f}% (of {n} old enough to judge)")
        for lo, hi, lab in [(-30, -20, "20-30"), (-40, -30, "30-40"), (-50, -40, "40-50"), (-70, -50, "50-70"), (-101, -70, "70+")]:
            G = [c for c in C if lo < c[3] <= hi]
            if not G:
                print(f"  {lab}: none"); continue
            m = km_median_years(G)
            p5, n5 = back_within(G, 5)
            print(f"  {lab}: n={len(G)} · typical wait {('%.2f' % m) if m else 'not reached'}y · back within 5y {p5:.0f}% (of {n5}) · not back yet {sum(1 for c in G if not c[1])}")

    stats("WHOLE ASX 200 (current members)", d["members"])
    stats("TECHNOLOGY (15)", d["tech"])
    stats("REST OF ASX 200", [t for t in d["members"] if t not in d["tech"]])

    print("\nPer company — every 20% fall since 2000 (or listing):")
    for t in sorted(d["tech"], key=lambda t: meta[t]["name"]):
        ep = [e for e in eps[t] if e["cross20_date"]]
        done = [e for e in ep if e["recovered"]]
        waits = sorted(e["days_cross20_to_recovery"] / TY for e in done)
        openep = [e for e in ep if not e["recovered"]]
        print(f"  {meta[t]['name'][:28]:28} falls {len(ep):2} · recovered {len(done):2} · "
              f"median wait {(statistics.median(waits) if waits else float('nan')):.2f}y · longest {(max(waits) if waits else float('nan')):.2f}y")
        for e in ep:
            w = f"back {e['recovery_date']} after {e['days_cross20_to_recovery']/TY:.2f}y" if e["recovered"] else f"OPEN, {e['bars_after_cross20']/TY:.2f}y since crossing -20%"
            print(f"      peak {e['peak_date']} {e['depth_pct']:6.1f}%  {w}")


TY = 252.0

if __name__ == "__main__" and "--recovery" in sys.argv:
    recovery_section()


if __name__ == "__main__" and not ({"--recovery", "--companies", "--derive"} & set(sys.argv)):
    main()


def fmt_wait(years: float) -> str:
    """The published articles' convention: months under a year, else years to 1 dp."""
    if years < 1:
        m = round(years * 12)
        return f"{max(m, 1)} month" + ("" if max(m, 1) == 1 else "s")
    return f"{years:.1f} years"


def derive() -> dict[str, Any]:
    """Everything the article's figures need, from the raw freeze."""
    from recovery_episodes import episodes

    d = load()
    metrics, eps, close = {}, {}, {}
    for t, rows in d["full"].items():
        if not rows:
            continue
        m = analyse(rows)
        metrics[t] = {k: m[k] for k in ("current_drawdown_pct", "typical_drawdown", "lower_bound", "peak_date", "first_bar")}
        # Only falls that reached 20%: nothing reads the shallower ones, and they are most of the file.
        eps[t] = [e for e in episodes(rows, d["as_of"]) if e["cross20_date"]]
        close[t] = float(rows[-1][3])
    return {"as_of": d["as_of"], "members": d["members"], "tech": d["tech"], "meta": d["meta"],
            "starts": STARTS, "metrics": metrics, "episodes": eps, "close": close}


def load_derived() -> dict[str, Any]:
    with gzip.open(DERIVED, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def save_derived() -> None:
    with gzip.GzipFile(DERIVED, "wb", mtime=0) as raw:
        raw.write(json.dumps(derive(), ensure_ascii=False).encode("utf-8"))
    print(f"wrote {DERIVED.name}: {DERIVED.stat().st_size:,} bytes")


def per_company(D: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    D = D or derive()
    out = []
    for t in D["tech"]:
        close = D["close"][t]
        ep = [e for e in D["episodes"][t] if e["cross20_date"]]
        done = [e for e in ep if e["recovered"]]
        waits = sorted(e["days_cross20_to_recovery"] / TY for e in done)
        open_ = [e for e in ep if not e["recovered"]]
        o = open_[0] if open_ else None
        out.append({
            "ticker": t,
            "name": D["meta"][t]["name"],
            "falls": len(ep),
            "back": len(done),
            "mid_wait": statistics.median(waits) if waits else None,
            "longest": max(waits) if waits else None,
            "deepest_recovered": min((e["depth_pct"] for e in done), default=None),
            "open_peak_date": o["peak_date"] if o else None,
            "open_now": (close / o["peak"] - 1) * 100 if o else None,
            "open_deepest": o["depth_pct"] if o else None,
            "open_years": o["bars_after_cross20"] / TY if o else None,
            "first": D["metrics"][t]["first_bar"],
        })
    return out


def print_per_company() -> None:
    rows = per_company()
    deeper = 0
    for r in sorted(rows, key=lambda r: r["name"]):
        mid = fmt_wait(r["mid_wait"]) if r["mid_wait"] is not None else "-"
        lon = fmt_wait(r["longest"]) if r["longest"] is not None else "-"
        flag = ""
        if r["open_deepest"] is not None and (r["deepest_recovered"] is None or r["open_deepest"] < r["deepest_recovered"]):
            flag = "  << deeper than any fall it has come back from"
            deeper += 1
        cur = (f"{r['open_now']:.1f}% below its {r['open_peak_date']} high · deepest so far {r['open_deepest']:.1f}% · "
               f"{r['open_years']:.1f}y since -20%") if r["open_now"] is not None else "not in a 20% fall"
        dr = f"{r['deepest_recovered']:.1f}" if r["deepest_recovered"] is not None else "-"
        print(f"{r['name'][:26]:26} falls {r['falls']:2} back {r['back']:2} mid {mid:10} longest {lon:10} deepest-back {dr:>6} | {cur}{flag}")
    print(f"\ncurrent fall deeper than any it has recovered from (or never recovered from one): {deeper}")


if __name__ == "__main__" and "--derive" in sys.argv:
    save_derived()

if __name__ == "__main__" and "--companies" in sys.argv:
    print_per_company()
