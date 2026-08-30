"""AUDIT LAYER A - coverage.

The 359 assertions only check the numbers I remembered to assert. A figure I
forgot is invisible to them and reads exactly like a verified one (CLAUDE.md 14g).

So: pull EVERY number out of the four article bodies, and report which ones no
assertion covers. Those are the ones that have never been checked by anything.
"""
import re, subprocess, sys, io
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DRAFTS = Path(r"C:/Users/Ayaat Nibras Aziz/Desktop/Stock Website/reference/article-drafts")
VERIFY = DRAFTS / "verify"

# 1. what does the assertion script actually verify? Ask it, don't guess.
src = (VERIFY / "assert_all.py").read_text(encoding="utf-8")
src = src.replace(
    'bad = [c for c in CHECKED if not c[3]]',
    'import json as _j; print("__ASSERTED__" + _j.dumps([[c[0], c[2]] for c in CHECKED]))\n'
    'bad = [c for c in CHECKED if not c[3]]')
tmp = VERIFY / "_dump_asserted.py"
tmp.write_text(src, encoding="utf-8")
out = subprocess.run([sys.executable, str(tmp)], capture_output=True, text=True).stdout
tmp.unlink()
import json
asserted = json.loads([l for l in out.splitlines() if l.startswith("__ASSERTED__")][0][len("__ASSERTED__"):])
asserted_vals = set()
for label, want in asserted:
    if isinstance(want, (int, float)):
        asserted_vals.add(round(abs(float(want)), 2))
print(f"assertions in the script : {len(asserted)}")
print(f"distinct absolute values : {len(asserted_vals)}")

# 2. every number that appears in an article BODY
NUM = re.compile(r"(?<![\w/-])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)")
# words that are structure, not claims
SKIP_CONTEXT = ("| # |", "|---|")
found = {}
for f in sorted(DRAFTS.glob("*.md")):
    body = f.read_text(encoding="utf-8").split("## Body")[1].split("---\n\n## Fact-check")[0]
    for ln in body.splitlines():
        if any(s in ln for s in SKIP_CONTEXT):
            continue
        for m in NUM.finditer(ln):
            raw = m.group(1)
            v = float(raw.replace(",", ""))
            found.setdefault(round(v, 2), []).append((f.name[:2], ln.strip()[:88]))

print(f"distinct numbers printed in the four bodies: {len(found)}")

# 3. which printed numbers are NOT covered by any assertion?
#    Years, ranking positions and band edges are structure rather than findings.
STRUCTURAL = {2000.0, 2024.0, 2026.0, 2025.0, 2007.0, 2018.0, 2021.0, 2022.0, 2023.0,
              1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0,
              20.0, 30.0, 40.0, 50.0, 70.0, 100.0, 252.0, 27.0, 60.0, 200.0, 201.0, 500.0, 499.0}
uncovered = []
for v, where in sorted(found.items()):
    if v in asserted_vals or v in STRUCTURAL:
        continue
    uncovered.append((v, where))

print()
print("=" * 78)
print(f"PRINTED NUMBERS WITH NO ASSERTION BEHIND THEM: {len(uncovered)}")
print("=" * 78)
for v, where in uncovered:
    print(f"\n  {v}")
    seen = set()
    for art, ln in where:
        if ln in seen:
            continue
        seen.add(ln)
        print(f"     [{art}] {ln}")
