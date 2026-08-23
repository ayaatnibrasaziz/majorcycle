"""Nightly tripwire: has the data provider quietly changed a field's units?

This is the guard that would have caught the `dividendYield` change on the day
it happened. yfinance switched that field from a fraction (0.032) to a percent
(3.20) in a routine release. Nothing errored. Every stored value was still a
plausible number. The only way to see it was to look at the whole cohort at
once: a universe whose median dividend yield is 0.02 is not a universe of
low-yielding companies, it is a universe measured in the wrong unit.

So this checks DISTRIBUTIONS, not values. A single stock is allowed to be an
outlier — a 35% yield is real, and rejecting it would throw away true data. What
is not allowed is for the *median* of 863 stocks to sit two orders of magnitude
away from where that field lives, because no market moves like that overnight.

The expected bands are declared once, beside the units themselves, in
`analytics/providers/field_spec.py`.

Run after the refresh:

    python -m analytics.cron.check_field_units          # report, exit 0/1

Deliberately advisory rather than blocking: it runs *after* the data is written,
so it tells the owner something is wrong rather than silently discarding a
night's refresh on a rule that might itself be miscalibrated.
"""

import argparse
import logging
import os
import statistics
import sys
from typing import Any, Optional, cast

from supabase import Client, create_client

from analytics.providers.field_spec import FUNDAMENTALS_SPEC

logger = logging.getLogger(__name__)

_PAGE = 1000

#: Below this many stocks with a value, a median means nothing and the field is
#: reported as "thin" rather than breached.
_MIN_SAMPLE = 30

#: What `check_invariants` covers. The nightly log prints these NAMES rather than
#: a count: a count silently goes stale the moment a rule is added, which this
#: repo has already paid for once (the entitlement guard printed "14 checks" over
#: 11 sections). A missing name in the log is visible; a wrong number is not.
INVARIANT_RULES = (
    "zero-margin sentinel",
    "cross-currency fcf_yield_pct",
    "financial_currency coverage",
)


