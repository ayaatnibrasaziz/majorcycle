"""A dividend re-adjusts every EARLIER bar, so it must trigger a full re-pull.

── The defect this guards ────────────────────────────────────────────────────

Our bars are `auto_adjust=True`, so each time a company goes ex-dividend the
provider divides its entire prior series by a new factor. The nightly refresh
fetches a ONE-MONTH window, so it stored the new month on the new basis and left
everything before it — the peak included — on the old one. Splits had this
machinery from the start; dividends never did.

Measured on the live database, 2026-08-29/30: the ratio between our stored close
and a fresh pull was a CONSTANT on every bar before the company's last ex-dividend
date and exactly 1.0000 after it — CBA 1.0169, GPT 1.0244 (across several
dividends, 1.0062-1.0244), MSFT 1.0019. The visible effect is a drawdown up to two
points deeper than the truth. Re-pulling CBA's full history took its 8,937 bars to
an exact match with a fresh pull, while GPT — left alone as the control — still had
9,828 bars on the old basis.

⚠️ **Nothing about this fails loudly, in any direction.** No error, no gap, no odd
chart. A slightly-too-deep fall is a perfectly plausible number, so neither review
nor any existing guard could see it; it was found by comparing our figures with a
fresh pull while auditing an article, which is a question nobody had asked before.

── What is asserted, and what deliberately is NOT ────────────────────────────

The trigger is asserted at both ends: the provider must SURFACE a dividend it was
given, and the refresh must READ it. Both halves fail silently on their own — a
provider that stops setting the attr leaves `_recent_dividends` returning `[]`
forever, which is indistinguishable from a company that pays nothing.

There is no "verify it worked" step, unlike splits. A split can leave a real cliff
when the provider's own history is internally inconsistent (MNST, audit F-030), so
splits carry a pending/resolve cycle. A dividend adjustment is a smooth rescale of
the whole series: the re-pull either happened or it did not, and there is no
signature in the data to check afterwards. Asserting one would be inventing work
for a failure mode that does not exist.

yfinance is fully mocked — no network, so this runs on a fork PR with no secrets.
"""
from unittest.mock import MagicMock, patch

import pandas as pd

from analytics.cron.daily_refresh import (
    _recent_dividend_events,
    _recent_dividends,
    _should_record_corporate_actions,
)
from analytics.providers.yfinance_provider import YFinanceProvider

# ── The refresh's reader ──────────────────────────────────────────────────────

def _bars(*, dividends: list[str] | None = None) -> pd.DataFrame:
    idx = pd.date_range("2026-08-03", periods=3, freq="B")
    df = pd.DataFrame({"Close": [10.0, 10.5, 11.0]}, index=idx)
    if dividends is not None:
        df.attrs["recent_dividends"] = dividends
    return df


def test_dividend_date_is_surfaced_to_the_refresh() -> None:
    assert _recent_dividends(_bars(dividends=["2026-08-19"])) == ["2026-08-19"]


def test_no_dividend_in_window_means_no_repull() -> None:
    assert _recent_dividends(_bars(dividends=[])) == []


def test_missing_attr_does_not_error() -> None:
    # The stooq fallback path never sets the attr. It must read as "no dividend",
    # not blow up the whole nightly run for one ticker.
    assert _recent_dividends(_bars()) == []


# ── The provider's writer ─────────────────────────────────────────────────────

def _history(dividends: list[float]) -> pd.DataFrame:
    idx = pd.to_datetime(
        ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"]
    )
    n = len(idx)
    return pd.DataFrame(
        {
            "Open": [10.0] * n,
            "High": [11.0] * n,
            "Low": [9.0] * n,
            "Close": [10.0] * n,
            "Volume": [100] * n,
            "Dividends": dividends,
            "Stock Splits": [0.0] * n,
        },
        index=idx,
    )


def _download(df: pd.DataFrame):
    # install_cache() is a global side effect (writes a sqlite file) — stub it.
    with patch("analytics.providers.yfinance_provider.requests_cache.install_cache"):
        provider = YFinanceProvider()
    fake = MagicMock()
    fake.history.return_value = df
    with patch("analytics.providers.yfinance_provider.yf.Ticker", return_value=fake):
        # period != "max" skips the _MIN_BARS gate so a tiny fixture is enough.
        return provider._download_yfinance("TEST", period="1mo")


def test_provider_surfaces_the_dividend_date() -> None:
    out, _ = _download(_history([0.0, 0.0, 2.40, 0.0, 0.0]))
    assert out is not None
    assert out.attrs["recent_dividends"] == ["2026-08-19"]
    # End to end: what the provider writes is what the refresh reads.
    assert _recent_dividends(out) == ["2026-08-19"]


