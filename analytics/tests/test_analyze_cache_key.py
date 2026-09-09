"""The screener's cache must be unable to serve an answer built from older data.

WHY THIS FILE EXISTS (2026-09-09).

The screener now keeps its results in the Vercel Runtime Cache, shared by every
function instance in the region and surviving deploys. That is a large speed win
and exactly one new way to be wrong: showing a customer a number the database no
longer agrees with.

The protection is not a webhook. A webhook is a MESSAGE, and a message can fail
to arrive with nothing logged on the reading side — the cache would then serve
yesterday's numbers indefinitely, which is CLAUDE.md 11z's shape (a silence that
looks like health). Instead every key carries the stock's `data_version`, a
counter a database trigger bumps inside the transaction of ANY write to that
stock or its bars. A stale entry is not deleted, it is UNREACHABLE.

So the thing worth testing is not "does the cache work" — a cache that never hits
passes that. It is:

  1. a changed version must change the key (staleness is impossible), and
  2. a FAILED version lookup must never read as "not in our universe" (11e), and
  3. a changed result SHAPE must retire every entry a previous deploy wrote, and
  4. the cache must never be able to sink a request when it misbehaves.

Every assertion has a control beside it proving it can fail, because a comparison
that has never failed is not evidence (11p).

Pure and credential-free: no database, no network, no Vercel. Runs anywhere.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
ANALYZE_PY = REPO_ROOT / "web" / "api" / "analyze.py"


def _load_analyze_module() -> ModuleType:
    """Import web/api/analyze.py by path (same shim as test_analyze_columns)."""
    spec = importlib.util.spec_from_file_location("mc_api_analyze_cache", ANALYZE_PY)
    assert spec and spec.loader, f"could not load {ANALYZE_PY}"
    module = importlib.util.module_from_spec(spec)
    sys.modules["mc_api_analyze_cache"] = module
    spec.loader.exec_module(module)
    return module


az = _load_analyze_module()

from _engine.major_cycle import CycleParams  # noqa: E402

PARAMS = CycleParams(pullback_threshold=-5.0, profit_threshold=5.0, lookback_bars=252)
OTHER_PARAMS = CycleParams(pullback_threshold=-3.0, profit_threshold=3.0, lookback_bars=63)


# ── Stub Supabase client ─────────────────────────────────────────────────────
# Mirrors only the chain `_load_data_versions` uses: .table().select().in_().execute()


class _StubQuery:
    def __init__(self, rows: list[dict[str, Any]] | None, error: Exception | None) -> None:
        self._rows = rows
        self._error = error

    def select(self, _cols: str) -> _StubQuery:
        return self

    def in_(self, _col: str, _values: list[str]) -> _StubQuery:
        return self

    def execute(self) -> Any:
        if self._error is not None:
            raise self._error
        return type("Resp", (), {"data": self._rows})()


class _StubClient:
    def __init__(
        self,
        rows: list[dict[str, Any]] | None = None,
        error: Exception | None = None,
    ) -> None:
        self._rows = rows
        self._error = error

    def table(self, _name: str) -> _StubQuery:
        return _StubQuery(self._rows, self._error)


# ── 1 · the version lookup ───────────────────────────────────────────────────


def test_versions_are_read_for_every_ticker_present() -> None:
    sb = _StubClient(rows=[
        {"ticker": "AAPL", "data_version": 4471},
        {"ticker": "MSFT", "data_version": 12},
    ])
    assert az._load_data_versions(sb, ["AAPL", "MSFT"]) == {"AAPL": 4471, "MSFT": 12}


def test_a_ticker_absent_from_the_answer_is_absent_from_the_map() -> None:
    """A stock we do not cover. The caller reads this as "not in our universe"."""
    sb = _StubClient(rows=[{"ticker": "AAPL", "data_version": 1}])
    versions = az._load_data_versions(sb, ["AAPL", "NOTREAL"])
    assert versions == {"AAPL": 1}
    assert versions is not None and "NOTREAL" not in versions


def test_a_failed_lookup_returns_none_and_not_an_empty_map() -> None:
    """The load-bearing one — CLAUDE.md 11e.

    An empty map and a failed query are different facts. If a read failure came
    back as `{}`, every ticker would look absent and the screener would tell a
    paying customer that 761 real companies are not in our universe. `None` means
    "could not ask", which the caller turns into "run without the cache".
    """
    sb = _StubClient(error=RuntimeError("connection reset by peer"))
    assert az._load_data_versions(sb, ["AAPL"]) is None


def test_a_missing_data_version_column_returns_none_so_the_old_path_still_runs() -> None:
    """Before the migration lands, PostgREST answers with an error, not a column.

    This is what makes the deploy order irrelevant: the screener behaves exactly
    as it did last week rather than failing.
    """
    sb = _StubClient(error=Exception('column stocks.data_version does not exist'))
    assert az._load_data_versions(sb, ["AAPL"]) is None


def test_a_null_version_refuses_to_key_rather_than_inventing_one() -> None:
    sb = _StubClient(rows=[{"ticker": "AAPL", "data_version": None}])
    assert az._load_data_versions(sb, ["AAPL"]) is None


def test_no_tickers_is_an_empty_map_not_a_failure() -> None:
    """The control for the two above: `None` has to MEAN something."""
    assert az._load_data_versions(_StubClient(rows=[]), []) == {}


# ── 2 · a changed version must change the key ────────────────────────────────


def test_a_bumped_version_produces_a_different_key() -> None:
    """This is the entire staleness protection, stated as one assertion."""
    before = az._shared_key("AAPL", PARAMS, 4471)
    after = az._shared_key("AAPL", PARAMS, 4472)
    assert before != after


def test_the_same_version_produces_the_same_key() -> None:
    """Control. Without this, a key function returning a random string would pass
    the test above while making the cache useless."""
    assert az._shared_key("AAPL", PARAMS, 4471) == az._shared_key("AAPL", PARAMS, 4471)


def test_each_preset_gets_its_own_key() -> None:
    """Short must never be able to read Medium's saved answer."""
    assert az._shared_key("AAPL", PARAMS, 1) != az._shared_key("AAPL", OTHER_PARAMS, 1)


