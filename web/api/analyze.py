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
import time
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
from postgrest.types import CountMethod  # noqa: E402
from supabase import Client, create_client  # noqa: E402

from _engine.major_cycle import CycleParams, analyze_ticker  # noqa: E402
from _engine.presets import PRESETS  # noqa: E402
from _engine.providers.base import FundamentalsSnapshot  # noqa: E402

logger = logging.getLogger("api.analyze")
logging.basicConfig(level=logging.INFO)

# The client chunks the user's selection; this is a defensive per-request cap so
# a single function invocation stays well within its time/memory budget.
MAX_TICKERS_PER_REQUEST = 60

# Warm-instance result cache. Price bars only change once a day (the cron), so a
# computed per-ticker result is safe to reuse for a while. On Vercel Fluid Compute
# the module stays loaded across invocations, so this makes re-runs ("Re-run",
# overlapping baskets like Top 50 ⊂ Top 100) near-instant. Keyed by ticker + the
# exact params. Bounded so it can't grow without limit.
_RESULT_CACHE: dict[tuple[str, float, float, int], tuple[float, dict[str, Any]]] = {}
_RESULT_TTL = 1800.0  # 30 minutes
_RESULT_CACHE_MAX = 2000

# Whether the get_price_bars_json RPC (one-shot history fetch) exists in this DB.
# None = not yet probed; False = confirmed missing (use pagination, don't keep
# retrying); True = present. Lets the code run BEFORE the migration is applied
# (it falls back to paginated reads) and switch to the fast path automatically
# once the migration lands and the instance is recycled.
_RPC_AVAILABLE: bool | None = None
_RPC_NAME = "get_price_bars_json"

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


def _load_price_bars(sb: Client, ticker: str, page_workers: int = 1) -> pd.DataFrame | None:
    """Read all price_bars for one ticker (PostgREST caps each response at 1000).

    ``page_workers > 1`` pulls the pages CONCURRENTLY — a long-history ticker
    (AAPL ~11.5k bars) then arrives in ~2 round-trips instead of a dozen
    sequential ones, the single biggest speedup for a one-ticker run.

    IMPORTANT: page-level concurrency is only used when the *caller* is NOT also
    running tickers in parallel. Nesting both (outer ticker pool × inner page
    pool) floods the one shared httpx client with too many simultaneous requests
    and triggers read errors. So run_analysis uses parallel pages for a single
    ticker, and parallel-across-tickers with sequential pages otherwise — total
    concurrency stays at the level web/api/cycle.py has proven safe (~8).
    """
    # Fast path: one round-trip via the get_price_bars_json RPC (no 1000-row cap).
    # Falls through to paginated reads if the function isn't deployed yet (so this
    # code is safe to ship before the migration is applied) or on a transient error.
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
            # else: treat as transient, fall through to pagination for this call only

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

    if page_workers <= 1:
        # Sequential — used inside the across-ticker pool.
        rows_seq: list[Any] = []
        start = 0
        while True:
            page = _fetch_page(start // PAGE)
            rows_seq.extend(page)
            if len(page) < PAGE:
                break
            start += PAGE
        if not rows_seq:
            return None
        return _bars_to_df(rows_seq)

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
        # ThreadPoolExecutor.map preserves input order; each page is date-ordered,
        # so the concatenation stays globally ordered by date.
        with ThreadPoolExecutor(max_workers=min(n_pages - 1, page_workers)) as ex:
            for page in ex.map(_fetch_page, range(1, n_pages)):
                rows.extend(page)
    if not rows:
        return None
    return _bars_to_df(rows)


def _bars_to_df(rows: list[Any]) -> pd.DataFrame:
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
    # Coerce OHLCV to numeric so the RPC path (jsonb numbers) and the paginated
    # path (PostgREST) yield an identical DataFrame regardless of any string/number
    # serialisation differences — the cycle math must get floats.
    for col in ("Open", "High", "Low", "Close", "Volume"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
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
    cache_key = (params.pullback_threshold, params.profit_threshold, params.lookback_bars)
    now = time.time()
    # Parallelise pages only when there's a single ticker (no across-ticker pool
    # to nest under) — otherwise page sequentially and rely on across-ticker
    # concurrency, keeping total in-flight requests at cycle.py's safe level.
    page_workers = 8 if len(tickers) == 1 else 1

    def _one(ticker: str) -> tuple[str, dict[str, Any] | None]:
        """Analyse one ticker; return (ticker, result_dict | None).

        Retries the Supabase reads a couple of times with backoff so a transient
        cross-region timeout self-heals instead of silently dropping the ticker
        into `unavailable`. A genuine "not in universe / insufficient history"
        is a clean None and returns immediately (no wasted retries).
        """
        key = (ticker, *cache_key)
        hit = _RESULT_CACHE.get(key)
        if hit is not None and now - hit[0] < _RESULT_TTL:
            return ticker, hit[1]
        for attempt in range(3):
            try:
                row, fundamentals = _load_fundamentals(sb, ticker)
                if row is None:
                    return ticker, None  # not in universe
                df = _load_price_bars(sb, ticker, page_workers)
                if df is None or df.empty:
                    return ticker, None
                analysis = analyze_ticker(ticker, df, fundamentals, params)
                if analysis is None:
                    return ticker, None  # insufficient history
                result = dataclasses.asdict(analysis)
                _RESULT_CACHE[key] = (now, result)
                return ticker, result
            except Exception:  # noqa: BLE001 — one bad ticker must not sink the batch
                if attempt == 2:
                    logger.exception("analyze failed for %s after retries", ticker)
                    return ticker, None
                time.sleep(0.4 * (attempt + 1))
        return ticker, None

    results: list[dict[str, Any]] = []
    unavailable: list[str] = []
    # Across-ticker concurrency. Kept deliberately modest: the client may also
    # have a few chunk requests in flight at once, so total concurrent Supabase
    # reads ≈ client_pool × max_workers. Too many cross-region requests overwhelm
    # the connection and cause read timeouts (tickers then fall to `unavailable`).
    # 4 here × the client's pool of 3 ≈ 12 in flight — safe on the free tier.
    max_workers = min(len(tickers), 4)
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        for ticker, result in ex.map(_one, tickers):
            if result is None:
                unavailable.append(ticker)
            else:
                results.append(result)

    # Bound the cache so it can't grow without limit on a long-lived instance.
    if len(_RESULT_CACHE) > _RESULT_CACHE_MAX:
        cutoff = now - _RESULT_TTL
        for k in [k for k, (ts, _) in _RESULT_CACHE.items() if ts < cutoff]:
            _RESULT_CACHE.pop(k, None)

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
