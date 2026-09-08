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
    200  — { results: RunResult[] (snake_case — each a CycleAnalysis plus a slim
            `fundamentals` subset for the Results screener), unavailable: string[],
            started_at, finished_at }
    400  — bad body (missing tickers, bad preset, invalid custom params, too many)
    500  — analysis failed (env missing, etc.)
"""

from __future__ import annotations

import base64
import dataclasses
import hmac
import json
import logging
import os
import random
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

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from postgrest.types import CountMethod  # noqa: E402
from supabase import Client, create_client  # noqa: E402

from _engine.major_cycle import CycleParams, analyze_ticker  # noqa: E402
from _engine.presets import PRESETS  # noqa: E402
from _engine.providers.base import FundamentalsSnapshot  # noqa: E402
from _engine.providers.field_spec import normalise_fundamentals  # noqa: E402

logger = logging.getLogger("api.analyze")

# Header carrying the internal shared secret, injected by web/proxy.ts once it has
# verified the caller's session AND entitlement. Must match web/lib/internalAuth.ts.
INTERNAL_HEADER = "x-mc-internal"
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

# The LEAN history fetch, and the reason a 761-ticker screen went from ~200s to
# 1,529s (measured in `analysis_runs`, which records started_at/finished_at).
#
# `get_price_bars_json` builds one jsonb OBJECT per bar — 11,525 of them for
# AAPL — and that construction, not the scan, is where the time goes. Timed on
# the live database:
#
#     get_price_bars_json('AAPL')                  826 ms   1,809,324 bytes
#     count(*), max(high), min(low), max(close)     18 ms   (same scan, no json)
#     get_cycle_bars_json('AAPL')                   15 ms     785,322 bytes
#
# At 761 tickers the old shape is ~630 seconds of database CPU and ~700-900 MB
# over the wire for ONE screen. The new one is columnar (four arrays instead of
# 11,525 objects) and carries only what the screener reads — High, Low, Close —
# because `calculate_cycle_metrics` uses those three and nothing else, while
# `open` and `volume` were fetched, parsed into the DataFrame and never touched.
#
# ⚠️ VALUES ARE BYTE-IDENTICAL, and that was not free. The obvious encoding —
# `array_agg(high::float8)` — is smaller still, but Postgres renders a float8 at
# 15 significant digits by default, so every price came back differing from the
# stored numeric by ~1e-13: a comparison across 25 tickers matched 0 of them.
# Four encodings were measured; the numeric's OWN TEXT, comma-joined, is both
# exact and the fastest:
#
#     float8, 15 digits (default)   121 ms   801,531 bytes   NOT exact
#     float8, 17 digits             448 ms   854,466 bytes   exact
#     jsonb array of text            33 ms   923,618 bytes   exact
#     string_agg, comma-joined       15 ms   785,322 bytes   exact  <- ships
#
# Verified across 40 random tickers, every date/high/low/close equal to what the
# old function emits, with the 15-digit run kept as the control proving that
# check can fail (11p).
#
# ⚠️ NOT a replacement for `_RPC_NAME`. The Stock Detail page draws candlesticks
# and genuinely needs open, volume and every date; two readers, two shapes.
_CYCLE_RPC_AVAILABLE: bool | None = None
_CYCLE_RPC_NAME = "get_cycle_bars_json"
# The same bars in binary — 44% fewer raw bytes, bit-identical numbers. Tried
# first; `get_cycle_bars_json` remains the fallback so a deploy and a migration
# can land in either order. See supabase/migrations/20260909000000_*.sql.
_B64_RPC_AVAILABLE: bool | None = None
_B64_RPC_NAME = "get_cycle_bars_b64"

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
    # Fastest path: the columnar High/Low/Close RPC (see _CYCLE_RPC_NAME above).
    # Falls through to the row-object RPC, and then to pagination, so this file is
    # safe to deploy before the migration is applied and picks the fast path up on
    # its own once it lands.
    global _B64_RPC_AVAILABLE
    if _B64_RPC_AVAILABLE is not False:
        for attempt in range(3):
            try:
                resp = sb.rpc(_B64_RPC_NAME, {"p_ticker": ticker}).execute()
                _B64_RPC_AVAILABLE = True
                payload = cast("dict[str, Any] | None", resp.data)
                return _b64_to_df(payload) if payload else None
            except Exception as e:  # noqa: BLE001
                msg = str(e).lower()
                if any(
                    s in msg
                    for s in ("pgrst202", "could not find", "does not exist", "not found", "404")
                ):
                    _B64_RPC_AVAILABLE = False
                    logger.warning(
                        "%s RPC not deployed — using %s", _B64_RPC_NAME, _CYCLE_RPC_NAME
                    )
                    break
                if attempt < 2:
                    time.sleep(0.3 * (attempt + 1))
                    continue
                break

    global _CYCLE_RPC_AVAILABLE
    if _CYCLE_RPC_AVAILABLE is not False:
        for attempt in range(3):
            try:
                resp = sb.rpc(_CYCLE_RPC_NAME, {"p_ticker": ticker}).execute()
                _CYCLE_RPC_AVAILABLE = True
                payload = cast("dict[str, Any] | None", resp.data)
                return _columns_to_df(payload) if payload else None
            except Exception as e:  # noqa: BLE001
                msg = str(e).lower()
                if any(
                    s in msg
                    for s in ("pgrst202", "could not find", "does not exist", "not found", "404")
                ):
                    _CYCLE_RPC_AVAILABLE = False
                    logger.warning("%s RPC not deployed — using %s", _CYCLE_RPC_NAME, _RPC_NAME)
                    break
                if attempt < 2:
                    time.sleep(0.3 * (attempt + 1))
                    continue
                break

    # Fast path: one round-trip via the get_price_bars_json RPC (no 1000-row cap).
    # Falls through to paginated reads if the function isn't deployed yet (so this
    # code is safe to ship before the migration is applied) or on a transient error.
    global _RPC_AVAILABLE
    if _RPC_AVAILABLE is not False:
        # The RPC is the fast, single-round-trip path the detail page uses. A
        # transient cross-region error here used to fall straight through to slow
        # paginated reads (which then time out under batch concurrency → false
        # skips). Retry the fast path a couple of times first; only fall through
        # if the function is genuinely missing or the RPC keeps failing.
        for rpc_attempt in range(3):
            try:
                resp = sb.rpc(_RPC_NAME, {"p_ticker": ticker}).execute()
                _RPC_AVAILABLE = True
                data = cast("list[Any] | None", resp.data)
                return _bars_to_df(data) if data else None
            except Exception as e:  # noqa: BLE001
                msg = str(e).lower()
                if any(
                    s in msg
                    for s in ("pgrst202", "could not find", "does not exist", "not found", "404")
                ):
                    _RPC_AVAILABLE = False
                    logger.warning("%s RPC not deployed — using paginated reads", _RPC_NAME)
                    break
                # Transient (timeout / connection reset): retry the fast path
                # before giving up on it for this call.
                if rpc_attempt < 2:
                    time.sleep(0.3 * (rpc_attempt + 1))
                    continue
                break  # fall through to pagination for this call only

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


def _b64_to_df(payload: dict[str, Any]) -> pd.DataFrame | None:
    """Build the analysis frame from the BINARY columnar RPC.

    `d` is base64 of n big-endian int32 epoch-days; `h`, `l`, `c` are base64 of n
    big-endian float8.

    ⚠️ This is NOT bit-identical to `_columns_to_df`, and the difference is the
    text path's fault rather than this one's. `pd.to_numeric` is a fast float
    parser and is not correctly rounded: given "0.09812240302562714" it returns
    0.0981224030256271, and it disagrees with Python's `float()` on 4,584 of
    AAPL's 11,525 closes. So the text path has always carried ~1-14 ULP of error
    (~2e-15 relative) and this path carries none, because it parses no strings.
    Measured across 21 tickers x 3 presets, every frame differs and every
    resulting CycleAnalysis is identical. See
    `analytics/tests/test_analyze_columns.py`, which pins both halves.

    ⚠️ The length check is load-bearing, for the same reason as in the text path:
    four aggregates over one scan cannot disagree, but if they ever did,
    `np.frombuffer` would hand back a short array and the frame would go silently
    out of alignment — a wrong number that looks like a right one.
    """
    n = int(payload.get("n") or 0)
    if n <= 0:
        return None

    def _col(key: str, dtype: str) -> np.ndarray[Any, np.dtype[Any]]:
        arr = np.frombuffer(base64.b64decode(payload.get(key) or ""), dtype=dtype)
        if len(arr) != n:
            raise ValueError(
                f"{_B64_RPC_NAME} column {key!r} has {len(arr)} values but n={n}"
            )
        return arr

    # `.astype` also converts big-endian to native and makes the arrays writable;
    # `np.frombuffer` returns a read-only view over the decoded bytes.
    days = _col("d", ">i4").astype("int64")
    return pd.DataFrame(
        {
            "High": _col("h", ">f8").astype("float64"),
            "Low": _col("l", ">f8").astype("float64"),
            "Close": _col("c", ">f8").astype("float64"),
        },
        index=pd.DatetimeIndex(days.astype("datetime64[D]")),
    )


def _columns_to_df(payload: dict[str, Any]) -> pd.DataFrame | None:
    """Build the analysis frame from the columnar RPC's four parallel arrays.

    Produces the same DataFrame the row-object path produces, minus Open and
    Volume — which nothing in the analysis path reads (`calculate_cycle_metrics`
    takes High/Low/Close; `_screener_fundamentals` takes High).

    ⚠️ The length check is the load-bearing line. Four separate `array_agg`s over
    one scan cannot disagree — the primary key is (ticker, date), so the ordering
    is total and every column sees the same rows — but if they ever did, pandas
    would not complain in a useful way: a shorter column becomes NaN-padded and
    the frame goes quietly out of alignment, which is a wrong number that looks
    like a right one. This repo's whole failure catalogue is that shape, so the
    impossible case is made LOUD rather than assumed away.
    """
    # Comma-DELIMITED, not JSON arrays. Postgres writes one `string_agg` per
    # column instead of a jsonb array of 11,525 quoted strings, which halves the
    # database's work again (33 ms -> 15 ms on AAPL) and drops another 15% of the
    # payload. The values are the same characters either way, so `pd.to_numeric`
    # receives exactly what it received before — verified element-for-element.
    raw_d = payload.get("d") or ""
    raw_h = payload.get("h") or ""
    raw_l = payload.get("l") or ""
    raw_c = payload.get("c") or ""
    if not raw_d:
        return None

    dates = raw_d.split(",")
    highs = raw_h.split(",")
    lows = raw_l.split(",")
    closes = raw_c.split(",")

    n = len(dates)
    if not (len(highs) == len(lows) == len(closes) == n):
        raise ValueError(
            f"{_CYCLE_RPC_NAME} returned misaligned columns: "
            f"d={n} h={len(highs)} l={len(lows)} c={len(closes)}"
        )
    declared = payload.get("n")
    if declared is not None and int(declared) != n:
        raise ValueError(f"{_CYCLE_RPC_NAME} said n={declared} but sent {n} dates")

    df = pd.DataFrame(
        {
            "High": pd.to_numeric(highs, errors="coerce"),
            "Low": pd.to_numeric(lows, errors="coerce"),
            "Close": pd.to_numeric(closes, errors="coerce"),
        },
        # ⚠️ `datetime64[s]` rather than `pd.to_datetime`, which is half the cost
        # and — verified — produces an index that compares equal element for
        # element. Every value comes from a Postgres `date` column, so it is
        # always YYYY-MM-DD; anything else raises here rather than being coerced
        # to NaT, because a silently missing date would shift `as_of`.
        index=pd.DatetimeIndex(np.array(dates, dtype="datetime64[s]")),
    )
    df.index.name = "date"
    return df


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
    """Read the stocks row + reconstruct a FundamentalsSnapshot from the JSONB.

    ⚠️ FOUR COLUMNS, not `*`. The row averages 46.3 kB and the screener reads
    exactly four things from it — `fundamentals`, plus `ticker`/`market`/
    `currency` as fallbacks when the snapshot omits them; the caller uses the row
    itself only to ask "is this ticker in the universe?". The other ~40 kB is
    statement blobs: insider transactions (6.6 kB), two balance sheets, two cash
    flows, two income statements, analyst upgrades. None of it reaches a screener
    row, and at 761 tickers `*` was pulling ~34 MB per screen to look at 2 kB of
    it. Measured 2026-09-08 with `jsonb_each(to_jsonb(stocks))`.

    The Stock Detail page is the reader those blobs exist for, and it fetches
    them separately — this narrowing does not touch it.
    """
    resp = (
        sb.table("stocks")
        .select("ticker,market,currency,fundamentals")
        .eq("ticker", ticker)
        .maybe_single()
        .execute()
    )
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
        # Normalised on read too — same reason as web/api/cycle.py.
        snapshot = normalise_fundamentals(FundamentalsSnapshot(**clean))
    except TypeError as e:
        logger.warning("FundamentalsSnapshot reconstruction failed for %s: %s", ticker, e)
        snapshot = None
    return row, snapshot


# The slim, display-only fundamentals subset returned alongside each scored
# result so the Results screener can render the Analyst / Full views (analyst
# targets, valuation ratios, profitability, growth, short interest) WITHOUT a
# second fetch. Never used by the cycle math. `analyst_recommendation` is
# third-party Wall-Street data shown verbatim (CLAUDE.md #17). Keys stay
# snake_case — the client converts to camelCase via toCamel().
_SCREENER_FIELDS = (
    "pe",
    "peg",
    "roe",
    "gross_margin",
    "net_margin",
    "fcf_yield_pct",
    "debt_to_equity",
    "current_ratio",
    "interest_coverage",
    "revenue_growth_yoy",
    "short_pct_of_float",
    "short_ratio",
    "analyst_target_price",
    "analyst_recommendation",
    "num_analyst_opinions",
    # Not displayed. Shipped so the screener can ask whether the provider's QUOTE
    # and its price HISTORY are on the same basis — see `_screener_fundamentals`.
    "week52_high",
)

#: Bars behind `history_high` — one trading year, matching the quoted figure's own
#: window. Same constant as `WINDOW` in `web/lib/quoteBasis.ts`.
_HISTORY_HIGH_BARS = 252


def _screener_fundamentals(
    snapshot: FundamentalsSnapshot | None, df: Any = None
) -> dict[str, Any]:
    """Pull the display-only screener subset out of a FundamentalsSnapshot.

    ⚠️ Also ships `history_high`: the highest high in our own last 252 bars — audit
    5A-126. The screener's **Target** and **Upside%** columns divide
    `analyst_target_price` (the provider's QUOTE) by `current_close` (its price
    HISTORY), and after a split those two can sit on different bases for days. On
    2026-09-04 AvalonBay was quoted at $184.06 with a 52-week high of $185.62 while
    its own series ended at $68.14, which renders as "+196% upside" — arithmetic that
    checks out on inputs that do not belong together.

    ⚠️ **Two numbers rather than a verdict, deliberately.** The threshold that decides
    what counts as a disagreement stays in `web/lib/quoteBasis.ts`, which the Stock
    Detail page already uses. Computing the answer here would put an ALGORITHM in two
    languages, which is the drift CLAUDE.md 11c-iii records: two implementations can
    share a spec and still part company. A screener row carries no price bars, so the
    number it cannot derive is the only thing sent.

    ⚠️ Note it is NOT a plain max over the whole frame: `df` holds the full history
    (five figures of bars for a US mega-cap), and a 52-week quote must be compared
    against a 52-week window or every stock that has ever doubled loses its figures.
    """
    if snapshot is None:
        return {}
    out: dict[str, Any] = {f: getattr(snapshot, f, None) for f in _SCREENER_FIELDS}
    out["history_high"] = None
    if df is not None and not df.empty and "High" in df:
        recent = df["High"].tail(_HISTORY_HIGH_BARS)
        if len(recent):
            top = float(recent.max())
            out["history_high"] = top if top > 0 else None
    return out


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
        for attempt in range(4):
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
                # Display-only fundamentals for the Results screener (see above).
                result["fundamentals"] = _screener_fundamentals(fundamentals, df)
                _RESULT_CACHE[key] = (now, result)
                return ticker, result
            except Exception:  # noqa: BLE001 — one bad ticker must not sink the batch
                if attempt == 3:
                    logger.exception("analyze failed for %s after retries", ticker)
                    return ticker, None
                # Jittered backoff so concurrent retries don't resynchronise into
                # another simultaneous burst against the DB.
                time.sleep(0.4 * (attempt + 1) + random.uniform(0, 0.25))
        return ticker, None

    results: list[dict[str, Any]] = []
    unavailable: list[str] = []
    # Across-ticker concurrency. Total concurrent Supabase reads ≈
    # client_pool (POOL_SIZE, 3) × max_workers, so this number times three is
    # what the database sees.
    #
    # ── Why it moved from 2 to 4 on 2026-09-08 ─────────────────────────────
    # Profiled against a real 761-ticker run (`analysis_runs` + the project's
    # own edge logs), a screen now spends almost none of its time computing:
    #
    #     gunzip + json + DataFrame + analyze_ticker      35.7 ms   (3%)
    #     waiting on Supabase                          ~1,327 ms  (97%)
    #
    # and of the database side, ONE call is 94% of it — `get_cycle_bars_json`,
    # 785 calls at 787 ms average. Postgres itself runs that function in
    # 15.5 ms warm (measured server-side with clock_timestamp, not EXPLAIN,
    # which cannot see result serialisation). The rest is PostgREST building,
    # gzipping and shipping 785 KB.
    #
    # A workload that is 97% waiting scales with concurrency, and the payload
    # cannot be made smaller: the obvious win — the prices are float32 noise
    # rendered at 18 characters (`319.9700012207031` for a real 319.97) and
    # rounding to 4 dp halves the payload — was MEASURED and rejected. Across
    # 26 tickers × 3 presets it changed 73 of 78 analyses, including AAPL
    # losing a pullback event (662 → 661) and its Valuation Score moving
    # 29.7 → 29.8. That is exactly the silent drift CLAUDE.md 11c-iii forbids.
    #
    # ⚠️ AND THE OBVIOUS JUSTIFICATION FOR RAISING THIS IS WRONG — recorded so
    # nobody rebuilds it. It is tempting to argue the old paginated path put
    # far more load on the database, so higher concurrency is a return to a
    # tested level. It is not. In a BATCH the old path ran `page_workers = 1`,
    # so its twelve 1,000-row pages per ticker were fetched SEQUENTIALLY:
    # in-flight request concurrency was 6 then and is 6 now. What collapsed was
    # the number of ROUND TRIPS per ticker (12 → 1), not the concurrency. So 12
    # in flight is genuinely untested territory, and this is a deliberate step
    # into it rather than a restoration.
    #
    # It is a safe step to take blind, which is why it is taken blind: the
    # failure mode of too much concurrency here is a read timeout, a ticker
    # falls to `unavailable`, and the client's warm-retry plus single-ticker
    # reconciliation pass picks it up. The cost of being wrong is latency, not
    # a missing stock — and it reverts by changing one number back to 2.
    #
    # ⚠️ Do NOT raise this and POOL_SIZE in the same change. One variable at a
    # time is what makes the next `analysis_runs` reading attributable.
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
            # The screener is premium and has no free form. Entitlement itself is
            # decided in web/proxy.ts — this function can't read a Supabase session
            # cookie, so the proxy (which has already verified the JWT locally) is
            # the session authority. On success it INJECTS this secret into the
            # forwarded request, so arriving without it means the gate was not
            # traversed, and the request is refused. (F3 Step 10.)
            secret = os.environ.get("CYCLE_INTERNAL_SECRET") or ""
            if not secret:
                logger.error("CYCLE_INTERNAL_SECRET is not set — refusing all requests")
                self._json(503, {"error": "server misconfigured"})
                return
            if not hmac.compare_digest(self.headers.get(INTERNAL_HEADER) or "", secret):
                self._json(401, {"error": "unauthorized"})
                return

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
        # `private, no-store` on EVERY branch — the 200 carries a whole basket's paid
        # analysis, and even the 401 is a per-caller answer. Vercel's edge caches only
        # on `s-maxage`/`stale-while-revalidate` and never on `no-store`, so bare
        # `no-store` (what this sent until 2026-07-30) was already safe in practice —
        # but it was the ONE premium surface `check:entitlement-gates` did not assert,
        # while it guards api/cycle.py, proxy.ts and the report route. Safe-by-someone-
        # else's-default is exactly the posture CLAUDE.md 11a exists to forbid: it is
        # how the report route came to send no Cache-Control at all. Matches cycle.py.
        payload = json.dumps(body, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "private, no-store")
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
