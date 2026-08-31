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

# How long to wait before retrying the tickers that failed the first pass.
# Long enough to outlast the thing the provider's own three retries cannot: they
# span roughly seven seconds of exponential backoff, which a rate-limit window or
# a brief provider outage sails straight through.
_RETRY_PASS_DELAY = 300.0

# Skip the retry pass when this share of the work failed. ⚠️ This is a TIME-BUDGET
# guard, not a data one, and it exists because the retry could otherwise turn a
# green job red for a reason that has nothing to do with the data. If half the
# universe failed, the cause is systemic — the provider is down, the network is
# gone, credentials expired — and re-fetching hundreds of tickers cannot fit in the
# workflow's remaining minutes; the job would hit `timeout-minutes` and die
# mid-write instead of finishing and reporting. A retry is for the handful of
# transient misses it was designed for (the 2026-08-28 run: 3 failures in 620).
# The staleness sweep at the end of the workflow is what raises the alarm on a
# systemic failure, and it does so without needing this pass to have run.
_RETRY_MAX_SHARE = 0.25

# ...but never below this many tickers, whatever the share works out to.
# ⚠️ Added after an end-to-end run showed the share test alone gets SMALL runs
# exactly wrong: `--only AAPL,ZZQQ9` is one failure in two, i.e. 50%, so the guard
# refused to retry a single ticker — the cheapest possible retry, and the one most
# likely to be a hand-run somebody is waiting on. The guard is a TIME budget, and
# time depends on the absolute number of tickers to re-fetch, not on what fraction
# of the run they were. Twenty-five re-fetches plus the five-minute wait is a few
# minutes; that is always affordable, at any universe size.
_RETRY_MIN_ALWAYS = 25

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


def _with_market_cap(row: dict[str, Any], fund: Any) -> dict[str, Any]:
    """Write whatever the provider answered — including nothing.

    OWNER DECISION, 2026-08-29. This function briefly did the opposite: it
    OMITTED the column when the provider had no cap, so the stored figure
    survived. That is safe against a one-night hiccup and unsafe against a long
    outage — it would keep serving a months-old market cap as though it were
    today's, and a stale number that looks current is a worse failure than a
    blank one. The owner's rule for this product is that we publish what the
    provider gives us and never a figure of our own construction, so the value
    is written through, null included.

    Two things make that safe, and both must stay:

      · the PROVIDER-side fallback in `yfinance_provider._extract_fundamentals`
        asks `fast_info` when `info` omits `marketCap`. That is the same
        provider answering the same question a second way, not a substitute
        figure — measured across 15 stocks in all three markets, the two
        endpoints agree to a median of 0.000% (worst case 0.85%, a moving
        price between two calls). It covered all 15 companies of the
        2026-08-27 incident, so a genuine null is now rare; and
      · the >0.5% invariant in `check_field_units.py` alarms if caps go missing
        across the universe, which is what makes a null self-correcting: the
        next night's run restores it from the provider, and if it does not, the
        alarm says so.

    THE INCIDENT THIS REPLACED (2026-08-27, audit F-032). yfinance's `info`
    omitted `marketCap` for 15 of 863 companies on one run; the value arrived as
    None and blanked a good stored figure for each. Nothing raised — the key was
    simply absent — and the damage was second-order: a null cap renders as an
    empty cell, drops the company out of any size-ranked cohort without an
    error, and takes `fcf_yield_pct` with it. It surfaced two days later only
    because a study that ranks by size produced a figure that would not
    reproduce. The lesson kept is the ALARM and the FALLBACK; the preservation
    is not, because it trades a visible gap for an invisible lie.
    """
    row["market_cap"] = getattr(fund, "market_cap", None) if fund is not None else None
    return row


def _jsonb(obj: Any) -> Any:
    return json.loads(json.dumps(obj, default=str))


def _get_supabase() -> Client:
    # SUPABASE_URL is what the workflow sets; `NEXT_PUBLIC_SUPABASE_URL` is the web
    # app's name for the same value. Six of the eight cron scripts accept either, so
    # a hand-run off .env.local works; this one and check_field_units.py did not, and
    # raised a bare KeyError naming a variable the operator had never heard of.
    url = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


