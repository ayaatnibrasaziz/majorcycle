"""When is a listings pull a REGRESSION rather than ordinary churn?

The AU source returned zero symbols every night from 2026-07-24 and nothing said
so for a month (audit F-027). `is_regression` is the rule that decides when the
nightly job goes red, so it is worth being precise about — a threshold that fires
on real delistings is a threshold people learn to ignore, and one that never fires
is what we already had.

⚠️ The parametrised cases below include the two that must stay QUIET. They are not
padding: a rule that answers "yes" to everything would satisfy every "must fire"
case in this file and would fail the product, because it would go red on a cold
start and on an ordinary week.
"""
import pytest

from analytics.cron.refresh_listings import is_regression, is_safe_to_deactivate

# (fetched, existing_active, is_a_regression, why)
CASES = [
    # ── must fire ────────────────────────────────────────────────────────────
    (0, 2000, True, "the exact F-027 case: the source answered, with nothing in it"),
    (0, 1, True, "one stored symbol is still a market we had and now do not"),
    (5, 2000, True, "near-empty is the same failure as empty, dressed up"),
    (999, 2000, True, "half a market vanishing overnight is not churn"),
    # ── must stay quiet ──────────────────────────────────────────────────────
    (0, 0, False, "a cold start has nothing to have lost — this is a NEW market"),
    (1841, 2000, False, "8% down is a month of ordinary delistings, not a fault"),
    (2000, 2000, False, "unchanged"),
    (2400, 2000, False, "a market that grew"),
    (1000, 2000, False, "exactly half survives — the bound is BELOW half, not at it"),
]


@pytest.mark.parametrize("fetched,existing,expected,why", CASES)
def test_is_regression(fetched: int, existing: int, expected: bool, why: str) -> None:
    assert is_regression(fetched, existing) is expected, why


def test_the_real_numbers_from_the_incident() -> None:
    """The measured figures, so this stays anchored to what actually happened.

    On 2026-08-25 the ASX source returned 0 against 2,000 stored AU symbols, and
    the replacement returned 1,841 against the same 2,000. The rule has to
    separate those two, and by a comfortable margin rather than a hair — 1,841 is
    92% of the menu, which is nowhere near the bound.
    """
    assert is_regression(0, 2000) is True
    assert is_regression(1841, 2000) is False


# (missing, existing_active, safe_to_deactivate, why)
DEACTIVATION_CASES = [
    # ── must refuse ──────────────────────────────────────────────────────────
    (158, 1981, False, "the measured changeover: 8% of the ASX is source disagreement, not delistings"),
    (1981, 1981, False, "retiring the entire market"),
    (100, 1981, False, "5% in one night is still two sources disagreeing"),
    # ── must allow ───────────────────────────────────────────────────────────
    (0, 1981, True, "nothing to retire"),
    (3, 1981, True, "three delistings in a week is exactly what the sweep is for"),
    (39, 1981, True, "just under 2% — the sweep must not stop working for real churn"),
    (0, 0, True, "a cold start: nothing stored, nothing to protect"),
]


@pytest.mark.parametrize("missing,existing,expected,why", DEACTIVATION_CASES)
def test_is_safe_to_deactivate(missing: int, existing: int, expected: bool, why: str) -> None:
    assert is_safe_to_deactivate(missing, existing) is expected, why


def test_the_two_rules_are_independent() -> None:
    """A pull can be perfectly healthy in size and still be unsafe to sweep with.

    This is the case that actually happened and the reason there are two rules
    rather than one. 1,841 symbols against 1,981 stored is nowhere near a
    regression — the market did not collapse — and yet the 158 it omits include
    QUB.AX and CVW.AX, both live and both covered by us. A single threshold would
    have had to choose between crying wolf on the pull and silently delisting
    those two.
    """
    assert is_regression(1841, 1981) is False, "the pull itself is healthy"
    assert is_safe_to_deactivate(158, 1981) is False, "but its omissions must not delist anyone"
