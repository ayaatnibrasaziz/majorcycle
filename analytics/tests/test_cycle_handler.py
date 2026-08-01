"""HTTP-surface tests for the /api/cycle paywall (F3 Step 10).

WHY THIS FILE EXISTS — and why it is not an e2e test.

The gate on `/api/cycle` (internal secret + entitlement stripping + cache headers) is
exercised by NEITHER of the environments we normally verify in:

  * Locally, `next dev` does not serve Vercel Python functions, so web/lib/cycle.ts
    takes its `useLocalCompute()` branch and runs cycle.py as a **CLI** — no HTTP, no
    headers, no secret check.
  * On a Vercel **preview**, `baseUrl()` prefers VERCEL_PROJECT_PRODUCTION_URL, so a
    preview's Stock Detail page fetches **production's** /api/cycle, not its own.

Without this file the gate would run for the first time in production, unverified.
So we boot the real `BaseHTTPRequestHandler` on a loopback port and make real requests.

No database and no credentials: the two Supabase loaders are patched out, but the
REAL `compute_cycle` -> `analyze_ticker` -> `_serialise_analysis` path still runs, so
the stripping is tested where it actually happens rather than being simulated.
"""

from __future__ import annotations

import http.client
import importlib.util
import json
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import ModuleType
from typing import Any, Iterator

import numpy as np
import pandas as pd
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
CYCLE_PY = REPO_ROOT / "web" / "api" / "cycle.py"


def _load_cycle_module() -> ModuleType:
    """Import web/api/cycle.py by path.

    It isn't an importable package from the repo root (it lives beside the Vercel
    function bundle, not under analytics/), and it self-inserts web/ onto sys.path at
    import time so its `from _engine...` imports resolve.
    """
    spec = importlib.util.spec_from_file_location("mc_api_cycle", CYCLE_PY)
    assert spec and spec.loader, f"could not load {CYCLE_PY}"
    module = importlib.util.module_from_spec(spec)
    sys.modules["mc_api_cycle"] = module
    spec.loader.exec_module(module)
    return module


cycle = _load_cycle_module()

SECRET = "test-internal-secret-value"
# Long enough for the medium preset: lookback 252 + pivot*2 + 10 headroom.
BARS = 400


def _synthetic_bars() -> pd.DataFrame:
    """A deterministic OHLCV frame with enough history for the medium preset."""
    idx = pd.date_range("2020-01-01", periods=BARS, freq="B")
    # A gentle wave so there are real pullbacks and rallies for the pivot logic to
    # find — a flat line would produce no cycle events at all.
    close = 100 + 20 * np.sin(np.linspace(0, 6 * np.pi, BARS))
    return pd.DataFrame(
        {
            "Open": close,
            "High": close * 1.01,
            "Low": close * 0.99,
            "Close": close,
            "Volume": np.full(BARS, 1_000_000),
        },
        index=idx,
    )


@pytest.fixture()
def server(monkeypatch: pytest.MonkeyPatch) -> Iterator[int]:
    """Boot the real handler on an ephemeral loopback port; yield the port."""
    monkeypatch.setenv("CYCLE_INTERNAL_SECRET", SECRET)
    # Stub only the I/O. compute_cycle, analyze_ticker and _serialise_analysis all
    # run for real, so the strip is verified in its actual code path.
    monkeypatch.setattr(cycle, "_supabase", lambda: object())
    monkeypatch.setattr(
        cycle, "_load_fundamentals", lambda _sb, _t: ({"currency": "USD"}, None)
    )
    monkeypatch.setattr(cycle, "_load_price_bars", lambda _sb, _t: _synthetic_bars())

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), cycle.handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield httpd.server_address[1]
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=5)


def _get(port: int, path: str, secret: str | None = SECRET) -> tuple[int, dict[str, str], Any]:
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
    try:
        headers = {} if secret is None else {cycle.INTERNAL_HEADER: secret}
        conn.request("GET", path, headers=headers)
        resp = conn.getresponse()
        raw = resp.read().decode("utf-8")
        hdrs = {k.lower(): v for k, v in resp.getheaders()}
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = raw
        return resp.status, hdrs, body
    finally:
        conn.close()


MEDIUM = "/api/cycle?ticker=AAPL&preset=medium"


