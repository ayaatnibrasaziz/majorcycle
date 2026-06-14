"""/api/analyze — Vercel Python serverless function.

POST /api/analyze
    Body (JSON, camelCase — see data-contracts.md §5 AnalyzeRequest):
        {
          "tickers": ["AAPL", "MSFT", ...],   // yfinance-format storage tickers
          "preset": "short" | "medium" | "long" | "custom",
          "pullbackThreshold": -5,            // required if preset == "custom"
          "profitThreshold": 5,               // required if preset == "custom"
          "lookbackBars": 252                 // required if preset == "custom"
        }

Runs the Major Cycle analysis on a *batch* (chunk) of tickers and returns the
scored results. This function is intentionally **stateless** — it never writes
to the DB. The Run Analysis tab chunks the user's selection client-side and
POSTs each chunk here, then writes a single `analysis_runs` history row itself
(inputs only — never rating outputs; see CLAUDE.md #15). So there is no `runId`
here, unlike the older draft in data-contracts.md §5.

Like `web/api/cycle.py`, this reads price bars + fundamentals from Supabase and
runs the math via the vendored `_engine` package; it NEVER calls yfinance.
Tickers not in our universe (or with insufficient history) are returned in
`unavailable` rather than failing the whole batch.

Responses:
    200  — { results: CycleAnalysis[] (snake_case), unavailable: string[],
            started_at, finished_at }
    400  — bad body (missing tickers, bad preset, invalid custom params, too many)
    500  — analysis failed (env missing, etc.)
"""

from __future__ import annotations

import dataclasses
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any, cast

# Ensure web/ is on sys.path so `from _engine.X import ...` resolves regardless
# of how Vercel launches this function. (analyze.py lives at web/api/analyze.py;
# its parent's parent is web/, where _engine/ sits as a sibling of api/.)
_WEB_ROOT = Path(__file__).resolve().parent.parent
if str(_WEB_ROOT) not in sys.path:
    sys.path.insert(0, str(_WEB_ROOT))

import pandas as pd  # noqa: E402
from supabase import Client, create_client  # noqa: E402

from _engine.major_cycle import CycleParams, analyze_ticker  # noqa: E402
from _engine.presets import PRESETS  # noqa: E402
from _engine.providers.base import FundamentalsSnapshot  # noqa: E402

logger = logging.getLogger("api.analyze")
logging.basicConfig(level=logging.INFO)

# The client chunks the user's selection; this is a defensive per-request cap so
# a single function invocation stays well within its time/memory budget.
MAX_TICKERS_PER_REQUEST = 60

# Custom-param validation bounds — the canonical contract (data-contracts.md §7).
_CUSTOM_BOUNDS = {
    "pullback_threshold": (-30.0, -1.0),
    "profit_threshold": (1.0, 30.0),
    "lookback_bars": (21, 5040),
}


# ── Supabase loaders ─────────────────────────────────────────────────────────
# Deliberately duplicated from web/api/cycle.py (shared origin). Each Vercel
# Python function bundles independently and cross-importing sibling api/*.py
# files is fragile, so we keep this function self-contained. The cycle *math*
# stays single-sourced via the _engine package. NOTE: the bar loader here pages
# SEQUENTIALLY (no inner ThreadPoolExecutor) because parallelism already happens
# at the ticker level below — nesting pools would explode the thread count.


def _supabase() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _load_price_bars(sb: Client, ticker: str) -> pd.DataFrame | None:
    """Read all price_bars for one ticker (paginated; PostgREST caps at 1000)."""
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
        page = cast("list[Any]", resp.data or [])
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
            "open": "Open",
            "high": "High",
            "low": "Low",
            "close": "Close",
            "volume": "Volume",
        }
    )
    return df


def _load_fundamentals(
    sb: Client, ticker: str
) -> tuple[dict[str, Any] | None, FundamentalsSnapshot | None]:
    """Read the stocks row + reconstruct a FundamentalsSnapshot from the JSONB."""
    resp = sb.table("stocks").select("*").eq("ticker", ticker).maybe_single().execute()
    if resp is None:
        return None, None
    row: dict[str, Any] | None = cast("dict[str, Any] | None", resp.data)
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


