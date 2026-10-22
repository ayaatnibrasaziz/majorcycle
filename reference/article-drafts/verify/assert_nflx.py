"""Assert every figure in draft 07 (Netflix Q3 2026) against its source.

Two kinds of figure:
  * MEASURED — re-derived here from the frozen price file via `nflx_figures.figures()`;
  * REPORTED — Netflix's own numbers, typed once below from the Q3 2026 shareholder letter
    (SEC 8-K Exhibit 99.1, 20 Oct 2026) and the earlier letters, with every DERIVED
    comparison (vs forecast, vs a year ago) computed here rather than typed.

Each expected string must appear in the draft (whitespace-normalised, so a figure split
across a line wrap still counts — 11av). Exits non-zero on the first run with a miss and
lists every miss.

    python -I reference/article-drafts/verify/assert_nflx.py
"""

from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nflx_figures import figures  # noqa: E402

DRAFT = Path(__file__).resolve().parents[1] / "07-netflix-q3-2026-results.md"

# --- REPORTED, in $ millions unless noted (letter page 1 table and statements) ---------
Q3 = {"rev": 12874.176, "oi": 4458.600, "ni": 3663.927, "eps": 0.87, "margin": 34.6}
Q3_FC = {"rev": 12860, "oi": 4268, "ni": 3452, "eps": 0.82, "margin": 33.2, "growth": 11.7}
Q3_25 = {"rev": 11510.307, "oi": 3248.247, "ni": 2546.916, "eps": 0.59, "margin": 28.2}
GROWTH = {"Q3'25": 17.2, "Q1'26": 16.2, "Q2'26": 13.4, "Q3'26": 11.8, "Q4'26 fc": 11.5}
Q4_FC = {"rev": 13442, "eps": 0.67, "margin": 26.0, "margin_yago": 24.5}
REGIONS = {"UCAN": 5628.215, "EMEA": 4106.572, "LATAM": 1602.603, "APAC": 1536.786}
BUYBACK = {"usd": 4796.725, "shares_m": 63.9}
DIL = {"now": 4195.127, "yago": 4340.392}
ADS = {"new": 2.7, "old": 3.0, "y2025": 1.5}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s)


WEB = Path(__file__).resolve().parents[3] / "web"
SLUG = "netflix-q3-2026-results"


def plain(s: str) -> str:
    """Curly quotes as straight ones, so the draft (straight) and the site (curly) compare."""
    return s.replace("’", "'").replace("“", '"').replace("”", '"')


def site_text(as_of_words: str) -> tuple[str, str]:
    """The SHIPPED copy a reader sees: the registry's answer, and the body with its markup
    stripped. Checked as well as the draft, because two copies of one set of figures is
    exactly how they drift (CLAUDE.md 11c). Table cells stay in as their string literals."""
    reg = (WEB / "lib" / "articles.ts").read_text(encoding="utf-8")
    entry = reg[reg.index(f"slug: '{SLUG}'"):]
    answer = re.search(r"answer:\s*'([^']*)'", entry).group(1)  # type: ignore[union-attr]
    tsx = (WEB / "app" / "(public)" / "articles" / "content.tsx").read_text(encoding="utf-8")
    m = re.search(r"const NFLX_AS_AT = '([^']+)'", tsx)
    assert m and m.group(1) == as_of_words, f"NFLX_AS_AT is {m and m.group(1)!r}, the data is as at {as_of_words!r}"
    body = tsx[tsx.index(f"'{SLUG}': () => ("):]
    body = body[: body.index("\n  ),\n")]
    body = body.replace("{NFLX_AS_AT}", as_of_words).replace("{' '}", " ")
    # Strip only the TEXT tags (p, strong, ul, li, a, Link). A `<DataTable … />` must keep its
    # props, because its cells are the table a reader sees.
    body = re.sub(r"</?(?:[a-z][a-z0-9]*|Link)\b[^>]*>", " ", body)
    return norm(plain(answer)), norm(plain(body))


