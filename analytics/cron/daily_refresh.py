"""Daily data refresh pipeline — runs via GitHub Actions cron at 23:00 UTC.

Usage:
    python -m analytics.cron.daily_refresh               # smart mode (default) — price+fundamentals daily, enriched only when stale
    python -m analytics.cron.daily_refresh --mode full   # full mode — forces enriched refresh for every ticker (~4-5 hrs)
"""

import dataclasses
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional, cast

import pandas as pd
import requests
from dotenv import load_dotenv
from supabase import Client, create_client

from analytics.config import DATA_PROVIDER

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_BATCH_SIZE = 10
_SLEEP_BETWEEN_BATCHES = 2.0
_DB_CHUNK = 500

# Incremental price updates fetch a ~1-month window (not just the last few days) so
# any stock split reported by yfinance's actions calendar within that window is
# seen and triggers a full re-adjusted re-pull (see `_recent_splits`). The wider
# window also survives a few missed cron days.
_INCREMENTAL_PRICE_PERIOD = "1mo"

# C-R9 smart split handling. A detected split is re-pulled + re-verified nightly while
# 'pending'; once the discontinuity is resolved we stop (status 'resolved'). If still
# unresolved this many days after first detection, it's flagged 'failed' (e.g. DD, where
# yfinance lists the split but never back-adjusts the prices). State lives in split_events.
_SPLIT_RETRY_DAYS = 30
# Trading-day window each side of the reported split date to scan for a leftover scale
# cliff (DD's price cliff is 2026-06-18, ~6 days before its 2026-06-24 split date).
_SPLIT_VERIFY_WINDOW = 10
# Multiplicative tolerance when matching a leftover adjacent-day cliff to the split's
# expected unadjusted price factor (1/ratio). DD's cliff (x2.985 vs 1/0.3333 = 3.0) is a
# 0.005 deviation; a normal price move is nowhere near 3x, so this can't false-fire.
_SPLIT_RATIO_TOL = 0.20
# Bars each side used to confirm a candidate cliff is a *persistent* scale shift (a real
# unadjusted split) rather than a one-day dip that bounces back (e.g. FDX 2026-06-10 fell
# -3.8% then recovered +5.9%, which a loose ratio match would otherwise read as a cliff).
# We compare the median close just-before vs just-after the step; only a sustained shift
# matching the split factor counts. See C-R2 review (FDX false positive).
_SPLIT_PERSIST_BARS = 3


def _jsonb(obj: Any) -> Any:
    return json.loads(json.dumps(obj, default=str))


def _get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _load_universe(supabase: Client) -> list[dict[str, str]]:
    """The tickers to refresh = the live universe in `stocks` (auto-expanding via
    drain_requests + the nightly index-membership refresh) PLUS the benchmark
    indices (always included, even if a benchmark row is somehow missing).

    This replaces the former static analytics/universe/*.csv seed: the DB is now the
    single source of truth, so there are no hand-maintained ticker CSVs. Paginated
    so it never silently truncates if the universe grows past PostgREST's 1000-row
    page cap.
    """
    tickers: set[str] = set(_INDEX_CURRENCY)  # benchmark indices, guaranteed
    page = 1000
    start = 0
    while True:
        res = (
            supabase.table("stocks")
            .select("ticker")
            .range(start, start + page - 1)
            .execute()
        )
        batch = cast(list[dict[str, Any]], res.data or [])
        for r in batch:
            if r.get("ticker"):
                tickers.add(str(r["ticker"]))
        if len(batch) < page:
            break
        start += page
    rows = [{"ticker": t} for t in sorted(tickers)]
    logger.info("Universe loaded: %d tickers from stocks table (+benchmarks)", len(rows))
    return rows


# Benchmark indices are stored as price-only rows (market='index') used by the
# Relative Performance chart. Each maps to a home currency for display.
_INDEX_CURRENCY: dict[str, str] = {
    "^GSPC": "USD",    # S&P 500
    "^IXIC": "USD",    # NASDAQ Composite
    "^AXJO": "AUD",    # S&P/ASX 200
    "^GSPTSE": "CAD",  # S&P/TSX Composite
}


def _infer_market(ticker: str) -> str:
    if ticker.startswith("^"):
        return "index"
    if ticker.endswith(".AX"):
        return "au"
    if ticker.endswith(".TO"):
        return "ca"
    return "us"