#: PostgREST returns at most this many rows per response — verified against the
#: live database, not assumed. An unpaginated read of a bigger table comes back
#: short with NO error, so the caller believes it has the whole table.
_PAGE = 1000


def _select_all(supabase: Client, table: str, columns: str) -> list[dict[str, Any]]:
    """Read every row of a table, page by page.

    `stocks` grows on its own — the universe auto-expands whenever a reader
    requests a ticker — so any read of it that is not paginated has an expiry
    date. This function is that rule in one place: `_load_universe` had its own
    correct pagination loop while the enrichment-state read forty lines below it
    did not, and nothing would have gone red on the night the universe passed
    1000 stocks. The refresh would simply have stopped enriching the overflow.
    """
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        res = supabase.table(table).select(columns).range(start, start + _PAGE - 1).execute()
        batch = cast(list[dict[str, Any]], res.data or [])
        rows.extend(batch)
        if len(batch) < _PAGE:  # a short page is the only proof of the end
            return rows
        start += _PAGE


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
    skipped_inactive = 0
    for r in _select_all(supabase, "stocks", "ticker,is_active"):
        if not r.get("ticker"):
            continue
        # A company three independent sources agree has stopped trading is not
        # refreshed — there is nothing to fetch, and asking every night turns one
        # dead ticker into a permanent "failed" entry that hides the real ones.
        # Its price history is untouched and its page still works; only the
        # fetching stops. See check_stale_tickers.py for how the flag is set, and
        # why it takes three sources rather than one.
        #
        # ⚠️ `.get("is_active", True)` defaults to KEEPING: if the column is ever
        # absent from a response, the universe must not silently empty itself.
        if not r.get("is_active", True):
            skipped_inactive += 1
            continue
        tickers.add(str(r["ticker"]))
    if skipped_inactive:
        logger.info(
            "Skipping %d ticker(s) marked inactive — their history is kept, not refreshed",
            skipped_inactive,
        )
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


# Which country's trading calendar each benchmark index follows. Separate from
# `_infer_market`, which returns 'index' for these — correct for the `stocks.market`
# column, useless for SCHEDULING. ^AXJO has to be refreshed on the ASX's clock, not
# New York's, or the Relative Performance chart compares an ASX-close series against
# a mid-session one.
_INDEX_HOME_MARKET: dict[str, str] = {
    "^GSPC": "us",
    "^IXIC": "us",
    "^AXJO": "au",
    "^GSPTSE": "ca",
}


def _schedule_market(ticker: str) -> str:
    """The market whose trading hours govern when this ticker should be fetched.

    Equals `_infer_market` for equities; maps indices onto their home country.
    An unknown `^INDEX` falls back to 'us' so it is still refreshed by *some*
    run rather than silently dropped by every market filter.
    """
    if ticker.startswith("^"):
        return _INDEX_HOME_MARKET.get(ticker, "us")
    return _infer_market(ticker)


def _infer_market(ticker: str) -> str:
    # `.V` (TSX Venture) is Canadian, not US. See the note in
    # providers/yfinance_provider._infer_market and web/lib/ticker.ts.
    if ticker.startswith("^"):
        return "index"
    if ticker.endswith(".AX"):
        return "au"
    if ticker.endswith(".TO") or ticker.endswith(".V"):
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


def _recent_dividends(df: pd.DataFrame) -> list[str]:
    """ISO dates of any dividend inside the freshly-fetched window.

    ⚠️ **A dividend re-adjusts every EARLIER bar, and for a whole year nothing
    here knew that.** Our bars are `auto_adjust=True`, so each time a company goes
    ex-dividend the provider divides the entire prior series by a new factor. The
    nightly refresh fetches one month, so it stored the new month on the NEW basis
    and left everything before it — the peak included — on the OLD one.

    Measured 2026-08-29 against a fresh pull of every company named in the
    articles: the ratio is a CONSTANT 1.017-1.035 on every bar before that
    company's last ex-dividend date and exactly 1.0000 after it. The effect is a
    drawdown up to 2 points deeper than the truth (CBA, GPT, Lendlease and
    Centuria all measured wrong), and it is invisible in every direction — no
    error, no gap, no odd-looking chart, just a plausible number that disagrees
    with every other source in the world.

    Same remedy as a split: re-pull the FULL history so every stored bar is
    adjusted on one basis. The DIFFERENCE from a split is that there is nothing to
    verify afterwards — a split can leave a real cliff when the provider's own
    history is inconsistent (MNST, audit F-030), which is why splits carry a
    pending/resolve cycle; a dividend adjustment is a smooth rescale that either
    happened or did not. So this triggers a re-pull and records nothing.

    Tolerant of the attr being absent, exactly as ``_recent_splits`` is — the
    stooq fallback path does not set it.
    """
    val = getattr(df, "attrs", {}).get("recent_dividends")
    return list(val) if val else []


