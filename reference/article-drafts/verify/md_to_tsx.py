"""Turn a draft's body (between "## Body" and the fact-check sheet) into the TSX the site ships.

One mechanical conversion, so the shipped words cannot drift from the checked draft (CLAUDE.md 11c):
  ### heading -> <h2>; paragraph -> <p>; "- " list -> <ul><li>; **x** -> <strong>; a pipe table ->
  <DataTable> (cells kept as string literals, so the site check reads them); straight quotes and
  apostrophes -> curly, as the site sets them. Prints the snippet for ARTICLE_BODIES.

    python -I md_to_tsx.py <draft.md> <slug>
"""
from __future__ import annotations

import re
import sys
import textwrap
from pathlib import Path


def curly(s: str) -> str:
    s = re.sub(r'"([^"]*)"', "“\\1”", s)
    return s.replace("'", "’")


def inline(s: str) -> str:
    s = curly(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    assert "{" not in s and "}" not in s and "<" not in s.replace("<strong>", "").replace("</strong>", ""), s
    return s


def wrap(text: str, indent: int) -> str:
    """Wrap for the source file. JSX DELETES a line break (and its indent) that sits beside a tag, so
    "it was" + break + "<strong>9.5%" renders "was9.5%" (found by proseSpacing, 23 Oct). Where a break
    lands beside a tag, an explicit {' '} keeps the space the reader should see."""
    lines = textwrap.wrap(text, width=96 - indent, break_on_hyphens=False)
    for k in range(len(lines) - 1):
        if lines[k + 1].startswith("<") or lines[k].endswith(">"):
            lines[k] += "{' '}"
    return "\n".join(" " * indent + ln for ln in lines)


def numeric(cells: list[str]) -> bool:
    return all(re.match(r"^[−+$\d]", c) or c in ("", "—") for c in cells)


def table(rows: list[list[str]], caption: str, ind: int) -> str:
    head, body = rows[0], rows[2:]
    n = len(head)
    keys = [f"c{k}" for k in range(n)]
    # Five or more columns: the first (a date or name) gives way, so a one-word header such as
    # "Westpac" fits its numeric column at 375px. At 40% it overflowed by 0.4px (CI, 28 Oct).
    first_w = 28 if n >= 5 else 40 if n > 2 else 50
    rest_w = (100 - first_w) / (n - 1)
    cols = []
    for k, h in enumerate(head):
        num = k > 0 and numeric([r[k] for r in body])
        w = f"{first_w if k == 0 else round(rest_w)}%"
        label = curly(h) if h else "Measure"
        cols.append(f"{{ key: '{keys[k]}', label: '{label}'{', numeric: true' if num else ''}, width: '{w}' }}")
    sp = " " * ind
    out = [f"{sp}<DataTable", f"{sp}  wrapHeaders", f"{sp}  minWidth=\"520px\"", f"{sp}  caption=\"{curly(caption)}\"",
           f"{sp}  columns={{["]
    out += [f"{sp}    {c}," for c in cols]
    out += [f"{sp}  ]}}", f"{sp}  rows={{["]
    for r in body:
        cells = ", ".join(f"{keys[k]}: '{curly(re.sub(r'[*]', '', v))}'" for k, v in enumerate(r))
        out.append(f"{sp}    {{ cells: {{ {cells} }} }},")
    out += [f"{sp}  ]}}", f"{sp}/>"]
    return "\n".join(out)


def convert(md: str, slug: str) -> str:
    body = md[md.index("## Body"):md.index("## Fact-check sheet")]
    body = body.split("\n", 1)[1].rsplit("\n---", 1)[0]
    blocks = re.split(r"\n\s*\n", body.strip())
    out = [f"  '{slug}': () => (", "    <>"]
    heading = ""
    for b in blocks:
        b = b.rstrip()
        if b.startswith("### "):
            heading = b[4:].strip()
            out.append(f"\n      <h2>{inline(heading)}</h2>")
        elif b.startswith("|"):
            rows = [[c.strip() for c in ln.strip().strip("|").split("|")] for ln in b.splitlines()]
            out.append(table(rows, heading, 6))
        elif b.startswith("- "):
            items = re.split(r"\n- ", "\n" + b)[1:]
            out.append("      <ul>")
            for it in items:
                text = " ".join(x.strip() for x in it.splitlines())
                out.append("        <li>")
                out.append(wrap(inline(text), 10))
                out.append("        </li>")
            out.append("      </ul>")
        elif re.match(r"1\. ", b):
            # A numbered list. Until 30 Oct this fell through to <p> and printed "1. … 2. … 3." as one paragraph.
            items = re.split(r"\n\d+\. ", "\n" + b)[1:]
            out.append("      <ol>")
            for it in items:
                text = " ".join(x.strip() for x in it.splitlines())
                out.append("        <li>")
                out.append(wrap(inline(text), 10))
                out.append("        </li>")
            out.append("      </ol>")
        else:
            text = " ".join(x.strip() for x in b.splitlines())
            out.append("      <p>")
            out.append(wrap(inline(text), 8))
            out.append("      </p>")
    out += ["    </>", "  ),"]
    return "\n".join(out)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(convert(Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[2]))
