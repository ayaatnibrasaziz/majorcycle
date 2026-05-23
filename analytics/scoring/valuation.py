from typing import Any, Optional

from analytics.providers.base import ValuationZone


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def calculate_valuation_zone(cycle: dict[str, Any]) -> tuple[ValuationZone, float]:
    """
    Determine valuation zone and score (0–100) from cycle metrics.

    Zones map the current drawdown position relative to historical cycle:
      DEEP VALUE : at or beyond typical_drawdown (historically deep dip)
      VALUE      : between half-typical and typical drawdown
      FAIR       : mild pullback (between -5% and half-typical)
      STRETCHED  : near all-time highs, limited safety margin
    """
    dd: Optional[float] = cycle.get("current_drawdown_pct")
    td: Optional[float] = cycle.get("typical_drawdown")
    lb: Optional[float] = cycle.get("lower_bound")

    if dd is None:
        return "FAIR", 0.0

    val_score: float
    if td is not None and lb is not None and td < 0 and lb < 0:
        if dd <= lb:
            val_score = 100.0
        elif dd <= td:
            span = lb - td
            val_score = 70.0 + 30.0 * (dd - td) / (span if span != 0 else -1e-9)
        elif dd <= td * 0.5:
            half_td = td * 0.5
            span = td - half_td
            val_score = 40.0 + 30.0 * (dd - half_td) / (span if span != 0 else -1e-9)
        elif dd <= -5.0:
            half_td = td * 0.5
            span = half_td - (-5.0)
            val_score = 10.0 + 30.0 * (dd - (-5.0)) / (span if span != 0 else -1e-9)
        else:
            val_score = max(0.0, 10.0 + dd * 2.0)
    else:
        val_score = _clamp(-dd * 2.0, 0.0, 60.0)

    val_score = round(_clamp(val_score), 1)

    zone: ValuationZone
    if td is not None and td < 0:
        if dd <= td:
            zone = "DEEP VALUE"
        elif dd <= td * 0.5:
            zone = "VALUE"
        elif dd <= -5.0:
            zone = "FAIR"
        else:
            zone = "STRETCHED"
    else:
        zone = (
            "DEEP VALUE" if dd <= -20
            else "VALUE" if dd <= -10
            else "FAIR" if dd <= -5
            else "STRETCHED"
        )

    return zone, val_score
