"""When the nightly refresh re-reads a ticker's enriched data (`_should_fetch_enriched`).

Beta review B-1 (2026-09-28): the old rule could never re-fire for a ticker enriched on
its own earnings day, and 771 of 872 stocks sat a median 54 days stale with every run
green. These tests pin the three reasons the new rule fires, the stuck state that
started it, and — by simulating the whole universe night by night — the two properties
that matter to a reader and to the workflow's time budget: nothing ever gets old, and
the work is spread over the week instead of landing on one night.
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from typing import Optional

from analytics.cron.daily_refresh import (
    _ENRICH_MAX_AGE_DAYS,
    _POST_EARNINGS_SETTLE_DAYS,
    _enrich_weekday,
    _should_fetch_enriched,
)


def _state(enriched: Optional[str], next_ed: Optional[str] = None) -> dict:
    return {
        "enriched_updated_at": f"{enriched}T00:05:00+00:00" if enriched else None,
        "next_earnings_date": next_ed,
    }


def _off_day(ticker: str, today: date) -> bool:
    return today.weekday() != _enrich_weekday(ticker)


def _day_not_its_weekday(ticker: str, start: date) -> date:
    d = start
    while not _off_day(ticker, d):
        d += timedelta(days=1)
    return d


def test_the_stuck_state_that_started_it_now_refreshes() -> None:
    # AAPL on 2026-09-28: enriched 2026-07-30 00:05 — ON its earnings day, before the
    # results — with next_earnings_date still 2026-07-30. The old rule never fired again.
    assert _should_fetch_enriched(_state("2026-07-30", "2026-07-30"), "2026-09-28", "smart", "AAPL")


def test_full_mode_new_ticker_and_missing_timestamp_always_fetch() -> None:
    assert _should_fetch_enriched(_state("2026-09-28"), "2026-09-28", "full", "AAPL")
    assert _should_fetch_enriched(None, "2026-09-28", "smart", "AAPL")
    assert _should_fetch_enriched(_state(None), "2026-09-28", "smart", "AAPL")
    assert _should_fetch_enriched(_state("garbage"), "2026-09-28", "smart", "AAPL")


def test_not_twice_on_the_same_day() -> None:
    # CONTROL: a rule that always says yes passes every "it refreshes" test above and
    # blows the nightly time budget. Enriched this morning = not again tonight, even on
    # its weekly day and even right after earnings.
    for ticker in ("AAPL", "BHP.AX", "SHOP.TO", "AE.V", "MSFT"):
        for offset in range(7):
            today = date(2026, 9, 28) + timedelta(days=offset)
            t = today.isoformat()
            assert not _should_fetch_enriched(_state(t), t, "smart", ticker)
            yesterday_earnings = (today - timedelta(days=1)).isoformat()
            assert not _should_fetch_enriched(_state(t, yesterday_earnings), t, "smart", ticker)


def test_max_age_fires_on_any_weekday() -> None:
    ticker = "AAPL"
    today = _day_not_its_weekday(ticker, date(2026, 9, 28))
    young = (today - timedelta(days=_ENRICH_MAX_AGE_DAYS - 1)).isoformat()
    old = (today - timedelta(days=_ENRICH_MAX_AGE_DAYS)).isoformat()
    assert not _should_fetch_enriched(_state(young, "2026-12-01"), today.isoformat(), "smart", ticker)
    assert _should_fetch_enriched(_state(old, "2026-12-01"), today.isoformat(), "smart", ticker)


def test_its_weekday_fires_and_other_days_do_not() -> None:
    ticker = "CBA.AX"
    base = date(2026, 10, 5)
    fired = []
    for offset in range(7):
        today = base + timedelta(days=offset)
        last = (today - timedelta(days=2)).isoformat()
        if _should_fetch_enriched(_state(last, "2027-02-01"), today.isoformat(), "smart", ticker):
            fired.append(today.weekday())
    assert fired == [_enrich_weekday(ticker)]


def test_after_earnings_it_refreshes_until_the_statements_have_had_time() -> None:
    ticker = "MSFT"
    earnings = date(2026, 10, 20)
    ed = earnings.isoformat()
    # Earnings day itself: results may come after the close, so nothing yet (off-day).
    day0 = earnings
    if not _off_day(ticker, day0):
        day0 = earnings  # its weekly day would fire anyway; the next assertion skips it
    else:
        assert not _should_fetch_enriched(_state("2026-10-19", ed), day0.isoformat(), "smart", ticker)
    # The morning after, even if enriched the day before the report: fetch.
    assert _should_fetch_enriched(_state("2026-10-19", ed), "2026-10-21", "smart", ticker)
    # Enriched on the day after — still inside the settle window, so again the next night.
    assert _should_fetch_enriched(_state("2026-10-21", ed), "2026-10-22", "smart", ticker)
    # Once an enrichment has been taken `settle` days after, the earnings reason stops.
    settled = earnings + timedelta(days=_POST_EARNINGS_SETTLE_DAYS)
    after = _day_not_its_weekday(ticker, settled + timedelta(days=1))
    if (after - settled).days < _ENRICH_MAX_AGE_DAYS:
        assert not _should_fetch_enriched(_state(settled.isoformat(), ed), after.isoformat(), "smart", ticker)


def test_the_weekday_hash_spreads_the_universe() -> None:
    tickers = [f"T{i}" for i in range(868)] + ["AAPL", "BHP.AX", "SHOP.TO", "AE.V"]
    counts = [0] * 7
    for t in tickers:
        counts[_enrich_weekday(t)] += 1
    # 872 / 7 = 124.6 — no night should carry more than ~1.3x its share.
    assert max(counts) <= 160, counts
    assert min(counts) >= 90, counts
    # Stable across calls (a salted hash() would move every ticker each process).
    assert _enrich_weekday("AAPL") == _enrich_weekday("AAPL")


def test_ninety_nights_of_the_whole_universe() -> None:
    """Simulate the nightly job: every ticker enriched on day 0 (the catch-up full
    refresh), quarterly earnings, and a provider that sometimes keeps reporting the
    old earnings date for days afterwards — the behaviour that caused B-1."""
    rng = random.Random(28)
    start = date(2026, 9, 28)
    tickers = [f"T{i}" for i in range(868)] + ["AAPL", "BHP.AX", "SHOP.TO", "AE.V"]
    last = {t: start for t in tickers}
    first_ed = {t: start + timedelta(days=rng.randint(5, 95)) for t in tickers}
    reported = dict(first_ed)  # what the provider says the next earnings date is
    earnings_seen: dict[str, list[date]] = {t: [] for t in tickers}
    nightly: list[int] = []
    worst_age = 0

    for n in range(1, 91):
        today = start + timedelta(days=n)
        count = 0
        for t in tickers:
            worst_age = max(worst_age, (today - last[t]).days)
            state = {
                "enriched_updated_at": f"{last[t].isoformat()}T00:05:00+00:00",
                "next_earnings_date": reported[t].isoformat(),
            }
            if _should_fetch_enriched(state, today.isoformat(), "smart", t):
                count += 1
                last[t] = today
                if reported[t] < today:
                    earnings_seen[t].append(today)
                    # Half the time the provider has already moved on; otherwise it
                    # keeps the stale date until a week after the report.
                    if rng.random() < 0.5 or (today - reported[t]).days >= 7:
                        reported[t] = reported[t] + timedelta(days=91)
        nightly.append(count)

    # Nothing a reader sees is ever more than the max age behind (it is checked
    # before the night's run, so an 8-day-old row is refreshed that night).
    assert worst_age <= _ENRICH_MAX_AGE_DAYS, worst_age
    # The time budget: after the first week no night carries a pile-up.
    assert max(nightly[7:]) <= 260, nightly
    assert sum(nightly[7:]) / len(nightly[7:]) <= 175, nightly
    # Every ticker whose earnings passed was re-read after its results.
    for t in tickers:
        if first_ed[t] < start + timedelta(days=85):
            assert earnings_seen[t], t
