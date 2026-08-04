"""Ticker suffix -> market, in BOTH places that decide it.

The rule lives in three files (two here, one in web/lib/ticker.ts). It drifted
once already: `.V` (TSX Venture) is Canadian, but two of the three copies only
knew `.AX` and `.TO`, so a venture stock would have been filed as US — wrong
country badge, wrong benchmark, wrong Browse filter.

Both Python copies are asserted against the SAME table, so one can't be fixed
while the other rots.
"""
import pytest

from analytics.cron.daily_refresh import _infer_market as cron_market
from analytics.providers.yfinance_provider import _infer_market as provider_market

CASES = [
    ("AAPL", "us"),
    ("BRK-B", "us"),
    ("BHP.AX", "au"),
    ("29M.AX", "au"),          # AU codes may start with a digit
    ("SHOP.TO", "ca"),
    ("GIB-A.TO", "ca"),        # dashed class share
    ("ABC.V", "ca"),           # TSX Venture — the drift this guards
    ("XYZ-A.V", "ca"),
]


@pytest.mark.parametrize("ticker,expected", CASES)
def test_provider_infers_market(ticker: str, expected: str) -> None:
    assert provider_market(ticker) == expected


@pytest.mark.parametrize("ticker,expected", CASES)
def test_cron_infers_market(ticker: str, expected: str) -> None:
    assert cron_market(ticker) == expected


@pytest.mark.parametrize("ticker", ["^GSPC", "^AXJO", "^GSPTSE"])
def test_cron_treats_carets_as_indices(ticker: str) -> None:
    """Only the cron copy has the index concept; the provider types Market as
    us/au/ca, so it must NOT grow one."""
    assert cron_market(ticker) == "index"


def test_the_two_copies_agree_on_every_equity_case() -> None:
    """The failure mode is drift, not a single wrong answer."""
    disagreements = [t for t, _ in CASES if cron_market(t) != provider_market(t)]
    assert not disagreements, f"market inference has drifted for: {disagreements}"
