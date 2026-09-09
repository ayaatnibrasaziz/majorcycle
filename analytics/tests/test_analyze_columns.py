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
from datetime import date
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


# ── the BINARY encoding (get_cycle_bars_b64, 2026-09-09) ─────────────────────
#
# Half the bytes of the text encoding, and — unexpectedly — more accurate. The
# text path runs `pd.to_numeric`, which is a FAST float parser and is not
# correctly rounded: given "0.09812240302562714" it returns 0.0981224030256271,
# and on AAPL's close column it disagrees with Python's `float()` on 4,584 of
# 11,525 values. That parser is in `_bars_to_df` too, so it predates the columnar
# work and has always been in the shipped product.
#
# So the two encodings are NOT bit-identical, and the tests below say which one
# is right rather than asserting an equality that would be false: the decoder
# must equal a CORRECTLY ROUNDED parse, and the analyses must still agree.


def _as_b64(df: pd.DataFrame) -> dict[str, Any]:
    """The wire shape `get_cycle_bars_b64` returns: big-endian binary, base64."""
    import base64
    import struct

    n = len(df)
    days = [(ts.date() - date(1970, 1, 1)).days for ts in df.index]
    def pack(fmt: str, vals: list[Any]) -> str:
        return base64.b64encode(struct.pack(f">{n}{fmt}", *vals)).decode()

    return {
        "n": n,
        "d": pack("i", days),
        "h": pack("d", [float(v) for v in df["High"].to_numpy()]),
        "l": pack("d", [float(v) for v in df["Low"].to_numpy()]),
        "c": pack("d", [float(v) for v in df["Close"].to_numpy()]),
    }


def test_the_binary_decoder_is_exactly_a_correctly_rounded_parse() -> None:
    """Must carry NO error at all: matching Python's `float()` bit for bit.

    ⚠️ This docstring said the text path was "~1-14 ULP off, so this must match
    `float()` and NOT `_columns_to_df`" until 2026-09-09. That was true and is
    the defect, not the design — see the sibling test below, which now requires
    all three decoders to agree."""
    src = _frame()
    got = az._b64_to_df(_as_b64(src))
    assert got is not None
    for col in ("High", "Low", "Close"):
        exact = np.array([float(repr(float(v))) for v in src[col].to_numpy()])
        assert np.array_equal(got[col].to_numpy(), exact), col


def test_the_binary_shape_analyses_the_same_as_the_text_shape() -> None:
    """No figure a reader sees moves. Measured on live data over 21 tickers x 3
    presets, 0 of 63 analyses differed — and again over 7 tickers x 3 presets on
    2026-09-09 with the Stock Detail decoder added to the comparison."""
    src = _frame()
    a = analyze_ticker("TEST", az._columns_to_df(_as_columns(src)), None, PARAMS)
    b = analyze_ticker("TEST", az._b64_to_df(_as_b64(src)), None, PARAMS)
    assert a is not None and b is not None
    assert dataclasses.asdict(a) == dataclasses.asdict(b)


def test_control_the_binary_comparison_can_fail() -> None:
    """Without this, the test above is satisfied by two paths that agree because
    neither does anything (11p)."""
    import base64
    import struct

    src = _frame()
    cols = _as_b64(src)
    vals = [float(v) for v in src["Close"].to_numpy()]
    vals[-1] += 0.0001
    cols["c"] = base64.b64encode(struct.pack(f">{len(vals)}d", *vals)).decode()
    a = analyze_ticker("TEST", az._columns_to_df(_as_columns(src)), None, PARAMS)
    b = analyze_ticker("TEST", az._b64_to_df(cols), None, PARAMS)
    assert a is not None and b is not None
    assert dataclasses.asdict(a) != dataclasses.asdict(b)


def test_the_binary_dates_are_real_dates() -> None:
    """`int4send(date - 1970-01-01)` is a compact encoding of the real calendar
    date, NOT a synthetic index — `as_of` is read off the last one."""
    src = _frame()
    got = az._b64_to_df(_as_b64(src))
    assert got is not None
    assert isinstance(got.index, pd.DatetimeIndex)
    assert got.index.equals(pd.DatetimeIndex(src.index))


def test_a_short_binary_column_is_loud() -> None:
    """A truncated column would let numpy hand back a short array and the frame
    would go quietly out of alignment — a wrong number that looks right."""
    cols = _as_b64(_frame())
    import base64

    cols["h"] = base64.b64encode(base64.b64decode(cols["h"])[:-8]).decode()
    with pytest.raises(ValueError, match="but n="):
        az._b64_to_df(cols)


def test_no_binary_bars_is_not_an_error() -> None:
    assert az._b64_to_df({"n": 0, "d": "", "h": "", "l": "", "c": ""}) is None


# ── the DIRECT-CONNECTION encoding (get_cycle_bars_bin, 2026-09-08) ──────────
#
# Raw binary over a direct Postgres connection: no JSON, no base64, no gzip.
# 322,704 bytes for AAPL against 785,136 for the original text JSON. Verified
# against the live database over 20 tickers x 3 presets: 20/20 frames
# bit-identical to the b64 path and 60/60 analyses identical.


def _as_bin(df: pd.DataFrame) -> bytes:
    """The wire shape `get_cycle_bars_bin` returns.

    int32 n | n*int32 epoch-days | n*float8 high | n*float8 low | n*float8 close
    """
    import struct

    n = len(df)
    out = struct.pack(">i", n)
    out += struct.pack(f">{n}i", *[(ts.date() - date(1970, 1, 1)).days for ts in df.index])
    for col in ("High", "Low", "Close"):
        out += struct.pack(f">{n}d", *[float(v) for v in df[col].to_numpy()])
    return out


