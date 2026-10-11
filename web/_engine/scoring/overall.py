import math
from typing import Any, Optional

from _engine.providers.base import OverallLabel

_RATING_WEIGHTS: dict[str, int] = {
    "financial_health": 40,
    "valuation_zone":   35,
    "cycle_payoff":     25,
}


# Cycle Payoff — when each half reaches full marks (owner, 2026-10-10). The site's
# explanations state both numbers, and `web/e2e/rating-definition.spec.ts` reads them
# from THIS file, so the words cannot drift from the scoring (CLAUDE.md 11c-v).
#
# PAYOFF_FULL_EVENTS — every stock records ~25 low points + high points a year on every
#   horizon, so the count measures history: 250 is about ten years. It was 20 until
#   2026-10-10, which every stock passed inside a year, so the half was a flat 50 for all.
# PAYOFF_FULL_RATIO — how many fall-sized climbs the typical rise holds:
#   ln(1 + rise) / ln(1 / (1 + fall)). A 50% fall followed by a 100% rise scores 1, not
#   2, because that rise only gets back to the start. The plain rise / fall it replaced
#   (full marks at 3) scored crash-and-bounce stocks HIGHER than steady ones: measured on
#   435 stocks outside our universe, speculative names' median ratio on Long was 7.0
#   against 4.9 for ours, and on this measure 1.6 against 2.7.
PAYOFF_FULL_EVENTS = 250
PAYOFF_FULL_RATIO = 2.5


def recovery_ratio(typical_drawdown: Optional[float], typical_profit: Optional[float]) -> Optional[float]:
    """Fall-sized climbs in the typical rise, or None when either side is missing."""
    if typical_drawdown is None or typical_profit is None:
        return None
    if not (-100.0 < typical_drawdown < 0 and typical_profit > 0):
        return None
    return math.log1p(typical_profit / 100.0) / -math.log1p(typical_drawdown / 100.0)


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
      events_score (50%): how much history the pattern rests on — full at
                          PAYOFF_FULL_EVENTS low + high points (about ten years)
      rr_score     (50%): recovery_ratio() — fall-sized climbs in the typical rise,
                          full at PAYOFF_FULL_RATIO. 50 when either side is missing.
    """
    pull_events: int = int(cycle.get("total_pullback_events") or 0)
    prof_events: int = int(cycle.get("total_profit_events") or 0)
    typ_dd: Optional[float] = cycle.get("typical_drawdown")
    typ_pr: Optional[float] = cycle.get("typical_profit")

    events_score = _clamp((pull_events + prof_events) / PAYOFF_FULL_EVENTS * 100.0)

    rr = recovery_ratio(typ_dd, typ_pr)
    rr_score = 50.0 if rr is None else _clamp(rr / PAYOFF_FULL_RATIO * 100.0)

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
