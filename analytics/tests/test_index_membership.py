"""Offline tests for the index-membership ETF-holdings parsers (no network)."""

from __future__ import annotations

import pandas as pd

from analytics.index_membership.sources import (
    _AU_BASE_RE,
    _CA_BASE_RE,
    parse_ishares_csv,
    parse_spy_xlsx,
)

# --- SPY (.xlsx) -----------------------------------------------------------

# A header=None-style sheet: preamble rows, the header row, constituents, a cash
# line, an issuer placeholder, then blank + disclaimer rows.
_SPY = pd.DataFrame(
    [
        ["Fund Name:", "SPDR S&P 500 ETF Trust", None, None, None, None],
        ["Ticker Symbol:", "SPY", None, None, None, None],
        ["Holdings:", "As of 22-Jun-2026", None, None, None, None],
        [None, None, None, None, None, None],
        ["Name", "Ticker", "Identifier", "SEDOL", "Weight", "Sector"],
        ["APPLE INC", "AAPL", "037833100", "2046251", "6.79", "-"],
        ["BERKSHIRE HATHAWAY INC CL B", "BRK.B", "084670702", "2073390", "1.7", "-"],
        ["UNITED STATES DOLLAR", "CASH_USD", "-", "-", "0.1", "-"],
        ["PENDING SETTLE", "2602335D", "-", "-", "0.0", "-"],
        [None, None, None, None, None, None],
        ["Before investing, consider the fund's ...", None, None, None, None, None],
    ]
)


def test_parse_spy_xlsx_keeps_equities_dashes_class_shares():
    # Class share dotted → dashed; cash + placeholder + blanks dropped; sorted unique.
    assert parse_spy_xlsx(_SPY) == ["AAPL", "BRK-B"]


def test_parse_spy_xlsx_no_header_returns_empty():
    assert parse_spy_xlsx(pd.DataFrame([["junk", "data"], ["more", "junk"]])) == []


# --- iShares (.csv) — AU (IOZ) / CA (XIU) ----------------------------------

_IOZ = (
    'Fund Holdings as of,"22-June-2026"\n'
    " \n"
    "Ticker,Name,Sector,Asset Class,Market Value,Weight (%)\n"
    '"BHP","BHP GROUP LTD","Materials","Equity","1","11"\n'
    '"GMG","GOODMAN GROUP UNITS","Real Estate","Equity","1","2"\n'
    '"TCL","TRANSURBAN GROUP STAPLED UNITS","Industrials","Equity","1","1"\n'
    '"XPU6","SPI 200 SEP 26","Cash and/or Derivatives","Futures","0","0"\n'
    " \n"
    "Total allocation percentages may not equal 100% due to rounding.\n"
)

_XIU = (
    'Fund Holdings as of,"Jun 22, 2026"\n'
    " \n"
    "Ticker,Name,Sector,Asset Class,Market Value,Weight (%)\n"
    '"RY","ROYAL BANK OF CANADA","Financials","Equity","1","10"\n'
    '"GIB.A","CGI INC","Information Technology","Equity","1","1"\n'
    '"2299955D","PENDING LISTING","-","Equity","0","0"\n'
)


def test_parse_ishares_au_keeps_units_and_stapled_drops_futures():
    # The name-based 'units'/'stapled' exclusion is deliberately NOT applied — these
    # are real ASX 200 constituents. The futures (non-Equity) line is dropped.
    assert parse_ishares_csv(_IOZ, suffix=".AX", base_re=_AU_BASE_RE) == [
        "BHP.AX",
        "GMG.AX",
        "TCL.AX",
    ]


def test_parse_ishares_ca_dashes_class_shares_drops_placeholder():
    # Dotted class share → dashed + suffix; issuer placeholder (leading digit) dropped.
    assert parse_ishares_csv(_XIU, suffix=".TO", base_re=_CA_BASE_RE) == [
        "GIB-A.TO",
        "RY.TO",
    ]


def test_parse_ishares_no_header_returns_empty():
    assert parse_ishares_csv("nothing,useful\nhere,either\n", suffix=".AX", base_re=_AU_BASE_RE) == []
