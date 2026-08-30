"""Cross-file checks: a statistic quoted in two articles must agree in both.

CLAUDE.md 11c — a number stated twice is a copy of that number, and prose is
where copies go to drift unnoticed. The 40-50% band already drifted once
(20.5 vs 20.4) between two of these files.
"""
import re
from pathlib import Path

DRAFTS = Path(r"C:/Users/Ayaat Nibras Aziz/Desktop/Stock Website/reference/article-drafts")
F = {p.name: p.read_text(encoding="utf-8") for p in sorted(DRAFTS.glob("*.md"))}
REC = "01-how-long-does-an-asx-share-take-to-recover.md"
ASX = "02-asx-200-shares-furthest-below-their-highs.md"
SP = "03-sp-500-shares-furthest-below-their-highs.md"
CA = "04-tsx-60-shares-furthest-below-their-highs.md"
fails = []


def need(name, cond, detail=""):
    if not cond:
        fails.append(f"{name}: {detail}")


def rows(text, header_start):
    """The data rows of the first markdown table whose header starts with this."""
    lines = text.splitlines()
    for i, ln in enumerate(lines):
        if ln.startswith(header_start):
            out = []
            for j in range(i + 2, len(lines)):
                if not lines[j].startswith("|"):
                    break
                out.append([c.strip() for c in lines[j].strip("|").split("|")])
            return out
    return []


# 1. the ASX depth ladder appears in BOTH the recovery piece and the ASX ranking piece
lad_rec = {r[0]: (r[3], r[4]) for r in rows(F[REC], "| How far it fell")}
lad_asx = {r[0]: (r[1], r[2]) for r in rows(F[ASX], "| The size of the fall")}
need("ladder present in both", lad_rec and lad_asx, f"{len(lad_rec)} vs {len(lad_asx)}")
for band, v in lad_asx.items():
    need(f"ladder band {band}", band in lad_rec, "band missing from the recovery article")
    if band in lad_rec:
        need(f"ladder {band} agrees", lad_rec[band] == v, f"recovery says {lad_rec[band]}, ASX says {v}")

# 2. the three-market comparison in the Canada piece must match each article's own figures
cmp_rows = {r[0]: r[1:] for r in rows(F[CA], "| | ASX 200")}
need("comparison table found", bool(cmp_rows), "no three-market table in the Canada article")
if cmp_rows:
    med = cmp_rows.get("Middle company is below its high by")
    # ⚠️ DERIVED from each article, never restated here. These two lines held the
    # literals 17.9 and 11.9 until 2026-08-30, which made the checker itself a
    # third copy of the number it exists to keep in sync — so when the dividend
    # correction moved both medians, the two articles agreed with each other and
    # the GUARD was the only thing that disagreed (CLAUDE.md 11c).
    import re as _re
    MED = _re.compile(r"sat \*\*(\d+\.\d)% below its own")

    def own_median(text):
        m = MED.search(" ".join(text.split()))
        return m.group(1) if m else None

    a, u = own_median(F[ASX]), own_median(F[SP])
    need("ASX states its own median", a is not None, "no 'sat **N% below its own' sentence in the ASX article")
    need("SP states its own median", u is not None, "no 'sat **N% below its own' sentence in the S&P article")
    need("ASX median agrees", bool(med) and med[0] == f"{a}%", f"Canada table says {med and med[0]}, the ASX article says {a}%")
    need("SP median agrees", bool(med) and med[1] == f"{u}%", f"Canada table says {med and med[1]}, the S&P article says {u}%")
    deep = cmp_rows.get("Deepest single fall")
    need("ASX deepest agrees", deep and deep[0].replace("−", "-") == "-74.0%", f"{deep}")
    need("SP deepest agrees", deep and deep[1].replace("−", "-") == "-76.2%", f"{deep}")

# 3. every article states the same as-at date and none states a different one
for n, t in F.items():
    need(f"{n} as-at", "27 August 2026" in t, "missing the as-at date")
    for bad in ("28 August 2026", "26 August 2026"):
        need(f"{n} no stray date", bad not in t, f"contains {bad}")

# 4. Monster is excluded and said to be excluded wherever an S&P count appears
need("SP article names the exclusion", "Monster" in F[SP] and "499" in F[SP], "")
need("no article ranks Monster",
     all("Monster" not in t.split("## Body")[1].split("## Fact-check")[0] for t in F.values()),
     "Monster appears in an article BODY (the fact-check sheets may name it)")

# 5. no article promises advice, and each carries the not-advice line
for n, t in F.items():
    need(f"{n} disclaimer", "not financial advice" in t or "not advice about any" in t, "")
    for word in (" buy ", " sell ", "Buy ", "Strong Buy"):
        body = t.split("## Body")[1].split("## Fact-check")[0]
        need(f"{n} no {word.strip()}", word not in body, f"body contains {word.strip()!r}")

# 6. the retired "never" framing must not come back. It read as a contradiction
#    (100% back within five years beside 4.5% never back) because the two columns
#    were counted over different populations.
for n, tx in F.items():
    body = tx.split("## Body")[1].split("## Fact-check")[0]
    for banned in ("Never back", "never come back", "never came back", "never made it back",
                   "Has never come back"):
        need(f"{n} no {banned!r}", banned not in body, "retired framing is back")

# 6b. no article body may name the data source
for n, tx in F.items():
    body = tx.split("## Body")[1].split("## Fact-check")[0]
    for banned in ("yfinance", "Yahoo", "data provider", "provider"):
        need(f"{n} does not name the source", banned not in body, f"body contains {banned!r}")

# 7. no italics in any body (owner rule, 2026-08-29)
for n, t in F.items():
    body = t.split("## Body")[1].split("## Fact-check")[0]
    need(f"{n} no italics", not re.search(r"(?<![*_])[*_][^*_\n]{3,}[*_](?![*_])", body), "italic run found")

print(f"cross-file checks: {'ALL PASS' if not fails else str(len(fails)) + ' FAILED'}")
for f in fails:
    print("   FAIL:", f)