def test_provider_reports_nothing_for_a_company_that_pays_nothing() -> None:
    # THE CONTROL. Without it, a writer that returned every date unconditionally
    # would pass the test above and re-pull the entire universe every night.
    out, _ = _download(_history([0.0] * 5))
    assert out is not None
    assert out.attrs["recent_dividends"] == []


def test_every_dividend_in_the_window_is_reported() -> None:
    # A month can hold more than one (a special alongside an ordinary one), and
    # missing the second would leave the history on the second-to-last basis —
    # wrong by a smaller amount, which is harder to notice, not easier.
    out, _ = _download(_history([0.0, 1.10, 0.0, 0.25, 0.0]))
    assert out is not None
    assert out.attrs["recent_dividends"] == ["2026-08-18", "2026-08-20"]


def test_a_dividend_column_of_nans_is_not_a_dividend() -> None:
    # yfinance serves NaN rather than 0.0 on some paths. `!= 0` is true for NaN,
    # which would make every bar look like an ex-dividend date and re-pull the
    # whole universe nightly — a performance failure with no visible symptom.
    out, _ = _download(_history([float("nan")] * 5))
    assert out is not None
    assert out.attrs["recent_dividends"] == []


# ── The RECORD, kept separate from the TRIGGER ────────────────────────────────
#
# Owner's request, 2026-08-30: corporate actions get one table per kind of action,
# so `dividend_events` sits beside `split_events` rather than inside it. What the
# tests below protect is the SEPARATION — `recent_dividends` (dates, load-bearing)
# and `recent_dividend_events` (dates + amounts, visibility) must not become one
# thing, because a change made for the record's sake could then break the trigger,
# and the trigger's failure is the one nothing can see.


def test_the_record_carries_the_dividend_amount() -> None:
    out, _ = _download(_history([0.0, 0.0, 2.40, 0.0, 0.0]))
    assert out is not None
    assert out.attrs["recent_dividend_events"] == [{"date": "2026-08-19", "amount": 2.40}]


def test_the_trigger_and_the_record_see_the_same_dividends() -> None:
    # If these two ever disagree, the database's account of why a company was
    # re-pulled stops matching what actually happened — and the row that is
    # missing is the evidence for the case that went wrong.
    out, _ = _download(_history([0.0, 1.10, 0.0, 0.25, 0.0]))
    assert out is not None
    assert _recent_dividends(out) == [e["date"] for e in _recent_dividend_events(out)]
    assert [e["amount"] for e in _recent_dividend_events(out)] == [1.10, 0.25]


def test_the_record_is_empty_for_a_company_that_pays_nothing() -> None:
    # THE CONTROL. Without it a writer emitting a row per BAR would pass every
    # test above and put a dividend record on every company every night.
    out, _ = _download(_history([0.0] * 5))
    assert out is not None
    assert out.attrs["recent_dividend_events"] == []


def test_a_missing_record_attr_does_not_error() -> None:
    # The stooq fallback path sets none of these attrs. Reading one must be "no
    # dividends", never an exception that kills the whole nightly run for one
    # ticker.
    assert _recent_dividend_events(_bars()) == []
    assert _recent_dividend_events(_bars(dividends=[])) == []


# ── A BULK RE-PULL MUST NOT BE RECORDED AS "what happened last night" ─────────
#
# This rule was MISSING for splits and it cost a manual cleanup on 2026-08-30: the
# `--repull-prices` catch-up that cleared a year of dividend drift took
# `split_events` from 8 rows to 1,762 in one evening, 120 of them stuck 'pending'
# and set to re-pull a whole company history nightly for 30 days. The owner had all
# 1,754 deleted. The dividend side would have written ~150,000 rows.
#
# One rule, one place, both tables (CLAUDE.md 11c) — and tested, because deleting
# `and not repull_prices` from an inline condition breaks nothing visibly and the
# damage only appears the next time somebody runs a catch-up.


def test_an_ordinary_nightly_fetch_is_recorded() -> None:
    assert _should_record_corporate_actions(first_fetch=False, repull_prices=False) is True


def test_a_full_repull_is_not_recorded() -> None:
    # The case that caused the cleanup.
    assert _should_record_corporate_actions(first_fetch=False, repull_prices=True) is False


def test_a_first_fetch_is_not_recorded() -> None:
    # A different reason from the one above, and it must not be lost while
    # "simplifying": the `stocks` row does not exist yet at this point in the loop,
    # and both event tables carry a foreign key to it.
    assert _should_record_corporate_actions(first_fetch=True, repull_prices=False) is False


def test_both_at_once_is_still_not_recorded() -> None:
    assert _should_record_corporate_actions(first_fetch=True, repull_prices=True) is False
