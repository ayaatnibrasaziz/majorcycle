"""Free public exchange symbol-directory fetchers (US / AU / CA).

No API key, no rate limit. Each market is split into a pure ``parse_*`` function
(operates on already-downloaded text/JSON, so it is unit-testable offline) and a
thin ``fetch_*`` function that does the network call. Every source URL has an
env-var override so a source that changes format/host can be repointed WITHOUT a
code change (diagnosability/fixability — see CLAUDE.md "build a safety net").

This module is a symbol directory only — it never fetches price/fundamental data,
so it does not import yfinance (#9 intact).
"""

from __future__ import annotations

import csv
import io
import logging
import os
import time
from typing import Any

import requests

from analytics.listings.normalize import (
    ListingRow,
    dedupe,
    normalize_asx,
    normalize_ca,
    normalize_us,
)

logger = logging.getLogger(__name__)

_UA = "Mozilla/5.0 (compatible; MajorCycleBot/1.0; +https://majorcycle.com)"
_TIMEOUT = 30

# --- Source URLs (env-overridable) ------------------------------------------
#
# ⚠️ `os.environ.get(k) or default`, never `os.environ.get(k, default)`. The second
# form returns the EMPTY STRING when the variable exists and is blank — which is
# exactly what a GitHub workflow input that nobody filled in looks like — and an
# empty URL would blank the source rather than fall back to it. That is the same
# family as the failure this file already documents below: a source that stops
# working without anything going wrong.
_NASDAQ_LISTED_URL = os.environ.get("NASDAQ_LISTED_URL") or (
    "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
)
_NASDAQ_OTHER_URL = os.environ.get("NASDAQ_OTHER_URL") or (
    "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"
)
# ⚠️ The obvious address — https://www.asx.com.au/asx/research/ASXListedCompanies.csv
# — STOPPED WORKING on 2026-07-24 and nobody noticed for a month (audit F-027). It
# did not start failing; it started lying. The ASX put Imperva bot protection in
# front of it, and it now answers:
#
#     HTTP 200 · text/html · 379 bytes
#     <html><head><title>Request Rejected</title></head>…
#
# A rejection wearing a success code. `raise_for_status()` passes, nothing raises,
# and only the CONTENT is wrong — so `parse_asx_csv` found no header row, returned
# an empty list, and the nightly job logged a warning and carried on green.
#
# This is the directory the ASX's own website reads, and it returns the identical
# `"ASX code","Company name"` header, so the parser below is unchanged.
_ASX_URL = os.environ.get("ASX_LISTINGS_URL") or (
    "https://asx.api.markitdigital.com/asx-research/1.0/companies/directory/file"
    "?access_token=83ff96335c2d45a094df02a206a39ff4"
)
_TMX_URL = os.environ.get("TMX_DIRECTORY_URL") or (
    "https://www.tsx.com/json/company-directory/search"
)

# NASDAQ otherlisted exchange codes we keep (primary common-stock venues). P/Z/V
# (NYSE Arca / Cboe / IEX) are overwhelmingly ETFs/funds → skipped.
_OTHER_EXCHANGE = {"N": "NYSE", "A": "NYSE American"}

_TMX_QUERY_KEYS = "abcdefghijklmnopqrstuvwxyz0123456789"


# === US — NASDAQ Trader symbol directory ===================================

def parse_nasdaqlisted(text: str) -> list[ListingRow]:
    """Parse nasdaqlisted.txt (pipe-delimited). Footer line is dropped."""
    rows: list[ListingRow] = []
    reader = csv.DictReader(io.StringIO(text), delimiter="|")
    for r in reader:
        symbol = (r.get("Symbol") or "").strip()
        if not symbol or symbol.startswith("File Creation Time"):
            continue
        out = normalize_us(
            symbol,
            r.get("Security Name"),
            "NASDAQ",
            is_etf=(r.get("ETF") or "").strip().upper() == "Y",
            is_test=(r.get("Test Issue") or "").strip().upper() == "Y",
        )
        if out:
            rows.append(out)
    return rows


def parse_otherlisted(text: str) -> list[ListingRow]:
    """Parse otherlisted.txt (NYSE / NYSE American etc.). Footer line is dropped."""
    rows: list[ListingRow] = []
    reader = csv.DictReader(io.StringIO(text), delimiter="|")
    for r in reader:
        symbol = (r.get("ACT Symbol") or "").strip()
        if not symbol or symbol.startswith("File Creation Time"):
            continue
        exchange = _OTHER_EXCHANGE.get((r.get("Exchange") or "").strip().upper())
        if exchange is None:
            continue
        out = normalize_us(
            symbol,
            r.get("Security Name"),
            exchange,
            is_etf=(r.get("ETF") or "").strip().upper() == "Y",
            is_test=(r.get("Test Issue") or "").strip().upper() == "Y",
        )
        if out:
            rows.append(out)
    return rows


