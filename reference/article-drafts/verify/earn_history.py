"""The measured half of the batch-2 results articles (Intel, Amazon, Sandisk, ServiceNow), checked one way.

`history(f, need)` recomputes, from `earn_figures.figures()` (frozen data), what the "How the shares reacted",
"How … shares usually react" and "How far … has fallen before" sections state: the results BEFORE this one
(this one is the last reaction), and every row of the falls table. Each assert script adds its own sentences
around these values; the table rows are required here, so a typed row cannot drift from the data.
"""

from __future__ import annotations

import statistics
from typing import Any, Callable

MONTHS = "January February March April May June July August September October November December".split()
WORDS = "zero one two three four five six seven eight nine ten".split()


def my(d: str) -> str:
    return f"{MONTHS[int(d[5:7]) - 1]} {d[:4]}"


def history(f: dict[str, Any], need: Callable[[str, str], None]) -> dict[str, Any]:
    rx = f["reactions"]
    this, before = rx[-1], rx[:-1]
    m = [r["move"] for r in before]
    w, b = min(before, key=lambda r: r["move"]), max(before, key=lambda r: r["move"])
    out = {
        "this": this, "n": len(before), "first": before[0]["release"], "last": before[-1]["release"],
        "median": statistics.median(abs(x) for x in m), "over5": sum(abs(x) >= 5 for x in m),
        "over10": sum(abs(x) >= 10 for x in m), "worst": w, "best": b, "up": sum(x > 0 for x in m),
        "down": sum(x < 0 for x in m), "bigger": sum(abs(x) > abs(this["move"]) for x in m),
    }
    need("rx median", f"The middle move, up or down, was **{out['median']:.1f}%**")
    need("rx worst", f"The largest fall was **{abs(w['move']):.1f}%** in {my(w['release'])}")
    need("rx best", f"The largest rise was **{b['move']:.1f}%** in {my(b['release'])}")
    for e in f["big_falls"]:
        back = my(e["recovery_date"]) if e["recovery_date"] else "Not yet"
        need(f"fall {e['peak_date']}", f"| {my(e['peak_date'])} | {my(e['trough_date'])} | −{abs(e['depth_pct']):.1f}% | {back} |")
    return out


def w(n: int) -> str:
    """'five' up to ten, digits after (the house style in these articles)."""
    return WORDS[n] if n <= 10 else str(n)
