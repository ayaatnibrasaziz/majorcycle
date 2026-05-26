from typing import Any, Optional

from _engine.providers.base import OverallLabel

_RATING_WEIGHTS: dict[str, int] = {
    "financial_health": 40,
    "valuation_zone":   35,
    "momentum":         25,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def calculate_overall_rating(
    fh_score: float,
    val_score: float,
    cycle: dict[str, Any],
) -> tuple[int, OverallLabel, float]:
    """
    Three-pillar weighted rating (0-100).

    Returns (overall_rating, overall_label, momentum_score).

    Momentum sub-score:
      events_score (50%): calibration — more pivot events = more reliable signal
      rr_score     (50%): typical_profit / |typical_drawdown| — reward/risk ratio
    """
    pull_events: int = int(cycle.get("total_pullback_events") or 0)
    prof_events: int = int(cycle.get("total_profit_events") or 0)
    typ_dd: Optional[float] = cycle.get("typical_drawdown")
    typ_pr: Optional[float] = cycle.get("typical_profit")

    events_score = _clamp((pull_events + prof_events) / 20.0 * 100.0)

    rr_score = 50.0
    if typ_dd and typ_pr and typ_dd < 0 and typ_pr > 0:
        rr = typ_pr / abs(typ_dd)
        rr_score = _clamp(rr / 3.0 * 100.0)

    momentum_score = round(events_score * 0.5 + rr_score * 0.5, 1)

    raw = (
        fh_score         * _RATING_WEIGHTS["financial_health"] / 100.0
        + val_score      * _RATING_WEIGHTS["valuation_zone"]   / 100.0
        + momentum_score * _RATING_WEIGHTS["momentum"]         / 100.0
    )

    rating = round(_clamp(raw))

    label: OverallLabel
    if rating >= 80:
        label = "High Conviction"
    elif rating >= 65:
        label = "Constructive"
    elif rating >= 50:
        label = "Neutral"
    elif rating >= 35:
        label = "Cautious"
    else:
        label = "Bearish"

    return rating, label, momentum_score
