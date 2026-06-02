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
    500  — analysis failed
"""

from __future__ import annotations

import dataclasses
import json
import logging
import os
import sys
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
from supabase import Client, create_client  # noqa: E402

from _engine.major_cycle import CycleParams, analyze_ticker  # noqa: E402
from _engine.presets import PRESETS  # noqa: E402
from _engine.providers.base import FundamentalsSnapshot  # noqa: E402

logger = logging.getLogger("api.cycle")
logging.basicConfig(level=logging.INFO)


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

    PostgREST caps each response at 1000 rows, so we paginate until exhausted —
    otherwise the cycle math would only see the oldest 1000 bars (decades-old,
    split-adjusted prices) and produce nonsense. Mirrors the pagination in
    web/lib/stocks.ts.
    """
    PAGE = 1000
    rows: list[Any] = []
    start = 0
    while True:
        resp = (
            sb.table("price_bars")
            .select("date,open,high,low,close,volume")
            .eq("ticker", ticker)
            .order("date")
            .range(start, start + PAGE - 1)
            .execute()
        )
        page: list[Any] = resp.data or []
        if not page:
            break
        rows.extend(page)
        if len(page) < PAGE:
            break
        start += PAGE
    if not rows:
        return None
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


def compute_cycle(ticker: str, preset: str) -> tuple[int, dict[str, Any]]:
    """Core cycle computation, shared by the HTTP handler and the CLI entry point.

    Returns ``(status_code, body)``. Reads price bars + fundamentals from Supabase
    and runs the cycle math; never touches yfinance.
    """
    ticker = (ticker or "").strip().upper()
    preset = (preset or "medium").lower()

    if not ticker:
        return 400, {"error": "missing required query param: ticker"}
    if preset not in PRESETS:
        return 400, {"error": f"unknown preset '{preset}' (must be one of: {sorted(PRESETS)})"}

    sb = _supabase()
    row, fundamentals = _load_fundamentals(sb, ticker)
    if row is None:
        return 404, {"error": f"ticker '{ticker}' not in universe"}

    df = _load_price_bars(sb, ticker)
    if df is None or df.empty:
        return 404, {"error": f"no price history for ticker '{ticker}'"}

    preset_cfg = PRESETS[preset]
    params = CycleParams(
        pullback_threshold=float(preset_cfg["pullback_threshold"]),
        profit_threshold=float(preset_cfg["profit_threshold"]),
        lookback_bars=int(preset_cfg["lookback_bars"]),
    )
    analysis = analyze_ticker(ticker, df, fundamentals, params)
    if analysis is None:
        return 500, {"error": f"analysis failed for '{ticker}' — insufficient price history"}

    return 200, _serialise_analysis(analysis)


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            query = parse_qs(urlparse(self.path).query)
            ticker = query.get("ticker", [""])[0] or ""
            preset = query.get("preset", ["medium"])[0] or "medium"
            status, body = compute_cycle(ticker, preset)
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
    _args = _p.parse_args()

    _status, _body = compute_cycle(_args.ticker, _args.preset)
    print(json.dumps(_body, default=str))
    sys.exit(0 if _status == 200 else 1)