def fetch_us() -> list[ListingRow]:
    nasdaq = requests.get(_NASDAQ_LISTED_URL, headers={"User-Agent": _UA}, timeout=_TIMEOUT)
    nasdaq.raise_for_status()
    other = requests.get(_NASDAQ_OTHER_URL, headers={"User-Agent": _UA}, timeout=_TIMEOUT)
    other.raise_for_status()
    rows = dedupe(parse_nasdaqlisted(nasdaq.text) + parse_otherlisted(other.text))
    logger.info("US listings: %d symbols (NASDAQ + NYSE/American)", len(rows))
    return rows


# === AU — ASX listed companies =============================================

def parse_asx_csv(text: str) -> list[ListingRow]:
    """Parse the ASX listed-companies CSV. The header row (with 'ASX code') may be
    preceded by a title/blank line, so we scan for it first."""
    lines = text.splitlines()
    header_idx = next(
        (i for i, ln in enumerate(lines) if "asx code" in ln.lower()), None
    )
    if header_idx is None:
        logger.warning("ASX CSV: no 'ASX code' header row found")
        return []
    reader = csv.DictReader(io.StringIO("\n".join(lines[header_idx:])))
    # Resolve the column names case-insensitively (header casing varies).
    fields = {(f or "").strip().lower(): f for f in (reader.fieldnames or [])}
    code_col = fields.get("asx code")
    name_col = next((fields[k] for k in fields if "company" in k or "name" in k), None)
    if not code_col:
        return []
    rows: list[ListingRow] = []
    for r in reader:
        out = normalize_asx(r.get(code_col, ""), r.get(name_col) if name_col else None)
        if out:
            rows.append(out)
    return rows


def fetch_au() -> list[ListingRow]:
    resp = requests.get(_ASX_URL, headers={"User-Agent": _UA}, timeout=_TIMEOUT)
    resp.raise_for_status()
    rows = dedupe(parse_asx_csv(resp.text))
    logger.info("AU listings: %d symbols (ASX)", len(rows))
    return rows


# === CA — TMX company directory (TSX + TSX Venture) ========================

def parse_tmx_json(payload: dict[str, Any], *, venture: bool) -> list[ListingRow]:
    """Parse one TMX company-directory JSON page into rows. Each result may list
    several `instruments` (share classes); we take each instrument's symbol."""
    rows: list[ListingRow] = []
    for result in payload.get("results") or []:
        name = result.get("name")
        instruments = result.get("instruments") or []
        symbols = [i.get("symbol") for i in instruments if i.get("symbol")]
        if not symbols and result.get("symbol"):
            symbols = [result["symbol"]]
        for sym in symbols:
            out = normalize_ca(sym, name, venture=venture)
            if out:
                rows.append(out)
    return rows


def _fetch_tmx_exchange(exchange: str, *, venture: bool) -> list[ListingRow]:
    rows: list[ListingRow] = []
    for key in _TMX_QUERY_KEYS:
        try:
            resp = requests.get(
                f"{_TMX_URL}/{exchange}/{key}",
                headers={"User-Agent": _UA, "Accept": "application/json"},
                timeout=_TIMEOUT,
            )
            resp.raise_for_status()
            rows.extend(parse_tmx_json(resp.json(), venture=venture))
        except Exception as e:  # one bad key must not sink the whole market
            logger.warning("TMX %s/%s query failed: %s", exchange, key, e)
        time.sleep(0.2)
    return rows


def fetch_ca() -> list[ListingRow]:
    # TSX **and** TSX Venture. Venture was off until 2026-08-25, by an explicit
    # product choice rather than a technical block — the routing limitation the old
    # comment here used to cite was fixed on 2026-08-04: `.V` classifies as `ca` in
    # web/lib/ticker.ts, in both `_infer_market`s and in the Results columns, and a
    # venture symbol KEEPS its suffix in the URL (`/stocks/ca/ABC.V`) so it can
    # never collide with `ABC.TO` (CLAUDE.md #14).
    #
    # Turned on by owner decision (audit F-028). The audit's data sweep is what
    # prompted the question: the method calls for checking a `.V` ticker end to end,
    # and there were **zero** in `stocks`, in all 9,136 `listings` rows, and in the
    # request queue — so a whole documented code path had no data behind it and
    # could not be checked at all. It roughly doubles the Canadian request menu
    # with micro-caps; that is the intended trade.
    #
    # Fetched as two independent calls so a TSXV outage cannot take TSX with it —
    # `_fetch_tmx_exchange` already swallows per-query failures for the same reason.
    rows = dedupe(
        _fetch_tmx_exchange("tsx", venture=False)
        + _fetch_tmx_exchange("tsxv", venture=True)
    )
    logger.info("CA listings: %d symbols (TSX + TSX Venture)", len(rows))
    return rows