def _recent_dividend_events(df: pd.DataFrame) -> list[dict[str, Any]]:
    """``[{date, amount}, ...]`` for dividends in the freshly-fetched window.

    Parallels ``_recent_split_events``. ``_recent_dividends`` above is the re-pull
    TRIGGER and reads dates only; this is the RECORD written to `dividend_events`.

    ⚠️ They are kept apart on purpose. The trigger is load-bearing — a dividend
    that fails to trigger a re-pull leaves a company's history on two adjustment
    bases and every drawdown on its page reads too deep, silently (CLAUDE.md
    11ae). The record is visibility. Folding them into one structure would let a
    change made for the record's sake break the trigger, and the trigger's failure
    is the one nothing can see.

    Tolerant of the attr being absent, exactly as its siblings are — the stooq
    fallback path sets none of them.
    """
    val = getattr(df, "attrs", {}).get("recent_dividend_events")
    return list(val) if val else []


def _should_record_corporate_actions(first_fetch: bool, repull_prices: bool) -> bool:
    """May this fetch's corporate actions be RECORDED, or is it a bulk backfill?

    A named rule rather than an inline condition, because losing it is silent and
    expensive, and because both `split_events` and `dividend_events` depend on it
    (CLAUDE.md 11c — one rule, one place).

    ⚠️ **What it prevents.** `_recent_split_events` and `_recent_dividend_events`
    report everything in the FETCHED WINDOW. On the nightly one-month window that
    is "what happened last night", which is what those tables are for. On a
    ``period="max"`` fetch it is every corporate action the company has ever had.

    Measured 2026-08-30: the `--repull-prices` catch-up that cleared a year of
    dividend drift took `split_events` from **8 rows to 1,762 in one evening**, and
    120 of them stuck in 'pending' — historical bonus issues whose small ratios
    (0.79 to 1.29) fall inside `_verify_split_resolved`'s cliff tolerance, where it
    overlaps ordinary daily volatility. Each would have re-pulled a whole company
    history every night for 30 days and then read as 'failed'. The owner had all
    1,754 deleted. The dividend side would have written ~150,000 rows.

    ⚠️ **Nothing is lost by skipping.** A `max` pull is already fully re-adjusted,
    so there is no discontinuity to record or verify; and a split or dividend
    inside the recent window is picked up by the next ordinary nightly run. A
    carried-over 'pending' split is still verified during a re-pull, because
    `pending` is loaded from the table rather than from the fetched window.

    `first_fetch` is excluded for a different reason: the `stocks` row does not
    exist yet at that point in the loop, and both tables carry a foreign key to it.
    """
    return not first_fetch and not repull_prices


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


def _record_dividend_detection(
    supabase: Client, ticker: str, ex_date: str, amount: Optional[float]
) -> None:
    """Record one dividend in `dividend_events`. Insert-once, like a split.

    ⚠️ **This table is a RECORD, not a state machine**, and that is the whole
    reason it is not `split_events` with a `kind` column (owner's request,
    2026-08-30; see the migration for the full reasoning). A split gets re-pulled
    AND VERIFIED, because the provider's own history can be internally
    inconsistent and leave a real price cliff (MNST, audit F-030) — hence
    status/cliff_date/cliff_ratio/repull_count. A dividend adjustment is a smooth
    rescale of the whole prior series: it either happened or it did not, and it
    leaves no signature to check afterwards. Every one of those columns would be
    permanently NULL on a dividend row.

    ``ignore_duplicates`` so re-seeing the same ex-date — which happens on every
    full re-pull — never rewrites the original detection time.
    """
    supabase.table("dividend_events").upsert(
        {"ticker": ticker, "ex_date": ex_date, "amount": amount},
        on_conflict="ticker,ex_date",
        ignore_duplicates=True,
    ).execute()


