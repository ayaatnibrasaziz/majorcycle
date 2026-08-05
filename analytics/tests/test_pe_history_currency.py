"""A P/E must not divide one currency by another.

`_compute_pe_history` builds its series from exchange prices and income-statement
earnings. For a company that trades in one currency and reports in another, that
is a division of unlike units, and it showed: Barrick's Valuation History chart
read 19.2x while the Key Metrics table on the same page said 10.1x.
"""

from typing import Any

import pandas as pd

from analytics.providers.yfinance_provider import YFinanceProvider


class _FakeTicker:
    """Minimal stand-in: four annual EPS rows and five years of flat prices."""

    def __init__(self) -> None:
        cols = pd.to_datetime(["2022-06-30", "2023-06-30", "2024-06-30", "2025-06-30"])
        self.income_stmt = pd.DataFrame(
            {c: [2.0] for c in cols}, index=["Diluted EPS"]
        )
        self.quarterly_income_stmt = pd.DataFrame()
        idx = pd.date_range("2022-01-31", periods=48, freq="ME")
        self._prices = pd.DataFrame({"Close": [40.0] * len(idx)}, index=idx)

    def history(self, **_: Any) -> pd.DataFrame:
        return self._prices


def _provider() -> YFinanceProvider:
    return YFinanceProvider.__new__(YFinanceProvider)  # skip the cache install


class TestPeHistoryCurrencyGuard:
    def test_same_currency_still_produces_a_series(self) -> None:
        """The control. A US company reporting in USD must be unaffected."""
        out = _provider()._compute_pe_history(
            _FakeTicker(), "AAPL", price_currency="USD", financial_currency="USD"
        )
        assert len(out) > 0
        # price 40 / EPS 2 = 20x
        assert out[-1]["pe"] == 20.0

    def test_mixed_currencies_are_withheld(self) -> None:
        """BHP.AX trades in AUD and reports in USD, so 40 / 2 is not a P/E — it
        is an Australian numerator over an American denominator."""
        out = _provider()._compute_pe_history(
            _FakeTicker(), "BHP.AX", price_currency="AUD", financial_currency="USD"
        )
        assert out == []

    def test_unknown_currency_does_not_withhold(self) -> None:
        """Rows written before `financialCurrency` was read have it as None.
        That is 'unknown', not 'different' — withholding on unknown would blank
        the chart for the whole universe."""
        out = _provider()._compute_pe_history(
            _FakeTicker(), "AAPL", price_currency="USD", financial_currency=None
        )
        assert len(out) > 0

    def test_the_default_call_is_unguarded_but_harmless(self) -> None:
        """Called without currencies at all (the old signature), it still works —
        so a caller that forgets is degraded, not broken. `fetch_enriched_data`
        passes both; `analytics/tests/test_field_spec.py` covers the units side."""
        out = _provider()._compute_pe_history(_FakeTicker(), "AAPL")
        assert len(out) > 0
