"""Provider-level tests for YFinanceProvider.

Focus: the split-detection sanity guard (`_MIN_SPLIT_DEVIATION`). A genuine split
is surfaced on ``df.attrs['recent_splits']`` / ``recent_split_events``; a spurious
near-1.0 "split" (e.g. SPGI 1.057) must be dropped so it never creates an
un-resolvable pending split_events row. yfinance is fully mocked — no network.
"""
from unittest.mock import MagicMock, patch

import pandas as pd

from analytics.providers.yfinance_provider import YFinanceProvider


def _history_with_splits() -> pd.DataFrame:
    """A short OHLCV frame whose Stock Splits column carries one REAL split (2.0)
    and one PHANTOM near-1.0 value (1.057, like SPGI 2026-07-01)."""
    idx = pd.to_datetime(
        ["2026-06-25", "2026-06-26", "2026-06-29", "2026-06-30", "2026-07-01"]
    )
    return pd.DataFrame(
        {
            "Open": [10.0, 10.0, 10.0, 10.0, 10.0],
            "High": [11.0, 11.0, 11.0, 11.0, 11.0],
            "Low": [9.0, 9.0, 9.0, 9.0, 9.0],
            "Close": [10.0, 10.0, 10.0, 10.0, 10.0],
            "Volume": [100, 100, 100, 100, 100],
            "Stock Splits": [0.0, 2.0, 0.0, 0.0, 1.057],
        },
        index=idx,
    )


def _provider() -> YFinanceProvider:
    # install_cache() is a global side effect (writes a sqlite cache file) — stub it.
    with patch(
        "analytics.providers.yfinance_provider.requests_cache.install_cache"
    ):
        return YFinanceProvider()


def _download(df: pd.DataFrame):
    provider = _provider()
    fake_ticker = MagicMock()
    fake_ticker.history.return_value = df
    with patch(
        "analytics.providers.yfinance_provider.yf.Ticker", return_value=fake_ticker
    ):
        # period != "max" skips the _MIN_BARS gate so a tiny fixture is enough.
        return provider._download_yfinance("TEST", period="1mo")


def test_phantom_near_one_split_is_ignored() -> None:
    out, _ = _download(_history_with_splits())
    assert out is not None

    ratios = [e["ratio"] for e in out.attrs["recent_split_events"]]
    # The real 2-for-1 survives; the phantom 1.057 is dropped.
    assert 2.0 in ratios
    assert 1.057 not in ratios
    assert all(abs(r - 1.0) >= 0.10 for r in ratios)

    # The phantom's date is also excluded from the re-pull trigger list.
    assert "2026-07-01" not in out.attrs["recent_splits"]
    assert "2026-06-26" in out.attrs["recent_splits"]


def test_real_split_still_recorded() -> None:
    df = _history_with_splits()
    df["Stock Splits"] = [0.0, 0.0, 0.0, 0.0, 4.0]  # a clean 4-for-1
    out, _ = _download(df)
    assert out is not None
    ratios = [e["ratio"] for e in out.attrs["recent_split_events"]]
    assert ratios == [4.0]
    assert out.attrs["recent_splits"] == ["2026-07-01"]


# --------------------------------------------------------------------------
# Timezone: a daily bar must keep the EXCHANGE'S OWN calendar date.
#
# yfinance stamps each daily bar at midnight in the exchange's timezone, so the
# local date IS the trading date. Converting to UTC first is silently harmless
# for exchanges west of Greenwich and silently WRONG for Sydney, which is why
# this shipped unnoticed: every ASX bar was stored one day early for the whole
# history (0 Fridays and ~50 Sundays a year) while US/CA looked perfect.
#
# The US case is not padding — it is the control that proves the fix is a real
# correction and not a blanket +1 applied to everybody.
# --------------------------------------------------------------------------

def _ohlcv(dates: list[str], tz: str) -> pd.DataFrame:
    """OHLCV frame indexed at midnight LOCAL time, as yfinance returns it."""
    idx = pd.to_datetime(dates).tz_localize(tz)
    n = len(dates)
    return pd.DataFrame(
        {
            "Open": [10.0] * n,
            "High": [11.0] * n,
            "Low": [9.0] * n,
            "Close": [10.0] * n,
            "Volume": [100] * n,
            "Stock Splits": [0.0] * n,
        },
        index=idx,
    )


def test_asx_bars_keep_their_sydney_trading_date() -> None:
    """Sydney midnight is 13:00-14:00 UTC the PREVIOUS day — the bug's mechanism."""
    trading_days = ["2026-07-29", "2026-07-30", "2026-07-31", "2026-08-03"]  # Wed-Fri, Mon
    out, _ = _download(_ohlcv(trading_days, "Australia/Sydney"))
    assert out is not None

    stored = [ts.strftime("%Y-%m-%d") for ts in out.index]
    assert stored == trading_days

    # The symptom the live database showed: a weekend date, and no Fridays.
    weekdays = {ts.strftime("%a") for ts in out.index}
    assert "Sun" not in weekdays and "Sat" not in weekdays
    assert "Fri" in weekdays


def test_us_bars_are_unchanged_by_the_fix() -> None:
    """Control: New York midnight is 04:00-05:00 UTC the SAME day, so US/CA data
    was never wrong and must not move."""
    trading_days = ["2026-07-29", "2026-07-30", "2026-07-31", "2026-08-03"]
    out, _ = _download(_ohlcv(trading_days, "America/New_York"))
    assert out is not None
    assert [ts.strftime("%Y-%m-%d") for ts in out.index] == trading_days


def test_asx_split_dates_use_the_local_trading_date() -> None:
    """Split dates are derived from the same index, so they shifted too — and a
    wrong split date misaligns the re-adjustment window."""
    df = _ohlcv(["2026-07-29", "2026-07-30", "2026-07-31"], "Australia/Sydney")
    df["Stock Splits"] = [0.0, 0.0, 2.0]
    out, _ = _download(df)
    assert out is not None
    assert out.attrs["recent_splits"] == ["2026-07-31"]