def _upsert_price_bars(supabase: Client, ticker: str, df: pd.DataFrame) -> None:
    bars: list[dict[str, Any]] = []
    for ts, row in df.iterrows():
        vol = row["Volume"]
        bars.append({
            "ticker": ticker,
            "date":   ts.strftime("%Y-%m-%d"),  # type: ignore[attr-defined]
            "open":   float(row["Open"]),
            "high":   float(row["High"]),
            "low":    float(row["Low"]),
            "close":  float(row["Close"]),
            "volume": int(vol) if pd.notna(vol) else None,
        })
    for i in range(0, len(bars), _DB_CHUNK):
        chunk = bars[i: i + _DB_CHUNK]
        supabase.table("price_bars").upsert(chunk, on_conflict="ticker,date").execute()


def _recent_splits(df: pd.DataFrame) -> list[str]:
    """ISO dates of any stock split inside the freshly-fetched window.

    The provider surfaces yfinance's authoritative split *actions* (the `Stock
    Splits` column) on ``df.attrs['recent_splits']``. This is the corporate-action
    calendar, not a price heuristic — a normal price move (a stock simply falling
    10%) never appears here, so it can't false-fire. A non-empty list means the
    series was re-scaled by a split and the caller should re-pull the FULL history
    so every stored bar is re-adjusted consistently (otherwise the pre-split bars
    keep the old scale and a split reads as a fake one-day crash that wrecks the
    cycle bounds).
    """
    val = getattr(df, "attrs", {}).get("recent_splits")
    return list(val) if val else []


def _recent_split_events(df: pd.DataFrame) -> list[dict[str, Any]]:
    """``[{date, ratio}, ...]`` for splits in the freshly-fetched window.

    Parallels ``_recent_splits`` but also carries the split ratio (the provider's
    ``recent_split_events`` attr) so the caller can record + verify the split, not
    just trigger a re-pull. Tolerant of the attr being absent (e.g. the stooq path).
    """
    val = getattr(df, "attrs", {}).get("recent_split_events")
    return list(val) if val else []


def _parse_dt(val: Any) -> Optional[datetime]:
    """Parse a Supabase ISO timestamp into a tz-aware (UTC) datetime; None on failure."""
    if not val:
        return None
    try:
        dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _window_median(vals: list[float]) -> Optional[float]:
    """Median of a small price window (used by the split-cliff persistence check)."""
    if not vals:
        return None
    s = sorted(vals)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0


