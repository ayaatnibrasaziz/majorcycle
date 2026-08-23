"""The ticker-request queue drain — how a reader's request ends up in the universe.

Why this file exists
--------------------
``analytics/cron/drain_requests.py`` implements decisions #12 and #16 (pre-seeded,
auto-expanding universe) and had **no test at all** until 2026-08-23, found by the
Layer G coverage map. It is the code path a real reader triggers: they ask for a
ticker, the nightly cron fetches it, and the request is reconciled against what
actually landed.

The reconciliation is where the risk sits, and it is entirely invisible when wrong:

    in `stocks` now            -> 'fetched'      (and logged to universe_log)
    no data, attempts <  cap   -> 'failed'       (transient, retried tomorrow)
    no data, attempts >= cap   -> 'unsupported'  (terminal, "not supported")

Getting the cap comparison wrong by one turns a retryable request terminal a day
early, or makes it retry forever. Neither errors, neither logs anything unusual,
and the reader simply never hears back.

How these tests avoid the network
---------------------------------
``run()`` is driven with a fake Supabase client that records every write, and
``daily_refresh.run`` is monkeypatched to a no-op — so the fetch, the provider and
the database are all absent. What is under test is the *decision* made about each
row, which is the part that has no other check on it.
"""

from __future__ import annotations

from typing import Any

import pytest

from analytics.cron import drain_requests


class _Result:
    def __init__(self, data: Any) -> None:
        self.data = data


class _Table:
    """Records the chain, and answers `execute()` from a canned map."""

    def __init__(self, name: str, log: list[dict[str, Any]], rows: dict[str, Any]) -> None:
        self._name = name
        self._log = log
        self._rows = rows
        self._op: dict[str, Any] = {"table": name}

    def select(self, cols: str) -> "_Table":
        self._op |= {"op": "select", "cols": cols}
        return self

    def update(self, payload: dict[str, Any]) -> "_Table":
        self._op |= {"op": "update", "payload": payload}
        return self

    def insert(self, payload: dict[str, Any]) -> "_Table":
        self._op |= {"op": "insert", "payload": payload}
        return self

    def in_(self, col: str, vals: list[str]) -> "_Table":
        self._op |= {"in": (col, vals)}
        return self

    def eq(self, col: str, val: Any) -> "_Table":
        self._op |= {"eq": (col, val)}
        return self

    def execute(self) -> _Result:
        self._log.append(self._op)
        return _Result(self._rows.get(self._name, []))


class _Supabase:
    def __init__(self, rows: dict[str, Any]) -> None:
        self.log: list[dict[str, Any]] = []
        self._rows = rows

    def table(self, name: str) -> _Table:
        return _Table(name, self.log, self._rows)


@pytest.fixture()
def patched(monkeypatch: pytest.MonkeyPatch):
    """Wire a fake Supabase in and stub out the real fetch."""

    def _install(pending: list[dict[str, Any]], present: list[str]) -> _Supabase:
        fake = _Supabase(
            {
                "ticker_requests": pending,
                "stocks": [{"ticker": t} for t in present],
            }
        )
        monkeypatch.setattr(drain_requests, "_get_supabase", lambda: fake)
        # The real one spawns a full provider fetch. Not this file's subject.
        monkeypatch.setattr(drain_requests.daily_refresh, "run", lambda **_: None)
        return fake

    return _install


def _updates(fake: _Supabase) -> dict[str, dict[str, Any]]:
    """symbol -> the update payload written for it."""
    out = {}
    for op in fake.log:
        if op.get("table") == "ticker_requests" and op.get("op") == "update":
            out[op["eq"][1]] = op["payload"]
    return out


def test_empty_queue(patched) -> None:
    fake = patched(pending=[], present=[])
    assert drain_requests.run() == {
        "pending": 0,
        "fetched": 0,
        "failed": 0,
        "unsupported": 0,
    }
    # Must not fetch, and must not write anything, when there is nothing to do.
    assert not [op for op in fake.log if op.get("op") in {"update", "insert"}]


