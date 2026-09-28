"""The screener reads a chunk's fundamentals in ONE request (2026-09-26).

Until then each of a chunk's 25 tickers made its own `stocks` request — 760 per
screen, each queueing behind the others under load. The batch must change nothing
but the number of requests: the same row must become the same FundamentalsSnapshot
by either route, and a failed batch must say "unknown" (None) so the per-ticker read
runs, never "not in the universe" (an empty dict), which would drop every ticker in
the chunk as a non-stock (CLAUDE.md 11e).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any
from unittest.mock import MagicMock

REPO_ROOT = Path(__file__).resolve().parents[2]
ANALYZE_PY = REPO_ROOT / "web" / "api" / "analyze.py"


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("mc_api_analyze_batch", ANALYZE_PY)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["mc_api_analyze_batch"] = module
    spec.loader.exec_module(module)
    return module


az = _load()

ROW: dict[str, Any] = {
    "ticker": "AAPL",
    "market": "us",
    "currency": "USD",
    "fundamentals": {"ticker": "AAPL", "pe": 31.2, "roe": 1.48, "gross_margin": 46.2, "sector": "Technology"},
}


def _client_returning(rows: list[dict[str, Any]]) -> MagicMock:
    sb = MagicMock()
    q = sb.table.return_value.select.return_value
    q.in_.return_value.execute.return_value.data = rows
    q.eq.return_value.maybe_single.return_value.execute.return_value.data = rows[0] if rows else None
    return sb


def test_batch_and_single_reads_give_the_same_snapshot() -> None:
    sb = _client_returning([ROW])
    single_row, single = az._load_fundamentals(sb, "AAPL")
    batch = az._load_fundamentals_batch(sb, ["AAPL", "MSFT"])
    assert batch is not None and "AAPL" in batch
    batch_row, batched = az._row_to_fundamentals(batch["AAPL"])
    assert batch_row == single_row
    assert batched == single


def test_one_request_for_the_whole_chunk() -> None:
    sb = _client_returning([ROW])
    az._load_fundamentals_batch(sb, ["AAPL", "MSFT", "KO"])
    sb.table.return_value.select.return_value.in_.assert_called_once_with("ticker", ["AAPL", "MSFT", "KO"])


def test_a_failed_batch_is_unknown_not_empty() -> None:
    sb = MagicMock()
    sb.table.return_value.select.return_value.in_.return_value.execute.side_effect = RuntimeError("timeout")
    # None sends every ticker to the per-ticker read; {} would call them all non-stocks.
    assert az._load_fundamentals_batch(sb, ["AAPL"]) is None


def test_a_ticker_missing_from_a_good_batch_is_simply_absent() -> None:
    sb = _client_returning([ROW])
    batch = az._load_fundamentals_batch(sb, ["AAPL", "NOTASTOCK"])
    assert batch is not None
    assert "NOTASTOCK" not in batch


# ── Beta review C-4 (2026-09-28): a retired stock is never rated ──────────────


def test_a_retired_stock_is_retired_and_a_trading_one_is_not() -> None:
    assert az._is_retired({**ROW, "is_active": False})
    # CONTROL: trading, unknown (NULL) and a row read without the column all count as
    # trading — "retired" must be positive evidence, or one bad read empties a screen.
    assert not az._is_retired({**ROW, "is_active": True})
    assert not az._is_retired({**ROW, "is_active": None})
    assert not az._is_retired(ROW)
    assert not az._is_retired(None)


def test_the_screener_asks_for_the_column_it_checks() -> None:
    # Without `is_active` in the select, every row reads as trading and the check is inert.
    assert "is_active" in az._FUNDAMENTALS_COLUMNS.split(",")


def test_run_analysis_puts_a_retired_stock_in_unavailable(monkeypatch: Any) -> None:
    retired = {**ROW, "ticker": "AOF.AX", "market": "au", "is_active": False}
    trading = {**ROW, "is_active": True}
    sb = _client_returning([retired, trading])
    monkeypatch.setattr(az, "_supabase", lambda: sb)
    loaded: list[str] = []
    monkeypatch.setattr(az, "_load_price_bars", lambda _sb, t, _w=1: loaded.append(t))  # None → unavailable
    status, body = az.run_analysis({"tickers": ["AOF.AX", "AAPL"], "preset": "medium"})
    assert status == 200
    assert "AOF.AX" in body["unavailable"]
    # The retired one is refused BEFORE its prices are read; the trading one is read.
    assert loaded == ["AAPL"]
