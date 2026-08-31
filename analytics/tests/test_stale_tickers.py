"""The staleness sweep and the three-source delisting test.

── What this guards ──────────────────────────────────────────────────────────

Two failure modes, pointing in opposite directions, and the second is the
expensive one:

  · **Missing a dead ticker** costs one failed fetch a night and a price that
    stops moving. Recoverable, and visible once anyone looks.
  · **Retiring a LIVE company** stops refreshing it and drops it from the
    screener. Measured on the live database, 2026-08-30: **`EA`, `EQR` and `AVB`
    — three S&P 500 companies, all trading — are `is_active = false` in
    `listings` AND `false` in `index_membership`.** Two of the three sources call
    them dead; only the live quote keeps them. A two-of-three rule would have
    retired three live large caps that night, which is why the test is unanimous
    rather than a majority: our reference tables go stale in exactly the way that
    makes a majority vote dangerous.

So the tests below are weighted toward the second: every one of the "must not
retire" cases is a control, and without them a `three_source_verdict` that simply
returned "dead" for everything would pass the positive test.

⚠️ No network and no database — the provider is patched and the Supabase client
is a stub. These run on a fork PR with no secrets, which is the whole reason the
project's unit-level tests are written this way.
"""

from typing import Any, cast
from unittest.mock import patch

import pytest
from supabase import Client

from analytics.cron.check_stale_tickers import (
    MAX_RETIRE_PCT,
    NEVER_FETCHED,
    _market_of,
    stale_by_market,
    three_source_verdict,
)

# ── Which market's calendar governs a ticker ──────────────────────────────────


def test_market_inference_matches_the_rest_of_the_codebase() -> None:
    assert _market_of("AAPL") == "us"
    assert _market_of("BHP.AX") == "au"
    assert _market_of("SHOP.TO") == "ca"
    assert _market_of("^GSPC") == "index"


def test_tsx_venture_is_canadian_not_american() -> None:
    # ⚠️ `.V` classified as US in two places until 2026-08-04 (CLAUDE.md #14).
    # Here the cost would be measuring a Canadian ticker against the US session
    # calendar — on a day the TSX is closed and the NYSE is not, that reports the
    # whole venture board as stale.
    assert _market_of("ABC.V") == "ca"


# ── Staleness, measured against the market's real session calendar ──────────

#: A realistic five-session week for one market, most recent first. Every test
#: below ranks against THIS, not against the dates the tickers happen to hold.
US_WEEK = ["2026-08-28", "2026-08-27", "2026-08-26", "2026-08-25", "2026-08-24",
           "2026-08-21", "2026-08-20", "2026-08-19", "2026-08-18", "2026-08-17"]
AU_WEEK = ["2026-08-27", "2026-08-26", "2026-08-25", "2026-08-24", "2026-08-21"]


def test_a_ticker_level_with_its_market_is_not_stale() -> None:
    newest = {"AAPL": "2026-08-28", "MSFT": "2026-08-28", "GOOG": "2026-08-28"}
    stale, totals = stale_by_market(newest, {"us": US_WEEK})
    assert stale == {}
    assert totals == {"us": 3}


def test_a_ticker_far_behind_its_market_is_stale() -> None:
    # ⚠️ THE CASE THE FIRST VERSION OF THIS CODE COULD NOT SEE. Every company is
    # current except one, which stopped five sessions ago. The calendar is built
    # from the benchmark index, so EQR ranks 5 sessions behind and is caught.
    #
    # Deriving the calendar from the tickers' own newest dates — which is what the
    # first implementation did — would have produced exactly two dates in
    # evidence, ranked EQR as ONE session behind, and reported a clean market.
    # The check would have been blindest in the ordinary case of a single
    # straggler, which is the only case there is.
    newest = {
        "AAPL": "2026-08-28",
        "MSFT": "2026-08-28",
        "GOOG": "2026-08-28",
        "EQR": "2026-08-21",
    }
    stale, _ = stale_by_market(newest, {"us": US_WEEK})
    assert [t for t, _, _ in stale["us"]] == ["EQR"]
    assert stale["us"][0][2] == 5


