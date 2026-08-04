"""Guard: no exchange date may be computed by converting to UTC.

The behavioural tests in test_yfinance_provider.py cover the price index. This
guard covers the call sites that DON'T exist yet -- a new provider, a new
fundamentals field, a future FMP migration -- because the defect is invisible
in review: `tz_convert(None)` looks correct, and is correct for every exchange
west of Greenwich. It shipped for months precisely because US and Canadian data
stayed perfect while every ASX bar was a day early.

Rule: to get an exchange's calendar date from a tz-aware timestamp, use
`tz_localize(None)` (drop the zone, keep local wall time), never
`tz_convert(None)` (convert to UTC first, which moves the date for any exchange
east of Greenwich).
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCANNED = [ROOT / "analytics", ROOT / "web" / "_engine"]
FORBIDDEN = "tz_convert(None)"


def _python_files() -> list[Path]:
    files: list[Path] = []
    for base in SCANNED:
        if base.exists():
            files.extend(p for p in base.rglob("*.py") if p.name != Path(__file__).name)
    return files


def test_scan_actually_finds_files() -> None:
    """A guard that scans nothing passes for the wrong reason."""
    files = _python_files()
    assert len(files) >= 20, f"expected to scan the analytics tree, found {len(files)} files"
    assert any(f.name == "yfinance_provider.py" for f in files), "provider not scanned"


def test_no_tz_convert_to_naive_utc() -> None:
    offenders: list[str] = []
    for path in _python_files():
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if FORBIDDEN in line and not line.lstrip().startswith("#"):
                offenders.append(f"{path.relative_to(ROOT)}:{i}: {line.strip()}")

    assert not offenders, (
        "Found tz_convert(None) — this converts to UTC before dropping the zone, "
        "which shifts the calendar date back a day for any exchange east of "
        "Greenwich (every ASX bar was stored one day early for months). "
        "Use tz_localize(None) to keep the exchange's own date.\n  "
        + "\n  ".join(offenders)
    )
