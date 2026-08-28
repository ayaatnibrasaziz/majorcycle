"""A provider that omits a value must never DELETE the value we already hold.

THE BUG THESE GUARD (2026-08-27). yfinance's `info` blob omitted `marketCap` for
15 of 863 companies on one nightly run — Salesforce, Lowe's and Micron among
them. The refresh wrote that None straight into `stocks.market_cap`, blanking a
good figure for each, and `fcf_yield_pct` (computed from the cap, and an input to
Financial Health) went with it.

⚠️ NOTHING WENT RED, AND NOTHING COULD HAVE. There was no error to catch: the key
was absent, the value was None, the write succeeded. A null cap renders as a
blank cell and drops the company out of any size-ranked cohort in silence. It was
found two days later, from the outside, because a study that ranks companies by
size produced a figure that would not reproduce — the S&P 500 "largest 60" median
came out -18.7 where -19.0 had been published, purely because the 15 had fallen
out of the ranking.

Two independent fixes, tested here, because either alone leaves a hole:

  · the PROVIDER asks `fast_info` when `info` has no cap (it carried one for all
    15), so we are less often empty-handed in the first place; and
  · the WRITER omits the column entirely when we have nothing, so being
    empty-handed can no longer destroy anything.

The second is the load-bearing one: it holds whatever the next upstream failure
turns out to be. The first only reduces how often we reach for it.
"""

from __future__ import annotations

from typing import Any

from analytics.cron.daily_refresh import _with_market_cap


class _Fund:
    """Stand-in for FundamentalsSnapshot — only the one field matters here."""

    def __init__(self, market_cap: float | None) -> None:
        self.market_cap = market_cap


def _row() -> dict[str, Any]:
    return {"ticker": "CRM", "name": "Salesforce, Inc.", "currency": "USD"}


# ── the writer ──────────────────────────────────────────────────────────────

def test_a_real_cap_is_written() -> None:
    row = _with_market_cap(_row(), _Fund(207_437_152_511.0))
    assert row["market_cap"] == 207_437_152_511.0


def test_a_missing_cap_leaves_the_key_absent_not_null() -> None:
    """The whole fix, in one assertion.

    `market_cap: None` and *no* `market_cap` key are the same value in Python and
    opposite instructions to Postgres: the first overwrites the stored figure
    with NULL, the second leaves it alone. So this asserts absence, never `is
    None` — a test written the loose way would pass on the broken code.
    """
    row = _with_market_cap(_row(), _Fund(None))

    assert "market_cap" not in row


def test_no_fundamentals_at_all_also_leaves_the_key_absent() -> None:
    """A provider call that failed outright must not blank the column either."""
    assert "market_cap" not in _with_market_cap(_row(), None)


def test_the_rest_of_the_row_is_untouched() -> None:
    """Control. A helper that returned an empty dict would satisfy the two
    absence assertions above while destroying every other column."""
    row = _with_market_cap(_row(), _Fund(None))

    assert row["ticker"] == "CRM"
    assert row["name"] == "Salesforce, Inc."
    assert row["currency"] == "USD"


# ── the provider's fallback ─────────────────────────────────────────────────

class _FastInfo:
    def __init__(self, **kw: Any) -> None:
        self._d = kw

    def get(self, k: str) -> Any:
        return self._d.get(k)


class _TickerObj:
    def __init__(self, info: dict[str, Any], fast_info: Any = None) -> None:
        self.info = info
        self.fast_info = fast_info


def _extract(info: dict[str, Any], fast_info: Any = None) -> float | None:
    from analytics.providers.yfinance_provider import YFinanceProvider

    snap = YFinanceProvider()._extract_fundamentals(
        "CRM", _TickerObj(info, fast_info)
    )
    return snap.market_cap


def test_info_is_used_when_it_has_the_cap() -> None:
    assert _extract({"marketCap": 1_000.0}) == 1_000.0


def test_fast_info_is_consulted_when_info_omits_the_cap() -> None:
    """The measured shape of the 2026-08-27 failure: `info` present and useful
    for everything else, with `marketCap` simply not in it."""
    got = _extract(
        {"currency": "USD", "sector": "Technology"},
        _FastInfo(market_cap=207_437_152_511.0),
    )

    assert got == 207_437_152_511.0


def test_the_camel_case_spelling_is_accepted_too() -> None:
    """yfinance has used both `market_cap` and `marketCap` on fast_info across
    versions, and the pipeline is version-PINNED but upgraded by PR (14e) — so
    the fallback must not depend on which spelling this release happens to use."""
    assert _extract({}, _FastInfo(marketCap=42.0)) == 42.0


def test_still_none_when_neither_source_has_it() -> None:
    """Control, and the reason the writer guard has to exist as well: the
    fallback is not guaranteed to find anything, so `None` must remain
    reachable — and harmless."""
    assert _extract({}, _FastInfo()) is None


def test_a_broken_fast_info_does_not_take_the_whole_refresh_down() -> None:
    """`fast_info` is a lazily-evaluated network object; touching it can raise.
    A ticker whose cap we cannot get must still return a usable snapshot rather
    than aborting that ticker's entire refresh."""

    class _Explodes:
        def get(self, k: str) -> Any:
            raise RuntimeError("network")

    assert _extract({"currency": "USD"}, _Explodes()) is None
