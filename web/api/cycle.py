"""/api/cycle — Vercel Python serverless function.

GET /api/cycle?ticker=AAPL&preset=medium

Returns the CycleAnalysis JSON for the given ticker. Reads price bars and
fundamentals from Supabase (the daily cron is the only thing that ever
talks to yfinance — this function never does). Runs the cycle math via
`_engine.major_cycle.analyze_ticker`.

The `_engine` package is a vendored snapshot of `analytics/` at the repo
root — see `web/_engine/__init__.py` and the CI drift check.

Query params:
    ticker  — yfinance-format storage ticker (e.g. AAPL, BHP.AX, SHOP.TO)
    preset  — short | medium | long  (default: medium)

Responses:
    200  — application/json; CycleAnalysis fields, snake_case
    400  — bad query params
    404  — ticker not in DB / no price history
    422  — ticker has data, but not enough for THIS horizon (normal outcome —
           e.g. a young stock on the Long preset; the UI shows a graceful
           "not available at this horizon" notice)
    500  — unexpected server error
"""

from __future__ import annotations

import dataclasses
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any, cast
from urllib.parse import parse_qs, urlparse

# Ensure web/ is on sys.path so `from _engine.X import ...` resolves regardless
# of how Vercel launches this function. (cycle.py lives at web/api/cycle.py;
# its parent's parent is web/, where _engine/ sits as a sibling of api/.)
_WEB_ROOT = Path(__file__).resolve().parent.parent
if str(_WEB_ROOT) not in sys.path:
    sys.path.insert(0, str(_WEB_ROOT))

import pandas as pd  # noqa: E402
from postgrest.types import CountMethod  # noqa: E402
from supabase import Client, create_client  # noqa: E402

from _engine.major_cycle import CycleParams, analyze_ticker  # noqa: E402
from _engine.presets import PRESETS  # noqa: E402
from _engine.providers.base import FundamentalsSnapshot  # noqa: E402

logger = logging.getLogger("api.cycle")
logging.basicConfig(level=logging.INFO)

# Whether the get_price_bars_json RPC (one-shot history fetch) exists in this DB.
# None = not yet probed; False = confirmed missing (use pagination); True = present.
# Lets this run before the migration is applied (falls back to paginated reads).
_RPC_AVAILABLE: bool | None = None
_RPC_NAME = "get_price_bars_json"


def _supabase() -> Client:
    # SUPABASE_URL is set in the Vercel runtime; locally (dev CLI) the web app's
    # .env.local exposes the same value as NEXT_PUBLIC_SUPABASE_URL. The URL is
    # public — only the service-role key is sensitive.
    url = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _load_price_bars(sb: Client, ticker: str) -> pd.DataFrame | None:
    """Read all price_bars for one ticker. Returns DataFrame with yfinance-style
    OHLCV column names (Open, High, Low, Close, Volume) and a DatetimeIndex.

    Fast path: ONE request via the get_price_bars_json RPC (whole history as a
    single jsonb — bypasses the 1000-row cap). Falls back to parallel paginated
    reads if the RPC isn't deployed yet or errors, so this is safe before/after
    the migration. (Without the RPC, PostgREST caps each response at 1000 rows,
    so we must page; otherwise the cycle math would see only the oldest 1000
    bars — decades-old split-adjusted prices — and produce nonsense.)
    """
    global _RPC_AVAILABLE
    if _RPC_AVAILABLE is not False:
        try:
            resp = sb.rpc(_RPC_NAME, {"p_ticker": ticker}).execute()
            _RPC_AVAILABLE = True
            data = cast("list[Any] | None", resp.data)
            return _bars_to_df(data) if data else None
        except Exception as e:  # noqa: BLE001
            msg = str(e).lower()
            if _RPC_AVAILABLE is None and any(
                s in msg for s in ("pgrst202", "could not find", "does not exist", "not found", "404")
            ):
                _RPC_AVAILABLE = False
                logger.warning("%s RPC not deployed — using paginated reads", _RPC_NAME)
            # else: transient — fall through to pagination for this call only

    PAGE = 1000

    def _fetch_page(i: int) -> list[Any]:
        start = i * PAGE
        resp = (
            sb.table("price_bars")
            .select("date,open,high,low,close,volume")
            .eq("ticker", ticker)
            .order("date")
            .range(start, start + PAGE - 1)
            .execute()
        )
        return cast("list[Any]", resp.data or [])

    # Fetch the first page WITH an exact count so we learn the row total in the
    # same round-trip, then pull any remaining pages concurrently.
    first = (
        sb.table("price_bars")
        .select("date,open,high,low,close,volume", count=CountMethod.exact)
        .eq("ticker", ticker)
        .order("date")
        .range(0, PAGE - 1)
        .execute()
    )
    first_page: list[Any] = first.data or []
    if not first_page:
        return None
    total = first.count or len(first_page)
    n_pages = (total + PAGE - 1) // PAGE

    rows: list[Any] = list(first_page)
    if n_pages > 1:
        # ThreadPoolExecutor.map preserves input order, and each page is
        # date-ordered, so the concatenation stays globally ordered by date.
        with ThreadPoolExecutor(max_workers=min(n_pages - 1, 8)) as ex:
            for page in ex.map(_fetch_page, range(1, n_pages)):
                rows.extend(page)
    if not rows:
        return None
    return _bars_to_df(rows)


