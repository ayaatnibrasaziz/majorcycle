from typing import Any, Optional

from analytics.providers.base import OverallLabel

_RATING_WEIGHTS: dict[str, int] = {
    "financial_health": 40,
    "valuation_zone":   35,
    "cycle_payoff":     25,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def calculate_overall_rating(
    fh_score: Optional[float],
    val_score: float,
    cycle: dict[str, Any],
) -> tuple[int, OverallLabel, float]:
    """
    Three-pillar weighted rating (0-100).

    Returns (overall_rating, overall_label, cycle_payoff_score).

    When ``fh_score`` is None (fundamentals unavailable / insufficient data) the
    rating is computed on the price cycle alone, renormalising the valuation +
    cycle-payoff weights — no fabricated Financial Health contribution (P3).

    Cycle Payoff sub-score (formerly mislabelled "Momentum" — it has no price
    trend component):
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

    cycle_payoff_score = round(events_score * 0.5 + rr_score * 0.5, 1)

    w_fh = _RATING_WEIGHTS["financial_health"]
    w_val = _RATING_WEIGHTS["valuation_zone"]
    w_cp = _RATING_WEIGHTS["cycle_payoff"]
    if fh_score is None:
        denom = w_val + w_cp
        raw = (val_score * w_val + cycle_payoff_score * w_cp) / denom
    else:
        raw = (fh_score * w_fh + val_score * w_val + cycle_payoff_score * w_cp) / 100.0

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

    return rating, label, cycle_payoff_score
