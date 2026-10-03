"""Share-count change is measured on shares OUTSTANDING (beta review B-34, 2026-10-03).

A buyback moves shares into treasury: the ISSUED count stays put, the OUTSTANDING
count falls. Reading "Share Issued" scored 81 buyback companies as exactly 0.0%.
"""
import numpy as np
import pandas as pd

from analytics.providers.yfinance_provider import shares_change_pct


def _sheet(rows: dict[str, list[float]]) -> pd.DataFrame:
    cols = pd.to_datetime(["2025-12-31", "2024-12-31"])
    return pd.DataFrame(rows, index=cols).T


def test_a_buyback_shows_even_though_issued_shares_did_not_move():
    bs = _sheet({"Share Issued": [924e6, 924e6], "Ordinary Shares Number": [660e6, 680e6]})
    assert shares_change_pct(bs) == round((660e6 - 680e6) / 680e6 * 100, 4)


def test_issued_is_only_a_fallback():
    assert shares_change_pct(_sheet({"Share Issued": [110.0, 100.0]})) == 10.0


def test_a_dollar_row_is_never_read_as_a_share_count():
    # CONTROL: "Common Stock" is a dollar amount; the old code fell back to it.
    assert shares_change_pct(_sheet({"Common Stock": [5e9, 4e9]})) is None


def test_missing_or_zero_prior_year_gives_nothing():
    assert shares_change_pct(_sheet({"Ordinary Shares Number": [100.0, np.nan]})) is None
    assert shares_change_pct(_sheet({"Ordinary Shares Number": [100.0, 0.0]})) is None
    assert shares_change_pct(None) is None
    assert shares_change_pct(pd.DataFrame()) is None


def test_a_gap_in_the_outstanding_row_falls_back_to_issued():
    bs = _sheet({"Ordinary Shares Number": [np.nan, 680e6], "Share Issued": [102.0, 100.0]})
    assert shares_change_pct(bs) == 2.0