def _get_supabase() -> Client:
    # Accept either name — see the same note in daily_refresh.py. The workflow sets
    # SUPABASE_URL; a hand-run off .env.local has only NEXT_PUBLIC_SUPABASE_URL.
    url = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    return create_client(url, os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def _load_fundamentals(supabase: Client) -> list[dict[str, Any]]:
    """Every non-index stock's fundamentals, paginated (PostgREST caps at 1000)."""
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        res = (
            supabase.table("stocks")
            .select("ticker,fundamentals")
            .neq("market", "index")
            .range(start, start + _PAGE - 1)
            .execute()
        )
        batch = cast(list[dict[str, Any]], res.data or [])
        rows.extend(batch)
        if len(batch) < _PAGE:
            return rows
        start += _PAGE


def check_invariants(rows: list[dict[str, Any]]) -> list[str]:
    """Rules that must hold for EVERY stored row, checked against the data itself.

    These exist because the same rule is applied in more than one runtime. The
    provider normalises on write and the Python serverless functions normalise on
    read — but the TypeScript reader that renders the Key Metrics table does
    neither, so a stale row reached the screen with a cross-currency FCF yield
    even after the "fix" was in. Asserting the invariant on the DATA covers every
    reader at once, rather than re-implementing the rule in each language and
    hoping the copies agree.
    """
    problems: list[str] = []

    zero_margins: dict[str, list[str]] = {}
    fcf_mixed: list[str] = []
    missing_fin_cur: list[str] = []
    for r in rows:
        f = r.get("fundamentals") or {}
        ticker = str(r.get("ticker", "?"))
        if not f.get("financial_currency"):
            missing_fin_cur.append(ticker)
        for name in ("gross_margin", "operating_margin", "net_margin", "ebitda_margin"):
            if f.get(name) == 0:
                zero_margins.setdefault(name, []).append(ticker)
        price_cur, fin_cur = f.get("currency"), f.get("financial_currency")
        if (
            price_cur and fin_cur and price_cur != fin_cur
            and isinstance(f.get("fcf_yield_pct"), (int, float))
        ):
            fcf_mixed.append(ticker)

    for name, tickers in sorted(zero_margins.items()):
        problems.append(
            f"{name}: {len(tickers)} row(s) store an exact 0.0, which is the "
            f"provider's 'not reported' sentinel and scores as a real 0% "
            f"(e.g. {', '.join(sorted(tickers)[:5])})"
        )
    if fcf_mixed:
        problems.append(
            f"fcf_yield_pct: {len(fcf_mixed)} row(s) mix currencies — cash flow is "
            f"in the reporting currency and market cap in the price currency "
            f"(e.g. {', '.join(sorted(fcf_mixed)[:5])})"
        )

    # Coverage, checked LAST because it explains the two checks above.
    #
    # The cross-currency test needs `financial_currency` to do anything at all —
    # so a row that lost the field is not clean, it is UNMEASURABLE, and it
    # counts as a pass. That is not hypothetical: on 2026-08-05 this function
    # reported "0 cross-currency FCF yields" over a universe where 608 of 863
    # rows had been rewritten by a refresh running pre-fix code, wiping the very
    # field the test reads. A silent instrument is worse than a red one.
    #
    # A proportion, not an absolute: a handful of tickers can genuinely lack
    # `financialCurrency` upstream, and a check that cries wolf gets ignored.
    # A wholesale revert shows up as most of the universe at once.
    if rows:
        share = len(missing_fin_cur) / len(rows)
        if share > 0.05:
            problems.append(
                f"financial_currency: missing on {len(missing_fin_cur)} of {len(rows)} "
                f"row(s) ({share:.0%}) — the cross-currency checks cannot run on those, "
                f"so they PASS without being tested. This is what a refresh running "
                f"code from before the reporting-currency fix looks like "
                f"(e.g. {', '.join(sorted(missing_fin_cur)[:5])})"
            )
    return problems


def check(rows: list[dict[str, Any]]) -> tuple[list[str], list[str], int]:
    """Return (breaches, thin_fields, fields_checked)."""
    breaches: list[str] = []
    thin: list[str] = []
    checked = 0

    for name, spec in FUNDAMENTALS_SPEC.items():
        if spec.median_band is None:
            continue
        values = [
            float(v)
            for r in rows
            if isinstance(v := (r.get("fundamentals") or {}).get(name), (int, float))
        ]
        if len(values) < _MIN_SAMPLE:
            thin.append(f"{name}: only {len(values)} value(s)")
            continue

        checked += 1
        median = statistics.median(values)
        lo, hi = spec.median_band
        if not (lo <= median <= hi):
            # Name the most likely cause. A 100x miss in either direction is the
            # fraction/percent confusion that has bitten this codebase before.
            # 20x, not 100x. A fraction/percent mix-up is a factor of 100 on the
            # VALUE, but the band has width, so the miss measured against its
            # nearer edge is smaller: a dividend yield reverting to a fraction
            # gives a median of 0.024 against a lower bound of 1.0 — a ratio of
            # 42, not 100. Set at 50 initially, and the test written for exactly
            # that regression is what showed the hint never firing.
            hint = ""
            if median != 0:
                if lo / median > 20:
                    hint = "  <-- looks like a FRACTION where a percent is expected (x100 missing)"
                elif median / hi > 20:
                    hint = "  <-- looks like a PERCENT where a fraction is expected (x100 applied twice)"
            breaches.append(
                f"{name}: median {median:,.4g} is outside the expected "
                f"[{lo:,.4g}, {hi:,.4g}] over {len(values)} stocks{hint}"
            )

    return breaches, thin, checked


def main(argv: Optional[list[str]] = None) -> int:
    # No arguments: the exit code IS the signal. A non-zero exit fails the
    # workflow step, which turns the run red and triggers GitHub's own
    # failed-workflow email (owner decision, 2026-08-06 — see D9).
    argparse.ArgumentParser(description=__doc__).parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    rows = _load_fundamentals(_get_supabase())
    breaches, thin, checked = check(rows)
    invariants = check_invariants(rows)

    logger.info(
        "check_field_units: %d field(s) checked across %d stocks; invariants: %s",
        checked, len(rows), ", ".join(INVARIANT_RULES),
    )
    for t in thin:
        logger.info("  thin sample, skipped — %s", t)

    if not checked:
        logger.error("No field had a large enough sample — the check ran on nothing.")
        return 1

    breaches = breaches + invariants
    if not breaches:
        logger.info("check_field_units: OK — every median is where it should be")
        return 0

    body = (
        "One or more fundamentals fields no longer sit where they should.\n\n"
        "This usually means the data provider changed a field's units in a "
        "release. Compare a live yfinance `info` value against what we store "
        "before trusting tonight's data.\n\n"
        + "\n".join(f"  - {b}" for b in breaches)
        + f"\n\n{checked} field(s) checked across {len(rows)} stocks."
    )
    logger.error("check_field_units: %d breach(es)\n%s", len(breaches), body)
    return 1


if __name__ == "__main__":
    sys.exit(main())
