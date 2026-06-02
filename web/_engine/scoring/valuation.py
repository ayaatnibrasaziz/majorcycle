from typing import Any, Optional

from _engine.providers.base import ValuationZone

# Quality gate (Proposal P1) — the raw valuation score is pure cycle position
# (how deep today's drawdown is vs typical), so a deeply-fallen but financially
# weak stock ("value trap") scores as a bargain. We scale the raw score by a
# quality factor derived from Financial Health, with NO hard cliffs:
#
#     quality_factor = FLOOR + (1 - FLOOR) * (FH / 100) ** GAMMA
#
#   FLOOR — the most we ever discount (a real dip keeps some credit even on a
#           weak company). GAMMA — curvature; >1 punishes low-FH stocks harder
#           while barely touching healthy ones. Both are tunable knobs.
QUALITY_GATE_FLOOR = 0.30
QUALITY_GATE_GAMMA = 1.5


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def quality_factor(fh_score: Optional[float]) -> float:
    """Valuation quality multiplier in [FLOOR, 1.0] from a 0-100 Financial Health
    score. Returns 1.0 (no discount) when FH is unavailable — we don't penalise
    quality we couldn't measure; the insufficient-data state (P3) flags that
    separately."""
    if fh_score is None:
        return 1.0
    f = _clamp(fh_score) / 100.0
    return QUALITY_GATE_FLOOR + (1.0 - QUALITY_GATE_FLOOR) * (f ** QUALITY_GATE_GAMMA)


def apply_quality_gate(
    val_raw: float, fh_score: Optional[float]
) -> tuple[float, float]:
    """Scale a raw valuation score by the Financial-Health quality factor.

    Returns (gated_score, factor) both rounded. The raw (un-gated) score and the
    DEEP VALUE/VALUE/FAIR/STRETCHED zone label still describe the true cycle
    position; only this gated score feeds the Overall rating.
    """
    qf = quality_factor(fh_score)
    return round(_clamp(val_raw * qf), 1), round(qf, 4)


def calculate_valuation_zone(cycle: dict[str, Any]) -> tuple[ValuationZone, float]:
    """
    Determine valuation zone and score (0-100) from cycle metrics.

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
