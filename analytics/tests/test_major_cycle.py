"""Unit tests for cycle math — ta_pivotlow/pivothigh and calculate_cycle_metrics."""

from collections.abc import Sequence

import numpy as np
import pandas as pd

from analytics.major_cycle import (
    CycleParams,
    calculate_cycle_metrics,
    ta_highest,
    ta_lowest,
    ta_pivothigh,
    ta_pivotlow,
)

_MEDIUM = CycleParams(pullback_threshold=-5.0, profit_threshold=5.0, lookback_bars=252)


def _make_df(closes: Sequence[float]) -> pd.DataFrame:
    """Build a minimal OHLCV DataFrame from a close price sequence."""
    closes_arr = np.array(closes, dtype=float)
    n = len(closes_arr)
    dates = pd.date_range("2020-01-01", periods=n, freq="B")
    return pd.DataFrame(
        {
            "Open":   closes_arr * 0.99,
            "High":   closes_arr * 1.01,
            "Low":    closes_arr * 0.99,
            "Close":  closes_arr,
            "Volume": np.ones(n) * 1_000_000,
        },
        index=dates,
    )


class TestTaHighest:
    def test_rolling_max(self) -> None:
        s = pd.Series([1.0, 3.0, 2.0, 5.0, 4.0])
        result = ta_highest(s, 3)
        assert result.iloc[-1] == 5.0
        assert np.isnan(result.iloc[0])  # min_periods not met

    def test_window_of_one(self) -> None:
        s = pd.Series([1.0, 2.0, 3.0])
        result = ta_highest(s, 1)
        assert list(result) == [1.0, 2.0, 3.0]


class TestTaLowest:
    def test_rolling_min(self) -> None:
        s = pd.Series([5.0, 3.0, 4.0, 1.0, 2.0])
        result = ta_lowest(s, 3)
        assert result.iloc[-1] == 1.0
        assert np.isnan(result.iloc[0])

    def test_window_of_one(self) -> None:
        s = pd.Series([5.0, 4.0, 3.0])
        result = ta_lowest(s, 1)
        assert list(result) == [5.0, 4.0, 3.0]


class TestTaPivotlow:
    def test_detects_clear_trough(self) -> None:
        # value at index 5 is a local minimum surrounded by higher values
        vals = [10.0, 9.0, 8.0, 7.0, 6.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
        s = pd.Series(vals, dtype=float)
        result = ta_pivotlow(s, left_bars=5, right_bars=5)
        # pivot placed at index 5 + 5 = 10
        assert result.iloc[10] == 5.0

    def test_no_pivot_when_tied(self) -> None:
        # equal values on the right side — strict inequality fails
        vals = [10.0, 8.0, 6.0, 8.0, 6.0, 8.0, 10.0]
        s = pd.Series(vals, dtype=float)
        result = ta_pivotlow(s, left_bars=2, right_bars=2)
        # index 4 has equal right neighbour at index 4 — not a pivot
        assert np.isnan(result.iloc[4])

    def test_returns_nan_for_short_series(self) -> None:
        s = pd.Series([1.0, 2.0, 1.0])
        result = ta_pivotlow(s, left_bars=5, right_bars=5)
        assert result.isna().all()


class TestTaPivothigh:
    def test_detects_clear_peak(self) -> None:
        vals = [1.0, 2.0, 3.0, 4.0, 5.0, 4.0, 3.0, 2.0, 1.0, 0.0, 0.0]
        s = pd.Series(vals, dtype=float)
        result = ta_pivothigh(s, left_bars=4, right_bars=4)
        # pivot at index 4, placed at index 8
        assert result.iloc[8] == 5.0

    def test_no_pivot_at_plateau(self) -> None:
        vals = [1.0, 2.0, 3.0, 3.0, 2.0, 1.0]
        s = pd.Series(vals, dtype=float)
        result = ta_pivothigh(s, left_bars=2, right_bars=2)
        assert result.isna().all()


class TestCalculateCycleMetrics:
    def test_returns_expected_keys(self) -> None:
        # Create a synthetic long price series (400 bars so medium params work)
        closes = list(range(50, 450)) + list(range(449, 49, -1))  # 400+400 bars... actually we need 400
        closes_400 = closes[:400]
        df = _make_df(closes_400)
        params = CycleParams(pullback_threshold=-5.0, profit_threshold=5.0, lookback_bars=50, pivot_bars=3)
        result = calculate_cycle_metrics(df, params)

        assert "current_close" in result
        assert "current_drawdown_pct" in result
        assert "current_profit_pct" in result
        assert "total_pullback_events" in result
        assert "total_profit_events" in result
        assert "as_of" in result

    def test_drawdown_negative_when_below_high(self) -> None:
        # Price goes up then drops — current drawdown must be negative
        ups = [float(i) for i in range(100, 200)]
        downs = [float(i) for i in range(199, 150, -1)]
        closes = ups + downs
        df = _make_df(closes)
        params = CycleParams(pullback_threshold=-5.0, profit_threshold=5.0, lookback_bars=100, pivot_bars=3)
        result = calculate_cycle_metrics(df, params)
        dd = result["current_drawdown_pct"]
        assert dd is not None
        assert dd < 0

    def test_event_counts_non_negative(self) -> None:
        closes = [float(100 + 20 * np.sin(i * 0.1)) for i in range(400)]
        df = _make_df(closes)
        params = CycleParams(pullback_threshold=-5.0, profit_threshold=5.0, lookback_bars=50, pivot_bars=3)
        result = calculate_cycle_metrics(df, params)
        assert result["total_pullback_events"] >= 0
        assert result["total_profit_events"] >= 0

    def test_insufficient_data_raises_on_analyze(self) -> None:
        from analytics.major_cycle import analyze_ticker
        df = _make_df([100.0] * 10)  # way too short
        params = CycleParams(pullback_threshold=-5.0, profit_threshold=5.0, lookback_bars=252)
        result = analyze_ticker("TEST", df, None, params)
        assert result is None
