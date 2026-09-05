"""Tests for split detection + verification in the daily refresh.

Detection is driven by yfinance's authoritative split *actions* calendar, surfaced
by the provider on ``df.attrs['recent_splits']`` / ``recent_split_events`` — not a
price heuristic, so a normal price move never triggers a re-pull. C-R9 adds
post-re-pull verification (``_verify_split_resolved``) + a dated status machine
(``_classify_split``).
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd

from analytics.cron.daily_refresh import (
    _SPLIT_RETRY_DAYS,
    _classify_split,
    _recent_split_events,
    _recent_splits,
    _reverify_stored_splits,
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



def test_half_adjusted_series_is_unresolved() -> None:
    """AUDIT 5A-122 — the shape our stored MNST history is actually in.

    MNST split 2:1 on 2026-08-11. Our stored closes alternate between the two bases:

        97.50 / 47.72 / 47.83 / 93.56 / 97.65 / 48.19 / 93.55 / 94.46 / 47.08 / 90.36

    ⚠️ **This test passes on the code as it already stood, and that is the finding.**
    Driven against the real stored series it returns (False, '2026-08-07', 1.9193) —
    the verifier can see this perfectly well. What it never saw is the STORED series:
    it runs once, on the freshly fetched frame, at detection time. The fetched frame
    that night evidently looked clean, the split was written 'resolved', and nothing
    ever compared the answer against what actually landed in the table. 478 of 501
    bars stayed exactly 2x the truth for three weeks, and the page reported a 55.7%
    fall on a stock that had fallen about 11% — rating it High Conviction.

    ⚠️ I first "fixed" this by adding sawtooth detection to this function and reverted
    it: a deliberate break of that new rule left every test green, which showed the
    rule was addressing a shape the existing code already handled (CLAUDE.md 11i/11u).
    The fix is `_reverify_stored_splits`, which closes the loop between what we fetch
    and what we store. This test pins the shape so a later change to the tolerances
    cannot quietly stop seeing it.
    """
    df = _closes(
        [97.50, 47.72, 47.83, 93.56, 97.65, 48.19, 93.55, 94.46, 47.08, 90.36, 45.72],
        start="2026-07-20",
    )
    resolved, cliff_date, cliff_ratio = _verify_split_resolved(df, "2026-08-04", 2.0)
    assert resolved is False
    assert cliff_date is not None and cliff_ratio is not None


def test_clean_two_for_one_series_is_resolved() -> None:
    """The control for the test above: a correctly back-adjusted 2:1 split leaves no
    step anywhere near 0.5 or 2.0, so a clean series must resolve. Without this, a
    verifier that returned False for everything would satisfy the test above."""
    clean = [88.0, 88.6, 87.9, 89.1, 88.4, 89.5, 88.8, 90.0, 89.3, 90.4, 89.7]
    resolved, cliff_date, cliff_ratio = _verify_split_resolved(
        _closes(clean, start="2026-07-20"), "2026-07-28", 2.0
    )
    assert resolved is True
    assert cliff_date is None and cliff_ratio is None



# --- _reverify_stored_splits ---------------------------------------------------
#
# AUDIT 5A-122. The verifier was never wrong; it was never shown the stored series.
# These drive the real function against a stub client, so they are pure and need no
# credentials, and they carry the control that matters: a HEALTHY split must not be
# reopened, or this sweep would re-pull every company's history every night.


class _SplitStub:
    """Minimal Supabase stand-in: two tables, and a record of what was written."""

    def __init__(self, splits: list[dict[str, Any]], bars: list[dict[str, Any]]) -> None:
        self._splits = splits
        self._bars = bars
        self.updates: list[tuple[str, dict[str, Any]]] = []

    # -- query builder (every method returns self; execute() ends it) --
    def table(self, name: str) -> "_SplitStub":
        self._t = name
        self._patch: dict[str, Any] | None = None
        return self

    def select(self, _cols: str) -> "_SplitStub":
        return self

    def eq(self, col: str, val: Any) -> "_SplitStub":
        if col == "id" and self._patch is not None:
            self.updates.append((str(val), self._patch))
        return self

    def gte(self, _c: str, _v: Any) -> "_SplitStub":
        return self

    def lte(self, _c: str, _v: Any) -> "_SplitStub":
        return self

    def order(self, _c: str) -> "_SplitStub":
        return self

    def update(self, patch: dict[str, Any]) -> "_SplitStub":
        self._patch = patch
        return self

    def execute(self) -> Any:
        rows = self._splits if self._t == "split_events" else self._bars
        if self._patch is not None:
            rows = []

        class _Res:
            data = rows

        return _Res()


def _bar_rows(prices: list[float], start: str = "2026-07-20") -> list[dict[str, Any]]:
    idx = pd.date_range(start, periods=len(prices), freq="B")
    return [{"date": d.strftime("%Y-%m-%d"), "close": p} for d, p in zip(idx, prices, strict=True)]


_MNST_STORED = [97.50, 47.72, 47.83, 93.56, 97.65, 48.19, 93.55, 94.46, 47.08, 90.36, 45.72]
_CLEAN_STORED = [88.0, 88.6, 87.9, 89.1, 88.4, 89.5, 88.8, 90.0, 89.3, 90.4, 89.7]


def _split_row(**kw: Any) -> dict[str, Any]:
    row = {
        "id": "row-1",
        "ticker": "MNST",
        "split_date": (datetime.now(timezone.utc).date() - timedelta(days=3)).isoformat(),
        "ratio": 2.0,
        "repull_count": 1,
    }
    row.update(kw)
    return row


def test_reverify_reopens_a_resolved_split_whose_stored_bars_disagree() -> None:
    """The defect: `resolved` written from a clean fetch, over a stored series that
    is anything but. Nothing looked again for three weeks."""
    start = (datetime.now(timezone.utc).date() - timedelta(days=10)).isoformat()
    stub = _SplitStub([_split_row()], _bar_rows(_MNST_STORED, start=start))
    reopened = _reverify_stored_splits(stub)  # type: ignore[arg-type]
    assert reopened == ["MNST"]
    assert len(stub.updates) == 1
    _id, patch = stub.updates[0]
    assert patch["status"] == "pending"
    assert patch["cliff_date"] is not None
    assert "resolved_at" not in patch


def test_reverify_leaves_a_healthy_split_alone() -> None:
    """THE control, and the load-bearing one. A sweep that reopened everything would
    satisfy the test above perfectly while re-pulling every company's full history
    every night — the exact churn that once put 120 rows into a 30-day retry loop."""
    start = (datetime.now(timezone.utc).date() - timedelta(days=10)).isoformat()
    stub = _SplitStub([_split_row()], _bar_rows(_CLEAN_STORED, start=start))
    assert _reverify_stored_splits(stub) == []  # type: ignore[arg-type]
    assert stub.updates == []


def test_reverify_ignores_markets_it_was_not_asked_for() -> None:
    """The AU run must not reopen a US split it is not about to re-pull."""
    start = (datetime.now(timezone.utc).date() - timedelta(days=10)).isoformat()
    stub = _SplitStub([_split_row()], _bar_rows(_MNST_STORED, start=start))
    assert _reverify_stored_splits(stub, markets=["au"]) == []  # type: ignore[arg-type]
    assert stub.updates == []
    # ...and the control: asked for its own market, it still fires.
    stub2 = _SplitStub([_split_row()], _bar_rows(_MNST_STORED, start=start))
    assert _reverify_stored_splits(stub2, markets=["us"]) == ["MNST"]  # type: ignore[arg-type]


def test_reverify_survives_a_database_error() -> None:
    """A sweep that runs last must never take the whole refresh down with it."""

    class _Boom:
        def table(self, _n: str) -> Any:
            raise RuntimeError("connection reset")

    assert _reverify_stored_splits(_Boom()) == []  # type: ignore[arg-type]


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
