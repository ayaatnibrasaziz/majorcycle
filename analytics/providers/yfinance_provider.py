import logging
import random
import time
from datetime import timedelta
from io import StringIO
from typing import Any, Optional

import numpy as np
import pandas as pd
import requests
import requests_cache
import yfinance as yf  # type: ignore[import-untyped]

from analytics.providers.base import (
    Currency,
    DataProvider,
    FundamentalsSnapshot,
    Market,
    NewsItem,
)

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_BACKOFF_BASE = 2
_MIN_BARS = 280  # lookback(252) + pivot_bars(5)*2 + buffer
_DOWNLOAD_PERIOD = "max"


def _safe(v: Any) -> Optional[float]:
    try:
        f = float(v)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, 4)
    except Exception:
        return None


def _pct(v: Any) -> Optional[float]:
    r = _safe(v)
    return round(r * 100, 4) if r is not None else None


def _safe_int(v: Any) -> Optional[int]:
    f = _safe(v)
    return round(f) if f is not None else None


def _infer_market(ticker: str) -> Market:
    if ticker.endswith(".AX"):
        return "au"
    if ticker.endswith(".TO"):
        return "ca"
    return "us"


def _infer_currency(info: dict[str, Any]) -> Currency:
    c = str(info.get("currency", ""))
    if c == "AUD":
        return "AUD"
    if c == "CAD":
        return "CAD"
    return "USD"


