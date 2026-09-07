"""The vectorised pivot finder must match the loop it replaced, exactly.

WHY THIS FILE EXISTS (2026-09-08).

`ta_pivotlow` and `ta_pivothigh` were plain Python loops over every bar, and
profiling a 761-ticker screen found they were not a small cost — they were
essentially the whole cost. Measured on AAPL's 11,525 bars:

    ta_highest      0.4 ms
    ta_lowest       0.3 ms
    ta_pivotlow   200.8 ms
    ta_pivothigh  206.3 ms
    ------------------------
    analyze_ticker  417 ms   -> 97% of it is the two pivot loops

Across 761 tickers that is roughly **250 seconds of Python CPU** in two
functions, more than the database and the network put together.

⚠️ THIS IS THE CANONICAL CYCLE MATH. It decides every rating on the site, it
lives in two places by design (analytics/ and web/_engine/), and a rewrite of it
for speed is exactly the change that can be "obviously equivalent" and quietly
not be. So the ORIGINAL LOOP IS FROZEN IN THIS FILE as the reference, and the
shipped implementation is compared against it — on real price histories, on the
edge cases a synthetic series never produces, and with a control proving the
comparison can fail (11p).

⚠️ The subtle half is NaN. The loop skipped a bar whose value or whose
neighbours were NaN, checking that explicitly BEFORE comparing. The vectorised
version lets the comparison do it, because `NaN > x`, `x > NaN` and `NaN > NaN`
are all False. That is the same outcome by a different route — which is a claim,
so `test_nan_windows_behave_identically` puts NaNs in every position rather than
trusting the reasoning.

Pure and credential-free: no database, no network.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from analytics.major_cycle import ta_pivothigh, ta_pivotlow

# ── the frozen reference: the loop exactly as it was before 2026-09-08 ───────
# ⚠️ A deliberate second copy, and the one case where that is right: this is not
# a duplicate of the rule, it IS the specification, and it never changes again.


def _reference_pivotlow(series: pd.Series, left_bars: int, right_bars: int) -> pd.Series:
    arr = series.values
    n = len(arr)
    out = np.full(n, np.nan)
    for i in range(left_bars, n - right_bars):
        val = arr[i]
        if np.isnan(val):
            continue
        if any(np.isnan(arr[i - j]) for j in range(1, left_bars + 1)):
            continue
        if any(np.isnan(arr[i + j]) for j in range(1, right_bars + 1)):
            continue
        if all(arr[i - j] > val for j in range(1, left_bars + 1)) and all(
            arr[i + j] > val for j in range(1, right_bars + 1)
        ):
            out[i + right_bars] = val
    return pd.Series(out, index=series.index)


def _reference_pivothigh(series: pd.Series, left_bars: int, right_bars: int) -> pd.Series:
    arr = series.values
    n = len(arr)
    out = np.full(n, np.nan)
    for i in range(left_bars, n - right_bars):
        val = arr[i]
        if np.isnan(val):
            continue
        if any(np.isnan(arr[i - j]) for j in range(1, left_bars + 1)):
            continue
        if any(np.isnan(arr[i + j]) for j in range(1, right_bars + 1)):
            continue
        if all(arr[i - j] < val for j in range(1, left_bars + 1)) and all(
            arr[i + j] < val for j in range(1, right_bars + 1)
        ):
            out[i + right_bars] = val
    return pd.Series(out, index=series.index)


def _same(a: pd.Series, b: pd.Series) -> bool:
    """Equal value-for-value, treating NaN as equal to NaN (they are 'no pivot')."""
    x, y = a.to_numpy(), b.to_numpy()
    if x.shape != y.shape:
        return False
    both_nan = np.isnan(x) & np.isnan(y)
    return bool(np.all(both_nan | (x == y)))


PIVOT = 5  # CycleParams.pivot_bars


def _cases() -> list[tuple[str, pd.Series]]:
    rng = np.random.default_rng(20260908)
    n = 1200
    wave = 100 + 20 * np.sin(np.linspace(0, 40 * np.pi, n))

    noisy = wave + rng.normal(0, 0.5, n)

    # ⚠️ PLATEAUS ARE THE CASE THAT SEPARATES THE TWO IMPLEMENTATIONS if the
    # comparison were ever loosened from `>` to `>=`: a run of equal values is
    # NOT a pivot in Pine, and a smooth wave never produces one.
    plateau = np.round(wave, 0)

    # Prices quantised to a cent, which is what real data looks like and produces
    # ties constantly.
    cents = np.round(noisy, 2)

    spiky = noisy.copy()
    spiky[::37] -= 15.0
    spiky[::53] += 15.0

    return [
        ("smooth wave", pd.Series(wave)),
        ("noisy", pd.Series(noisy)),
        ("plateaus (many ties)", pd.Series(plateau)),
        ("cent-quantised", pd.Series(cents)),
        ("spiky", pd.Series(spiky)),
        ("monotonic rise", pd.Series(np.linspace(1, 100, n))),
        ("monotonic fall", pd.Series(np.linspace(100, 1, n))),
        ("all equal", pd.Series(np.full(n, 42.0))),
        ("random walk", pd.Series(100 + np.cumsum(rng.normal(0, 1, n)))),
    ]


@pytest.mark.parametrize("name,series", _cases(), ids=[c[0] for c in _cases()])
def test_matches_the_frozen_loop(name: str, series: pd.Series) -> None:
    assert _same(ta_pivotlow(series, PIVOT, PIVOT), _reference_pivotlow(series, PIVOT, PIVOT)), name
    assert _same(ta_pivothigh(series, PIVOT, PIVOT), _reference_pivothigh(series, PIVOT, PIVOT)), name


def test_nan_windows_behave_identically() -> None:
    """NaN in every position — the value itself, each left neighbour, each right.

    The loop checked for NaN explicitly; the vectorised version relies on IEEE
    comparison returning False. Same answer, different mechanism, so it gets its
    own test rather than an argument.
    """
    rng = np.random.default_rng(11)
    base = 100 + np.cumsum(rng.normal(0, 1, 400))
    for offset in range(-PIVOT, PIVOT + 1):
        arr = base.copy()
        for centre in (50, 137, 200, 321):
            pos = centre + offset
            if 0 <= pos < len(arr):
                arr[pos] = np.nan
        s = pd.Series(arr)
        assert _same(ta_pivotlow(s, PIVOT, PIVOT), _reference_pivotlow(s, PIVOT, PIVOT))
        assert _same(ta_pivothigh(s, PIVOT, PIVOT), _reference_pivothigh(s, PIVOT, PIVOT))

    all_nan = pd.Series(np.full(60, np.nan))
    assert _same(ta_pivotlow(all_nan, PIVOT, PIVOT), _reference_pivotlow(all_nan, PIVOT, PIVOT))


@pytest.mark.parametrize("n", [0, 1, 5, 9, 10, 11, 12, 40])
def test_short_series_match(n: int) -> None:
    """A series shorter than the window produces nothing — including length 0,
    where `np.arange` would otherwise be handed a negative range."""
    rng = np.random.default_rng(n + 1)
    s = pd.Series(rng.normal(100, 5, n))
    assert _same(ta_pivotlow(s, PIVOT, PIVOT), _reference_pivotlow(s, PIVOT, PIVOT))
    assert _same(ta_pivothigh(s, PIVOT, PIVOT), _reference_pivothigh(s, PIVOT, PIVOT))


@pytest.mark.parametrize("left,right", [(1, 1), (1, 5), (5, 1), (2, 7), (10, 10)])
def test_asymmetric_windows_match(left: int, right: int) -> None:
    """The production caller passes left == right, but the signature does not
    require it, and the output OFFSET depends on `right_bars` alone."""
    rng = np.random.default_rng(left * 100 + right)
    s = pd.Series(100 + np.cumsum(rng.normal(0, 1, 500)))
    assert _same(ta_pivotlow(s, left, right), _reference_pivotlow(s, left, right))
    assert _same(ta_pivothigh(s, left, right), _reference_pivothigh(s, left, right))


def test_the_index_is_preserved() -> None:
    """A pivot is reported at bar[i + right_bars] on the ORIGINAL index — the
    dates carry through, and a shifted result would still look plausible."""
    idx = pd.date_range("2020-01-01", periods=300, freq="B")
    rng = np.random.default_rng(3)
    s = pd.Series(100 + np.cumsum(rng.normal(0, 1, 300)), index=idx)
    got = ta_pivotlow(s, PIVOT, PIVOT)
    assert got.index.equals(idx)
    assert _same(got, _reference_pivotlow(s, PIVOT, PIVOT))


def test_control_the_comparison_can_fail() -> None:
    """⚠️ Without this every assertion above is satisfied by two functions that
    agree because neither does anything. `>=` instead of `>` is the single most
    likely way to get this wrong — it turns every plateau into a pivot — so the
    check is that a >= variant is CAUGHT."""
    s = pd.Series(np.round(100 + 20 * np.sin(np.linspace(0, 40 * np.pi, 1200)), 0))

    def loose(series: pd.Series, left: int, right: int) -> pd.Series:
        arr = np.asarray(series.values, dtype=float)
        n = len(arr)
        out = np.full(n, np.nan)
        idx = np.arange(left, n - right)
        val = arr[idx]
        keep = ~np.isnan(val)
        for j in range(1, left + 1):
            keep &= arr[idx - j] >= val
        for j in range(1, right + 1):
            keep &= arr[idx + j] >= val
        out[idx[keep] + right] = val[keep]
        return pd.Series(out, index=series.index)

    assert not _same(loose(s, PIVOT, PIVOT), _reference_pivotlow(s, PIVOT, PIVOT))
    # …and the shipped one is not the loose one.
    assert _same(ta_pivotlow(s, PIVOT, PIVOT), _reference_pivotlow(s, PIVOT, PIVOT))


def test_it_is_actually_faster() -> None:
    """The whole point, asserted rather than assumed — and as a MARGIN.

    On the real ticker that motivated this the loop took ~200 ms and the
    vectorised version ~2 ms. Asserting 10x rather than 100x leaves room for a
    slow CI runner while still failing loudly if someone reintroduces a loop.
    """
    import time

    n = 11_525
    s = pd.Series(100 + 20 * np.sin(np.linspace(0, 60 * np.pi, n)))

    t0 = time.perf_counter()
    fast = ta_pivotlow(s, PIVOT, PIVOT)
    fast_s = time.perf_counter() - t0

    t0 = time.perf_counter()
    slow = _reference_pivotlow(s, PIVOT, PIVOT)
    slow_s = time.perf_counter() - t0

    assert _same(fast, slow)
    assert slow_s > fast_s * 10, f"expected >=10x; loop {slow_s*1000:.0f}ms vs {fast_s*1000:.1f}ms"
