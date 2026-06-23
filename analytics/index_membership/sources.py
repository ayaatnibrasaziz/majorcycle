"""Free ETF-holdings fetchers for current index constituents (US / AU / CA).

Each index maps to the canonical free ETF that replicates it, so the ETF's
published holdings file IS the constituent list:

    S&P 500     → SPY  (State Street SPDR) — daily .xlsx
    S&P/ASX 200 → IOZ  (iShares Core)      — daily .csv
    S&P/TSX 60  → XIU  (iShares)           — daily .csv

(BlackRock's US IVV is consent-gated and won't serve a file to a headless cron;
SPY's State Street file is ungated, so US uses SPY.)

As in `analytics/listings/sources.py`, each market is a pure ``parse_*`` function
(operates on already-downloaded text/DataFrame, so it is unit-testable offline)
plus a thin ``fetch_*`` that does the network call. Every source URL has an env-var
override so a source that changes host/format can be repointed WITHOUT a code change.

Ticker output is yfinance storage format (CLAUDE.md #14): US bare with class shares
dashed (``BRK-B``), AU ``.AX``, CA ``.TO``. We deliberately do NOT apply the listings
name-exclusion filter here — it screens out ``units``/``stapled``/``trust``, which
would wrongly drop legitimate index constituents (e.g. Goodman Group Units,
Transurban Stapled Units). The holdings files already contain only the index's
equities; we additionally keep only rows whose Asset Class is ``Equity`` so the
cash/derivative line is excluded.

This module fetches a symbol list only — never price/fundamental data — so it does
not import yfinance (#9 intact).
"""

from __future__ import annotations

import csv
import io
import logging
import os
import re
from typing import Optional

import pandas as pd
import requests

logger = logging.getLogger(__name__)

_UA = "Mozilla/5.0 (compatible; MajorCycleBot/1.0; +https://majorcycle.com)"
_TIMEOUT = 30

# --- Source URLs (env-overridable) ------------------------------------------
_SPY_URL = os.environ.get(
    "SPY_HOLDINGS_URL",
    "https://www.ssga.com/us/en/intermediary/etfs/library-content/products/"
    "fund-data/etfs/us/holdings-daily-us-en-spy.xlsx",
)
_IOZ_URL = os.environ.get(
    "IOZ_HOLDINGS_URL",
    "https://www.blackrock.com/au/products/251852/ishares-core-s-and-p-asx-200-etf/"
    "1478358644060.ajax?fileType=csv&fileName=IOZ_holdings&dataType=fund",
)
_XIU_URL = os.environ.get(
    "XIU_HOLDINGS_URL",
    "https://www.blackrock.com/ca/investors/en/products/239832/ishares-sptsx-60-index-etf/"
    "1464253357814.ajax?fileType=csv&fileName=XIU_holdings&dataType=fund",
)

# Acceptable yfinance symbol shapes per market (after normalisation). These drop
# placeholder/cash rows (e.g. SPY's "CASH_USD", "-", Bloomberg-style "2602335D").
_US_RE = re.compile(r"^[A-Z]{1,5}(-[A-Z]{1,2})?$")
# AU codes may start with a digit (e.g. 360.AX = Life360), so leading digits are
# allowed. US/CA root symbols are alphabetic, so requiring a leading letter drops
# issuer placeholder rows (SPY "2602335D", XIU "2299955D") without losing real names.
_AU_BASE_RE = re.compile(r"^[A-Z0-9]{1,6}$")
_CA_BASE_RE = re.compile(r"^[A-Z][A-Z0-9]{0,7}(-[A-Z]{1,3})?$")


def _dedupe_sorted(tickers: list[str]) -> list[str]:
    return sorted(set(tickers))


# === US — SPY holdings (.xlsx) =============================================

