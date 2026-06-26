"""Tests for split detection in the daily refresh.

Detection is driven by yfinance's authoritative split *actions* calendar, surfaced
by the provider on ``df.attrs['recent_splits']`` — not a price heuristic, so a
normal price move never triggers a re-pull.
"""

import pandas as pd

from analytics.cron.daily_refresh import _recent_splits


def _bars(*, splits: list[str] | None = None) -> pd.DataFrame:
    idx = pd.date_range("2026-05-01", periods=3, freq="B")
    df = pd.DataFrame({"Close": [10.0, 10.5, 11.0]}, index=idx)
    if splits is not None:
        df.attrs["recent_splits"] = splits
    return df


def test_returns_split_dates_when_present() -> None:
    df = _bars(splits=["2026-05-04"])
    assert _recent_splits(df) == ["2026-05-04"]


def test_empty_when_no_split_in_window() -> None:
    assert _recent_splits(_bars(splits=[])) == []


def test_empty_when_attr_missing() -> None:
    # A df from a path that never set the attr (e.g. stooq) must not error.
    assert _recent_splits(_bars()) == []


def test_normal_price_move_does_not_trigger() -> None:
    # A 40% one-day drop with NO split action ⇒ no re-pull (the whole point: real
    # moves aren't in the split calendar, unlike an 8%-ratio heuristic).
    idx = pd.date_range("2026-05-01", periods=2, freq="B")
    crash = pd.DataFrame({"Close": [10.0, 6.0]}, index=idx)
    crash.attrs["recent_splits"] = []
    assert _recent_splits(crash) == []
