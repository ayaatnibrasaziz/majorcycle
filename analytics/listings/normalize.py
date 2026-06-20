"""Pure normalisation: raw exchange symbol → yfinance format.

Side-effect-free (no network, no I/O) so it can be unit-tested offline. The network
fetchers live in `sources.py`. yfinance storage format (CLAUDE.md #14 / data-contracts
§6): US is bare (`AAPL`, class shares dashed `BRK-B`), AU is `.AX`, CA is `.TO` (TSX)
or `.V` (TSX Venture), with class/unit shares dashed (`GIB-A.TO`, `REI-UN.TO`).
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ListingRow:
    """One row destined for the `listings` table."""

    symbol: str            # yfinance format: 'AAPL', 'BHP.AX', 'SHOP.TO', 'GIB-A.TO'
    name: str | None
    exchange: str | None   # 'NASDAQ' | 'NYSE' | 'NYSE American' | 'ASX' | 'TSX' | 'TSXV'
    market: str            # 'us' | 'au' | 'ca'


# Names that are clearly not common stock. The source files don't always give a
# clean type flag, so we screen by security name as a backstop. We deliberately do
# NOT exclude "fund"/"trust" broadly (that would drop legitimate REITs).
_EXCLUDE_NAME = re.compile(
    r"\b(warrants?|rights?|units?|preferred|preference|depositary|depository|"
    r"debenture|when[- ]issued|test\s+stock|ETF|ETN)\b",
    re.IGNORECASE,
)

# Acceptable yfinance symbol shapes per market (after normalisation).
_US_RE = re.compile(r"^[A-Z]{1,5}(-[A-Z]{1,2})?$")
_AU_RE = re.compile(r"^[A-Z0-9]{2,6}$")
_CA_BASE_RE = re.compile(r"^[A-Z0-9]{1,8}(-[A-Z]{1,3})?$")

# Common trailing descriptors to strip from security names for a tidy display name.
_NAME_TAIL = re.compile(
    r"\s*[-,]?\s*(common stock|common shares|ordinary shares|class [a-z] .*|"
    r"the\s*)$",
    re.IGNORECASE,
)


def clean_name(name: str | None) -> str | None:
    """Collapse whitespace + trim a couple of noisy trailing descriptors."""
    if not name:
        return None
    out = re.sub(r"\s+", " ", name).strip()
    out = _NAME_TAIL.sub("", out).strip(" -,")
    return out or None


def _excluded_name(name: str | None) -> bool:
    return bool(name and _EXCLUDE_NAME.search(name))


def normalize_us(
    symbol: str,
    name: str | None,
    exchange: str | None,
    *,
    is_etf: bool,
    is_test: bool,
) -> ListingRow | None:
    """NASDAQ Trader symbol (nasdaqlisted / otherlisted) → yfinance US symbol."""
    if is_etf or is_test or _excluded_name(name):
        return None
    s = (symbol or "").strip().upper().replace(".", "-").replace("/", "-")
    if not _US_RE.fullmatch(s):
        return None
    return ListingRow(symbol=s, name=clean_name(name), exchange=exchange, market="us")


def normalize_asx(code: str, name: str | None) -> ListingRow | None:
    """ASX listed-company code → yfinance AU symbol (`BHP` → `BHP.AX`)."""
    if _excluded_name(name):
        return None
    base = (code or "").strip().upper()
    if not _AU_RE.fullmatch(base):
        return None
    return ListingRow(symbol=f"{base}.AX", name=clean_name(name), exchange="ASX", market="au")


def normalize_ca(symbol: str, name: str | None, *, venture: bool) -> ListingRow | None:
    """TMX symbol → yfinance CA symbol (`GIB.A` → `GIB-A.TO`, venture → `.V`)."""
    if _excluded_name(name):
        return None
    base = (symbol or "").strip().upper().replace(".", "-")
    if not _CA_BASE_RE.fullmatch(base):
        return None
    suffix = ".V" if venture else ".TO"
    exchange = "TSXV" if venture else "TSX"
    return ListingRow(symbol=f"{base}{suffix}", name=clean_name(name), exchange=exchange, market="ca")


def dedupe(rows: list[ListingRow]) -> list[ListingRow]:
    """Keep the first occurrence of each symbol (sources can overlap)."""
    seen: set[str] = set()
    out: list[ListingRow] = []
    for r in rows:
        if r.symbol in seen:
            continue
        seen.add(r.symbol)
        out.append(r)
    return out