def parse_spy_xlsx(raw: pd.DataFrame) -> list[str]:
    """Parse an SPY holdings sheet read with ``header=None`` into yfinance US tickers.

    The file has a few preamble rows (Fund Name / Ticker Symbol / Holdings date),
    a header row (``Name, Ticker, Identifier, SEDOL, Weight, Sector, …``), the
    constituent rows, then trailing blank + disclaimer rows. We locate the header
    row dynamically (robust to preamble shifts), then keep rows whose Ticker is a
    valid US symbol. Class shares use a dot in the file (``BRK.B``) → dashed.
    """
    header_idx: Optional[int] = None
    for i, row in raw.iterrows():
        vals = [str(v).strip() for v in row.tolist()]
        if "Ticker" in vals and "Name" in vals:
            header_idx = int(i)  # type: ignore[arg-type]
            break
    if header_idx is None:
        logger.warning("SPY holdings: no 'Ticker'/'Name' header row found")
        return []

    cols = [str(v).strip() for v in raw.iloc[header_idx].tolist()]
    try:
        tkr_col = cols.index("Ticker")
    except ValueError:
        return []

    out: list[str] = []
    for _, row in raw.iloc[header_idx + 1:].iterrows():
        raw_t = row.iloc[tkr_col]
        if not isinstance(raw_t, str):
            continue
        t = raw_t.strip().upper().replace(".", "-").replace("/", "-")
        if _US_RE.fullmatch(t):
            out.append(t)
    return _dedupe_sorted(out)


def fetch_sp500() -> list[str]:
    resp = requests.get(_SPY_URL, headers={"User-Agent": _UA}, timeout=_TIMEOUT)
    resp.raise_for_status()
    raw = pd.read_excel(io.BytesIO(resp.content), header=None, engine="openpyxl")
    tickers = parse_spy_xlsx(raw)
    logger.info("S&P 500 constituents: %d (SPY)", len(tickers))
    return tickers


# === iShares holdings (.csv) — AU (IOZ) / CA (XIU) =========================

def parse_ishares_csv(text: str, *, suffix: str, base_re: re.Pattern[str]) -> list[str]:
    """Parse an iShares holdings CSV into yfinance tickers.

    Layout: ``Fund Holdings as of,"<date>"`` + a blank line, then a header row
    (``Ticker,Name,Sector,Asset Class,…``), the holdings, then a footer note. We
    scan for the header row, keep rows whose Asset Class is ``Equity`` (drops the
    cash/derivatives line), and append the market suffix (``.AX`` / ``.TO``). A
    dotted base (class/unit share, e.g. ``GIB.A``) is dashed → ``GIB-A.TO``.
    """
    lines = text.splitlines()
    header_idx = next(
        (i for i, ln in enumerate(lines) if ln.lower().startswith("ticker,")),
        None,
    )
    if header_idx is None:
        logger.warning("iShares holdings: no 'Ticker,' header row found")
        return []

    reader = csv.DictReader(io.StringIO("\n".join(lines[header_idx:])))
    out: list[str] = []
    for row in reader:
        if (row.get("Asset Class") or "").strip() != "Equity":
            continue
        base = (row.get("Ticker") or "").strip().upper().replace(".", "-")
        if base_re.fullmatch(base):
            out.append(f"{base}{suffix}")
    return _dedupe_sorted(out)


def fetch_asx200() -> list[str]:
    resp = requests.get(_IOZ_URL, headers={"User-Agent": _UA}, timeout=_TIMEOUT)
    resp.raise_for_status()
    tickers = parse_ishares_csv(resp.text, suffix=".AX", base_re=_AU_BASE_RE)
    logger.info("ASX 200 constituents: %d (IOZ)", len(tickers))
    return tickers


def fetch_tsx60() -> list[str]:
    resp = requests.get(_XIU_URL, headers={"User-Agent": _UA}, timeout=_TIMEOUT)
    resp.raise_for_status()
    tickers = parse_ishares_csv(resp.text, suffix=".TO", base_re=_CA_BASE_RE)
    logger.info("S&P/TSX 60 constituents: %d (XIU)", len(tickers))
    return tickers