# ── Request parsing / validation ─────────────────────────────────────────────


def _resolve_params(body: dict[str, Any]) -> tuple[CycleParams | None, str | None]:
    """Build CycleParams from a request body. Returns (params, error_message)."""
    preset = str(body.get("preset", "medium")).lower()

    if preset == "custom":
        try:
            pullback = float(body["pullbackThreshold"])
            profit = float(body["profitThreshold"])
            lookback = int(body["lookbackBars"])
        except (KeyError, TypeError, ValueError):
            return None, (
                "custom preset requires numeric pullbackThreshold, "
                "profitThreshold and lookbackBars"
            )
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
                pullback_threshold=pullback,
                profit_threshold=profit,
                lookback_bars=lookback,
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


def _clean_tickers(raw: Any) -> list[str]:
    """Normalise + de-duplicate (order-preserving) the requested ticker list."""
    if not isinstance(raw, list):
        return []
    seen: set[str] = set()
    out: list[str] = []
    for item in raw:
        t = str(item or "").strip().upper()
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def run_analysis(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Core batch computation, shared by the HTTP handler and the CLI.

    Returns ``(status_code, response_body)``.
    """
    started_at = datetime.now(timezone.utc).isoformat()

    tickers = _clean_tickers(body.get("tickers"))
    if not tickers:
        return 400, {"error": "missing or empty 'tickers'"}
    if len(tickers) > MAX_TICKERS_PER_REQUEST:
        return 400, {
            "error": (
                f"too many tickers ({len(tickers)}); "
                f"max {MAX_TICKERS_PER_REQUEST} per request — chunk the list"
            )
        }

    params, err = _resolve_params(body)
    if err or params is None:
        return 400, {"error": err or "invalid parameters"}

    sb = _supabase()

    def _one(ticker: str) -> tuple[str, dict[str, Any] | None]:
        """Analyse one ticker; return (ticker, result_dict | None)."""
        try:
            row, fundamentals = _load_fundamentals(sb, ticker)
            if row is None:
                return ticker, None  # not in universe
            df = _load_price_bars(sb, ticker)
            if df is None or df.empty:
                return ticker, None
            analysis = analyze_ticker(ticker, df, fundamentals, params)
            if analysis is None:
                return ticker, None  # insufficient history
            return ticker, dataclasses.asdict(analysis)
        except Exception:  # noqa: BLE001 — one bad ticker must not sink the batch
            logger.exception("analyze failed for %s", ticker)
            return ticker, None

    results: list[dict[str, Any]] = []
    unavailable: list[str] = []
    max_workers = min(len(tickers), 8)
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        for ticker, result in ex.map(_one, tickers):
            if result is None:
                unavailable.append(ticker)
            else:
                results.append(result)

    return 200, {
        "results": results,
        "unavailable": unavailable,
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw = self.rfile.read(length) if length else b"{}"
            try:
                body = json.loads(raw or b"{}")
            except json.JSONDecodeError:
                self._json(400, {"error": "invalid JSON body"})
                return
            if not isinstance(body, dict):
                self._json(400, {"error": "body must be a JSON object"})
                return
            status, payload = run_analysis(body)
            self._json(status, payload)
        except KeyError as e:
            logger.exception("Missing env var")
            self._json(500, {"error": "server misconfigured", "detail": f"missing env: {e}"})
        except Exception as e:  # noqa: BLE001
            logger.exception("Unhandled error in /api/analyze")
            self._json(500, {"error": "internal error", "detail": str(e)})

    def _json(self, status: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    # Local/dev CLI: echo a JSON request body on stdin, get the response on stdout.
    #   echo '{"tickers":["SHOP.TO"],"preset":"medium"}' | python web/api/analyze.py
    # Used for local verification (Next dev does not serve this Vercel function).
    _raw = sys.stdin.read() or "{}"
    _body = json.loads(_raw)
    _status, _payload = run_analysis(_body)
    print(json.dumps(_payload, default=str))
    sys.exit(0 if _status == 200 else 1)
