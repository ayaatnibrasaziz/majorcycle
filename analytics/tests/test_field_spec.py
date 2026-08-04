"""The units contract.

Every silent data bug this project has shipped had the same shape: a value that
was the wrong *scale* or the wrong *meaning*, while still being a perfectly
plausible-looking number. Code review cannot see that, and neither can a type
checker. These tests are the thing that can.
"""

from dataclasses import fields, replace

import pytest

from analytics.providers.base import FundamentalsSnapshot
from analytics.providers.field_spec import (
    FUNDAMENTALS_SPEC,
    ZERO_MEANS_NA,
    normalise_fundamentals,
    spec_covers_snapshot,
)
from analytics.scoring.financial_health import score_financial_health


class TestSpecCoverage:
    def test_every_snapshot_field_declares_a_unit(self) -> None:
        """Adding a fundamentals field without saying what unit it is in fails here.

        This is the guard that a comment beside one call site could never be.
        """
        missing, extra = spec_covers_snapshot()
        assert not missing, (
            f"FundamentalsSnapshot fields with no entry in FUNDAMENTALS_SPEC: "
            f"{sorted(missing)}. Declare the unit — percent / ratio / money / "
            f"price / count / text — in analytics/providers/field_spec.py."
        )
        assert not extra, (
            f"FUNDAMENTALS_SPEC declares fields that no longer exist: {sorted(extra)}"
        )

    def test_the_spec_is_not_vacuously_empty(self) -> None:
        """A spec that scanned nothing would pass every check above."""
        assert len(FUNDAMENTALS_SPEC) >= 50
        assert len(list(fields(FundamentalsSnapshot))) >= 50

    def test_percent_fields_all_carry_a_median_band(self) -> None:
        """A percent field with no expected band cannot be unit-drift checked.

        `sp500_52wk_change_pct` and the derived relative-strength figure are the
        only exemptions: one is a single index value repeated across the
        universe, the other is a difference of two others.
        """
        exempt = {"rel_strength_vs_sp500"}
        for name, spec in FUNDAMENTALS_SPEC.items():
            if spec.unit == "percent" and name not in exempt:
                assert spec.median_band is not None, f"{name} has no median_band"
                lo, hi = spec.median_band
                assert lo < hi, f"{name} band is inverted"


class TestZeroMeansNotApplicable:
    def test_only_the_four_margins_treat_zero_as_missing(self) -> None:
        """Deliberately narrow. A zero payout ratio, a zero short interest and a
        debt-free balance sheet are all REAL zeros — nulling those would throw
        away true data. Only the margins use 0.0 as a not-reported sentinel."""
        assert ZERO_MEANS_NA == {
            "gross_margin",
            "operating_margin",
            "net_margin",
            "ebitda_margin",
        }

    def test_zero_margins_become_none(self) -> None:
        f = FundamentalsSnapshot(
            ticker="JPM", gross_margin=0.0, ebitda_margin=0.0,
            operating_margin=50.394, net_margin=34.921,
        )
        out = normalise_fundamentals(f)
        assert out.gross_margin is None
        assert out.ebitda_margin is None
        # Real values are untouched.
        assert out.operating_margin == 50.394
        assert out.net_margin == 34.921

    def test_genuine_zeros_survive(self) -> None:
        """A company can really pay no dividend, carry no debt and have no
        short interest. Those zeros must reach the scorer intact."""
        f = FundamentalsSnapshot(
            ticker="X", payout_ratio_pct=0.0, total_debt=0.0,
            short_ratio=0.0, short_pct_of_float=0.0,
            shares_change_yoy_pct=0.0, insider_ownership_pct=0.0,
        )
        out = normalise_fundamentals(f)
        assert out.payout_ratio_pct == 0.0
        assert out.total_debt == 0.0
        assert out.short_ratio == 0.0
        assert out.short_pct_of_float == 0.0
        assert out.shares_change_yoy_pct == 0.0
        assert out.insider_ownership_pct == 0.0

    def test_a_bank_is_not_punished_for_a_margin_it_cannot_have(self) -> None:
        """The defect, stated as a test.

        yfinance sends gross/EBITDA margins of exactly 0.0 for every bank. Read
        literally that is the worst bucket in the profitability pillar, so the
        stock is marked down for a metric that does not apply to it. Measured on
        live data this moved 36 stocks' Overall Rating and flipped four labels
        (C, WFC, SYF from Neutral to Constructive; EQB.TO from Cautious to
        Neutral) — see docs/data-audit.md D1.
        """
        bank = FundamentalsSnapshot(
            ticker="JPM",
            gross_margin=0.0, ebitda_margin=0.0,           # yfinance sentinel
            operating_margin=50.394, net_margin=34.921, roe=17.789,
            debt_to_equity=1.2, current_ratio=1.1, interest_coverage=12.0,
            revenue_growth_yoy=30.4, earnings_growth_yoy=46.9,
            payout_ratio_pct=25.71, shares_change_yoy_pct=-2.5,
        )
        as_read_literally, _ = score_financial_health(bank)
        normalised, _ = score_financial_health(normalise_fundamentals(bank))

        assert as_read_literally is not None and normalised is not None
        assert normalised > as_read_literally, (
            "normalising the not-applicable margins must not make the bank score "
            "worse — that would mean the sentinel was being read as real data"
        )
        # The profitability pillar is 30% of the score; the fabricated 0% cost
        # roughly nine points of Financial Health.
        assert normalised - as_read_literally > 5


