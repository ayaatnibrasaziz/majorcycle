"""The screener's columnar price fetch must analyse to the SAME numbers.

WHY THIS FILE EXISTS (2026-09-08).

A 761-ticker screen took 1,529s, against ~200s for the same-sized run in June and
July — measured in `analysis_runs`, which stores started_at/finished_at. Timed on
the live database, the cause was not the scan:

    get_price_bars_json('AAPL')                826 ms   1,809,324 bytes
    the same scan with no jsonb per row         18 ms
    get_cycle_bars_json('AAPL')                 15 ms     785,322 bytes

`get_price_bars_json` builds one jsonb OBJECT per bar — 11,525 of them for AAPL —
so at 761 tickers a single screen spent roughly 630 seconds of database CPU
writing the same six key names over and over. The screener now reads a columnar
function carrying only High, Low and Close, which is all `calculate_cycle_metrics`
has ever used.

⚠️ THE RISK THAT MATTERS IS NOT SPEED, IT IS DRIFT. Two encodings of one price
history is exactly the shape CLAUDE.md 11c-iii records: a second implementation
that shares a spec and still parts company, silently, in a plausible-looking
number. It nearly happened here — the first draft used `array_agg(high::float8)`,
and Postgres renders a float8 at 15 significant digits by default, so every price
came back ~1e-13 away from the stored numeric. A 25-ticker comparison matched
**zero** of them. The shipped function aggregates the numeric's own text, which
is exact by construction and also the fastest of the three encodings tried.

So this file drives the REAL `_bars_to_df` and `_columns_to_df` out of
web/api/analyze.py, feeds both the same bars in the two wire shapes, and asserts
the full `CycleAnalysis` comes out identical — with a control proving the
comparison can fail, because a comparison that has never failed is not evidence
(11p).

Pure and credential-free: no database, no network, so it runs anywhere.
"""

from __future__ import annotations

import dataclasses
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import numpy as np
import pandas as pd
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
ANALYZE_PY = REPO_ROOT / "web" / "api" / "analyze.py"


def _load_analyze_module() -> ModuleType:
    """Import web/api/analyze.py by path (same shim as test_cycle_handler)."""
    spec = importlib.util.spec_from_file_location("mc_api_analyze", ANALYZE_PY)
    assert spec and spec.loader, f"could not load {ANALYZE_PY}"
    module = importlib.util.module_from_spec(spec)
    sys.modules["mc_api_analyze"] = module
    spec.loader.exec_module(module)
    return module


az = _load_analyze_module()

from _engine.major_cycle import CycleParams, analyze_ticker  # noqa: E402

BARS = 400
PARAMS = CycleParams(pullback_threshold=-5.0, profit_threshold=5.0, lookback_bars=252)


def _frame() -> pd.DataFrame:
    """A deterministic frame with real pullbacks and rallies for the pivot logic."""
    idx = pd.date_range("2020-01-01", periods=BARS, freq="B")
    close = 100 + 20 * np.sin(np.linspace(0, 6 * np.pi, BARS))
    return pd.DataFrame(
        {
            "Open": close * 0.995,
            "High": close * 1.01,
            "Low": close * 0.99,
            "Close": close,
            "Volume": np.full(BARS, 1_000_000),
        },
        index=idx,
    )


def _as_row_objects(df: pd.DataFrame) -> list[dict[str, Any]]:
    """The wire shape `get_price_bars_json` returns: one object per bar."""
    cols = {c: [repr(float(v)) for v in df[c].to_numpy()] for c in ("Open", "High", "Low", "Close")}
    vol = [int(v) for v in df["Volume"].to_numpy()]
    return [
        {
            "date": ts.strftime("%Y-%m-%d"),
            "open": cols["Open"][i],
            "high": cols["High"][i],
            "low": cols["Low"][i],
            "close": cols["Close"][i],
            "volume": vol[i],
        }
        for i, ts in enumerate(df.index)
    ]


