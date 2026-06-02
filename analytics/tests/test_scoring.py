"""Unit tests for scoring modules — financial_health, valuation, overall."""

from analytics.providers.base import FundamentalsSnapshot
from analytics.scoring.financial_health import score_financial_health
from analytics.scoring.overall import calculate_overall_rating
from analytics.scoring.valuation import (
    QUALITY_GATE_FLOOR,
    apply_quality_gate,
    calculate_valuation_zone,
    quality_factor,
)


def _fund(**kwargs) -> FundamentalsSnapshot:  # type: ignore[return]
    """Build a FundamentalsSnapshot with only the supplied fields set."""
    return FundamentalsSnapshot(ticker="TEST", **kwargs)


class TestScoreFinancialHealth:
    def test_excellent_company(self) -> None:
        f = _fund(
            roe=25.0,
            gross_margin=55.0,
            operating_margin=22.0,
            net_margin=18.0,
            debt_to_equity=0.2,
            current_ratio=2.5,
            interest_coverage=15.0,
            revenue_growth_yoy=22.0,
            earnings_growth_yoy=28.0,
            fcf_yield_pct=7.0,
            fcf_margin_pct=22.0,
            payout_ratio_pct=30.0,
            shares_change_yoy_pct=-3.0,
        )
        score, subscores = score_financial_health(f)
        assert score is not None
        assert score >= 80.0
        assert set(subscores.keys()) == {"profitability", "balance_sheet", "growth", "cashflow", "shareholder"}
        assert all(0.0 <= v <= 100.0 for v in subscores.values())

    def test_poor_company(self) -> None:
        f = _fund(
            roe=-5.0,
            gross_margin=10.0,
            operating_margin=-5.0,
            net_margin=-8.0,
            debt_to_equity=3.0,
            current_ratio=0.5,
            revenue_growth_yoy=-10.0,
            earnings_growth_yoy=-20.0,
            fcf_yield_pct=-3.0,
            fcf_margin_pct=-5.0,
            payout_ratio_pct=90.0,
            shares_change_yoy_pct=15.0,
        )
        score, _ = score_financial_health(f)
        assert score is not None
        assert score < 40.0

    def test_all_none_is_withheld(self) -> None:
        # No usable fundamentals -> insufficient data, not a fabricated 50.
        f = _fund()
        score, subscores = score_financial_health(f)
        assert score is None
        assert "balance_sheet" not in subscores
        assert "profitability" not in subscores

    def test_score_clamped_0_to_100(self) -> None:
        f = _fund(
            roe=999.0, gross_margin=999.0, operating_margin=999.0,
            debt_to_equity=0.1, revenue_growth_yoy=50.0,
        )
        score, _ = score_financial_health(f)
        assert score is not None
        assert 0.0 <= score <= 100.0

    def test_missing_pillar_is_omitted_not_fabricated(self) -> None:
        # Bank-like: profitability + growth + shareholder present, but no
        # balance-sheet or cash-flow inputs (banks report neither in this shape).
        f = _fund(
            roe=18.0, net_margin=20.0,            # profitability
            revenue_growth_yoy=12.0,              # growth
            payout_ratio_pct=35.0,                # shareholder
        )
        score, subscores = score_financial_health(f)
        assert score is not None                  # >=3 pillars -> scored
        assert "balance_sheet" not in subscores   # omitted, not 50
        assert "cashflow" not in subscores
        assert {"profitability", "growth", "shareholder"} <= set(subscores)

    def test_fewer_than_three_pillars_withheld(self) -> None:
        # Only profitability + shareholder have data -> withhold.
        f = _fund(roe=18.0, payout_ratio_pct=35.0)
        score, _ = score_financial_health(f)
        assert score is None


class TestCalculateValuationZone:
    def test_deep_value_when_at_typical_drawdown(self) -> None:
        cycle = {"current_drawdown_pct": -12.0, "typical_drawdown": -10.0, "lower_bound": -20.0}
        zone, score = calculate_valuation_zone(cycle)
        assert zone == "DEEP VALUE"
        assert score >= 70.0

    def test_value_zone(self) -> None:
        cycle = {"current_drawdown_pct": -6.0, "typical_drawdown": -10.0, "lower_bound": -20.0}
        zone, score = calculate_valuation_zone(cycle)
        assert zone == "VALUE"
        assert 40.0 <= score <= 70.0

    def test_fair_zone(self) -> None:
        cycle = {"current_drawdown_pct": -6.0, "typical_drawdown": None, "lower_bound": None}
        zone, _score = calculate_valuation_zone(cycle)
        assert zone == "FAIR"

    def test_stretched_when_near_highs(self) -> None:
        cycle = {"current_drawdown_pct": -1.0, "typical_drawdown": -10.0, "lower_bound": -20.0}
        zone, score = calculate_valuation_zone(cycle)
        assert zone == "STRETCHED"
        assert score < 10.0

    def test_lower_bound_gives_max_score(self) -> None:
        cycle = {"current_drawdown_pct": -25.0, "typical_drawdown": -10.0, "lower_bound": -20.0}
        _zone, score = calculate_valuation_zone(cycle)
        assert score == 100.0

    def test_missing_drawdown_returns_fair(self) -> None:
        zone, score = calculate_valuation_zone({"current_drawdown_pct": None})
        assert zone == "FAIR"
        assert score == 0.0


