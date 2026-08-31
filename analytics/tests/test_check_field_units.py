"""The cohort tripwire, tested by making it detect the bug it exists for.

Verified against the live universe on 2026-08-05: 39 fields checked across 863
stocks, no breaches.
"""

from typing import Any

from analytics.cron.check_field_units import (
    _MIN_SAMPLE,
    _load_fundamentals,
    check,
    check_invariants,
)


def _universe(**fields: float) -> list[dict[str, Any]]:
    """A synthetic universe where every stock holds the same values."""
    return [
        {"ticker": f"T{i}", "fundamentals": dict(fields)}
        for i in range(_MIN_SAMPLE + 10)
    ]


class TestCohortCheck:
    """⚠️ Every fixture below carries `market_cap`, including the ones testing
    something else entirely. `check_invariants` runs the WHOLE invariant set on
    whatever it is handed, and the market_cap rule is a proportion — so a partial
    row reads as 100% missing and trips a check the test is not about. Completing
    the rows is the right response: making the invariant stand down on small
    universes would be the "unmeasurable counts as clean" failure it exists to
    prevent (14g).
    """
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
            {"ticker": "A", "fundamentals": {"market_cap": 1.0, "dividend_yield_pct": 0.0001}}
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
            {"ticker": "AAPL", "fundamentals": {"market_cap": 1.0, 
                "currency": "USD", "financial_currency": "USD",
                "gross_margin": 48.6, "fcf_yield_pct": 2.4,
            }},
            {"ticker": "BHP.AX", "fundamentals": {"market_cap": 1.0, 
                "currency": "AUD", "financial_currency": "USD",
                "gross_margin": 83.1, "fcf_yield_pct": None,
            }},
        ]
        assert check_invariants(rows) == []

    def test_a_stored_zero_margin_is_reported(self) -> None:
        """The sentinel must never come back — it is worth four customer-facing
        rating labels."""
        rows = [{"ticker": "JPM", "fundamentals": {"market_cap": 1.0, 
            "currency": "USD", "financial_currency": "USD", "gross_margin": 0,
        }}]
        problems = check_invariants(rows)
        assert len(problems) == 1
        assert "gross_margin" in problems[0] and "JPM" in problems[0]

    def test_a_cross_currency_fcf_yield_is_reported(self) -> None:
        """This one was live AFTER the fix: normalising on the Python read path
        left the TypeScript reader — and so the Key Metrics table — untouched.
        Checking the DATA covers every reader at once."""
        rows = [{"ticker": "ABX.TO", "fundamentals": {"market_cap": 1.0, 
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
            {"ticker": f"T{i}", "fundamentals": {"market_cap": 1.0, "currency": "USD"}} for i in range(70)
        ] + [
            {"ticker": f"OK{i}", "fundamentals": {"market_cap": 1.0, 
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
            {"ticker": f"OK{i}", "fundamentals": {"market_cap": 1.0, 
                "currency": "USD", "financial_currency": "USD",
            }} for i in range(98)
        ] + [
            {"ticker": f"GAP{i}", "fundamentals": {"market_cap": 1.0, "currency": "USD"}} for i in range(2)
        ]
        assert check_invariants(rows) == []

    def test_the_real_market_cap_incident_would_now_be_caught(self) -> None:
        """⚠️ THE NUMBERS ARE THE ACTUAL EVENT, NOT A ROUND ILLUSTRATION.

        On 2026-08-27 the nightly refresh blanked `market_cap` on 15 of 871 rows
        because yfinance's `info` omitted the key. That is **1.7%** — and the
        first threshold written for this check was 2%, which would have passed
        the very incident it is named after. A guard tuned above its own defect
        is worse than none: it reports "clean" with authority. The floor is 0.5%.
        """
        rows = [
            {"ticker": f"GONE{i}", "fundamentals": {
                "currency": "USD", "financial_currency": "USD",
            }} for i in range(15)
        ] + [
            {"ticker": f"OK{i}", "fundamentals": {
                "market_cap": 1.0, "currency": "USD", "financial_currency": "USD",
            }} for i in range(856)
        ]
        problems = check_invariants(rows)
        assert len(problems) == 1
        assert "market_cap" in problems[0]
        assert "15 of 871" in problems[0]

    def test_a_couple_of_genuinely_capless_tickers_do_not_cry_wolf(self) -> None:
        """Control. Without this the check could be set to fire on any missing
        cap at all, which is how a check stops being read."""
        rows = [
            {"ticker": f"OK{i}", "fundamentals": {
                "market_cap": 1.0, "currency": "USD", "financial_currency": "USD",
            }} for i in range(869)
        ] + [
            {"ticker": f"GAP{i}", "fundamentals": {
                "currency": "USD", "financial_currency": "USD",
            }} for i in range(2)
        ]
        assert check_invariants(rows) == []

    def test_index_rows_are_not_counted_as_missing_caps(self) -> None:
        """`^GSPC` and friends are price-only rows that never carry a cap.
        Counting them would put a permanent floor under the proportion and the
        check would either fire forever or have to be loosened to tolerate them —
        which would then hide a real loss of that size."""
        rows = [
            {"ticker": f"^IDX{i}", "fundamentals": {
                "currency": "USD", "financial_currency": "USD",
            }} for i in range(4)
        ] + [
            {"ticker": f"OK{i}", "fundamentals": {
                "market_cap": 1.0, "currency": "USD", "financial_currency": "USD",
            }} for i in range(96)
        ]
        assert check_invariants(rows) == []

    def test_no_invariant_divides_by_zero_on_an_empty_universe(self) -> None:
        assert check_invariants([]) == []

    def test_a_same_currency_fcf_yield_is_fine(self) -> None:
        rows = [{"ticker": "AAPL", "fundamentals": {"market_cap": 1.0, 
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


class TestRetiredTickersAreHeldBack:
    """A ticker we have stopped refreshing must not be judged by these invariants.

    ⚠️ WHY THIS EXISTS. `is_active` arrived on 2026-08-30 and `daily_refresh` was
    taught to skip a retired ticker; this checker was not (CLAUDE.md 11c-iv — the
    rule existed and a second consumer never received it). Every invariant here has
    one implicit remedy, *tonight's refresh repairs it*, and for a ticker that is
    never refreshed again that remedy does not exist — so a retired row with a blank
    market cap becomes a permanent nightly breach nobody can act on, which is how a
    red X stops being read at all (11z). Found latent by the Layer G Layer 4 delta
    on 2026-08-31 and closed before it fired.
    """

    class _Res:
        def __init__(self, data: list[dict[str, Any]]) -> None:
            self.data = data

    class _Table:
        """The smallest stub that behaves like the PostgREST builder chain."""

        def __init__(self, rows: list[dict[str, Any]]) -> None:
            self._rows = rows

        def select(self, _cols: str) -> "TestRetiredTickersAreHeldBack._Table":
            return self

        def neq(self, _col: str, _val: str) -> "TestRetiredTickersAreHeldBack._Table":
            return self

        def range(self, lo: int, hi: int) -> "TestRetiredTickersAreHeldBack._Table":
            self._slice = (lo, hi)
            return self

        def execute(self) -> "TestRetiredTickersAreHeldBack._Res":
            lo, hi = self._slice
            return TestRetiredTickersAreHeldBack._Res(self._rows[lo : hi + 1])

    class _Client:
        def __init__(self, rows: list[dict[str, Any]]) -> None:
            self._rows = rows

        def table(self, _name: str) -> "TestRetiredTickersAreHeldBack._Table":
            return TestRetiredTickersAreHeldBack._Table(self._rows)

    def _rows(self) -> list[dict[str, Any]]:
        return [
            {"ticker": "AAPL", "fundamentals": {"market_cap": 1.0}, "is_active": True},
            {"ticker": "BK", "fundamentals": {"market_cap": None}, "is_active": False},
            {"ticker": "CTRA", "fundamentals": {"market_cap": None}, "is_active": False},
            {"ticker": "CBA.AX", "fundamentals": {"market_cap": 2.0}, "is_active": True},
        ]

    def test_a_retired_ticker_is_excluded_and_counted(self) -> None:
        rows, retired = _load_fundamentals(self._Client(self._rows()))  # type: ignore[arg-type]
        assert [r["ticker"] for r in rows] == ["AAPL", "CBA.AX"]
        # Counted, not silently dropped — an exclusion nobody can see is how
        # "unmeasured" starts reading as "clean" (14g).
        assert retired == 2

    def test_an_active_ticker_is_still_checked(self) -> None:
        """The control. A function returning nothing at all passes the test above."""
        rows, retired = _load_fundamentals(self._Client(self._rows()))  # type: ignore[arg-type]
        assert len(rows) == 2
        assert retired + len(rows) == 4
        # The fundamentals must survive the filter, not just the ticker — this
        # function's whole output is what every invariant then reads.
        assert rows[0]["fundamentals"] == {"market_cap": 1.0}

    def test_a_row_with_no_is_active_column_is_kept(self) -> None:
        """Defaults to keeping, matching daily_refresh._load_universe.

        Failing the other way would let a schema slip silently empty this check's
        universe — and a check that runs on nothing reports exactly what a clean
        one reports.
        """
        rows, retired = _load_fundamentals(
            self._Client([{"ticker": "NEW", "fundamentals": {"market_cap": 3.0}}])  # type: ignore[arg-type]
        )
        assert [r["ticker"] for r in rows] == ["NEW"]
        assert retired == 0