def _verify_split_resolved(
    df: pd.DataFrame, split_date: str, ratio: Optional[float]
) -> tuple[bool, Optional[str], Optional[float]]:
    """Has the split's price discontinuity been removed from the full series?

    A correctly back-adjusted split leaves no scale cliff at the split. An unadjusted
    one (e.g. DD) leaves an adjacent-day close ratio ≈ the split's expected unadjusted
    price factor ``1/ratio`` (DD reverse 1-for-3 → 1/0.3333 ≈ 3.0, a one-day jump UP).
    Scan the closes in a ``±_SPLIT_VERIFY_WINDOW``-bar window around the split date for
    such a cliff; a matching one ⇒ unresolved. The expected direction/magnitude is fixed
    by the ratio, so a real crash or spike (which doesn't match ``1/ratio``) is never
    misread as a leftover split. A matched step must ALSO be a *persistent* shift (median
    close just-before vs just-after ≈ the split factor), so a one-day dip that bounces back
    (FDX) — which can match the per-bar ratio by coincidence — isn't read as a cliff.

    Returns ``(resolved, cliff_date, cliff_ratio)``. When unresolved, ``cliff_*`` describe
    the worst offending bar (for backend visibility); when resolved they are ``None``.
    """
    try:
        idx = df.index
        closes = df["Close"].to_numpy()
    except (KeyError, TypeError, AttributeError):
        return True, None, None
    if len(closes) < 2:
        return True, None, None

    try:
        split_ts = pd.Timestamp(split_date)
    except (ValueError, TypeError):
        return True, None, None

    pos = int(idx.searchsorted(split_ts))
    lo = max(1, pos - _SPLIT_VERIFY_WINDOW)
    hi = min(len(closes), pos + _SPLIT_VERIFY_WINDOW + 1)
    if lo >= hi:
        return True, None, None

    target = (1.0 / ratio) if (ratio and ratio > 0) else None
    # Generic fallback (missing/zero ratio): flag any large adjacent jump in-window.
    generic_hi = 1.5
    generic_lo = 1.0 / generic_hi

    worst_ratio: Optional[float] = None
    worst_date: Optional[str] = None
    worst_dev = 0.0
    for i in range(lo, hi):
        prev = float(closes[i - 1])
        cur = float(closes[i])
        if prev <= 0 or cur <= 0:
            continue
        step = cur / prev
        if target is not None:
            is_match = abs(step / target - 1.0) <= _SPLIT_RATIO_TOL
        else:
            is_match = step >= generic_hi or step <= generic_lo
        if not is_match:
            continue
        # Persistence guard: a real unadjusted split is a *sustained* scale shift —
        # every bar after the split sits on the new scale. A one-day dip that bounces
        # back (FDX 2026-06-10) matches the per-bar ratio by coincidence but does NOT
        # persist. Compare the median close just-before vs just-after the step: only a
        # sustained shift matching the split factor counts. Too few bars at the series
        # edge → fall back to the single-step match (don't miss a split near the end).
        expected = target if target is not None else step
        before = [
            float(closes[j])
            for j in range(max(0, i - _SPLIT_PERSIST_BARS), i)
            if float(closes[j]) > 0
        ]
        after = [
            float(closes[j])
            for j in range(i, min(len(closes), i + _SPLIT_PERSIST_BARS))
            if float(closes[j]) > 0
        ]
        mb = _window_median(before)
        ma = _window_median(after)
        if mb is not None and ma is not None and mb > 0:
            sustained = ma / mb
            if abs(sustained / expected - 1.0) > _SPLIT_RATIO_TOL:
                continue  # transient blip, not a persistent split cliff
        if abs(step - 1.0) > worst_dev:
            worst_dev = abs(step - 1.0)
            worst_ratio = round(step, 4)
            worst_date = pd.Timestamp(idx[i]).strftime("%Y-%m-%d")

    if worst_ratio is not None:
        return False, worst_date, worst_ratio
    return True, None, None


def _classify_split(detected_at: datetime, now: datetime, resolved: bool) -> str:
    """Next split status: resolved → 'resolved'; unresolved & under the retry window →
    'pending' (keep retrying); unresolved & ≥ _SPLIT_RETRY_DAYS old → 'failed' (flag)."""
    if resolved:
        return "resolved"
    if (now - detected_at).days >= _SPLIT_RETRY_DAYS:
        return "failed"
    return "pending"


def _load_pending_splits(supabase: Client) -> dict[str, list[dict[str, Any]]]:
    """All still-'pending' split_events, keyed by ticker — loaded once up front so the
    nightly run can re-pull + re-verify carried-over splits even after they age out of
    the 1-month incremental detection window."""
    res = (
        supabase.table("split_events")
        .select("id,ticker,split_date,ratio,detected_at,repull_count")
        .eq("status", "pending")
        .execute()
    )
    rows = cast(list[dict[str, Any]], res.data or [])
    out: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        out.setdefault(str(r["ticker"]), []).append(r)
    return out


def _ticker_pending_splits(supabase: Client, ticker: str) -> list[dict[str, Any]]:
    """Re-read one ticker's pending split_events (after recording a fresh detection) so
    just-detected rows get verified in the same run as carried-over ones."""
    res = (
        supabase.table("split_events")
        .select("id,ticker,split_date,ratio,detected_at,repull_count")
        .eq("ticker", ticker)
        .eq("status", "pending")
        .execute()
    )
    return cast(list[dict[str, Any]], res.data or [])


def _record_split_detection(
    supabase: Client, ticker: str, split_date: str, ratio: Optional[float]
) -> None:
    """Insert a 'pending' split_events row on first sighting. ``ignore_duplicates`` so a
    re-detected split that's already resolved/failed is never reopened."""
    supabase.table("split_events").upsert(
        {"ticker": ticker, "split_date": split_date, "ratio": ratio},
        on_conflict="ticker,split_date",
        ignore_duplicates=True,
    ).execute()


