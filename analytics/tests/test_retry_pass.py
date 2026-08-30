"""The nightly refresh's second pass — which failures it retries, and when it won't.

── Why a second pass exists at all ───────────────────────────────────────────

The provider already retries three times, but those attempts span roughly seven
seconds of exponential backoff. A rate-limit window, a brief Yahoo outage or one
dropped connection outlasts all three, and the ticker is written off for the night.

⚠️ **The cost is not a missing day — it is a lasting data defect.** A ticker skipped
tonight is fetched tomorrow on a ONE-MONTH window. If it went ex-dividend in
between, the re-pull trigger has already scrolled out of view, and its history is
left on two adjustment bases: every drawdown on its page reads too deep, silently,
until something re-pulls it (CLAUDE.md 11ae). `ASK.AX` failed exactly once during
the 2026-08-30 catch-up and is otherwise perfectly current — a transient miss is
indistinguishable from a delisting to anything looking at one night.

── Why the decision is a separate function ───────────────────────────────────

`run()` needs a provider, a database and a clock, so the loop itself cannot be
driven in a credential-free test. `_retry_targets` is the only *decision* in the
two-pass design, so it is pulled out where it can be exercised directly.
"""

from analytics.cron.daily_refresh import (
    _RETRY_MAX_SHARE,
    _RETRY_MIN_ALWAYS,
    _retry_targets,
)


def test_a_handful_of_failures_is_retried() -> None:
    # The ordinary bad night: the 2026-08-28 run logged 3 failures in 620 tickers.
    assert _retry_targets(["ASK.AX", "BHP.AX", "CBA.AX"], 620) == [
        "ASK.AX",
        "BHP.AX",
        "CBA.AX",
    ]


def test_a_clean_night_needs_no_second_pass() -> None:
    assert _retry_targets([], 620) == []


def test_a_systemic_failure_is_not_retried() -> None:
    # ⚠️ A TIME-BUDGET guard, not a data one. If half the universe failed, the
    # cause is systemic and re-fetching hundreds of tickers cannot fit in the
    # workflow's remaining minutes — the job would hit `timeout-minutes` and die
    # MID-WRITE, which is worse than finishing and reporting. The staleness sweep
    # at the end of the workflow raises the alarm either way.
    assert _retry_targets([f"T{i}" for i in range(400)], 620) == []


def test_the_cap_is_a_share_not_a_count() -> None:
    # A count would need re-tuning every time the universe grows — and a threshold
    # nobody has re-tuned is a threshold nobody trusts. 25% of 620 is 155; of 100
    # it is 25. Both sides here are above _RETRY_MIN_ALWAYS, so the SHARE is what
    # is being measured and not the floor.
    assert _retry_targets([f"T{i}" for i in range(200)], 1200) != []
    assert _retry_targets([f"T{i}" for i in range(200)], 300) == []


def test_the_boundary_is_tested_on_both_sides() -> None:
    # A bound checked on one side only tests the direction that was never the
    # failure mode (CLAUDE.md 11i). At exactly the cap the retry still runs; one
    # ticker past it, it does not.
    n = 400
    at_cap = int(_RETRY_MAX_SHARE * n)          # 100
    assert len(_retry_targets([f"T{i}" for i in range(at_cap)], n)) == at_cap
    assert _retry_targets([f"T{i}" for i in range(at_cap + 1)], n) == []


def test_a_tiny_run_still_retries() -> None:
    # ⚠️ THE DEFECT AN END-TO-END RUN CAUGHT, and the unit tests had blessed the
    # wrong behaviour. `--only AAPL,ZZQQ9` is one failure in two — 50% — so the
    # share test refused to retry a SINGLE ticker: the cheapest possible retry, on
    # the kind of hand-run somebody is sitting and watching.
    #
    # I had written the old version of this test asserting that was deliberate, on
    # the reasoning that a hand-run's failure is visible in the terminal anyway.
    # Running it proved the reasoning wrong-headed: the guard is a TIME budget, and
    # time depends on how many tickers must be re-fetched, not on what fraction of
    # the run they were. Hence `_RETRY_MIN_ALWAYS`.
    assert _retry_targets(["ZZQQ9"], 2) == ["ZZQQ9"]
    assert _retry_targets(["AAPL"], 1) == ["AAPL"]
    assert _retry_targets(["AAPL"], 620) == ["AAPL"]


def test_the_floor_applies_however_small_the_universe() -> None:
    # Up to _RETRY_MIN_ALWAYS tickers is always affordable — a handful of fetches
    # plus one five-minute wait — so the share never gets a say below it.
    assert _retry_targets([f"T{i}" for i in range(_RETRY_MIN_ALWAYS)], 30) != []
    # Above the floor, the share takes over again and refuses a systemic failure.
    assert _retry_targets([f"T{i}" for i in range(_RETRY_MIN_ALWAYS + 1)], 30) == []