def test_the_binary_blob_decodes_to_the_same_frame_as_base64() -> None:
    src = _frame()
    a = az._b64_to_df(_as_b64(src))
    b = az._bin_to_df(_as_bin(src))
    assert a is not None and b is not None
    assert list(a.columns) == list(b.columns)
    assert a.index.equals(b.index)
    for col in a.columns:
        assert np.array_equal(a[col].to_numpy(), b[col].to_numpy()), col


def test_the_binary_blob_analyses_identically() -> None:
    src = _frame()
    a = analyze_ticker("TEST", az._b64_to_df(_as_b64(src)), None, PARAMS)
    b = analyze_ticker("TEST", az._bin_to_df(_as_bin(src)), None, PARAMS)
    assert a is not None and b is not None
    assert dataclasses.asdict(a) == dataclasses.asdict(b)


def test_control_the_binary_blob_comparison_can_fail() -> None:
    """Without this the two tests above are satisfied by two decoders that agree
    because neither does anything (11p)."""
    import struct

    src = _frame()
    blob = bytearray(_as_bin(src))
    # Nudge the last close by a ten-thousandth of a dollar.
    tail = len(blob) - 8
    (last,) = struct.unpack_from(">d", blob, tail)
    struct.pack_into(">d", blob, tail, last + 0.0001)
    a = analyze_ticker("TEST", az._b64_to_df(_as_b64(src)), None, PARAMS)
    b = analyze_ticker("TEST", az._bin_to_df(bytes(blob)), None, PARAMS)
    assert a is not None and b is not None
    assert dataclasses.asdict(a) != dataclasses.asdict(b)


def test_a_truncated_blob_is_loud() -> None:
    """A short payload must raise, not silently produce a mis-aligned frame."""
    blob = _as_bin(_frame())
    with pytest.raises(ValueError, match="implies"):
        az._bin_to_df(blob[:-8])


def test_an_empty_blob_is_not_an_error() -> None:
    assert az._bin_to_df(b"") is None
    assert az._bin_to_df(struct_zero()) is None


def struct_zero() -> bytes:
    import struct

    return struct.pack(">i", 0)


def test_a_blank_password_does_not_build_a_dsn() -> None:
    """⚠️ An env var that EXISTS AND IS BLANK is exactly what an unfilled Vercel
    field looks like. It must read as "not configured", never as a valid empty
    password, or every ticker would spend two connection attempts failing (11z).
    """
    import os

    keep = {k: os.environ.get(k) for k in ("SCREENER_DB_URL", "SCREENER_DB_PASSWORD")}
    try:
        os.environ["SCREENER_DB_URL"] = ""
        os.environ["SCREENER_DB_PASSWORD"] = ""
        assert az._direct_dsn() is None
        os.environ["SCREENER_DB_PASSWORD"] = "p@ss word/with+specials"
        os.environ["NEXT_PUBLIC_SUPABASE_URL"] = "https://abcdef.supabase.co"
        dsn = az._direct_dsn()
        assert dsn is not None
        # The password is URL-ENCODED: an unescaped @ or / silently corrupts the
        # host or database name and produces a baffling connection error.
        assert "p%40ss+word%2Fwith%2Bspecials" in dsn
        assert "mc_bars_reader.abcdef" in dsn
    finally:
        for k, v in keep.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


def test_the_text_decoder_is_exactly_a_correctly_rounded_parse() -> None:
    """The half that was missing until 2026-09-09.

    `_columns_to_df` used `pd.to_numeric`, which is fast and NOT correctly
    rounded — on live data it disagreed with Python's `float()` on 4,501 of
    AAPL's 11,526 highs, and 94% of stored prices carry more than 15 significant
    digits. Every analysis came out identical anyway, so nothing a reader saw was
    ever wrong; the point is that a value sitting exactly on a -3/-5/-8%
    threshold must not depend on WHICH fallback happened to run.
    """
    src = _frame()
    got = az._columns_to_df(_as_columns(src))
    assert got is not None
    for col in ("High", "Low", "Close"):
        exact = np.array([float(repr(float(v))) for v in src[col].to_numpy()])
        assert np.array_equal(got[col].to_numpy(), exact), col


def test_all_three_decoders_agree_bit_for_bit() -> None:
    """The invariant, stated once, over every shape the screener can receive.

    ⚠️ Asserted on the BARS, not on the analysis. Two frames that differ in the
    last bit still produce the same CycleAnalysis almost always, so an
    analysis-level check passes on a broken decoder (14g) — which is exactly how
    the text path stayed lossy while a green test said the two shapes "analyse
    identically".
    """
    src = _frame()
    frames = {
        "rows (detail page shape)": az._bars_to_df(_as_row_objects(src)),
        "text columns": az._columns_to_df(_as_columns(src)),
        "binary columns": az._b64_to_df(_as_b64(src)),
    }
    ref = np.array([float(repr(float(v))) for v in src["Close"].to_numpy()])
    for name, df in frames.items():
        assert df is not None, name
        for col in ("High", "Low", "Close"):
            exact = np.array([float(repr(float(v))) for v in src[col].to_numpy()])
            assert np.array_equal(df[col].to_numpy(), exact), f"{name} / {col}"
    assert len(ref) == BARS


def test_control_the_bit_for_bit_check_can_fail() -> None:
    """A decoder that rounded every price to 6 decimals must be caught, or the
    test above is satisfied by any parser at all (11p)."""
    src = _frame()
    got = az._columns_to_df(_as_columns(src))
    assert got is not None
    rounded = np.round(np.array([float(v) for v in src["Close"].to_numpy()]), 6)
    assert not np.array_equal(got["Close"].to_numpy(), rounded)