def _mark_dividend_repulled(supabase: Client, ticker: str, ex_dates: list[str]) -> None:
    """Stamp `repulled_at` on the dividends that triggered a full re-pull.

    Separate from recording, because the two answer different questions and the
    gap between them is where the year-long defect lived: a row with `repulled_at`
    NULL means "we saw this dividend and the history was NOT re-adjusted for it",
    which is precisely the state that was invisible before. Now it is a query.
    """
    if not ex_dates:
        return
    supabase.table("dividend_events").update(
        {"repulled_at": datetime.now(timezone.utc).isoformat()}
    ).eq("ticker", ticker).in_("ex_date", ex_dates).execute()


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


def _retry_targets(failed: list[str], universe_size: int) -> list[str]:
    """Which failed tickers the second pass should re-fetch — empty means skip it.

    A separate function because it is the only *decision* in the two-pass retry and
    the rest of the loop cannot be tested without mocking a provider, a database
    and a clock. Kept honest by `analytics/tests/test_retry_pass.py`.

    Empty for two different reasons, and the caller logs them differently:

      · nothing failed — the ordinary night, no retry needed;
      · too much failed — see `_RETRY_MAX_SHARE`. ⚠️ This is a TIME-BUDGET guard,
        not a data one. If half the universe failed the cause is systemic (the
        provider is down, the network is gone, credentials expired) and re-fetching
        hundreds of tickers cannot fit in the workflow's remaining minutes; the job
        would hit `timeout-minutes` and die MID-WRITE rather than finishing and
        reporting. The staleness sweep at the end of the workflow raises the alarm
        on a systemic failure without needing this pass to have run.

    ⚠️ **`_RETRY_MIN_ALWAYS` is why the share is not the whole rule**, and it was
    added because an end-to-end run caught the share getting small runs backwards:
    `--only AAPL,ZZQQ9` is one failure in two — 50% — so the guard refused to retry
    a *single* ticker. A time budget depends on how many tickers must be re-fetched,
    not on what fraction of the run they were.
    """
    if not failed:
        return []
    if len(failed) <= _RETRY_MIN_ALWAYS:
        return list(failed)
    if len(failed) > _RETRY_MAX_SHARE * max(1, universe_size):
        return []
    return list(failed)


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