def test_a_symbol_that_landed_is_marked_fetched(patched) -> None:
    fake = patched(
        pending=[{"symbol": "NVDA", "market": "us", "attempts": 0, "requested_by": "u1"}],
        present=["NVDA"],
    )
    summary = drain_requests.run()
    assert summary["fetched"] == 1
    payload = _updates(fake)["NVDA"]
    assert payload["status"] == "fetched"
    # last_error must be CLEARED on success — a stale error from a previous failed
    # attempt would otherwise sit on a request that has since worked.
    assert payload["last_error"] is None
    assert payload["fetched_at"] is not None


def test_a_fetched_symbol_is_logged_to_the_universe(patched) -> None:
    # Decision #16: cached forever, and attributed to the reader who asked.
    fake = patched(
        pending=[{"symbol": "NVDA", "market": "us", "attempts": 0, "requested_by": "u1"}],
        present=["NVDA"],
    )
    drain_requests.run()
    inserts = [op for op in fake.log if op.get("table") == "universe_log"]
    assert len(inserts) == 1
    assert inserts[0]["payload"] == {
        "ticker": "NVDA",
        "added_by": "user_request",
        "added_by_user": "u1",
    }


def test_a_symbol_that_did_not_land_is_retryable(patched) -> None:
    fake = patched(
        pending=[{"symbol": "ZZZZ", "market": "us", "attempts": 0, "requested_by": None}],
        present=[],
    )
    summary = drain_requests.run()
    assert summary["failed"] == 1 and summary["unsupported"] == 0
    payload = _updates(fake)["ZZZZ"]
    assert payload["status"] == "failed"
    assert payload["attempts"] == 1


def test_the_last_allowed_attempt_is_still_retryable(patched) -> None:
    # attempts 1 -> 2, and the cap is 3, so this must NOT be terminal yet. This is
    # the off-by-one that would quietly cut a reader's request short.
    fake = patched(
        pending=[{"symbol": "ZZZZ", "market": "us", "attempts": 1, "requested_by": None}],
        present=[],
    )
    assert drain_requests.run()["failed"] == 1
    assert _updates(fake)["ZZZZ"]["status"] == "failed"


def test_reaching_the_cap_is_terminal(patched) -> None:
    # attempts 2 -> 3 == _MAX_ATTEMPTS, so this one gives up.
    fake = patched(
        pending=[{"symbol": "ZZZZ", "market": "us", "attempts": 2, "requested_by": None}],
        present=[],
    )
    summary = drain_requests.run()
    assert summary["unsupported"] == 1 and summary["failed"] == 0
    payload = _updates(fake)["ZZZZ"]
    assert payload["status"] == "unsupported"
    # The reason is recorded ON the row, so a stuck request can be diagnosed from
    # the queue itself rather than from a log nobody keeps.
    assert "3 attempts" in payload["last_error"]


def test_a_missing_attempts_column_counts_as_zero(patched) -> None:
    # A row inserted before `attempts` existed, or written by a client that omits
    # it. `int(None or 0) + 1` must not raise, and must not skip to terminal.
    fake = patched(
        pending=[{"symbol": "ZZZZ", "market": "us", "attempts": None, "requested_by": None}],
        present=[],
    )
    assert drain_requests.run()["failed"] == 1
    assert _updates(fake)["ZZZZ"]["attempts"] == 1


def test_only_queued_and_failed_are_picked_up(patched) -> None:
    # 'fetched' and 'unsupported' are terminal. Re-draining them would re-fetch
    # every ticker ever requested, every night, forever.
    fake = patched(pending=[], present=[])
    drain_requests.run()
    sel = next(op for op in fake.log if op.get("table") == "ticker_requests")
    assert sel["in"] == ("status", ["queued", "failed"])


def test_a_mixed_batch_is_counted_correctly(patched) -> None:
    fake = patched(
        pending=[
            {"symbol": "AAA", "market": "us", "attempts": 0, "requested_by": "u1"},
            {"symbol": "BBB", "market": "us", "attempts": 0, "requested_by": None},
            {"symbol": "CCC", "market": "us", "attempts": 2, "requested_by": None},
        ],
        present=["AAA"],
    )
    assert drain_requests.run() == {
        "pending": 3,
        "fetched": 1,
        "failed": 1,
        "unsupported": 1,
    }