def test_a_ticker_one_session_behind_is_not_stale() -> None:
    # THE CONTROL that stops the threshold being decorative. A stock that did not
    # print yesterday — thin volume, a halt — must not be swept up. Without this,
    # a check that flagged anything not exactly current would pass the test above
    # and report hundreds of false positives a night.
    newest = {"AAPL": "2026-08-28", "MSFT": "2026-08-28", "THIN": "2026-08-27"}
    stale, _ = stale_by_market(newest, {"us": US_WEEK})
    assert stale == {}


def test_exactly_at_the_threshold_is_not_stale() -> None:
    # A bound tested on one side only tests the direction that was never the
    # failure mode (CLAUDE.md 11i). STALE_TRADING_DAYS=3 must mean "more than 3".
    newest = {"AAPL": "2026-08-28", "EDGE": "2026-08-25"}
    stale, _ = stale_by_market(newest, {"us": US_WEEK})
    assert stale == {}
    newest["EDGE"] = "2026-08-24"          # one session further back
    stale, _ = stale_by_market(newest, {"us": US_WEEK})
    assert [t for t, _, _ in stale["us"]] == ["EDGE"]


def test_a_market_holiday_makes_nobody_stale() -> None:
    # ⚠️ Why staleness is defined in SESSIONS rather than calendar days. This
    # calendar skips a four-day Easter weekend. Measured in calendar days every
    # ticker here is 4+ days old and a naive check would report the whole market
    # stale every Easter and every Christmas; measured in sessions, nothing is
    # behind anything.
    easter = ["2026-04-06", "2026-04-02", "2026-04-01", "2026-03-31"]
    newest = {t: "2026-04-06" for t in ("AAPL", "MSFT", "GOOG", "AMZN")}
    stale, _ = stale_by_market(newest, {"us": easter})
    assert stale == {}


def test_markets_are_judged_separately() -> None:
    # A market that is simply closed — the ASX at 22:30 UTC, the NYSE at 08:00
    # UTC — must not look stale beside one that is open. This is what lets the
    # same sweep run in both nightly workflows.
    newest = {
        "AAPL": "2026-08-28", "MSFT": "2026-08-28",
        "BHP.AX": "2026-08-27", "CBA.AX": "2026-08-27",
    }
    stale, totals = stale_by_market(newest, {"us": US_WEEK, "au": AU_WEEK})
    assert stale == {}
    assert totals == {"us": 2, "au": 2}


def test_a_market_with_no_calendar_is_reported_not_silently_passed() -> None:
    # ⚠️ If the benchmark index has no bars, this market cannot be judged. It must
    # NOT fall back to a calendar derived from the tickers — that is the very bug
    # above — and it must not quietly return "clean", which is what a check that
    # cannot see reports (CLAUDE.md 14g). It returns nothing for that market and
    # logs the gap.
    newest = {"BHP.AX": "2026-01-01", "CBA.AX": "2026-01-01"}
    stale, totals = stale_by_market(newest, {"us": US_WEEK})
    assert "au" not in stale
    assert totals["au"] == 2, "the tickers are still COUNTED, so the gap is visible"


def test_a_ticker_ahead_of_a_lagging_benchmark_is_not_stale() -> None:
    # ⚠️ THE BUG THAT REAL DATA FOUND, and it was a whole-market false alarm.
    #
    # The first version looked each ticker's date UP in the calendar and treated a
    # miss as maximally stale. On 2026-08-30 the ASX equities held a bar for the
    # 28th while ^AXJO — the index supplying their calendar — reached only the
    # 27th. So 247 Australian companies, nearly the entire market, were reported
    # "60 sessions behind" for being one day MORE current than the benchmark.
    #
    # Every unit test passed. Only running it against the live database showed it,
    # which is why it was run before this shipped.
    stale, _ = stale_by_market(
        {"BHP.AX": "2026-08-28", "CBA.AX": "2026-08-28"},
        {"au": ["2026-08-27", "2026-08-26", "2026-08-25", "2026-08-24"]},
    )
    assert stale == {}, "a ticker ahead of its benchmark is the most current thing there is"


