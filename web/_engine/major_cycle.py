import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional

import numpy as np
import pandas as pd

from _engine.providers.base import (
    FundamentalsSnapshot,
    OverallLabel,
    ValuationZone,
)
from _engine.scoring.financial_health import score_financial_health
from _engine.scoring.overall import calculate_overall_rating
from _engine.scoring.valuation import apply_quality_gate, calculate_valuation_zone

logger = logging.getLogger(__name__)


@dataclass
class CycleParams:
    """User-chosen analysis parameters."""
    pullback_threshold: float   # negative %, e.g. -5.0
    profit_threshold: float     # positive %, e.g. 5.0
    lookback_bars: int          # e.g. 252
    pivot_bars: int = 5


@dataclass
class CycleAnalysis:
    """The Major Cycle output for one ticker."""
    ticker: str
    params: CycleParams
    as_of: str                      # ISO date of analysis

    current_close: float
    current_drawdown_pct: float
    current_profit_pct: float

    typical_drawdown: Optional[float]
    lower_bound: Optional[float]
    typical_profit: Optional[float]
    upper_bound: Optional[float]
    total_pullback_events: int
    total_profit_events: int

    financial_health_score: Optional[float]
    valuation_score: float            # quality-gated (feeds the Overall rating)
    valuation_score_raw: float        # un-gated cycle-position score
    quality_factor: Optional[float]   # gate multiplier applied (None if no FH to gate by)
    valuation_zone: ValuationZone
    cycle_payoff_score: float         # signal-reliability + reward/risk (was "momentum")
    overall_rating: int
    overall_label: OverallLabel

    fh_subscores: dict[str, float] = field(default_factory=dict)


def ta_highest(series: pd.Series, length: int) -> pd.Series:  # type: ignore[type-arg]
    """Replicates Pine Script ta.highest(series, length).

    Pine's ta.highest uses the highest of the *available* bars before `length`
    bars exist — it does NOT blank the warmup. min_periods=length would NaN the
    first `length` bars, so a major early dip/rally (e.g. a recent IPO's first-year
    crash) would never be measured and could be missed by the lower/upper bound.
    min_periods=1 matches Pine and the client drawdown curve
    (DrawdownOverlay.computeDrawdown, which uses available bars from bar 0).
    See docs/methodology-audit.md "C-R6 — first-lookback warmup".
    """
    return series.rolling(window=length, min_periods=1).max()


def ta_lowest(series: pd.Series, length: int) -> pd.Series:  # type: ignore[type-arg]
    """Replicates Pine Script ta.lowest(series, length). min_periods=1 so the first
    `length` bars aren't blanked — see ta_highest + docs/methodology-audit.md."""
    return series.rolling(window=length, min_periods=1).min()


def _pivots(
    series: pd.Series,  # type: ignore[type-arg]
    left_bars: int,
    right_bars: int,
    *,
    lower: bool,
) -> pd.Series:  # type: ignore[type-arg]
    """Vectorised Pine Script ta.pivotlow / ta.pivothigh.

    A pivot is a bar strictly beyond all `left_bars` before it and all
    `right_bars` after it; the value is reported at bar[i + right_bars], which is
    the first bar on which it could have been known.

    ⚠️ WHY THIS IS VECTORISED, and it is not micro-optimisation. Written as a
    Python loop, these two functions were **97% of the entire analysis**:
    measured on AAPL's 11,525 bars, 200.8 ms + 206.3 ms against 0.4 ms for both
    rolling windows combined, out of 417 ms for the whole `analyze_ticker`. A
    761-ticker screen therefore spent roughly **250 seconds of pure Python CPU**
    inside these two loops — more than everything else in the request put
    together, database included. Vectorised, the same call is ~2 ms.

    ⚠️ THE NaN HANDLING IS THE SAME LOGIC, not a simplification, and it is the
    part worth checking. The loop skipped a bar whose value or whose neighbours
    were NaN, before comparing. Here the comparison does that work: `NaN > x`,
    `x > NaN` and `NaN > NaN` are all False in IEEE 754, so any NaN in the
    window fails the mask and the bar produces no pivot — the identical outcome
    by a different route. `~np.isnan(val)` is kept explicitly anyway: it is
    already implied while `left_bars + right_bars >= 1`, and stating it means a
    future caller passing 0 cannot silently change the answer.

    ⚠️ Ties are NOT pivots, in both directions — the comparison is strict, as
    Pine's is. A flat stretch of equal prices produces nothing, which is why the
    equivalence test feeds plateaus as well as real series.

    Byte-identical to the loop it replaces: `analytics/tests/test_pivots.py`
    keeps that loop as the frozen reference and compares them over real price
    histories, plateaus, NaN patterns and random data, with a control proving
    the comparison can fail.
    """
    arr: np.ndarray[Any, np.dtype[Any]] = np.asarray(series.values, dtype=float)
    n = len(arr)
    out = np.full(n, np.nan)
    if n <= left_bars + right_bars:
        return pd.Series(out, index=series.index)

    idx = np.arange(left_bars, n - right_bars)
    val = arr[idx]
    keep = ~np.isnan(val)
    for j in range(1, left_bars + 1):
        keep &= (arr[idx - j] > val) if lower else (arr[idx - j] < val)
    for j in range(1, right_bars + 1):
        keep &= (arr[idx + j] > val) if lower else (arr[idx + j] < val)

    out[idx[keep] + right_bars] = val[keep]
    return pd.Series(out, index=series.index)


