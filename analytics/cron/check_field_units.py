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
    python -m analytics.cron.check_field_units --email  # also email the owner

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

import requests
from supabase import Client, create_client

from analytics.providers.field_spec import FUNDAMENTALS_SPEC

logger = logging.getLogger(__name__)

_PAGE = 1000

#: Below this many stocks with a value, a median means nothing and the field is
#: reported as "thin" rather than breached.
_MIN_SAMPLE = 30


def _get_supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )


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


def _email(subject: str, body: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY", "")
    owner = os.environ.get("OWNER_EMAIL", "")
    if not api_key or not owner:
        logger.warning("Email skipped — RESEND_API_KEY or OWNER_EMAIL not set")
        return
    try:
        requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": "MajorCycle Cron <noreply@majorcycle.com>",
                "to": [owner],
                "subject": subject,
                "text": body,
            },
            timeout=10,
        )
    except Exception as e:
        logger.error("Failed to send email: %s", e)


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", action="store_true", help="email the owner on a breach")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    rows = _load_fundamentals(_get_supabase())
    breaches, thin, checked = check(rows)

    logger.info(
        "check_field_units: %d field(s) checked across %d stocks", checked, len(rows)
    )
    for t in thin:
        logger.info("  thin sample, skipped — %s", t)

    if not checked:
        logger.error("No field had a large enough sample — the check ran on nothing.")
        return 1

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
    if args.email:
        _email(f"MajorCycle: {len(breaches)} fundamentals field(s) look mis-scaled", body)
    return 1


if __name__ == "__main__":
    sys.exit(main())
