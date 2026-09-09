"""The data-version migration must arm all three verbs on price_bars.

⚠️ THIS GUARD READS THE MIGRATION, NOT THE DATABASE — say which half a guard can
see rather than let silence read as coverage (CLAUDE.md 14g). The BEHAVIOUR of the
UPDATE path is driven against the live database by `web/e2e/data-version.spec.ts`;
INSERT and DELETE are deliberately not driven there, because doing so on a
production table means creating and removing a real price bar on every CI run and
one failed cleanup leaves a poisoned chart. Both were proven by hand on 2026-09-09
(a new bar +1, a deleted bar +1). What this file protects is the WIRING, which is
the part a future edit would silently drop.

Why it matters that all three are armed: `daily_refresh._upsert_price_bars` issues
INSERT ... ON CONFLICT DO UPDATE, and in Postgres a row that already exists takes
the UPDATE path and fires UPDATE triggers rather than INSERT ones. A trigger armed
only on INSERT would therefore sit silent on the split and dividend re-pulls
(11ae/11af) — the writes that rewrite HISTORY without adding a bar, and the exact
case where a stale cached analysis would be most wrong.

Pure and credential-free: reads one file, touches nothing.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    REPO_ROOT / "supabase" / "migrations" / "20260909120000_stocks_data_version.sql"
)


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.exists(), f"missing {MIGRATION}"
    text = MIGRATION.read_text(encoding="utf-8")
    # Comments explain the fix and quote the very code being asserted on, so a
    # naive search finds its own documentation. This repo has been caught by that
    # five times (11au, 11aw); strip line comments before matching.
    return "\n".join(
        line for line in text.splitlines() if not line.lstrip().startswith("--")
    )


@pytest.mark.parametrize("verb", ["insert", "update", "delete"])
def test_price_bars_arms_every_verb(sql: str, verb: str) -> None:
    pattern = rf"after\s+{verb}\s+on\s+public\.price_bars"
    assert re.search(pattern, sql, re.IGNORECASE), (
        f"no AFTER {verb.upper()} trigger on price_bars — a write of that kind "
        f"would leave data_version unchanged and the screener would serve a "
        f"cached answer built from the old data"
    )


def test_the_probe_can_fail(sql: str) -> None:
    """Control. The three assertions above are satisfied by any file mentioning
    those words; prove the pattern is specific enough to miss something absent."""
    assert not re.search(r"after\s+truncate\s+on\s+public\.price_bars", sql, re.IGNORECASE)


@pytest.mark.parametrize("verb", ["insert", "update", "delete"])
def test_every_price_bars_trigger_is_statement_level(sql: str, verb: str) -> None:
    """FOR EACH ROW would turn one re-pull — 11,525 bars for a single company —
    into 11,525 separate updates of one stocks row, on the instance CLAUDE.md 11ay
    identifies as the bottleneck."""
    block = re.search(
        rf"after\s+{verb}\s+on\s+public\.price_bars(.{{0,300}}?);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    assert block, f"could not read the AFTER {verb.upper()} trigger definition"
    assert "for each statement" in block.group(1).lower(), (
        f"the {verb} trigger is row-level"
    )


def test_the_stocks_counter_is_monotonic_by_construction(sql: str) -> None:
    """`IS DISTINCT FROM` here honoured any explicit value, including a lower one:
    measured live, one upsert sending data_version = 1 took a stock from 500 back
    to 1 and made every answer cached at 1..500 reachable again. `>` is what makes
    a version impossible to see twice."""
    assert "new.data_version > old.data_version" in sql
    assert "is distinct from" not in sql.lower(), (
        "the stocks trigger is back to comparing for difference rather than for "
        "direction — a write carrying a lower version would be honoured"
    )


def test_the_functions_are_not_executable_by_the_public_roles(sql: str) -> None:
    """Supabase re-grants EXECUTE to anon and authenticated on every CREATE OR
    REPLACE, so the revoke has to live in the same migration or it is undone the
    next time this file is applied (11y / audit F-024)."""
    for fn in ("bump_stocks_data_version", "bump_price_bars_data_version"):
        assert re.search(
            rf"revoke\s+all\s+on\s+function\s+public\.{fn}\(\).*?anon.*?authenticated",
            sql,
            re.IGNORECASE | re.DOTALL,
        ), f"{fn} is left executable by the public roles"