def ta_pivotlow(
    series: pd.Series, left_bars: int, right_bars: int  # type: ignore[type-arg]
) -> pd.Series:  # type: ignore[type-arg]
    """Exact Pine Script ta.pivotlow replication. See `_pivots`."""
    return _pivots(series, left_bars, right_bars, lower=True)


def ta_pivothigh(
    series: pd.Series, left_bars: int, right_bars: int  # type: ignore[type-arg]
) -> pd.Series:  # type: ignore[type-arg]
    """Exact Pine Script ta.pivothigh replication. See `_pivots`."""
    return _pivots(series, left_bars, right_bars, lower=False)


def _safe(v: Any) -> Optional[float]:
    try:
        f = float(v)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, 4)
    except Exception:
        return None


def calculate_cycle_metrics(df: pd.DataFrame, params: CycleParams) -> dict[str, Any]:
    """Compute raw cycle metrics from OHLCV price history."""
    high = df["High"]
    low = df["Low"]
    close = df["Close"]

    rolling_ath = ta_highest(high, params.lookback_bars)
    drawdown_pct = ((close - rolling_ath) / rolling_ath) * 100
    trough_series = ta_pivotlow(drawdown_pct, params.pivot_bars, params.pivot_bars)
    pullback_list = (
        trough_series.dropna()[trough_series.dropna() < params.pullback_threshold].tolist()
    )

    rolling_atl = ta_lowest(low, params.lookback_bars)
    profit_pct = ((close - rolling_atl) / rolling_atl) * 100
    peak_series = ta_pivothigh(profit_pct, params.pivot_bars, params.pivot_bars)
    profit_list = (
        peak_series.dropna()[peak_series.dropna() > params.profit_threshold].tolist()
    )

    last_date = (
        df.index[-1].strftime("%Y-%m-%d")
        if hasattr(df.index[-1], "strftime")
        else str(df.index[-1])
    )

    return {
        "current_close":         _safe(close.iloc[-1]),
        "current_drawdown_pct":  _safe(drawdown_pct.iloc[-1]),
        "current_profit_pct":    _safe(profit_pct.iloc[-1]),
        "lower_bound":           _safe(min(pullback_list)) if pullback_list else None,
        "upper_bound":           _safe(max(profit_list)) if profit_list else None,
        "typical_drawdown":      _safe(float(np.mean(pullback_list))) if pullback_list else None,
        "typical_profit":        _safe(float(np.mean(profit_list))) if profit_list else None,
        "total_pullback_events": len(pullback_list),
        "total_profit_events":   len(profit_list),
        "as_of":                 last_date,
    }


def analyze_ticker(
    ticker: str,
    df: pd.DataFrame,
    fundamentals: Optional[FundamentalsSnapshot],
    params: CycleParams,
) -> Optional[CycleAnalysis]:
    """Full analysis for one ticker: cycle metrics + scoring → CycleAnalysis."""
    min_bars = params.lookback_bars + params.pivot_bars * 2 + 10
    if len(df) < min_bars:
        logger.warning("%s: insufficient data (%d bars, need %d)", ticker, len(df), min_bars)
        return None

    cycle = calculate_cycle_metrics(df, params)

    current_close = cycle.get("current_close")
    current_drawdown_pct = cycle.get("current_drawdown_pct")
    current_profit_pct = cycle.get("current_profit_pct")
    if current_close is None or current_drawdown_pct is None or current_profit_pct is None:
        return None

    fh_score: Optional[float] = None
    fh_subscores: dict[str, float] = {}
    if fundamentals is not None:
        fh_score, fh_subscores = score_financial_health(fundamentals)

    valuation_zone, valuation_score_raw = calculate_valuation_zone(cycle)
    valuation_score, quality_factor = apply_quality_gate(valuation_score_raw, fh_score)

    overall_rating, overall_label, cycle_payoff_score = calculate_overall_rating(
        fh_score, valuation_score, cycle
    )

    return CycleAnalysis(
        ticker=ticker,
        params=params,
        as_of=str(cycle.get("as_of") or date.today().isoformat()),
        current_close=current_close,
        current_drawdown_pct=current_drawdown_pct,
        current_profit_pct=current_profit_pct,
        typical_drawdown=cycle.get("typical_drawdown"),
        lower_bound=cycle.get("lower_bound"),
        typical_profit=cycle.get("typical_profit"),
        upper_bound=cycle.get("upper_bound"),
        total_pullback_events=int(cycle.get("total_pullback_events") or 0),
        total_profit_events=int(cycle.get("total_profit_events") or 0),
        financial_health_score=fh_score,
        valuation_score=valuation_score,
        valuation_score_raw=valuation_score_raw,
        quality_factor=quality_factor,
        valuation_zone=valuation_zone,
        cycle_payoff_score=cycle_payoff_score,
        overall_rating=overall_rating,
        overall_label=overall_label,
        fh_subscores=fh_subscores,
    )
