"""The market cap we store is the provider's answer, whatever it is.

TWO RULES ARE TESTED HERE, AND THEY PULL IN OPPOSITE DIRECTIONS ON PURPOSE.

  1. Ask the provider properly. yfinance's `info` blob intermittently omits
     `marketCap` for a large, actively-traded company — 15 of 863 on the run of
     2026-08-27, Salesforce, Lowe's and Micron among them. `fast_info` is a
     second endpoint on the same object and carried a cap for all 15, so the
     provider is asked that way before we give up. This is not a substitute
     figure: measured across 15 stocks in all three markets the two endpoints
     agree to a median of 0.000%, worst case 0.85% on a moving price.

  2. Never invent one. When neither endpoint has a cap, we write null. An
     earlier version omitted the column so the stored figure survived a bad
     night; the owner rejected that on 2026-08-29, because it also survives a
     BAD MONTH — serving a months-old market cap as though it were current.
     A blank cell is a visible gap; a stale number is an invisible lie, and the
     reader cannot tell it from a fresh one.

⚠️ RULE 2 IS WHY THE INCIDENT ABOVE COULD HAPPEN, AND IT IS STILL RIGHT.
Writing the null is what blanked those 15 companies, silently: a null cap
renders as an empty cell, drops the company out of any size-ranked cohort
without an error, and takes `fcf_yield_pct` with it. What makes it acceptable
is not the write, it is the two things around it — the fallback that makes a
genuine null rare, and the >0.5%-missing invariant in `check_field_units.py`
that makes one loud. The write is self-correcting; a preserved value is not,
because nothing about it ever looks wrong.
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


def test_a_missing_cap_is_written_through_as_null() -> None:
    """The owner's rule, in one assertion.

    `market_cap: None` and *no* `market_cap` key are the same value in Python
    and opposite instructions to Postgres: the first overwrites the stored
    figure with NULL, the second leaves it alone. So the key must be PRESENT —
    asserting `is None` alone would pass on a payload that silently kept
    yesterday's number, which is the behaviour this replaced.
    """
    row = _with_market_cap(_row(), _Fund(None))

    assert "market_cap" in row
    assert row["market_cap"] is None


def test_no_fundamentals_at_all_is_also_written_through() -> None:
    """A provider call that failed outright says the same thing: we have no
    figure today. It must not leave an old one standing in for a new one."""
    row = _with_market_cap(_row(), None)

    assert "market_cap" in row
    assert row["market_cap"] is None


def test_the_rest_of_the_row_is_untouched() -> None:
    """Control. A helper that returned a bare {"market_cap": None} would satisfy
    both assertions above while destroying every other column."""
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
