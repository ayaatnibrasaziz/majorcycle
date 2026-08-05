"""The cohort tripwire, tested by making it detect the bug it exists for.

Verified against the live universe on 2026-08-05: 39 fields checked across 863
stocks, no breaches.
"""

from typing import Any

from analytics.cron.check_field_units import _MIN_SAMPLE, check, check_invariants


def _universe(**fields: float) -> list[dict[str, Any]]:
    """A synthetic universe where every stock holds the same values."""
    return [
        {"ticker": f"T{i}", "fundamentals": dict(fields)}
        for i in range(_MIN_SAMPLE + 10)
    ]


class TestCohortCheck:
    def test_healthy_universe_passes(self) -> None:
        breaches, _thin, checked = check(
            _universe(dividend_yield_pct=2.4, payout_ratio_pct=34.0, debt_to_equity=0.64)
        )
        assert checked == 3
        assert breaches == []

    def test_catches_a_percent_field_that_reverts_to_a_fraction(self) -> None:
        """The `dividendYield` regression, exactly.

        yfinance once changed this field from a fraction to a percent. If it ever
        changes back — or if somebody removes the `_safe`/`_pct` distinction —
        every stored value is 100x too small while each one still looks like a
        perfectly ordinary number. Only the cohort median shows it.
        """
        breaches, _thin, _ = check(_universe(dividend_yield_pct=0.024))
        assert len(breaches) == 1
        assert "dividend_yield_pct" in breaches[0]
        assert "FRACTION" in breaches[0]

    def test_catches_a_fraction_field_that_gets_scaled_twice(self) -> None:
        breaches, _thin, _ = check(_universe(payout_ratio_pct=3400.0))
        assert len(breaches) == 1
        assert "payout_ratio_pct" in breaches[0]
        assert "PERCENT" in breaches[0]

    def test_catches_debt_to_equity_losing_its_divide_by_100(self) -> None:
        """yfinance sends 78.4 meaning 0.78x. Dropping the /100 would make the
        balance-sheet pillar treat every company as catastrophically levered."""
        breaches, _thin, _ = check(_universe(debt_to_equity=78.4))
        assert any("debt_to_equity" in b for b in breaches)

    def test_a_thin_field_is_reported_not_breached(self) -> None:
        """Below the sample floor a median is noise. Say so rather than crying
        wolf — a check that fires on nothing gets ignored, and then it is not a
        check any more."""
        rows: list[dict[str, Any]] = [
            {"ticker": "A", "fundamentals": {"dividend_yield_pct": 0.0001}}
        ]
        breaches, thin, checked = check(rows)
        assert breaches == []
        assert checked == 0
        assert any("dividend_yield_pct" in t for t in thin)

    def test_an_empty_universe_checks_nothing(self) -> None:
        """Guards against the vacuous pass: no data must not read as no problem.
        `main()` turns `checked == 0` into a non-zero exit for this reason."""
        breaches, _thin, checked = check([])
        assert breaches == []
        assert checked == 0

    def test_a_clean_universe_trips_no_invariant(self) -> None:
        rows = [
            {"ticker": "AAPL", "fundamentals": {
                "currency": "USD", "financial_currency": "USD",
                "gross_margin": 48.6, "fcf_yield_pct": 2.4,
            }},
            {"ticker": "BHP.AX", "fundamentals": {
                "currency": "AUD", "financial_currency": "USD",
                "gross_margin": 83.1, "fcf_yield_pct": None,
            }},
        ]
        assert check_invariants(rows) == []

    def test_a_stored_zero_margin_is_reported(self) -> None:
        """The sentinel must never come back — it is worth four customer-facing
        rating labels."""
        rows = [{"ticker": "JPM", "fundamentals": {
            "currency": "USD", "financial_currency": "USD", "gross_margin": 0,
        }}]
        problems = check_invariants(rows)
        assert len(problems) == 1
        assert "gross_margin" in problems[0] and "JPM" in problems[0]

    def test_a_cross_currency_fcf_yield_is_reported(self) -> None:
        """This one was live AFTER the fix: normalising on the Python read path
        left the TypeScript reader — and so the Key Metrics table — untouched.
        Checking the DATA covers every reader at once."""
        rows = [{"ticker": "ABX.TO", "fundamentals": {
            "currency": "CAD", "financial_currency": "USD", "fcf_yield_pct": 6.12,
        }}]
        problems = check_invariants(rows)
        assert len(problems) == 1
        assert "fcf_yield_pct" in problems[0] and "ABX.TO" in problems[0]

    def test_a_wholesale_loss_of_financial_currency_is_reported(self) -> None:
        """The failure that made this rule necessary.

        On 2026-08-05 the nightly refresh ran pre-fix code and rewrote 608 of 863
        rows, wiping `financial_currency`. The cross-currency test then reported
        ZERO violations — not because there were none, but because the field it
        reads was gone. An unmeasurable row must never count as a clean one.
        """
        rows = [
            {"ticker": f"T{i}", "fundamentals": {"currency": "USD"}} for i in range(70)
        ] + [
            {"ticker": f"OK{i}", "fundamentals": {
                "currency": "AUD", "financial_currency": "AUD",
            }} for i in range(30)
        ]
        problems = check_invariants(rows)
        assert len(problems) == 1
        assert "financial_currency" in problems[0]
        assert "70 of 100" in problems[0]

    def test_a_few_genuinely_missing_do_not_cry_wolf(self) -> None:
        """Some tickers legitimately have no `financialCurrency` upstream. A check
        that fires on those gets ignored, and then it is not a check any more."""
        rows = [
            {"ticker": f"OK{i}", "fundamentals": {
                "currency": "USD", "financial_currency": "USD",
            }} for i in range(98)
        ] + [
            {"ticker": f"GAP{i}", "fundamentals": {"currency": "USD"}} for i in range(2)
        ]
        assert check_invariants(rows) == []

    def test_no_invariant_divides_by_zero_on_an_empty_universe(self) -> None:
        assert check_invariants([]) == []

    def test_a_same_currency_fcf_yield_is_fine(self) -> None:
        rows = [{"ticker": "AAPL", "fundamentals": {
            "currency": "USD", "financial_currency": "USD", "fcf_yield_pct": 2.4,
        }}]
        assert check_invariants(rows) == []

    def test_one_wild_outlier_does_not_trip_it(self) -> None:
        """A 35% dividend yield is real (we hold one). The tripwire watches the
        median precisely so a true outlier never fires it."""
        rows = _universe(dividend_yield_pct=2.4)
        rows[0]["fundamentals"]["dividend_yield_pct"] = 35.48
        breaches, _thin, _ = check(rows)
        assert breaches == []
