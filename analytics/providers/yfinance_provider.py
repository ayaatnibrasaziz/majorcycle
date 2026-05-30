import logging
import random
import re
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
    EnrichedData,
    FundamentalsSnapshot,
    Market,
    NewsItem,
)

logger = logging.getLogger(__name__)

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

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
        df, _ = self._download_with_retry(ticker, period=period)
        return df

    def fetch_fundamentals(self, ticker: str) -> Optional[FundamentalsSnapshot]:
        try:
            t = yf.Ticker(ticker)
            info: dict[str, Any] = {}
            try:
                info = t.info or {}
            except Exception:
                pass
            if not info or not any(
                k in info
                for k in ("symbol", "longName", "currentPrice", "regularMarketPrice")
            ):
                return None
            return self._extract_fundamentals(ticker, t)
        except Exception as e:
            logger.warning("fetch_fundamentals %s: %s", ticker, e)
            return None

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

    def fetch_enriched_data(self, ticker: str) -> Optional[EnrichedData]:
        try:
            t = yf.Ticker(ticker)
            info: dict[str, Any] = {}
            try:
                info = t.info or {}
            except Exception:
                pass

            overview_raw = info.get("longBusinessSummary")
            company_overview: Optional[str] = str(overview_raw) if overview_raw else None

            inc_a = self._extract_statement(self._safe_attr(t, "income_stmt"))
            inc_q = self._extract_statement(self._safe_attr(t, "quarterly_income_stmt"))
            bs_a = self._extract_statement(self._safe_attr(t, "balance_sheet"))
            bs_q = self._extract_statement(self._safe_attr(t, "quarterly_balance_sheet"))
            cf_a = self._extract_statement(self._safe_attr(t, "cashflow"))
            cf_q = self._extract_statement(self._safe_attr(t, "quarterly_cashflow"))

            earnings_hist = self._extract_earnings_history(
                self._safe_attr(t, "earnings_history")
            )
            top_holders = self._extract_top_holders(
                self._safe_attr(t, "institutional_holders")
            )
            insider_tx = self._extract_insider_transactions(
                self._safe_attr(t, "insider_transactions")
            )
            analyst_ud = self._extract_upgrades_downgrades(
                self._safe_attr(t, "upgrades_downgrades")
            )
            pe_hist = self._compute_pe_history(t, ticker)
            next_ed = self._extract_next_earnings_date(t)

            return EnrichedData(
                company_overview=company_overview,
                income_statement_annual=inc_a,
                income_statement_quarterly=inc_q,
                balance_sheet_annual=bs_a,
                balance_sheet_quarterly=bs_q,
                cashflow_annual=cf_a,
                cashflow_quarterly=cf_q,
                earnings_history=earnings_hist,
                top_holders=top_holders,
                insider_transactions=insider_tx,
                analyst_upgrades_downgrades=analyst_ud,
                pe_history=pe_hist,
                next_earnings_date=next_ed,
            )
        except Exception as e:
            logger.warning("fetch_enriched_data %s: %s", ticker, e)
            return None

    @staticmethod
    def _extract_next_earnings_date(ticker_obj: Any) -> Optional[str]:
        """Pull next-earnings DATE from yfinance t.calendar.

        Returns 'YYYY-MM-DD' or None. Guaranteed never to return a
        malformed string like '[]' (yfinance returns empty lists for
        many ASX/TSX stocks; sending that to a DATE column kills the
        whole row upsert).
        """
        try:
            cal = YFinanceProvider._safe_attr(ticker_obj, "calendar")
            if cal is None:
                return None

            # Pull the raw value out of either dict or DataFrame shape
            raw: Any = None
            if isinstance(cal, dict):
                raw = cal.get("Earnings Date")
            elif isinstance(cal, pd.DataFrame):
                if "Earnings Date" in cal.columns:
                    vals = cal["Earnings Date"].dropna()
                    if not vals.empty:
                        raw = vals.iloc[0]

            if raw is None:
                return None

            # Unwrap list/tuple — yfinance returns [Timestamp(...)] sometimes,
            # and empty [] when the calendar is unavailable
            if isinstance(raw, (list, tuple)):
                if len(raw) == 0:
                    return None
                raw = raw[0]
                if raw is None:
                    return None

            # Timestamp / datetime-like
            date_attr = getattr(raw, "date", None)
            if callable(date_attr):
                try:
                    return str(date_attr())
                except Exception:
                    return None

            # Last resort: only accept strings that already look like ISO dates
            s = str(raw)[:10] if raw is not None else ""
            return s if _ISO_DATE_RE.match(s) else None
        except Exception:
            return None

    @staticmethod
    def _safe_attr(obj: Any, attr: str) -> Any:
        try:
            return getattr(obj, attr, None)
        except Exception:
            return None

    def _extract_statement(self, df: Any) -> dict[str, Any]:
        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            return {}
        try:
            labels = [
                str(c.date()) if hasattr(c, "date") else str(c)
                for c in df.columns
            ]
            result: dict[str, Any] = {"labels": labels}
            for row in df.index:
                raw_key = str(row).lower().strip()
                key = (
                    raw_key
                    .replace(" ", "_")
                    .replace("/", "_")
                    .replace("-", "_")
                    .replace(".", "")
                    .replace(",", "")
                    .replace("(", "")
                    .replace(")", "")
                )
                vals: list[Any] = []
                for v in df.loc[row]:
                    try:
                        fv = float(v)
                        vals.append(None if (np.isnan(fv) or np.isinf(fv)) else round(fv, 0))
                    except Exception:
                        vals.append(None)
                result[key] = vals
            return result
        except Exception as e:
            logger.debug("_extract_statement error: %s", e)
            return {}

    def _extract_earnings_history(self, df: Any) -> list[dict[str, Any]]:
        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            return []
        try:
            rows: list[dict[str, Any]] = []
            for idx, row in df.iterrows():
                date_str = str(idx.date()) if hasattr(idx, "date") else str(idx)
                entry: dict[str, Any] = {"date": date_str}
                for col in df.columns:
                    col_key = (
                        str(col)
                        .lower()
                        .replace(" ", "_")
                        .replace("(", "")
                        .replace(")", "")
                        .replace("%", "pct")
                    )
                    entry[col_key] = _safe(row[col])
                rows.append(entry)
            return rows[-20:]
        except Exception as e:
            logger.debug("_extract_earnings_history error: %s", e)
            return []

    def _extract_top_holders(self, df: Any) -> list[dict[str, Any]]:
        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            return []
        try:
            holders: list[dict[str, Any]] = []
            for _, row in df.iterrows():
                holders.append({
                    "holder": str(row.get("Holder", row.get("Name", ""))),
                    "shares": _safe_int(row.get("Shares")),
                    "pct_out": _safe(row.get("% Out", row.get("pctHeld"))),
                    "value": _safe(row.get("Value")),
                    "date_reported": str(row.get("Date Reported", "")),
                })
            return holders[:15]
        except Exception as e:
            logger.debug("_extract_top_holders error: %s", e)
            return []

    @staticmethod
    def _classify_transaction(text: str) -> str:
        t = text.lower()
        if "sale" in t:
            return "Sale"
        if "purchase" in t:
            return "Purchase"
        if "award" in t or "grant" in t:
            return "Award"
        if "gift" in t:
            return "Gift"
        return "Other"

    def _extract_insider_transactions(self, df: Any) -> list[dict[str, Any]]:
        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            return []
        try:
            # yfinance returns a RangeIndex; the actual transaction date is in
            # the "Start Date" column (not the index).
            date_col = next(
                (c for c in ["Start Date", "startDate", "Date", "date"] if c in df.columns),
                None,
            )
            df_sorted = (
                df.sort_values(date_col, ascending=False)
                if date_col
                else df.sort_index(ascending=False)
            )
            txs: list[dict[str, Any]] = []
            for _, row in df_sorted.iterrows():
                if date_col:
                    date_val = row.get(date_col)
                    if date_val is not None and not pd.isna(date_val):
                        date_str = (
                            str(date_val.date())
                            if hasattr(date_val, "date")
                            else str(date_val)[:10]
                        )
                    else:
                        date_str = ""
                else:
                    date_str = ""
                text = str(row.get("Text", "")).strip()
                txs.append({
                    "date": date_str,
                    "insider": str(row.get("Insider", "")),
                    "position": str(row.get("Position", "")),
                    "type": self._classify_transaction(text),
                    "text": text,
                    "shares": _safe_int(row.get("Shares")),
                    "value": _safe(row.get("Value")),
                })
            return txs[:50]
        except Exception as e:
            logger.debug("_extract_insider_transactions error: %s", e)
            return []

    def _extract_upgrades_downgrades(self, df: Any) -> list[dict[str, Any]]:
        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            return []
        try:
            df_sorted = df.sort_index(ascending=False)
            changes: list[dict[str, Any]] = []
            for idx, row in df_sorted.iterrows():
                date_str = str(idx.date()) if hasattr(idx, "date") else str(idx)
                changes.append({
                    "date": date_str,
                    "firm": str(row.get("Firm", "")),
                    "to_grade": str(row.get("ToGrade", "")),
                    "from_grade": str(row.get("FromGrade", "")),
                    "action": str(row.get("Action", "")),
                })
            return changes[:50]
        except Exception as e:
            logger.debug("_extract_upgrades_downgrades error: %s", e)
            return []

    def _compute_pe_history(self, ticker_obj: Any, ticker: str) -> list[dict[str, Any]]:
        try:
            def _find_eps_row(df: pd.DataFrame) -> Any:
                for candidate in df.index:
                    if "diluted" in str(candidate).lower() and "eps" in str(candidate).lower():
                        return candidate
                for candidate in df.index:
                    if "basic" in str(candidate).lower() and "eps" in str(candidate).lower():
                        return candidate
                return None

            # Build an EPS timeline: (timestamp, eps_value) pairs, oldest first.
            # Annual entries (income_stmt) cover ~4 fiscal years; quarterly TTM
            # entries add more-accurate recent data. Monthly price samples are
            # divided against the most recently known EPS for ~60 data points.
            eps_timeline: list[tuple[pd.Timestamp, float]] = []

            ais = self._safe_attr(ticker_obj, "income_stmt")
            if ais is not None and isinstance(ais, pd.DataFrame) and not ais.empty:
                eps_row = _find_eps_row(ais)
                if eps_row is not None:
                    for col in ais.columns:
                        val = _safe(ais.loc[eps_row, col])
                        if val is not None and val > 0:
                            ts = pd.Timestamp(col)
                            if ts.tz is not None:
                                ts = ts.tz_convert(None)
                            eps_timeline.append((ts, val))

            qis = self._safe_attr(ticker_obj, "quarterly_income_stmt")
            if qis is not None and isinstance(qis, pd.DataFrame) and not qis.empty:
                eps_row_q = _find_eps_row(qis)
                if eps_row_q is not None:
                    q_eps: dict[Any, Optional[float]] = {
                        c: _safe(qis.loc[eps_row_q, c]) for c in qis.columns
                    }
                    q_dates = sorted(q_eps.keys())
                    for i in range(3, len(q_dates)):
                        window = q_dates[i - 3: i + 1]
                        clean: list[float] = [v for d in window if (v := q_eps.get(d)) is not None]
                        if len(clean) < 4:
                            continue
                        ttm = sum(clean)
                        if ttm > 0:
                            ts = pd.Timestamp(q_dates[i])
                            if ts.tz is not None:
                                ts = ts.tz_convert(None)
                            eps_timeline.append((ts, ttm))

            if not eps_timeline:
                return []

            eps_timeline.sort(key=lambda x: x[0])

            try:
                price_df: Any = ticker_obj.history(period="5y", interval="1d", auto_adjust=True)
            except Exception:
                return []
            if price_df is None or price_df.empty:
                return []

            p_idx = pd.DatetimeIndex(price_df.index)
            if p_idx.tz is not None:
                p_idx = p_idx.tz_convert(None)
            close_series = pd.Series(price_df["Close"].values, index=p_idx, dtype=float)
            monthly = close_series.resample("ME").last().dropna()

            eps_dates = [e[0] for e in eps_timeline]
            eps_values = [e[1] for e in eps_timeline]

            results: list[dict[str, Any]] = []
            for month_end, price in monthly.items():
                applicable_eps: Optional[float] = None
                for j in range(len(eps_dates) - 1, -1, -1):
                    if eps_dates[j] <= month_end:
                        applicable_eps = eps_values[j]
                        break

                if applicable_eps is None or applicable_eps <= 0:
                    continue

                pe_val = round(float(price) / applicable_eps, 2)
                if 0 < pe_val < 2000:
                    results.append({"date": month_end.strftime("%Y-%m-%d"), "pe": pe_val})

            return results
        except Exception as e:
            logger.debug("_compute_pe_history %s: %s", ticker, e)
            return []

    def _download_yfinance(self, ticker_str: str, period: str = _DOWNLOAD_PERIOD) -> tuple[Optional[pd.DataFrame], Any]:
        try:
            t = yf.Ticker(ticker_str)
            raw: Any = t.history(period=period, interval="1d", auto_adjust=True)
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
            if period == _DOWNLOAD_PERIOD and len(df) < _MIN_BARS:
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

    def _download_with_retry(self, ticker_str: str, period: str = _DOWNLOAD_PERIOD) -> tuple[Optional[pd.DataFrame], Any]:
        for attempt in range(1, _MAX_RETRIES + 1):
            df, t = self._download_yfinance(ticker_str, period=period)
            if df is not None:
                return df, t
            sleep_time = _RETRY_BACKOFF_BASE ** attempt + random.uniform(0, 1)
            logger.debug(
                "%s: attempt %d failed — retry in %.1fs", ticker_str, attempt, sleep_time
            )
            time.sleep(sleep_time)

        if period == _DOWNLOAD_PERIOD:
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
                    {"year": int(yr), "amount": round(float(amt), 4)}  # type: ignore[call-overload]
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
