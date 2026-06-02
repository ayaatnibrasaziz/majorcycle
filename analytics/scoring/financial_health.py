from typing import Optional

import numpy as np

from analytics.providers.base import FundamentalsSnapshot

# A pillar needs at least one real input to be scored. If it has none, we omit
# it (Proposal P3 — no fabricated "neutral 50") and renormalise the remaining
# pillar weights. If fewer than this many pillars have data, the whole Financial
# Health score is withheld as insufficient.
_MIN_PILLARS_FOR_SCORE = 3

_FH_WEIGHTS: dict[str, int] = {
    "profitability": 30,
    "balance_sheet": 25,
    "growth":        20,
    "cashflow":      15,
    "shareholder":   10,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def score_financial_health(
    f: FundamentalsSnapshot,
) -> tuple[Optional[float], dict[str, float]]:
    """
    Five-pillar financial health score (0-100).

    Returns (total_score, subscores). A pillar with no usable inputs is omitted
    from ``subscores`` rather than fabricated; the total renormalises over the
    pillars that have data. If fewer than ``_MIN_PILLARS_FOR_SCORE`` pillars have
    data the total is ``None`` (insufficient data — withheld, not invented).

    Pillar keys when present: profitability, balance_sheet, growth, cashflow,
    shareholder.
    """
    scores: dict[str, float] = {}

    # Profitability (30%)
    p: list[float] = []
    if f.roe is not None:
        r = f.roe
        p.append(_clamp(100 if r >= 20 else 80 if r >= 15 else 60 if r >= 10
                        else 40 if r >= 5 else 20 if r >= 0 else 0))
    if f.gross_margin is not None:
        gm = f.gross_margin
        p.append(_clamp(100 if gm >= 50 else 85 if gm >= 40 else 65 if gm >= 30
                        else 45 if gm >= 20 else 20))
    if f.operating_margin is not None:
        om = f.operating_margin
        p.append(_clamp(100 if om >= 20 else 80 if om >= 15 else 60 if om >= 10
                        else 40 if om >= 5 else 20 if om >= 0 else 0))
    if f.net_margin is not None:
        nm = f.net_margin
        p.append(_clamp(100 if nm >= 15 else 80 if nm >= 10 else 60 if nm >= 5
                        else 20 if nm >= 0 else 0))
    if p:
        scores["profitability"] = float(np.mean(p))

    # Balance Sheet (25%)
    bs: list[float] = []
    if f.debt_to_equity is not None:
        de = f.debt_to_equity
        bs.append(_clamp(100 if de < 0.3 else 85 if de < 0.5 else 65 if de < 1.0
                         else 40 if de < 2.0 else 15))
    if f.current_ratio is not None:
        cr = f.current_ratio
        bs.append(_clamp(100 if cr >= 2.0 else 80 if cr >= 1.5 else 60 if cr >= 1.2
                         else 40 if cr >= 1.0 else 10))
    if f.interest_coverage is not None:
        ic = f.interest_coverage
        bs.append(_clamp(100 if ic >= 10 else 80 if ic >= 5 else 60 if ic >= 3
                         else 35 if ic >= 1.5 else 5))
    if bs:
        scores["balance_sheet"] = float(np.mean(bs))

    # Growth (20%)
    gr: list[float] = []
    if f.revenue_growth_yoy is not None:
        rg = f.revenue_growth_yoy
        gr.append(_clamp(100 if rg >= 20 else 85 if rg >= 15 else 70 if rg >= 10
                         else 50 if rg >= 5 else 30 if rg >= 0 else 10))
    if f.earnings_growth_yoy is not None:
        eg = f.earnings_growth_yoy
        gr.append(_clamp(100 if eg >= 25 else 85 if eg >= 15 else 65 if eg >= 5
                         else 40 if eg >= 0 else 10))
    if gr:
        scores["growth"] = float(np.mean(gr))

    # Cash Flow (15%)
    cf: list[float] = []
    if f.fcf_yield_pct is not None:
        fy = f.fcf_yield_pct
        cf.append(_clamp(100 if fy >= 6 else 80 if fy >= 4 else 60 if fy >= 2
                         else 35 if fy >= 0 else 5))
    if f.fcf_margin_pct is not None:
        fm = f.fcf_margin_pct
        cf.append(_clamp(100 if fm >= 20 else 85 if fm >= 15 else 70 if fm >= 10
                         else 50 if fm >= 5 else 25 if fm >= 0 else 0))
    if cf:
        scores["cashflow"] = float(np.mean(cf))

    # Shareholder (10%)
    sh: list[float] = []
    if f.payout_ratio_pct is not None:
        pr = f.payout_ratio_pct
        sh.append(_clamp(100 if pr < 40 else 75 if pr < 60 else 45 if pr < 80 else 15))
    else:
        sh.append(60.0)  # no dividend — reinvesting, neutral positive signal
    if f.shares_change_yoy_pct is not None:
        sc = f.shares_change_yoy_pct
        sh.append(_clamp(100 if sc < -2 else 70 if sc < 0 else 50 if sc < 3
                         else 25 if sc < 10 else 0))
    if sh:
        scores["shareholder"] = float(np.mean(sh))

    # Aggregate over the pillars that have data, renormalising their weights so a
    # missing pillar is never silently replaced by a fabricated "neutral 50".
    available = {k: scores[k] for k in _FH_WEIGHTS if k in scores}
    if len(available) < _MIN_PILLARS_FOR_SCORE:
        return None, available

    weight_sum = sum(_FH_WEIGHTS[k] for k in available)
    total = round(_clamp(
        sum(available[k] * _FH_WEIGHTS[k] for k in available) / weight_sum
    ), 1)

    return total, available
