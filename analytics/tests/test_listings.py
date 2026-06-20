"""Offline tests for the listings normaliser + source parsers (no network)."""

from __future__ import annotations

from analytics.listings.normalize import (
    dedupe,
    normalize_asx,
    normalize_ca,
    normalize_us,
)
from analytics.listings.sources import (
    parse_asx_csv,
    parse_nasdaqlisted,
    parse_otherlisted,
    parse_tmx_json,
)

# --- normalisation ---------------------------------------------------------

def test_normalize_us_plain_and_class_shares():
    assert normalize_us("AAPL", "Apple Inc.", "NASDAQ", is_etf=False, is_test=False).symbol == "AAPL"
    # Class shares: '.' → '-' (yfinance format).
    assert normalize_us("BRK.B", "Berkshire", "NYSE", is_etf=False, is_test=False).symbol == "BRK-B"


def test_normalize_us_filters_out_non_common():
    assert normalize_us("QQQ", "Invesco QQQ Trust", "NASDAQ", is_etf=True, is_test=False) is None
    assert normalize_us("ZVZZT", "Test Stock", "NASDAQ", is_etf=False, is_test=True) is None
    assert normalize_us("AAPLW", "Apple Inc. Warrant", "NASDAQ", is_etf=False, is_test=False) is None
    assert normalize_us("AB$C", "Junk", "NASDAQ", is_etf=False, is_test=False) is None


def test_normalize_asx_appends_suffix():
    row = normalize_asx("bhp", "BHP Group Limited")
    assert row is not None and row.symbol == "BHP.AX" and row.market == "au" and row.exchange == "ASX"


def test_normalize_ca_tsx_and_venture():
    assert normalize_ca("ENB", "Enbridge Inc.", venture=False).symbol == "ENB.TO"
    assert normalize_ca("GIB.A", "CGI Inc.", venture=False).symbol == "GIB-A.TO"
    assert normalize_ca("ABC", "Junior Co", venture=True).symbol == "ABC.V"


def test_dedupe_keeps_first():
    a = normalize_us("AAPL", "Apple", "NASDAQ", is_etf=False, is_test=False)
    b = normalize_us("AAPL", "Apple dup", "NASDAQ", is_etf=False, is_test=False)
    assert [r.symbol for r in dedupe([a, b])] == ["AAPL"]


# --- source parsers --------------------------------------------------------

_NASDAQ = (
    "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares\n"
    "AAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N\n"
    "ZVZZT|NASDAQ TEST STOCK|G|Y|N|100|N|N\n"
    "QQQ|Invesco QQQ Trust|Q|N|N|100|Y|N\n"
    "File Creation Time: 0102202412:00|||||||\n"
)

_OTHER = (
    "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol\n"
    "BRK.A|Berkshire Hathaway Inc.|N|BRK.A|N|100|N|BRK.A\n"
    "BRK.B|Berkshire Hathaway Inc.|N|BRK.B|N|100|N|BRK.B\n"
    "SPY|SPDR S&P 500 ETF|P|SPY|Y|100|N|SPY\n"
    "File Creation Time: x|||||||\n"
)

_ASX = (
    "ASX listed companies as at 01-Jan-2026,,\n"
    "Company name,ASX code,GICS industry group\n"
    '"BHP GROUP LIMITED",BHP,Materials\n'
    '"COMMONWEALTH BANK OF AUSTRALIA",CBA,Banks\n'
)

_TMX = {
    "results": [
        {"symbol": "ENB", "name": "Enbridge Inc.", "instruments": [{"symbol": "ENB"}]},
        {"symbol": "GIB.A", "name": "CGI Inc.", "instruments": [{"symbol": "GIB.A"}]},
    ]
}


def test_parse_nasdaqlisted():
    assert [r.symbol for r in parse_nasdaqlisted(_NASDAQ)] == ["AAPL"]


def test_parse_otherlisted_keeps_nyse_drops_arca_etf():
    syms = [r.symbol for r in parse_otherlisted(_OTHER)]
    assert syms == ["BRK-A", "BRK-B"]


def test_parse_asx_csv_skips_preamble():
    rows = parse_asx_csv(_ASX)
    assert [r.symbol for r in rows] == ["BHP.AX", "CBA.AX"]
    assert rows[0].name == "BHP GROUP LIMITED"


def test_parse_tmx_json():
    assert [r.symbol for r in parse_tmx_json(_TMX, venture=False)] == ["ENB.TO", "GIB-A.TO"]
