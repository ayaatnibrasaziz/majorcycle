"""The three Run Analysis presets — decision #15, and a locked contract.

Why this file exists
--------------------
The Layer G coverage map found that ``analytics/presets.py`` was referenced by no
test at all. It is four lines of literals, which is exactly why nobody wrote one —
and exactly why a wrong edit here would be invisible. These numbers are a **locked
decision** (CLAUDE.md #15: Short -3/+3/63, Medium -5/+5/252, Long -8/+8/756), they
are quoted to readers in the Methodology copy, and every rating on the site is
computed through them. A typo in one digit changes every score in the product while
every test stays green and every page still renders.

⚠️ These tests deliberately assert **literal values**, which is normally a smell —
a test that restates the source proves nothing about behaviour. It is right here
for one reason: this file *is* the decision, not an implementation of it. The
assertion is against CLAUDE.md, and the failure it is meant to catch is somebody
"tidying" 252 to 250 or flipping a sign. There is no other copy to compare against,
so restating it is the only available check.
"""

from __future__ import annotations

from analytics.presets import PRESETS


def test_exactly_three_presets() -> None:
    # Custom is not in here — it is user-supplied at the call site. If a fourth
    # ever appears in this dict, the UI's preset picker and the Methodology copy
    # both need to know, so make it fail rather than quietly ship.
    assert sorted(PRESETS) == ["long", "medium", "short"]


def test_short_preset_matches_the_locked_decision() -> None:
    assert PRESETS["short"] == {
        "pullback_threshold": -3.0,
        "profit_threshold": 3.0,
        "lookback_bars": 63,
    }


def test_medium_preset_matches_the_locked_decision() -> None:
    assert PRESETS["medium"] == {
        "pullback_threshold": -5.0,
        "profit_threshold": 5.0,
        "lookback_bars": 252,
    }


def test_long_preset_matches_the_locked_decision() -> None:
    assert PRESETS["long"] == {
        "pullback_threshold": -8.0,
        "profit_threshold": 8.0,
        "lookback_bars": 756,
    }


def test_pullback_is_negative_and_profit_is_positive() -> None:
    # The sign carries the meaning: pullback is a fall from a peak, profit is a
    # rise from a trough. Swapping them would still compute *something* — a
    # plausible number for every stock — and the label would simply become a lie.
    for name, p in PRESETS.items():
        assert p["pullback_threshold"] < 0, f"{name} pullback must be a fall"
        assert p["profit_threshold"] > 0, f"{name} profit must be a rise"


def test_the_three_horizons_are_ordered_and_distinct() -> None:
    # Short < Medium < Long, strictly. Two presets with the same lookback would
    # give a reader two differently-named buttons producing identical output.
    bars = [PRESETS[k]["lookback_bars"] for k in ("short", "medium", "long")]
    assert bars == sorted(bars)
    assert len(set(bars)) == 3


def test_thresholds_widen_with_the_horizon() -> None:
    # A longer horizon tolerates a deeper dip before it counts as a cycle event.
    # If a short horizon ever demanded a *larger* move than a long one, the three
    # presets would no longer describe a scale at all.
    mags = [abs(PRESETS[k]["pullback_threshold"]) for k in ("short", "medium", "long")]
    assert mags == sorted(mags)
    assert len(set(mags)) == 3


def test_lookbacks_are_whole_bars() -> None:
    # These index into a price series. A float would silently truncate somewhere
    # downstream rather than raise.
    for name, p in PRESETS.items():
        assert isinstance(p["lookback_bars"], int), f"{name} lookback must be an int"
