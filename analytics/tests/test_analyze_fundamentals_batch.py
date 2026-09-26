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