def _update_split_state(
    supabase: Client,
    split_id: str,
    *,
    status: str,
    now_iso: str,
    repull_count: int,
    cliff_date: Optional[str],
    cliff_ratio: Optional[float],
    resolved: bool,
) -> None:
    patch: dict[str, Any] = {
        "status": status,
        "last_repull_at": now_iso,
        "repull_count": repull_count,
        "cliff_date": cliff_date,
        "cliff_ratio": cliff_ratio,
        "updated_at": now_iso,
    }
    if resolved:
        patch["resolved_at"] = now_iso
    supabase.table("split_events").update(patch).eq("id", split_id).execute()


def _should_fetch_enriched(
    state: Optional[dict[str, Any]], today_str: str, mode: str
) -> bool:
    if mode == "full":
        return True
    if state is None:
        return True
    enrich_ts: Optional[str] = state.get("enriched_updated_at")
    enrich_date = enrich_ts[:10] if enrich_ts else None
    if enrich_date is None:
        return True
    next_ed: Optional[str] = state.get("next_earnings_date")
    if next_ed is None:
        try:
            days_since = (
                datetime.fromisoformat(today_str) - datetime.fromisoformat(enrich_date)
            ).days
            return days_since >= 7
        except Exception:
            return True
    return next_ed <= today_str and enrich_date < next_ed


def _send_failure_email(subject: str, body: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY", "")
    owner = os.environ.get("OWNER_EMAIL", "")
    if not api_key or not owner:
        logger.warning("Failure email skipped — RESEND_API_KEY or OWNER_EMAIL not set")
        return
    try:
        requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": "MajorCycle Cron <noreply@majorcycle.com>",
                "to": [owner],
                "subject": subject,
                "text": body,
            },
            timeout=10,
        )
    except Exception as e:
        logger.error("Failed to send failure email: %s", e)