def test_a_date_inside_the_window_but_not_a_session_is_ranked_sensibly() -> None:
    # A bar dated on a day the index has no session — a holiday print, a provider
    # oddity — must be ranked by where it FALLS, not dropped to the maximum. Here
    # the 26th is missing from the calendar; a bar on it is 1 session behind the
    # 27th, not 4.
    stale, _ = stale_by_market(
        {"ODD.AX": "2026-08-26"},
        {"au": ["2026-08-27", "2026-08-25", "2026-08-24", "2026-08-21"]},
    )
    assert stale == {}


def test_a_date_older_than_the_whole_window_is_the_worst_case() -> None:
    # Four months stale — the real Australian Unity Office case. Its date is not
    # in the calendar at all, so `rank` has no entry and it must not raise.
    newest = {"AAPL": "2026-08-28", "ANCIENT": "2026-04-30"}
    stale, _ = stale_by_market(newest, {"us": US_WEEK})
    assert [t for t, _, _ in stale["us"]] == ["ANCIENT"]
    assert stale["us"][0][2] >= len(US_WEEK)


def test_a_ticker_with_no_bars_at_all_is_reported_not_skipped() -> None:
    # "Never fetched" and "up to date" must never share an outcome (CLAUDE.md
    # 11e). A ticker with no bars has no date to rank, so it needs its own path —
    # and the easiest way to write that path is to `continue` past it, which
    # reports a broken ticker as a healthy one.
    newest: dict[str, Any] = {"AAPL": "2026-08-28", "GHOST": None}
    stale, _ = stale_by_market(newest, {"us": US_WEEK})
    assert [t for t, _, _ in stale["us"]] == ["GHOST"]
    assert stale["us"][0][1] == "(no bars)"
    assert stale["us"][0][2] == NEVER_FETCHED


def test_the_worst_offender_is_reported_first() -> None:
    newest = {
        "AAPL": "2026-08-28",
        "MILD": "2026-08-21",
        "BAD": "2026-04-30",
    }
    stale, _ = stale_by_market(newest, {"us": US_WEEK})
    assert [t for t, _, _ in stale["us"]] == ["BAD", "MILD"]


# ── The three-source test ────────────────────────────────────────────────────


class _StubTable:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def select(self, _cols: str) -> "_StubTable":
        return self

    def range(self, start: int, end: int) -> "_StubTable":
        self._slice = (start, end)
        return self

    def execute(self) -> Any:
        start, end = self._slice

        class _Res:
            data = self._rows[start : end + 1]

        return _Res()


class _StubClient:
    def __init__(self, listings: list[str], index: list[str]) -> None:
        self._listings = [{"symbol": s, "is_active": True} for s in listings]
        self._index = [{"ticker": t, "is_active": True} for t in index]

    def table(self, name: str) -> _StubTable:
        return _StubTable(self._listings if name == "listings" else self._index)


def _verdicts(
    tickers: list[str],
    *,
    quoted: list[str],
    listings: list[str],
    index: list[str],
) -> dict[str, dict[str, bool]]:
    class _Provider:
        @staticmethod
        def fetch_price_history(t: str, period: str = "max") -> Any:
            if t not in quoted:
                return None

            class _DF:
                empty = False

            return _DF()

    with patch("analytics.cron.check_stale_tickers.DATA_PROVIDER", _Provider):
        return three_source_verdict(cast(Client, _StubClient(listings, index)), tickers)


def test_a_company_gone_from_all_three_sources_is_dead() -> None:
    v = _verdicts(
        ["DEADCO"],
        quoted=[],
        listings=["AAPL", "MSFT"],
        index=["AAPL", "MSFT"],
    )
    assert v["DEADCO"] == {"quote": False, "listed": False, "indexed": False}
    assert not any(v["DEADCO"].values())


def test_a_live_company_missing_from_both_reference_tables_is_kept() -> None:
    # ⚠️ THE CASE THAT DECIDES THE DESIGN, and it is a real one: EA, EQR and AVB
    # are all trading S&P 500 companies that our `listings` AND `index_membership`
    # rows both mark inactive (verified against the live database 2026-08-30). Two
    # of three sources say dead. The quote is the only thing keeping them, so the
    # rule must be unanimous — a majority vote retires three live large caps.
    v = _verdicts(
        ["EQR"],
        quoted=["EQR"],
        listings=["AAPL"],
        index=["AAPL"],
    )
    assert v["EQR"] == {"quote": True, "listed": False, "indexed": False}
    assert any(v["EQR"].values()), "a live quote alone must be enough to keep a company"