def b(x_m: float, dp: int = 2) -> str:
    return f"${x_m / 1000:.{dp}f}B"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # the misses print a minus sign (U+2212)
    raw = DRAFT.read_text(encoding="utf-8")
    # Only the words a reader sees: the answer box and the body. The fact-check sheet quotes
    # wrong figures from other sources on purpose, and must not satisfy an assertion.
    text = norm(raw[raw.index("## The answer"):raw.index("## Fact-check sheet")])
    f = figures()
    want: list[tuple[str, str]] = []

    def need(label: str, s: str) -> None:
        want.append((label, s))

    # Reported figures, as the table prints them.
    for k in ("rev", "oi", "ni"):
        need(f"Q3 {k}", b(Q3[k]))
        need(f"Q3 forecast {k}", b(Q3_FC[k]))
        need(f"Q3'25 {k}", b(Q3_25[k]))
    for d in (Q3, Q3_FC, Q3_25):
        need("eps", f"${d['eps']:.2f}")
        need("margin", f"{d['margin']:.1f}%")
    for k, v in GROWTH.items():
        need(f"growth {k}", f"{v:.1f}%")
    need("Q4 revenue forecast", f"${Q4_FC['rev'] / 1000:.2f} billion")
    need("Q4 eps forecast", f"${Q4_FC['eps']:.2f}")
    need("Q4 margin", f"{Q4_FC['margin']:.1f}%")
    need("Q4 margin a year ago", f"{Q4_FC['margin_yago']:.1f}%")
    for k, v in REGIONS.items():
        need(f"region {k}", b(v))

    # Derived from reported.
    need("rev vs forecast (within 0.1%)", "within 0.1%")
    assert abs(Q3["rev"] / Q3_FC["rev"] - 1) * 100 < 0.15
    need("oi vs forecast", f"{(Q3['oi'] / Q3_FC['oi'] - 1) * 100:.1f}% above")
    need("buyback avg", f"about ${round(BUYBACK['usd'] / BUYBACK['shares_m'])}")
    need("diluted shares", f"{abs((DIL['now'] / DIL['yago'] - 1) * 100):.1f}% lower than a year earlier")
    need("ads cut ~10%", f"around {round(abs(ADS['new'] / ADS['old'] - 1) * 100)}%")
    need("layoff cost", f"roughly ${round(0.012 * Q4_FC['rev'] / 10) * 10} million")
    need("range midpoint", f"{abs(51.1 / 51.2 - 1) * 100:.1f}% below")

    # Measured from the frozen prices.
    last = f["last_close"]
    need("close", f"${last:.2f}")
    need("record close", f"${f['ath_close']:.2f}")
    need("below record", f"{abs(f['below_ath']):.1f}% below")
    need("52w high", f"${f['high_52w']:.2f}")
    need("below 52w high", f"{abs((last / f['high_52w'] - 1) * 100):.1f}% below")
    need("ytd", f"{abs(f['ytd']):.1f}% lower")
    need("S&P below high", f"{abs(f['index']['^GSPC']['below_high']):.1f}% below its record")
    need("releases", f"all {f['rx_n']} regular")
    need("median move", f"{f['rx_median_abs']:.1f}%")
    need("median move since 2022", f"{f['rx_median_abs_since_2022']:.1f}%")
    need("10%+ moves", f"{f['rx_over10']} of the {f['rx_n']}")
    need("worst", f"{abs(f['rx_worst']['move']):.1f}%")
    need("best", f"{f['rx_best']['move']:.1f}%")
    need("falls after", f"fell after {f['rx_down']} of the {f['rx_n']}")
    need("streak", "each of the last six")
    assert f["down_streak"] == 6, f["down_streak"]
    rx_last = f["reactions"][-1]
    need("the 21 Oct move", f"down {abs(rx_last['move']):.1f}%")
    need("the move in the answer", f"fell {abs(rx_last['move']):.1f}%")
    need("previous close", f"${f['prev_close']:.2f}")
    need("lowest close since", f"lowest close since {f['prev_lower_close_month']}")
    need("S&P on the day", f"S&P 500 rose {f['index']['^GSPC']['day_move']:.1f}%")
    need("model window", f"last {f['model_window']} trading days")
    need("model high", f"${f['model_high']:.2f}")
    assert f["model_high_date"] == "2025-10-21", f["model_high_date"]  # "last year's results day"
    for r in f["reactions"][-6:]:
        need(f"reaction {r['release']}", f"({r['move']:+.1f}%)".replace("-", "−"))
    for e in f["big_falls"]:
        need(f"fall from {e['peak_date']}", f"−{abs(e['depth_pct']):.1f}%")
    words = {6: "six", 7: "seven", 8: "eight"}
    need("number of falls", f"Netflix's {words[len(f['big_falls'])]} falls of 40% or more")
    need("earlier falls", f"the earlier {words[len(f['big_falls']) - 1]}")
    need("normal fall", f"about {abs(f['engine']['typical_drawdown']):.1f}%")
    need("engine now", f"{abs(f['engine']['current_drawdown_pct']):.1f}% below")

    d = date.fromisoformat(f["as_of"])
    as_of_words = f"{d.day} {d:%B %Y}"
    answer, body = site_text(as_of_words)
    # The draft's answer box: the paragraph between its heading and the next rule.
    box = raw[raw.index("## The answer"):].split("\n---", 1)[0]
    draft_answer = norm(plain(box.split("\n", 1)[1])).strip()
    site = answer + " " + body
    miss = [(lbl, s) for lbl, s in want if s not in text]
    miss += [(lbl + " [site]", s) for lbl, s in want if plain(s) not in site]
    if answer != draft_answer:
        miss.append(("answer box [site]", f"the registry answer differs from the draft: {answer!r}"))
    print(f"{2 * len(want) + 1 - len(miss)} of {2 * len(want) + 1} checks pass: {len(want)} figures in the draft "
          f"and on the site, plus the answer box (as at {f['as_of']})")
    for lbl, s in miss:
        print(f"  MISSING {lbl}: {s!r}")
    sys.exit(1 if miss else 0)


if __name__ == "__main__":
    main()