def test_each_ticker_gets_its_own_key() -> None:
    assert az._shared_key("AAPL", PARAMS, 1) != az._shared_key("MSFT", PARAMS, 1)


# ── 3 · a changed result shape must retire the previous deploy's entries ─────


def test_the_shape_signature_moves_when_a_result_field_is_added(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Runtime cache survives deploys, so a release that changes the shape of a
    result would otherwise read yesterday's shape back and hand the screener a row
    missing a column. The signature is derived from the field names themselves, so
    this cannot be forgotten."""
    baseline = az._result_shape_signature()

    monkeypatch.setattr(az, "_SHAPE_SIGNATURE", None)
    monkeypatch.setattr(az, "_SCREENER_FIELDS", (*az._SCREENER_FIELDS, "a_new_column"))
    assert az._result_shape_signature() != baseline

    # And it is stable once the change is in place, not merely different each call.
    monkeypatch.setattr(az, "_SHAPE_SIGNATURE", None)
    assert az._result_shape_signature() == az._result_shape_signature()


def test_the_manual_epoch_also_moves_the_signature(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The automatic half cannot see a change to how an existing field is COMPUTED
    — every field name stays identical. `_RESULT_EPOCH` is the hand lever for that
    case, and this proves pulling it actually works."""
    baseline = az._result_shape_signature()
    monkeypatch.setattr(az, "_SHAPE_SIGNATURE", None)
    monkeypatch.setattr(az, "_RESULT_EPOCH", az._RESULT_EPOCH + 1)
    assert az._result_shape_signature() != baseline


def test_the_signature_is_in_the_key() -> None:
    assert az._result_shape_signature() in az._shared_key("AAPL", PARAMS, 1)


# ── 4 · the cache must never be able to sink a request ───────────────────────


class _ExplodingCache:
    def get(self, _key: str) -> Any:
        raise RuntimeError("runtime cache unreachable")

    def set(self, _key: str, _value: Any, _options: Any = None) -> None:
        raise RuntimeError("runtime cache unreachable")


def test_a_broken_cache_read_is_a_miss_not_an_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(az, "_shared_cache", lambda: _ExplodingCache())
    assert az._shared_get("any-key") is None


def test_a_broken_cache_write_never_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """A computed answer must reach the customer even if we cannot store it."""
    monkeypatch.setattr(az, "_shared_cache", lambda: _ExplodingCache())
    az._shared_set("any-key", {"overall_rating": 60})  # must not raise


def test_the_shared_layer_is_skipped_when_vercel_has_not_enabled_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`vercel.cache` silently falls back to a private in-memory dict when its
    environment variables are absent. That would look like a working shared cache
    while being no better than the in-process one — unmeasurable counted as clean
    (14g). So the endpoint is read directly and the layer is skipped outright."""
    monkeypatch.setattr(az, "_SHARED_ENABLED", False)
    assert az._shared_cache() is None


def test_a_non_dict_from_the_cache_is_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    """Whatever comes back was written by us, but it arrives over a network and
    through someone else's serialiser. A result is a dict or it is a miss."""

    class _WrongShape:
        def get(self, _key: str) -> Any:
            return "not a result"

    monkeypatch.setattr(az, "_shared_cache", lambda: _WrongShape())
    assert az._shared_get("any-key") is None


# ── 5 · the wiring, end to end ───────────────────────────────────────────────
# The tests above check the pieces. These drive the REAL `run_analysis` and assert
# the two behaviours the whole change exists for: an instance that has just been
# recycled still gets a warm answer, and a data change is never served from cache.


def _price_frame() -> Any:
    import numpy as np
    import pandas as pd

    n = 400
    close = 100 + 20 * np.sin(np.linspace(0, 6 * np.pi, n))
    return pd.DataFrame(
        {
            "Open": close * 0.995,
            "High": close * 1.01,
            "Low": close * 0.99,
            "Close": close,
            "Volume": np.full(n, 1_000_000),
        },
        index=pd.date_range("2020-01-01", periods=n, freq="B"),
    )


class _DictCache:
    """A working shared cache, so L2 is exercised rather than merely tolerated."""

    def __init__(self) -> None:
        self.store: dict[str, Any] = {}

    def get(self, key: str) -> Any:
        return self.store.get(key)

    def set(self, key: str, value: Any, _options: Any = None) -> None:
        self.store[key] = value


@pytest.fixture
def wired(monkeypatch: pytest.MonkeyPatch) -> Any:
    """`run_analysis` with the database stubbed and a counter on the expensive read."""
    calls = {"bars": 0}
    versions = {"AAPL": 1}
    shared = _DictCache()

    monkeypatch.setattr(az, "_supabase", lambda: _StubClient(rows=[]))
    monkeypatch.setattr(
        az, "_load_data_versions", lambda _sb, tickers: {t: versions[t] for t in tickers if t in versions}
    )
    monkeypatch.setattr(
        az, "_load_fundamentals", lambda _sb, _t: ({"ticker": _t, "market": "us", "currency": "USD"}, None)
    )

    def _bars(_sb: Any, _t: str, _w: int = 1) -> Any:
        calls["bars"] += 1
        return _price_frame()

    monkeypatch.setattr(az, "_load_price_bars", _bars)
    monkeypatch.setattr(az, "_SHARED_ENABLED", True)
    monkeypatch.setattr(az, "_shared_cache", lambda: shared)
    az._RESULT_CACHE.clear()

    return {"calls": calls, "versions": versions, "shared": shared}


def _run() -> dict[str, Any]:
    status, body = az.run_analysis({"tickers": ["AAPL"], "preset": "medium"})
    assert status == 200, body
    return body


def test_a_recycled_instance_still_gets_a_warm_answer(wired: Any) -> None:
    """The reason for the whole change.

    Before this, the cache lived only in one instance's memory, so a recycle sent
    the next reader all the way back to the database. Measured on the owner's own
    runs: two screens 34 minutes apart were 100% and 99% cold.
    """
    first = _run()
    assert wired["calls"]["bars"] == 1

    az._RESULT_CACHE.clear()  # exactly what a recycled instance looks like
    second = _run()

    assert wired["calls"]["bars"] == 1, "a recycled instance re-read the database"
    assert second["results"] == first["results"]


def test_a_data_change_is_never_served_from_cache(wired: Any) -> None:
    """The one way this change could hurt a customer, asserted directly."""
    _run()
    assert wired["calls"]["bars"] == 1

    wired["versions"]["AAPL"] = 2  # any write to the stock or its bars does this
    az._RESULT_CACHE.clear()
    _run()

    assert wired["calls"]["bars"] == 2, "a stale answer was served after the data changed"


def test_the_cache_is_actually_being_used_at_all(wired: Any) -> None:
    """Control. Both tests above are satisfied by a cache that never stores
    anything — the first would fail, but a future 'fix' could quietly disable L2
    and leave only L1 passing. Assert something really landed in the shared store."""
    _run()
    assert len(wired["shared"].store) == 1
    assert next(iter(wired["shared"].store)).startswith("mc:analyze:")


def test_an_unknown_ticker_is_still_reported_unavailable(wired: Any) -> None:
    """The cache must not change what a stock outside our universe does."""
    status, body = az.run_analysis({"tickers": ["NOTREAL"], "preset": "medium"})
    assert status == 200
    assert body["unavailable"] == ["NOTREAL"]
    assert body["results"] == []


def test_a_failed_version_lookup_disables_both_layers(wired: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """No version means no cache — not "cache under a placeholder".

    Keying L1 on a placeholder would let two requests that both failed the lookup
    share an entry, so a data change landing between them would be served stale.
    Narrow, and still the exact thing this design promises cannot happen.
    """
    monkeypatch.setattr(az, "_load_data_versions", lambda _sb, _t: None)

    _run()
    assert wired["calls"]["bars"] == 1
    _run()
    assert wired["calls"]["bars"] == 2, "an uncacheable request was cached anyway"
    assert wired["shared"].store == {}, "an uncacheable result reached the shared store"
    assert az._RESULT_CACHE == {}, "an uncacheable result reached the in-memory store"


def test_the_previous_test_is_not_vacuous(wired: Any) -> None:
    """Control. With versions available the very same calls DO cache, so the test
    above is measuring the version's absence rather than a broken fixture."""
    _run()
    _run()
    assert wired["calls"]["bars"] == 1