def run(
    mode: str = "smart",
    only: Optional[list[str]] = None,
    notify_on_failure: bool = True,
) -> None:
    started_at = datetime.now(timezone.utc)
    logger.info("Daily refresh started at %s (mode=%s)", started_at.isoformat(), mode)

    supabase = _get_supabase()
    universe = _load_universe(supabase)

    # One-off runs: restrict to an explicit ticker list. Any requested ticker not
    # present in the universe is injected as an ad-hoc row (market inferred
    # from its suffix) so single-ticker / index seeding works without CSV edits.
    if only:
        wanted = [t.strip() for t in only if t.strip()]
        by_ticker = {row["ticker"]: row for row in universe}
        selected: list[dict[str, str]] = []
        for t in wanted:
            selected.append(by_ticker.get(t, {"ticker": t, "name": "", "sector": ""}))
        universe = selected
        logger.info("--only restricted run: %d ticker(s): %s", len(universe), ", ".join(wanted))
    failed: list[str] = []
    succeeded = 0
    enriched_count = 0

    result = supabase.table("stocks").select(
        "ticker,enriched_updated_at,next_earnings_date"
    ).execute()
    raw_states = cast(list[dict[str, Any]], result.data or [])
    ticker_states: dict[str, dict[str, Any]] = {
        str(row["ticker"]): row for row in raw_states
    }
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logger.info(
        "%d tickers already in DB — checking staleness for enriched data",
        len(ticker_states),
    )

    # Carried-over splits still being verified (C-R9). Loaded once so a 'pending' split is
    # re-pulled + re-checked nightly even after it ages out of the 1-month detection window.
    pending_splits = _load_pending_splits(supabase)
    if pending_splits:
        logger.info(
            "%d ticker(s) with pending split verification: %s",
            len(pending_splits),
            ", ".join(sorted(pending_splits)),
        )

    batches = [universe[i: i + _BATCH_SIZE] for i in range(0, len(universe), _BATCH_SIZE)]

    for batch_idx, batch in enumerate(batches):
        for item in batch:
            ticker = item["ticker"]
            try:
                state = ticker_states.get(ticker)
                fetch_enriched = _should_fetch_enriched(state, today_str, mode)
                first_fetch = state is None

                df = DATA_PROVIDER.fetch_price_history(
                    ticker, period="max" if first_fetch else _INCREMENTAL_PRICE_PERIOD
                )
                if df is None or df.empty:
                    logger.debug("%s: no price data", ticker)
                    failed.append(ticker)
                    continue

                # Smart split handling (C-R9). yfinance's split calendar is authoritative
                # (a normal price move never appears in it). On detecting a split inside the
                # incremental window we record a 'pending' split_events row; then — for any
                # pending split (just-detected OR carried over) — we re-pull the FULL
                # re-adjusted history once and VERIFY the discontinuity is actually gone.
                # Resolved → stop re-pulling; still broken after 30 days → flagged 'failed'.
                # (Driven by the pending set, not the 1-month window, so a still-broken split
                # keeps being retried and a fixed one is never re-pulled again.)
                pending = list(pending_splits.get(ticker, []))
                if not first_fetch:
                    detected = _recent_split_events(df)
                    if detected:
                        for ev in detected:
                            _record_split_detection(
                                supabase, ticker, ev["date"], ev.get("ratio")
                            )
                        # Re-read so just-detected rows are verified alongside carried-over ones.
                        pending = _ticker_pending_splits(supabase, ticker)

                if pending:
                    logger.warning(
                        "%s: %d pending split(s) — re-pulling full re-adjusted history to verify",
                        ticker,
                        len(pending),
                    )
                    full = DATA_PROVIDER.fetch_price_history(ticker, period="max")
                    if full is not None and not full.empty:
                        df = full
                        now_dt = datetime.now(timezone.utc)
                        verify_iso = now_dt.isoformat()
                        for sp in pending:
                            resolved, cliff_date, cliff_ratio = _verify_split_resolved(
                                full, str(sp["split_date"]), sp.get("ratio")
                            )
                            status = _classify_split(
                                _parse_dt(sp.get("detected_at")) or now_dt, now_dt, resolved
                            )
                            _update_split_state(
                                supabase,
                                str(sp["id"]),
                                status=status,
                                now_iso=verify_iso,
                                repull_count=int(sp.get("repull_count") or 0) + 1,
                                cliff_date=cliff_date,
                                cliff_ratio=cliff_ratio,
                                resolved=resolved,
                            )
                            logger.info(
                                "%s: split %s (ratio=%s) → %s%s",
                                ticker,
                                sp["split_date"],
                                sp.get("ratio"),
                                status,
                                "" if resolved else f" — cliff {cliff_date} x{cliff_ratio}",
                            )
                    else:
                        logger.warning(
                            "%s: full re-pull returned no data — pending splits left for next run",
                            ticker,
                        )

                now = datetime.now(timezone.utc).isoformat()
                market = _infer_market(ticker)

                # Benchmark indices: price-only. They have no meaningful
                # fundamentals/enriched data — write a minimal stocks row (so the
                # staleness/period logic works) plus their price bars, then move on.
                if market == "index":
                    supabase.table("stocks").upsert(
                        {
                            "ticker":       ticker,
                            "market":       "index",
                            "name":         item.get("name") or ticker,
                            "currency":     _INDEX_CURRENCY.get(ticker, "USD"),
                            "fundamentals": {},
                            "updated_at":   now,
                        },
                        on_conflict="ticker",
                    ).execute()
                    _upsert_price_bars(supabase, ticker, df)
                    succeeded += 1
                    logger.info("%s | index price-only | bars=%d", ticker, len(df))
                    continue

                fund = DATA_PROVIDER.fetch_fundamentals(ticker)

                fund_dict: dict[str, Any] = dataclasses.asdict(fund) if fund else {}

                stock_row: dict[str, Any] = {
                    "ticker":       ticker,
                    "market":       market,
                    "name":         fund.name if fund else None,
                    "sector":       fund.sector if fund else None,
                    "industry":     fund.industry if fund else None,
                    "currency":     fund.currency if fund else "USD",
                    "exchange":     fund.exchange if fund else None,
                    "market_cap":   fund.market_cap if fund else None,
                    "fundamentals": _jsonb(fund_dict),
                    "updated_at":   now,
                }

                # News is time-sensitive, so refresh it on every run rather than
                # only on the (≈quarterly) enriched-data cadence. It's one cheap
                # call and failures are non-fatal. Only overwrite when we actually
                # got items, so a transient yfinance hiccup never wipes the
                # previously-stored news for a ticker.
                news = DATA_PROVIDER.fetch_news(ticker)
                if news:
                    news_list: list[dict[str, Any]] = [dataclasses.asdict(n) for n in news]
                    stock_row["news"] = _jsonb(news_list)

                if fetch_enriched:
                    enriched = DATA_PROVIDER.fetch_enriched_data(ticker)

                    enriched_dict: dict[str, Any] = dataclasses.asdict(enriched) if enriched else {}

                    stock_row["company_overview"] = (
                        enriched.company_overview if enriched else None
                    )
                    stock_row["income_statement_annual"] = _jsonb(
                        enriched_dict.get("income_statement_annual", {})
                    )
                    stock_row["income_statement_quarterly"] = _jsonb(
                        enriched_dict.get("income_statement_quarterly", {})
                    )
                    stock_row["balance_sheet_annual"] = _jsonb(
                        enriched_dict.get("balance_sheet_annual", {})
                    )
                    stock_row["balance_sheet_quarterly"] = _jsonb(
                        enriched_dict.get("balance_sheet_quarterly", {})
                    )
                    stock_row["cashflow_annual"] = _jsonb(
                        enriched_dict.get("cashflow_annual", {})
                    )
                    stock_row["cashflow_quarterly"] = _jsonb(
                        enriched_dict.get("cashflow_quarterly", {})
                    )
                    stock_row["earnings_history"] = _jsonb(
                        enriched_dict.get("earnings_history", [])
                    )
                    stock_row["top_holders"] = _jsonb(
                        enriched_dict.get("top_holders", [])
                    )
                    stock_row["insider_transactions"] = _jsonb(
                        enriched_dict.get("insider_transactions", [])
                    )
                    stock_row["analyst_upgrades_downgrades"] = _jsonb(
                        enriched_dict.get("analyst_upgrades_downgrades", [])
                    )
                    stock_row["pe_history"] = _jsonb(
                        enriched_dict.get("pe_history", [])
                    )
                    stock_row["enriched_updated_at"] = now
                    # Defensive: only send a real ISO date to the DATE column.
                    # Anything else (None, '', '[]', other garbage) is dropped
                    # — the column will keep its previous value.
                    next_ed = enriched_dict.get("next_earnings_date") if enriched else None
                    if isinstance(next_ed, str) and _ISO_DATE_RE.match(next_ed):
                        stock_row["next_earnings_date"] = next_ed

                    enriched_count += 1
                    logger.info(
                        "%s | enriched | market=%s | sector=%s | bars=%d",
                        ticker,
                        market,
                        fund.sector if fund else "?",
                        len(df),
                    )
                else:
                    logger.info("%s | price+fund | bars=%d", ticker, len(df))

                supabase.table("stocks").upsert(stock_row, on_conflict="ticker").execute()
                _upsert_price_bars(supabase, ticker, df)
                succeeded += 1

            except Exception as e:
                logger.error("%s: unexpected error: %s", ticker, e, exc_info=True)
                failed.append(ticker)

        if batch_idx < len(batches) - 1:
            time.sleep(_SLEEP_BETWEEN_BATCHES)

    finished_at = datetime.now(timezone.utc)
    elapsed = (finished_at - started_at).total_seconds()

    logger.info(
        "Refresh complete — %d succeeded (%d enriched), %d failed, %.0fs elapsed",
        succeeded,
        enriched_count,
        len(failed),
        elapsed,
    )

    if failed:
        logger.warning("Failed tickers (%d): %s", len(failed), ", ".join(failed))
        if notify_on_failure:
            _send_failure_email(
                subject=f"MajorCycle cron: {len(failed)} tickers failed",
                body=(
                    f"Daily refresh finished at {finished_at.isoformat()}\n"
                    f"Succeeded: {succeeded} ({enriched_count} enriched)\n"
                    f"Failed: {len(failed)}\n\n"
                    "Failed tickers:\n" + "\n".join(failed)
                ),
            )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="MajorCycle data refresh pipeline")
    parser.add_argument("--mode", choices=["smart", "full"], default="smart")
    parser.add_argument(
        "--only",
        default=None,
        help="Comma-separated ticker(s) to refresh in isolation, e.g. --only AAPL or --only ^GSPC,^AXJO",
    )
    args = parser.parse_args()
    only_list = args.only.split(",") if args.only else None
    run(mode=args.mode, only=only_list)