class YFinanceProvider(DataProvider):

    def __init__(self, cache_hours: int = 6) -> None:
        requests_cache.install_cache(
            "yf_cache",
            expire_after=timedelta(hours=cache_hours),
            allowable_methods=["GET"],
        )

    @property
    def name(self) -> str:
        return "yfinance"

    def is_healthy(self) -> bool:
        try:
            t = yf.Ticker("AAPL")
            df: Any = t.history(period="5d", auto_adjust=True)
            return df is not None and not df.empty
        except Exception:
            return False

    def fetch_price_history(self, ticker: str, period: str = "max") -> Optional[pd.DataFrame]:
        df, _ = self._download_with_retry(ticker)
        return df

    def fetch_fundamentals(self, ticker: str) -> Optional[FundamentalsSnapshot]:
        df, t = self._download_with_retry(ticker)
        if df is None or t is None:
            return None
        return self._extract_fundamentals(ticker, t)

    def fetch_news(self, ticker: str, limit: int = 10) -> list[NewsItem]:
        try:
            t = yf.Ticker(ticker)
            raw: list[dict[str, Any]] = t.news or []
            items: list[NewsItem] = []
            for item in raw[:limit]:
                title: str = str(item.get("title", ""))
                url: str = str(item.get("link") or item.get("url", ""))
                ts: int = int(item.get("providerPublishTime", 0))
                published_at = pd.Timestamp(ts, unit="s").isoformat() if ts else ""
                source: str = str(item.get("publisher", "Yahoo Finance"))
                if title and url:
                    items.append(
                        NewsItem(title=title, url=url, published_at=published_at, source=source)
                    )
            return items
        except Exception as e:
            logger.debug("fetch_news %s: %s", ticker, e)
            return []

    def _download_yfinance(self, ticker_str: str) -> tuple[Optional[pd.DataFrame], Any]:
        try:
            t = yf.Ticker(ticker_str)
            raw: Any = t.history(period=_DOWNLOAD_PERIOD, interval="1d", auto_adjust=True)
            if raw is None or raw.empty:
                return None, None
            df = pd.DataFrame(raw)
            df.index = pd.to_datetime(df.index)
            if df.index.tz is not None:
                df.index = df.index.tz_convert(None)
            df = df[["Open", "High", "Low", "Close", "Volume"]]
            df = df[df["Close"].notna()].copy()
            df[["Open", "High", "Low", "Volume"]] = (
                df[["Open", "High", "Low", "Volume"]].ffill()
            )
            if len(df) < _MIN_BARS:
                return None, None
            return df, t
        except Exception as e:
            logger.debug("yfinance error for %s: %s", ticker_str, e)
            return None, None

    def _download_stooq(self, ticker_str: str) -> tuple[Optional[pd.DataFrame], None]:
        try:
            url = f"https://stooq.com/q/d/l/?s={ticker_str.lower()}.us&i=d"
            resp = requests.get(url, timeout=15)
            if resp.status_code != 200 or len(resp.text) < 100:
                return None, None
            df = pd.read_csv(StringIO(resp.text))
            df.columns = pd.Index([c.strip().capitalize() for c in df.columns])
            if "Date" not in df.columns:
                return None, None
            df["Date"] = pd.to_datetime(df["Date"])
            df = df.set_index("Date").sort_index()
            for col in ["Open", "High", "Low", "Close", "Volume"]:
                if col not in df.columns:
                    return None, None
            df = df[["Open", "High", "Low", "Close", "Volume"]]
            df = df[df["Close"].notna()].copy()
            df[["Open", "High", "Low", "Volume"]] = (
                df[["Open", "High", "Low", "Volume"]].ffill()
            )
            if len(df) < _MIN_BARS:
                return None, None
            return df, None
        except Exception as e:
            logger.debug("stooq error for %s: %s", ticker_str, e)
            return None, None

    def _download_with_retry(self, ticker_str: str) -> tuple[Optional[pd.DataFrame], Any]:
        for attempt in range(1, _MAX_RETRIES + 1):
            df, t = self._download_yfinance(ticker_str)
            if df is not None:
                return df, t
            sleep_time = _RETRY_BACKOFF_BASE ** attempt + random.uniform(0, 1)
            logger.debug(
                "%s: attempt %d failed — retry in %.1fs", ticker_str, attempt, sleep_time
            )
            time.sleep(sleep_time)

        logger.debug("%s: trying stooq fallback", ticker_str)
        df, _ = self._download_stooq(ticker_str)
        if df is not None:
            logger.info("%s: using stooq data (Yahoo failed)", ticker_str)
            return df, None

        logger.warning("%s: all data sources failed", ticker_str)
        return None, None

    def _extract_fundamentals(self, ticker: str, ticker_obj: Any) -> FundamentalsSnapshot:
        try:
            info: dict[str, Any] = ticker_obj.info or {}
        except Exception:
            info = {}

        def g(key: str) -> Any:
            return info.get(key)

        market = _infer_market(ticker)
        currency = _infer_currency(info)

        market_cap = _safe(g("marketCap"))
        total_revenue = _safe(g("totalRevenue"))
        ebitda = _safe(g("ebitda"))
        free_cashflow = _safe(g("freeCashflow"))

        fcf_yield_pct: Optional[float] = None
        fcf_margin_pct: Optional[float] = None
        if free_cashflow and market_cap and market_cap > 0:
            fcf_yield_pct = round(free_cashflow / market_cap * 100, 4)
        if free_cashflow and total_revenue and total_revenue > 0:
            fcf_margin_pct = round(free_cashflow / total_revenue * 100, 4)

        de_raw = _safe(g("debtToEquity"))
        debt_to_equity = round(de_raw / 100, 4) if de_raw is not None else None

        week52_change = _pct(g("52WeekChange"))
        sp500_52wk_change = _pct(g("SandP52WeekChange"))
        rel_strength_vs_sp500: Optional[float] = None
        if week52_change is not None and sp500_52wk_change is not None:
            rel_strength_vs_sp500 = round(week52_change - sp500_52wk_change, 4)

        interest_coverage: Optional[float] = None
        try:
            fin: Any = ticker_obj.financials
            if fin is not None and not fin.empty:
                ie_rows = [
                    r for r in fin.index
                    if "interest" in str(r).lower() and "expense" in str(r).lower()
                ]
                if ie_rows:
                    ie_val: Any = fin.loc[ie_rows[0]].iloc[0]
                    ie = _safe(abs(float(ie_val)))
                    if ebitda and ie and ie > 0:
                        interest_coverage = round(ebitda / ie, 4)
        except Exception:
            pass

        shares_change_yoy_pct: Optional[float] = None
        try:
            bs: Any = ticker_obj.balance_sheet
            if bs is not None and not bs.empty and bs.shape[1] >= 2:
                so_rows = [
                    r for r in bs.index
                    if "share" in str(r).lower() and "issued" in str(r).lower()
                ]
                if not so_rows:
                    so_rows = [r for r in bs.index if "common stock" in str(r).lower()]
                if so_rows:
                    s_now = float(bs.loc[so_rows[0]].iloc[0])
                    s_prev = float(bs.loc[so_rows[0]].iloc[1])
                    if s_prev and s_prev != 0:
                        shares_change_yoy_pct = round((s_now - s_prev) / abs(s_prev) * 100, 4)
        except Exception:
            pass

        dividend_history: list[dict[str, Any]] = []
        try:
            divs: Any = ticker_obj.dividends
            if divs is not None and not divs.empty:
                divs_series = pd.Series(divs)
                divs_series.index = pd.to_datetime(divs_series.index)
                if divs_series.index.tz is not None:
                    divs_series.index = divs_series.index.tz_convert(None)
                by_year = divs_series.groupby(divs_series.index.year).sum()
                dividend_history = [
                    {"year": int(yr), "amount": round(float(amt), 4)}
                    for yr, amt in by_year.items()
                ]
        except Exception:
            pass

        name_val: Optional[str] = str(g("longName") or g("shortName") or "") or None
        sector_val: Optional[str] = str(g("sector") or g("industryKey") or "") or None
        industry_val: Optional[str] = str(g("industry") or "") or None
        exchange_val: Optional[str] = str(g("exchange") or "") or None
        rec_val: Optional[str] = str(g("recommendationKey") or "") or None

        return FundamentalsSnapshot(
            ticker=ticker,
            name=name_val,
            sector=sector_val,
            industry=industry_val,
            market=market,
            currency=currency,
            exchange=exchange_val,
            market_cap=market_cap,
            gross_margin=_pct(g("grossMargins")),
            operating_margin=_pct(g("operatingMargins")),
            net_margin=_pct(g("profitMargins")),
            roe=_pct(g("returnOnEquity")),
            roa=_pct(g("returnOnAssets")),
            ebitda_margin=_pct(g("ebitdaMargins")),
            pe=_safe(g("trailingPE")),
            forward_pe=_safe(g("forwardPE")),
            peg=_safe(g("pegRatio")),
            price_to_book=_safe(g("priceToBook")),
            price_to_sales=_safe(g("priceToSalesTrailing12Months")),
            ev_to_ebitda=_safe(g("enterpriseToEbitda")),
            ev_to_revenue=_safe(g("enterpriseToRevenue")),
            revenue_growth_yoy=_pct(g("revenueGrowth")),
            earnings_growth_yoy=_pct(g("earningsGrowth")),
            total_revenue=total_revenue,
            total_debt=_safe(g("totalDebt")),
            total_cash=_safe(g("totalCash")),
            debt_to_equity=debt_to_equity,
            current_ratio=_safe(g("currentRatio")),
            quick_ratio=_safe(g("quickRatio")),
            interest_coverage=interest_coverage,
            free_cashflow=free_cashflow,
            operating_cashflow=_safe(g("operatingCashflow")),
            fcf_yield_pct=fcf_yield_pct,
            fcf_margin_pct=fcf_margin_pct,
            ebitda=ebitda,
            dividend_yield_pct=_pct(g("dividendYield")),
            payout_ratio_pct=_pct(g("payoutRatio")),
            shares_change_yoy_pct=shares_change_yoy_pct,
            short_pct_of_float=_pct(g("shortPercentOfFloat")),
            short_ratio=_safe(g("shortRatio")),
            insider_ownership_pct=_pct(g("heldPercentInsiders")),
            institution_ownership_pct=_pct(g("heldPercentInstitutions")),
            analyst_target_price=_safe(g("targetMeanPrice")),
            analyst_low_price=_safe(g("targetLowPrice")),
            analyst_high_price=_safe(g("targetHighPrice")),
            analyst_recommendation=rec_val,
            num_analyst_opinions=_safe_int(g("numberOfAnalystOpinions")),
            week52_high=_safe(g("fiftyTwoWeekHigh")),
            week52_low=_safe(g("fiftyTwoWeekLow")),
            week52_change_pct=week52_change,
            sp500_52wk_change_pct=sp500_52wk_change,
            rel_strength_vs_sp500=rel_strength_vs_sp500,
            beta=_safe(g("beta")),
            dividend_history=dividend_history,
        )