def test_a_company_kept_by_its_reference_rows_alone_survives_a_dead_quote() -> None:
    # The mirror image, and the reason the provider is not privileged over the
    # other two: Yahoo 404s on a renamed ticker exactly as it does on one that
    # never existed (BK vs ZZQQ9, both verified). While the exchange directory or
    # an index file still carries a symbol, the provider's silence is not enough.
    #
    # ⚠️ Note this is NOT a claim that BK itself is protected. Checked on
    # 2026-08-30, the rename has propagated: `BK` is absent from both reference
    # tables, all three sources agree, and it is correctly retired — the ticker
    # really has stopped trading. Its 13,485 bars are kept and `BNY` is held
    # separately and complete. What saves that history is "mark, never delete",
    # not this test (CLAUDE.md 14f).
    v = _verdicts(
        ["RENAMED"],
        quoted=[],
        listings=["RENAMED"],
        index=["AAPL"],
    )
    assert v["RENAMED"]["quote"] is False
    assert any(v["RENAMED"].values())


def test_one_surviving_source_is_enough_to_keep_a_ticker() -> None:
    # A control on the AND. Each of these has exactly one source still holding it,
    # and each must survive — otherwise the test above passes for the wrong reason
    # (two sources agreeing) and a two-of-three rule would slip through unnoticed.
    v = _verdicts(
        ["ONLYQUOTE", "ONLYLISTED", "ONLYINDEXED"],
        quoted=["ONLYQUOTE"],
        listings=["ONLYLISTED"],
        index=["ONLYINDEXED"],
    )
    for t in ("ONLYQUOTE", "ONLYLISTED", "ONLYINDEXED"):
        assert any(v[t].values()), f"{t} has one live source and must be kept"


def test_a_provider_crash_counts_as_still_quoted() -> None:
    # Fail toward keeping. A network blip, a rate limit or a parser change inside
    # yfinance must never be read as evidence that a company stopped existing —
    # that is CLAUDE.md 11e: "I could not read it" and "it is not there" are
    # different answers and must never share a return value.
    class _Provider:
        @staticmethod
        def fetch_price_history(t: str, period: str = "max") -> Any:
            raise RuntimeError("connection reset")

    with patch("analytics.cron.check_stale_tickers.DATA_PROVIDER", _Provider):
        v = three_source_verdict(cast(Client, _StubClient(["AAPL"], ["AAPL"])), ["BOOM"])
    assert v["BOOM"]["quote"] is True


def test_an_empty_reference_set_refuses_to_run() -> None:
    # ⚠️ The control that matters most. If `listings` came back empty — a failed
    # refresh, a truncated page, a renamed column — then EVERY ticker is "absent
    # from the exchange directory", the three-source test silently becomes a
    # one-source test, and the run would retire live companies while reporting
    # exactly what a healthy run reports (CLAUDE.md 14g).
    with pytest.raises(RuntimeError, match="reference set is empty"):
        _verdicts(["X"], quoted=[], listings=[], index=["AAPL"])
    with pytest.raises(RuntimeError, match="reference set is empty"):
        _verdicts(["X"], quoted=[], listings=["AAPL"], index=[])


# ── The safety cap ───────────────────────────────────────────────────────────


def test_the_retire_cap_is_a_proportion_not_a_count() -> None:
    # A count would need re-tuning every time the universe grows, and a stale
    # threshold is one nobody trusts. 2% of 500 is 10; of 50 is 1.
    assert MAX_RETIRE_PCT == 2.0
    assert max(1, int(500 * MAX_RETIRE_PCT / 100.0)) == 10
    # ⚠️ And it never floors to zero: a small market must still be able to retire
    # its one genuinely dead company, or the sweep does nothing there forever.
    assert max(1, int(10 * MAX_RETIRE_PCT / 100.0)) == 1
