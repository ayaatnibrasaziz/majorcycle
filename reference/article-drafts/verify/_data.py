"""The ONE place that knows how the frozen article data is stored on disk.

⚠️ Five scripts opened the file directly, each with the absolute path and
``json.load`` written out again. That is five copies of one decision (CLAUDE.md
11c), and the moment the file's *storage* changed — plain JSON to gzip, on
2026-08-30, to take it from 2.47 MB to 0.38 MB — every one of them would have had
to be found and edited. Miss one and it does not fail loudly: it raises a
FileNotFoundError three weeks later, when nobody remembers why.

So: readers ask for the data, never for the file.

⚠️ **The gzip is a storage decision, not a data one.** Every value is byte-for-byte
what it was — same keys, same precision, same row order. ``load()`` still returns a
plain dict, so nothing downstream knows or cares. What it costs is that the file
can no longer be read by clicking it on GitHub; ``dump_readable()`` exists for
that, writing an uncompressed copy anywhere you like without touching the
committed one.
"""
from __future__ import annotations

import gzip
import json
from pathlib import Path
from typing import Any

# `verify/` → `article-drafts/` → `reference/`
REFERENCE = Path(__file__).resolve().parent.parent.parent

DATA = REFERENCE / "drawdown-recovery-2026-08-27-DATA.json.gz"
DIVIDENDS = REFERENCE / "drawdown-recovery-2026-08-27-DIVIDENDS.json"


def load(path: Path = DATA) -> Any:
    """Read a frozen data file, gzipped or not.

    Both forms are accepted deliberately. The audit scripts are run by hand
    months apart, and one of them being handed an uncompressed copy — because
    somebody unzipped it to read it — should not be an error.
    """
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as fh:
            return json.load(fh)
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def save(obj: Any, path: Path = DATA) -> int:
    """Write a frozen data file. Returns the size in bytes.

    ``mtime=0`` so re-running the freeze on unchanged data produces an IDENTICAL
    file. Without it gzip stamps the current time into the header, every rebuild
    shows as a change in git, and a diff stops meaning anything.
    """
    if path.suffix == ".gz":
        with gzip.GzipFile(path, "wb", mtime=0) as raw:
            raw.write(json.dumps(obj, ensure_ascii=False).encode("utf-8"))
    else:
        path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    return path.stat().st_size


def dump_readable(out: Path, path: Path = DATA) -> int:
    """Write an uncompressed, indented copy for reading. Never committed."""
    out.write_text(json.dumps(load(path), ensure_ascii=False, indent=1), encoding="utf-8")
    return out.stat().st_size


if __name__ == "__main__":  # a convenience, not part of any check
    import sys

    if len(sys.argv) > 1:
        n = dump_readable(Path(sys.argv[1]))
        print(f"wrote a readable copy: {sys.argv[1]} ({n / 1e6:.2f} MB)")
    else:
        d = load()
        print(f"{DATA.name}: {DATA.stat().st_size / 1e6:.2f} MB, {len(d['rows'])} rows, "
              f"{sum(len(r['episodes']) for r in d['rows'])} episodes, as at {d['as_at']}")