class TestInternalSecret:
    def test_no_secret_header_is_rejected(self, server: int) -> None:
        status, _, body = _get(server, f"{MEDIUM}&entitled=1", secret=None)
        assert status == 401
        assert body == {"error": "unauthorized"}

    def test_wrong_secret_is_rejected(self, server: int) -> None:
        status, _, _ = _get(server, f"{MEDIUM}&entitled=1", secret="not-the-secret")
        assert status == 401

    def test_a_near_miss_secret_is_rejected(self, server: int) -> None:
        # Guards against a prefix/length comparison sneaking in.
        status, _, _ = _get(server, f"{MEDIUM}&entitled=1", secret=SECRET[:-1])
        assert status == 401
        status, _, _ = _get(server, f"{MEDIUM}&entitled=1", secret=SECRET + "x")
        assert status == 401

    def test_correct_secret_is_accepted(self, server: int) -> None:
        status, _, body = _get(server, f"{MEDIUM}&entitled=1")
        assert status == 200
        assert body["ticker"] == "AAPL"

    def test_unset_secret_fails_closed_with_503(
        self, server: int, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # A missing env var must never mean "allow everyone" — it must be loud and shut.
        monkeypatch.delenv("CYCLE_INTERNAL_SECRET", raising=False)
        status, _, body = _get(server, f"{MEDIUM}&entitled=1")
        assert status == 503
        assert body == {"error": "server misconfigured"}


class TestEntitlementStripping:
    def test_entitled_response_carries_every_premium_key(self, server: int) -> None:
        status, _, body = _get(server, f"{MEDIUM}&entitled=1")
        assert status == 200
        missing = cycle.PREMIUM_KEYS - set(body)
        assert not missing, f"entitled payload is missing premium keys: {sorted(missing)}"

    def test_unentitled_response_omits_every_premium_key(self, server: int) -> None:
        status, _, body = _get(server, f"{MEDIUM}&entitled=0")
        assert status == 200
        leaked = cycle.PREMIUM_KEYS & set(body)
        assert not leaked, f"premium keys leaked to a free viewer: {sorted(leaked)}"

    def test_unentitled_response_still_carries_the_free_fields(self, server: int) -> None:
        # Stripping must not gut the page — the free half is what a free user sees.
        _, _, body = _get(server, f"{MEDIUM}&entitled=0")
        for key in (
            "ticker",
            "as_of",
            "current_close",
            "current_drawdown_pct",
            "current_profit_pct",
            "typical_drawdown",
            "lower_bound",
            "typical_profit",
            "upper_bound",
            "total_pullback_events",
            "total_profit_events",
        ):
            assert key in body, f"free field {key} went missing"

    def test_premium_keys_are_absent_not_null(self, server: int) -> None:
        # Nulls would still tell a free user the shape of what they're missing, and
        # would let a client "un-hide" a placeholder. They must simply not be there.
        _, _, body = _get(server, f"{MEDIUM}&entitled=0")
        for key in cycle.PREMIUM_KEYS:
            assert key not in body

    @pytest.mark.parametrize("query", ["", "&entitled=", "&entitled=0", "&entitled=yes", "&entitled=true"])
    def test_anything_but_exactly_1_is_treated_as_unentitled(
        self, server: int, query: str
    ) -> None:
        # Fail CLOSED: a caller that forgets or fumbles the flag strips, never leaks.
        _, _, body = _get(server, f"{MEDIUM}{query}")
        assert not (cycle.PREMIUM_KEYS & set(body))


class TestCacheHeaders:
    """Regression net for the CDN-cache bypass found in the Step 10 audit (B1).

    /api/cycle once sent `public, s-maxage=3600`. Because a shared cache keys on the
    URL alone, a warmed entry would have been served to ANY later requester — no
    secret, no session — handing over the full paid analysis before the function ran.
    """

    def test_success_is_private_and_not_stored(self, server: int) -> None:
        _, headers, _ = _get(server, f"{MEDIUM}&entitled=1")
        cache_control = headers.get("cache-control", "")
        assert "private" in cache_control
        assert "no-store" in cache_control

    def test_success_never_advertises_a_shared_cache(self, server: int) -> None:
        _, headers, _ = _get(server, f"{MEDIUM}&entitled=1")
        cache_control = headers.get("cache-control", "").lower()
        assert "s-maxage" not in cache_control
        assert "public" not in cache_control
        assert "stale-while-revalidate" not in cache_control

    def test_the_free_variant_is_equally_uncacheable(self, server: int) -> None:
        _, headers, _ = _get(server, f"{MEDIUM}&entitled=0")
        cache_control = headers.get("cache-control", "").lower()
        assert "s-maxage" not in cache_control
        assert "public" not in cache_control

    def test_rejections_are_not_cacheable_either(self, server: int) -> None:
        _, headers, _ = _get(server, f"{MEDIUM}&entitled=1", secret=None)
        assert "no-store" in headers.get("cache-control", "")


class TestRequestValidation:
    """The secret gate must run BEFORE anything else — an unauthorised caller should
    not be able to probe validation behaviour or reach the database."""

    def test_missing_ticker_is_400_only_once_authorised(self, server: int) -> None:
        status, _, _ = _get(server, "/api/cycle?preset=medium&entitled=1")
        assert status == 400

    def test_unauthorised_bad_request_is_401_not_400(self, server: int) -> None:
        status, _, _ = _get(server, "/api/cycle?preset=medium&entitled=1", secret=None)
        assert status == 401