def _as_columns(df: pd.DataFrame) -> dict[str, Any]:
    """The wire shape `get_cycle_bars_json` returns: four comma-joined strings.

    Values are the numeric's OWN TEXT — the whole reason the two paths agree to
    the last digit — joined by `string_agg` rather than boxed in a jsonb array,
    which halves the database's work again.
    """
    return {
        "n": len(df),
        "d": ",".join(ts.strftime("%Y-%m-%d") for ts in df.index),
        "h": ",".join(repr(float(v)) for v in df["High"].to_numpy()),
        "l": ",".join(repr(float(v)) for v in df["Low"].to_numpy()),
        "c": ",".join(repr(float(v)) for v in df["Close"].to_numpy()),
    }


def test_the_two_wire_shapes_analyse_identically() -> None:
    src = _frame()
    df_rows = az._bars_to_df(_as_row_objects(src))
    df_cols = az._columns_to_df(_as_columns(src))
    assert df_cols is not None

    a_rows = analyze_ticker("TEST", df_rows, None, PARAMS)
    a_cols = analyze_ticker("TEST", df_cols, None, PARAMS)
    assert a_rows is not None and a_cols is not None
    assert dataclasses.asdict(a_rows) == dataclasses.asdict(a_cols)

    # The screener's own extra field is computed off the same frame.
    assert az._screener_fundamentals(None, df_rows) == az._screener_fundamentals(None, df_cols)


def test_control_the_comparison_can_fail() -> None:
    """A wrong price in the last bar must be caught.

    Without this, `test_the_two_wire_shapes_analyse_identically` is satisfied by
    any two paths that happen to agree — including two that are both broken the
    same way. One ten-thousandth of a dollar is deliberately tiny: it is below
    anything a reader would see and still moves the drawdown percentage.
    """
    src = _frame()
    cols = _as_columns(src)
    parts = cols["c"].split(",")
    parts[-1] = repr(float(src["Close"].iloc[-1]) + 0.0001)
    cols["c"] = ",".join(parts)

    a_rows = analyze_ticker("TEST", az._bars_to_df(_as_row_objects(src)), None, PARAMS)
    df_cols = az._columns_to_df(cols)
    assert df_cols is not None
    a_cols = analyze_ticker("TEST", df_cols, None, PARAMS)
    assert a_rows is not None and a_cols is not None
    assert dataclasses.asdict(a_rows) != dataclasses.asdict(a_cols)


def test_the_frame_carries_only_what_the_analysis_reads() -> None:
    """High/Low/Close and a real date index — no Open, no Volume.

    Dropping those two is half the payload saving, and it is only safe because
    nothing downstream touches them. If a future change starts reading Open or
    Volume in the screener path, this is the test that says so rather than the
    reader seeing a KeyError in production.
    """
    df = az._columns_to_df(_as_columns(_frame()))
    assert df is not None
    assert list(df.columns) == ["High", "Low", "Close"]
    assert isinstance(df.index, pd.DatetimeIndex)
    # The dates are REAL, not synthesised — `as_of` is read off the last one.
    assert df.index[-1].strftime("%Y-%m-%d") == _frame().index[-1].strftime("%Y-%m-%d")


def test_misaligned_columns_are_loud() -> None:
    """Four aggregates over one scan cannot disagree — but if they ever did,
    pandas would NaN-pad the short one and the frame would go quietly out of
    alignment. A wrong number that looks right is this repo's whole failure
    catalogue, so the impossible case raises rather than being assumed away."""
    cols = _as_columns(_frame())
    cols["h"] = ",".join(cols["h"].split(",")[:-1])
    with pytest.raises(ValueError, match="misaligned columns"):
        az._columns_to_df(cols)


def test_a_declared_count_that_disagrees_is_loud() -> None:
    cols = _as_columns(_frame())
    cols["n"] = len(cols["d"].split(",")) + 1
    with pytest.raises(ValueError, match="but sent"):
        az._columns_to_df(cols)


def test_no_bars_is_not_an_error() -> None:
    """A ticker with no history is `None`, the same answer the row path gives —
    'I could not read it' and 'it does not exist' must not share a value (11e),
    and here the absence is genuine."""
    assert az._columns_to_df({"n": 0, "d": "", "h": "", "l": "", "c": ""}) is None
