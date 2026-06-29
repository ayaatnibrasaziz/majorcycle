"""Tests for split detection + verification in the daily refresh.

Detection is driven by yfinance's authoritative split *actions* calendar, surfaced
by the provider on ``df.attrs['recent_splits']`` / ``recent_split_events`` — not a
price heuristic, so a normal price move never triggers a re-pull. C-R9 adds
post-re-pull verification (``_verify_split_resolved``) + a dated status machine
(``_classify_split``).
"""

from datetime import datetime, timedelta, timezone

import pandas as pd

from analytics.cron.daily_refresh import (
    _SPLIT_RETRY_DAYS,
    _classify_split,
    _recent_split_events,
    _recent_splits,
    _verify_split_resolved,
)


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


# --- _recent_split_events (date + ratio) ---------------------------------------

def test_recent_split_events_returns_date_and_ratio() -> None:
    df = _bars()
    df.attrs["recent_split_events"] = [{"date": "2026-05-04", "ratio": 0.3333}]
    assert _recent_split_events(df) == [{"date": "2026-05-04", "ratio": 0.3333}]


def test_recent_split_events_empty_when_attr_missing() -> None:
    assert _recent_split_events(_bars()) == []


# --- _verify_split_resolved ----------------------------------------------------

def _closes(prices: list[float], start: str = "2026-06-10") -> pd.DataFrame:
    idx = pd.date_range(start, periods=len(prices), freq="B")
    return pd.DataFrame({"Close": prices}, index=idx)


def test_unadjusted_reverse_split_is_unresolved() -> None:
    # DD-like: 1-for-3 reverse (ratio 0.3333 -> expected price factor 3.0). yfinance lists
    # the 2026-06-24 split but leaves a ~3x cliff at 2026-06-18 (note the 6-day mismatch).
    # 06-10..: 6 bars ~48, then jump to ~143 from 2026-06-18 onward.
    df = _closes([48.0] * 6 + [143.0] * 9)  # cliff at index 6 = 2026-06-18
    resolved, cliff_date, cliff_ratio = _verify_split_resolved(df, "2026-06-24", 0.3333)
    assert resolved is False
    assert cliff_date == "2026-06-18"
    assert cliff_ratio is not None and abs(cliff_ratio - 143.0 / 48.0) < 0.01


def test_adjusted_series_is_resolved() -> None:
    # Correctly back-adjusted: no scale cliff near the split ⇒ resolved.
    df = _closes([142.0, 143.0, 144.0, 143.5, 142.5, 143.0, 144.0, 145.0, 144.0, 143.0])
    resolved, cliff_date, cliff_ratio = _verify_split_resolved(df, "2026-06-24", 0.3333)
    assert resolved is True
    assert cliff_date is None and cliff_ratio is None


def test_real_crash_not_misread_as_split() -> None:
    # A real ~-63% one-day crash near a REVERSE split (expected cliff is a 3x jump UP,
    # not a drop) must NOT be flagged as a leftover split ⇒ resolved.
    df = _closes([100.0] * 6 + [37.0] * 9)  # -63% drop at index 6
    resolved, cliff_date, _ = _verify_split_resolved(df, "2026-06-24", 0.3333)
    assert resolved is True
    assert cliff_date is None


def test_transient_dip_not_misread_as_split() -> None:
    # FDX-like (C-R2 review): yfinance reported a dubious 1.241 'split' (expected price
    # factor 1/1.241 ≈ 0.806). A one-day -3.8% dip matches that factor within tolerance but
    # BOUNCES BACK the next day — not a persistent scale shift. The persistence guard must
    # keep it resolved rather than flagging a phantom cliff (which left FDX stuck 'pending').
    df = _closes([330.0] * 6 + [318.0, 337.0, 337.0, 337.0, 337.0])  # dip at index 6, recovers
    resolved, cliff_date, _ = _verify_split_resolved(df, "2026-06-18", 1.241)
    assert resolved is True
    assert cliff_date is None


def test_missing_ratio_falls_back_to_generic_cliff_scan() -> None:
    # With no ratio we can't match a factor, so any large in-window jump is flagged.
    df = _closes([48.0] * 6 + [143.0] * 9)
    resolved, cliff_date, _ = _verify_split_resolved(df, "2026-06-24", None)
    assert resolved is False
    assert cliff_date == "2026-06-18"

    smooth = _closes([142.0, 143.0, 144.0, 143.5, 142.5, 143.0, 144.0])
    assert _verify_split_resolved(smooth, "2026-06-13", None)[0] is True


# --- _classify_split (dated status machine) ------------------------------------

def test_classify_resolved_always_resolved() -> None:
    now = datetime.now(timezone.utc)
    old = now - timedelta(days=99)
    assert _classify_split(old, now, resolved=True) == "resolved"


def test_classify_unresolved_within_window_stays_pending() -> None:
    now = datetime.now(timezone.utc)
    recent = now - timedelta(days=_SPLIT_RETRY_DAYS - 1)
    assert _classify_split(recent, now, resolved=False) == "pending"


def test_classify_unresolved_at_retry_boundary_fails() -> None:
    now = datetime.now(timezone.utc)
    boundary = now - timedelta(days=_SPLIT_RETRY_DAYS)
    assert _classify_split(boundary, now, resolved=False) == "failed"