def run(
    mode: str = "smart",
    only: Optional[list[str]] = None,
    markets: Optional[list[str]] = None,
    repull_prices: bool = False,
) -> None:
    """Refresh prices, fundamentals and enriched data for the universe.

    ``repull_prices`` forces ``period="max"`` for EVERY ticker instead of the
    one-month incremental window. It exists for one job: re-adjusting history that
    was stored across a dividend the pipeline did not know to re-pull for (see
    ``_recent_dividends``). It is deliberately a flag on the real pipeline rather
    than a throwaway script — the write path, the chunking, the batch pacing and
    the failure handling are the ones already proven nightly, and a one-off script
    would be a second implementation of all four (CLAUDE.md 11c).

    ⚠️ It is SLOW and heavy: full history for the whole universe is millions of
    rows. Run it market by market.
    """
    started_at = datetime.now(timezone.utc)
    logger.info(
        "Daily refresh started at %s (mode=%s%s)",
        started_at.isoformat(),
        mode,
        ", FULL price re-pull" if repull_prices else "",
    )

    # Validate the argument BEFORE opening a connection — a typo in a cron file
    # should fail in a second with a clear message, not after loading the universe.
    wanted_markets: set[str] = set()
    if markets:
        wanted_markets = {m.strip().lower() for m in markets if m.strip()}
        unknown = wanted_markets - {"us", "au", "ca"}
        if unknown:
            raise ValueError(
                f"Unknown market(s): {', '.join(sorted(unknown))}. Valid: us, au, ca."
            )

    supabase = _get_supabase()
    universe = _load_universe(supabase)

    # Market-scoped runs exist because no single UTC time is after every market's
    # close: the ASX starts accepting next-day orders at 20:00-21:00 UTC, which is
    # before or exactly when New York closes. So each market is refreshed on its own
    # schedule and only its own tickers are touched. Applied BEFORE `only` so an
    # explicit ticker list always wins.
    if wanted_markets:
        before = len(universe)
        universe = [r for r in universe if _schedule_market(r["ticker"]) in wanted_markets]
        logger.info(
            "--markets %s: %d of %d tickers selected",
            ",".join(sorted(wanted_markets)), len(universe), before,
        )
        if not universe:
            raise ValueError(
                f"No tickers matched --markets {','.join(sorted(wanted_markets))} — "
                "refusing to report a vacuous success."
            )

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

    raw_states = _select_all(
        supabase, "stocks", "ticker,enriched_updated_at,next_earnings_date"
    )
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

    # ── Two passes: everything, then whatever failed ──────────────────────
    #
    # Roadmap "Stale prices + dead tickers", part 1 — confirmed by the owner
    # 2026-08-30. The provider already retries three times (`_download_with_retry`),
    # but those three attempts sit inside about seven seconds. A rate-limit, a brief
    # Yahoo outage or one dropped connection outlasts all three, and the ticker is
    # then written off for the night with a one-line warning.
    #
    # ⚠️ The cost is not just a missing day. A ticker skipped tonight is fetched
    # tomorrow on a ONE-MONTH window, so if it went ex-dividend in between, the
    # re-pull trigger has already scrolled out of view and its history is left on
    # two adjustment bases — silently, and permanently until something re-pulls it
    # (CLAUDE.md 11ae). A transient miss is therefore a lasting data defect, not a
    # gap that fills itself in.
    #
    # ⚠️ Evidence it happens: `ASK.AX` failed once during the 2026-08-30 catch-up
    # re-pull and is otherwise perfectly current. Nothing about that night was
    # unusual, and to anything looking at a single run it is indistinguishable from
    # a delisting.
    #
    # The gap between the passes is what makes this different from the provider's
    # own retries — it has to outlast the kind of outage those three attempts sit
    # inside. Nothing else changes: the second pass runs the identical body, so
    # there is no second implementation of the write path to drift (CLAUDE.md 11c).
    work: list[dict[str, str]] = list(universe)
    by_ticker_item: dict[str, dict[str, str]] = {r["ticker"]: r for r in universe}

    for pass_no in (1, 2):
        if pass_no == 2:
            if not failed:
                logger.info("No failures in pass 1 — no retry pass needed.")
                break
            # One call, one decision (`_retry_targets` — tested in
            # analytics/tests/test_retry_pass.py). An empty answer here can only
            # mean the budget guard fired, because the "nothing failed" case was
            # already handled above.
            retry_targets = _retry_targets(failed, len(universe))
            if not retry_targets:
                logger.error(
                    "Pass 1 failed %d of %d tickers (%.0f%%) — SKIPPING the retry pass. "
                    "That is systemic, not transient, and re-fetching them all would "
                    "run the workflow past its timeout and kill it mid-write. The "
                    "staleness sweep at the end of this workflow will raise the alarm.",
                    len(failed), len(universe),
                    100.0 * len(failed) / max(1, len(universe)),
                )
                break
            logger.warning(
                "Pass 1 left %d failure(s): %s. Waiting %.0fs, then retrying them.",
                len(retry_targets), ", ".join(retry_targets), _RETRY_PASS_DELAY,
            )
            time.sleep(_RETRY_PASS_DELAY)
            work = [
                by_ticker_item.get(t, {"ticker": t, "name": "", "sector": ""})
                for t in retry_targets
            ]
            # Reset so `failed` ends up holding only what failed BOTH passes.
            # Without this a ticker that recovered would still be reported as
            # failed, and the staleness sweep downstream reads this list.
            failed = []

        batches = [work[i: i + _BATCH_SIZE] for i in range(0, len(work), _BATCH_SIZE)]

        for batch_idx, batch in enumerate(batches):
            for item in batch:
                ticker = item["ticker"]
                try:
                    state = ticker_states.get(ticker)
                    fetch_enriched = _should_fetch_enriched(state, today_str, mode)
                    first_fetch = state is None

                    df = DATA_PROVIDER.fetch_price_history(
                        ticker,
                        period="max"
                        if (first_fetch or repull_prices)
                        else _INCREMENTAL_PRICE_PERIOD,
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
                    # ⚠️ `not repull_prices` matters as much as `not first_fetch`, and
                    # it was missing until 2026-08-30. `_recent_split_events` reports
                    # every split in the FETCHED WINDOW, so on a `period="max"` run
                    # that is every split the company has ever had — back to 1962.
                    #
                    # The cost, measured: the catch-up that cleared the dividend drift
                    # took this table from **8 rows to 1,762 in one evening**, and 120
                    # of those stuck in 'pending' because `_verify_split_resolved`'s
                    # ±20% cliff tolerance overlaps ordinary daily volatility for the
                    # small ratios (0.79 to 1.29) that historical bonus issues produce.
                    # Each would have re-pulled a company's entire history nightly for
                    # 30 days and then read as 'failed'. The owner had them deleted.
                    #
                    # Skipping detection here loses nothing: a `max` pull is ALREADY
                    # fully re-adjusted, so there is no discontinuity to record or
                    # verify, and a split inside the recent window is picked up by the
                    # next ordinary nightly run. Same rule as `dividend_events` — only
                    # nightly detections are recorded, never a bulk backfill.
                    if _should_record_corporate_actions(first_fetch, repull_prices):
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

                    # A dividend inside the window re-adjusts every earlier bar, so the
                    # stored history has to be re-pulled on the new basis (see
                    # `_recent_dividends`). Skipped when the split branch above already
                    # re-pulled — one full fetch per ticker per night, never two.
                    if _should_record_corporate_actions(first_fetch, repull_prices) and not pending:
                        divs = _recent_dividends(df)
                        if divs:
                            # Record BEFORE re-pulling, so a re-pull that dies mid-way
                            # still leaves a row with `repulled_at` NULL — the state
                            # that says "seen, not acted on", which is exactly what was
                            # invisible for a year. Recording after would lose the
                            # evidence in the one case it matters.
                            #
                            # Only detections inside the nightly window are recorded.
                            # A `period="max"` pull sees every dividend a company has
                            # ever paid, and writing those would put ~150,000 backfill
                            # rows in a table meant to answer "what happened last
                            # night?" — the same flood that put 1,754 rows into
                            # split_events in one evening.
                            for ev in _recent_dividend_events(df):
                                _record_dividend_detection(
                                    supabase, ticker, ev["date"], ev.get("amount")
                                )
                            logger.info(
                                "%s: dividend on %s — re-pulling full re-adjusted history",
                                ticker,
                                ", ".join(divs),
                            )
                            full = DATA_PROVIDER.fetch_price_history(ticker, period="max")
                            if full is not None and not full.empty:
                                df = full
                                _mark_dividend_repulled(supabase, ticker, divs)
                            else:
                                # Leave the incremental frame in place and say so. The next
                                # run re-detects the same dividend only if it is still inside
                                # the 1-month window, so a persistent provider outage here is
                                # a silent miss — which is what the staleness sweep is for.
                                logger.warning(
                                    "%s: dividend re-pull returned no data — history still on the old basis",
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
                        "fundamentals": _jsonb(fund_dict),
                        "updated_at":   now,
                    }

                    _with_market_cap(stock_row, fund)

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


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="MajorCycle data refresh pipeline")
    parser.add_argument("--mode", choices=["smart", "full"], default="smart")
    parser.add_argument(
        "--repull-prices",
        action="store_true",
        help=(
            "Fetch FULL price history for every ticker instead of the 1-month window. "
            "For re-adjusting history stored across a dividend. Slow — run per market."
        ),
    )
    parser.add_argument(
        "--only",
        default=None,
        help="Comma-separated ticker(s) to refresh in isolation, e.g. --only AAPL or --only ^GSPC,^AXJO",
    )
    parser.add_argument(
        "--markets",
        default=None,
        help=(
            "Comma-separated market(s) to refresh, e.g. --markets au or --markets us,ca. "
            "Benchmark indices follow their home country (^AXJO with au). Omit for all."
        ),
    )
    args = parser.parse_args()
    only_list = args.only.split(",") if args.only else None
    markets_list = args.markets.split(",") if args.markets else None
    run(mode=args.mode, only=only_list, markets=markets_list, repull_prices=args.repull_prices)