class TestQualityGate:
    def test_factor_is_monotonic_in_fh(self) -> None:
        # Healthier company -> higher (or equal) factor, never lower.
        factors = [quality_factor(fh) for fh in range(0, 101, 10)]
        assert factors == sorted(factors)

    def test_factor_bounds(self) -> None:
        assert quality_factor(0.0) == QUALITY_GATE_FLOOR        # weakest -> floor
        assert quality_factor(100.0) == 1.0                     # strongest -> no discount
        assert all(QUALITY_GATE_FLOOR <= quality_factor(fh) <= 1.0
                   for fh in range(0, 101, 5))

    def test_no_fh_means_no_discount(self) -> None:
        # Can't measure quality -> don't penalise it.
        assert quality_factor(None) == 1.0
        gated, qf = apply_quality_gate(80.0, None)
        assert gated == 80.0
        assert qf == 1.0

    def test_value_trap_is_discounted(self) -> None:
        # Deep-value raw score (90) on a weak company (FH 20) drops hard.
        gated, qf = apply_quality_gate(90.0, 20.0)
        assert gated < 45.0
        assert qf < 0.5

    def test_healthy_bargain_barely_touched(self) -> None:
        # Strong company (FH 85) in a real dip keeps most of its valuation.
        gated, qf = apply_quality_gate(70.0, 85.0)
        assert gated > 58.0
        assert qf > 0.8


class TestCalculateOverallRating:
    def test_high_conviction_when_all_high(self) -> None:
        cycle = {
            "total_pullback_events": 15,
            "total_profit_events": 15,
            "typical_drawdown": -10.0,
            "typical_profit": 30.0,
        }
        rating, label, _momentum = calculate_overall_rating(90.0, 90.0, cycle)
        assert rating >= 80
        assert label == "High Conviction"

    def test_bearish_when_all_low(self) -> None:
        cycle = {
            "total_pullback_events": 0,
            "total_profit_events": 0,
            "typical_drawdown": None,
            "typical_profit": None,
        }
        rating, label, _momentum = calculate_overall_rating(10.0, 5.0, cycle)
        assert rating < 35
        assert label == "Bearish"

    def test_label_thresholds(self) -> None:
        cycle: dict = {"total_pullback_events": 10, "total_profit_events": 10,
                       "typical_drawdown": -10.0, "typical_profit": 15.0}
        pairs = [
            (90.0, 90.0, "High Conviction"),
            (70.0, 65.0, "Constructive"),
            (50.0, 50.0, "Neutral"),
            (30.0, 35.0, "Cautious"),
            (5.0,  5.0,  "Bearish"),
        ]
        for fh, val, expected_label in pairs:
            _, label, _ = calculate_overall_rating(fh, val, cycle)
            assert label == expected_label, f"fh={fh} val={val}: expected {expected_label}, got {label}"

    def test_momentum_uses_rr_ratio(self) -> None:
        cycle_good_rr = {
            "total_pullback_events": 10,
            "total_profit_events": 10,
            "typical_drawdown": -10.0,
            "typical_profit": 30.0,   # R/R = 3.0 -> 100%
        }
        cycle_bad_rr = {
            "total_pullback_events": 10,
            "total_profit_events": 10,
            "typical_drawdown": -10.0,
            "typical_profit": 3.0,    # R/R = 0.3 -> 10%
        }
        _, _, mom_good = calculate_overall_rating(70.0, 70.0, cycle_good_rr)
        _, _, mom_bad = calculate_overall_rating(70.0, 70.0, cycle_bad_rr)
        assert mom_good > mom_bad

    def test_rating_clamped_0_to_100(self) -> None:
        cycle: dict = {"total_pullback_events": 0, "total_profit_events": 0}
        rating, _, _ = calculate_overall_rating(100.0, 100.0, cycle)
        assert 0 <= rating <= 100

    def test_cycle_only_when_fh_none(self) -> None:
        # FH withheld -> rate on valuation + momentum alone (renormalised),
        # not as if FH were a fabricated 50.
        cycle: dict = {"total_pullback_events": 10, "total_profit_events": 10,
                       "typical_drawdown": -10.0, "typical_profit": 30.0}
        rating_none, label_none, _ = calculate_overall_rating(None, 80.0, cycle)
        rating_fifty, _, _ = calculate_overall_rating(50.0, 80.0, cycle)
        assert 0 <= rating_none <= 100
        assert label_none in (
            "High Conviction", "Constructive", "Neutral", "Cautious", "Bearish"
        )
        # With a high valuation, dropping a fabricated 50 FH lifts the rating.
        assert rating_none > rating_fifty