class TestFinancialCurrency:
    def test_fcf_yield_is_withheld_when_the_currencies_disagree(self) -> None:
        """BHP.AX prices in AUD and reports in USD, so free cash flow divided by
        market cap is off by the exchange rate. Withhold rather than publish a
        number that is wrong by ~35%."""
        f = FundamentalsSnapshot(
            ticker="BHP.AX", currency="AUD", financial_currency="USD",
            fcf_yield_pct=4.2, fcf_margin_pct=18.0,
        )
        out = normalise_fundamentals(f)
        assert out.fcf_yield_pct is None
        # Both inputs to the MARGIN come from the statements, so it stays valid.
        assert out.fcf_margin_pct == 18.0

    def test_fcf_yield_survives_when_the_currencies_match(self) -> None:
        f = FundamentalsSnapshot(
            ticker="AAPL", currency="USD", financial_currency="USD",
            fcf_yield_pct=2.1,
        )
        assert normalise_fundamentals(f).fcf_yield_pct == 2.1

    def test_a_missing_financial_currency_is_not_treated_as_a_mismatch(self) -> None:
        """Rows written before the field existed have it as None. That is
        'unknown', not 'different' — do not silently blank their FCF yield."""
        f = FundamentalsSnapshot(ticker="AAPL", currency="USD", fcf_yield_pct=2.1)
        assert f.financial_currency is None
        assert normalise_fundamentals(f).fcf_yield_pct == 2.1


class TestNormaliseIsSafeToRunTwice:
    def test_idempotent(self) -> None:
        """It runs on write in the provider AND on read in the serverless
        functions, so applying it twice must change nothing."""
        f = FundamentalsSnapshot(
            ticker="CBA.AX", currency="AUD", financial_currency="AUD",
            gross_margin=0.0, net_margin=36.354, fcf_yield_pct=3.0,
        )
        once = normalise_fundamentals(replace(f))
        twice = normalise_fundamentals(replace(once))
        assert once == twice


@pytest.mark.parametrize(
    "name,expected_unit",
    [
        # The three units that were each learned from a live defect.
        ("dividend_yield_pct", "percent"),  # already percent — never x100 again
        ("debt_to_equity", "ratio"),        # stored as a multiple, not yfinance's x100
        ("payout_ratio_pct", "percent"),    # a fraction upstream, so it DOES get x100
    ],
)
def test_the_units_we_learned_the_hard_way(name: str, expected_unit: str) -> None:
    assert FUNDAMENTALS_SPEC[name].unit == expected_unit