def _bars_to_df(rows: list[Any]) -> pd.DataFrame:
    """Build the yfinance-style OHLCV DataFrame (DatetimeIndex) from raw bar rows.

    Coerces OHLCV to numeric so the RPC path (jsonb numbers) and the paginated
    path build an identical frame regardless of serialisation — the cycle math
    needs floats.
    """
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date")
    df = df.rename(
        columns={
            "open":   "Open",
            "high":   "High",
            "low":    "Low",
            "close":  "Close",
            "volume": "Volume",
        }
    )
    for col in ("Open", "High", "Low", "Close", "Volume"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _load_fundamentals(
    sb: Client, ticker: str
) -> tuple[dict[str, Any] | None, FundamentalsSnapshot | None]:
    """Read the stocks row + reconstruct a FundamentalsSnapshot from the JSONB.

    The daily cron writes the dataclass via `dataclasses.asdict(snapshot)`, so
    the stored dict already matches the dataclass field names. We filter to
    only the known fields to be defensive against schema additions.
    """
    resp = sb.table("stocks").select("*").eq("ticker", ticker).maybe_single().execute()
    if resp is None:
        return None, None
    row: dict[str, Any] | None = cast(dict[str, Any] | None, resp.data)
    if not row:
        return None, None

    fund_dict: dict[str, Any] = row.get("fundamentals") or {}
    allowed = {f.name for f in dataclasses.fields(FundamentalsSnapshot)}
    clean = {k: v for k, v in fund_dict.items() if k in allowed}
    clean.setdefault("ticker", row["ticker"])
    if "market" not in clean and row.get("market"):
        clean["market"] = row["market"]
    if "currency" not in clean and row.get("currency"):
        clean["currency"] = row["currency"]

    try:
        snapshot = FundamentalsSnapshot(**clean)
    except TypeError as e:
        logger.warning("FundamentalsSnapshot reconstruction failed for %s: %s", ticker, e)
        snapshot = None
    return row, snapshot


def _serialise_analysis(analysis: Any) -> dict[str, Any]:
    """Convert the CycleAnalysis dataclass tree to a JSON-safe dict."""
    return dataclasses.asdict(analysis)


# Custom-param validation bounds — the canonical contract (data-contracts.md §7),
# same as web/api/analyze.py.
_CUSTOM_BOUNDS = {
    "pullback_threshold": (-30.0, -1.0),
    "profit_threshold": (1.0, 30.0),
    "lookback_bars": (21, 5040),
}


def _resolve_params(
    preset: str,
    pullback: float | None,
    profit: float | None,
    lookback: int | None,
) -> tuple[CycleParams | None, str | None]:
    """Build CycleParams from a named preset or explicit custom values."""
    if preset == "custom":
        if pullback is None or profit is None or lookback is None:
            return None, "custom preset requires pullback, profit and lookback"
        for name, value in (
            ("pullback_threshold", pullback),
            ("profit_threshold", profit),
            ("lookback_bars", lookback),
        ):
            lo, hi = _CUSTOM_BOUNDS[name]
            if not (lo <= value <= hi):
                return None, f"{name} {value} out of range [{lo}, {hi}]"
        return (
            CycleParams(
                pullback_threshold=float(pullback),
                profit_threshold=float(profit),
                lookback_bars=int(lookback),
            ),
            None,
        )
    if preset not in PRESETS:
        return None, f"unknown preset '{preset}' (must be one of: {sorted(PRESETS)} or 'custom')"
    cfg = PRESETS[preset]
    return (
        CycleParams(
            pullback_threshold=float(cfg["pullback_threshold"]),
            profit_threshold=float(cfg["profit_threshold"]),
            lookback_bars=int(cfg["lookback_bars"]),
        ),
        None,
    )


def compute_cycle(
    ticker: str,
    preset: str,
    pullback: float | None = None,
    profit: float | None = None,
    lookback: int | None = None,
) -> tuple[int, dict[str, Any]]:
    """Core cycle computation, shared by the HTTP handler and the CLI entry point.

    Returns ``(status_code, body)``. Reads price bars + fundamentals from Supabase
    and runs the cycle math; never touches yfinance. ``preset`` is one of the named
    presets OR 'custom' (with explicit pullback/profit/lookback).
    """
    ticker = (ticker or "").strip().upper()
    preset = (preset or "medium").lower()

    if not ticker:
        return 400, {"error": "missing required query param: ticker"}

    params, err = _resolve_params(preset, pullback, profit, lookback)
    if err or params is None:
        return 400, {"error": err or "invalid parameters"}

    sb = _supabase()
    row, fundamentals = _load_fundamentals(sb, ticker)
    if row is None:
        return 404, {"error": f"ticker '{ticker}' not in universe"}

    df = _load_price_bars(sb, ticker)
    if df is None or df.empty:
        return 404, {"error": f"no price history for ticker '{ticker}'"}

    analysis = analyze_ticker(ticker, df, fundamentals, params)
    if analysis is None:
        # The ticker exists and has price history, but not enough bars to fill
        # the requested horizon's lookback window (e.g. a recently-listed stock
        # on the Long preset). This is a normal, expected user action — NOT a
        # server fault — so it must not be a 5xx (which reads as "we broke" and
        # generates error-level log/alert noise). 422 Unprocessable Content:
        # the request was well-formed, but this ticker+horizon combination can't
        # be satisfied. The frontend treats any non-200 as null and renders the
        # "Major Cycle — not available at this horizon" notice gracefully.
        return 422, {
            "error": f"insufficient price history for '{ticker}' at this horizon",
            "reason": "insufficient_history",
        }

    return 200, _serialise_analysis(analysis)


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            query = parse_qs(urlparse(self.path).query)
            ticker = query.get("ticker", [""])[0] or ""
            preset = query.get("preset", ["medium"])[0] or "medium"

            def _num(key: str) -> float | None:
                raw = query.get(key, [""])[0]
                if raw in (None, ""):
                    return None
                try:
                    return float(raw)
                except ValueError:
                    return None

            pullback = _num("pullback")
            profit = _num("profit")
            _lb = _num("lookback")
            lookback = int(_lb) if _lb is not None else None
            status, body = compute_cycle(ticker, preset, pullback, profit, lookback)
            self._json(status, body, cache_for_seconds=3600 if status == 200 else 0)
        except KeyError as e:
            logger.exception("Missing env var")
            self._json(500, {"error": "server misconfigured", "detail": f"missing env: {e}"})
        except Exception as e:
            logger.exception("Unhandled error in /api/cycle")
            self._json(500, {"error": "internal error", "detail": str(e)})

    def _json(self, status: int, body: dict[str, Any], cache_for_seconds: int = 0) -> None:
        payload = json.dumps(body, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        if cache_for_seconds > 0:
            self.send_header(
                "Cache-Control",
                f"public, s-maxage={cache_for_seconds}, stale-while-revalidate=86400",
            )
        else:
            self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    # Local/dev CLI: `python web/api/cycle.py --ticker AAPL --preset medium`
    # Prints the CycleAnalysis JSON to stdout; exits non-zero on any error.
    # Used by web/lib/cycle.ts in development, where Next dev does not serve
    # this Vercel Python function over HTTP. Production is unaffected.
    import argparse

    _p = argparse.ArgumentParser(description="Compute CycleAnalysis JSON for one ticker")
    _p.add_argument("--ticker", required=True)
    _p.add_argument("--preset", default="medium")
    _p.add_argument("--pullback", type=float, default=None)
    _p.add_argument("--profit", type=float, default=None)
    _p.add_argument("--lookback", type=int, default=None)
    _args = _p.parse_args()

    _status, _body = compute_cycle(
        _args.ticker, _args.preset, _args.pullback, _args.profit, _args.lookback
    )
    print(json.dumps(_body, default=str))
    sys.exit(0 if _status == 200 else 1)
