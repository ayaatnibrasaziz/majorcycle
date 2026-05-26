from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

import pandas as pd

Market = Literal["us", "au", "ca"]
Currency = Literal["USD", "AUD", "CAD"]
ValuationZone = Literal["DEEP VALUE", "VALUE", "FAIR", "STRETCHED"]
OverallLabel = Literal["High Conviction", "Constructive", "Neutral", "Cautious", "Bearish"]


@dataclass
class NewsItem:
    title: str
    url: str
    published_at: str  # ISO 8601 string
    source: str


@dataclass
class FundamentalsSnapshot:
    """Canonical fundamentals shape. Both YFinanceProvider and FMPProvider return this exact shape."""

    # Identity
    ticker: str
    name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market: Market = "us"
    currency: Currency = "USD"
    exchange: Optional[str] = None
    market_cap: Optional[float] = None

    # Profitability
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    net_margin: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    ebitda_margin: Optional[float] = None

    # Valuation
    pe: Optional[float] = None
    forward_pe: Optional[float] = None
    peg: Optional[float] = None
    price_to_book: Optional[float] = None
    price_to_sales: Optional[float] = None
    ev_to_ebitda: Optional[float] = None
    ev_to_revenue: Optional[float] = None

    # Growth
    revenue_growth_yoy: Optional[float] = None
    earnings_growth_yoy: Optional[float] = None
    total_revenue: Optional[float] = None

    # Balance Sheet
    total_debt: Optional[float] = None
    total_cash: Optional[float] = None
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    quick_ratio: Optional[float] = None
    interest_coverage: Optional[float] = None

    # Cash Flow
    free_cashflow: Optional[float] = None
    operating_cashflow: Optional[float] = None
    fcf_yield_pct: Optional[float] = None
    fcf_margin_pct: Optional[float] = None
    ebitda: Optional[float] = None

    # Shareholder Returns
    dividend_yield_pct: Optional[float] = None
    payout_ratio_pct: Optional[float] = None
    shares_change_yoy_pct: Optional[float] = None
    short_pct_of_float: Optional[float] = None
    short_ratio: Optional[float] = None

    # Ownership
    insider_ownership_pct: Optional[float] = None
    institution_ownership_pct: Optional[float] = None

    # Analyst (third-party data — display verbatim)
    analyst_target_price: Optional[float] = None
    analyst_low_price: Optional[float] = None
    analyst_high_price: Optional[float] = None
    analyst_recommendation: Optional[str] = None
    num_analyst_opinions: Optional[int] = None

    # Price / Technicals
    week52_high: Optional[float] = None
    week52_low: Optional[float] = None
    week52_change_pct: Optional[float] = None
    sp500_52wk_change_pct: Optional[float] = None
    rel_strength_vs_sp500: Optional[float] = None
    beta: Optional[float] = None

    dividend_history: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class EnrichedData:
    """Extended Phase 1+2 data stored as JSONB columns in the stocks table."""

    company_overview: Optional[str] = None
    income_statement_annual: dict[str, Any] = field(default_factory=dict)
    income_statement_quarterly: dict[str, Any] = field(default_factory=dict)
    balance_sheet_annual: dict[str, Any] = field(default_factory=dict)
    balance_sheet_quarterly: dict[str, Any] = field(default_factory=dict)
    cashflow_annual: dict[str, Any] = field(default_factory=dict)
    cashflow_quarterly: dict[str, Any] = field(default_factory=dict)
    earnings_history: list[dict[str, Any]] = field(default_factory=list)
    top_holders: list[dict[str, Any]] = field(default_factory=list)
    insider_transactions: list[dict[str, Any]] = field(default_factory=list)
    analyst_upgrades_downgrades: list[dict[str, Any]] = field(default_factory=list)
    pe_history: list[dict[str, Any]] = field(default_factory=list)
    next_earnings_date: Optional[str] = None


class DataProvider(ABC):
    """Abstract data provider. All concrete providers implement this exactly."""

    @abstractmethod
    def fetch_price_history(self, ticker: str, period: str = "max") -> Optional[pd.DataFrame]:
        """Return DataFrame with columns [Open, High, Low, Close, Volume], DatetimeIndex (UTC-naive)."""
        ...

    @abstractmethod
    def fetch_fundamentals(self, ticker: str) -> Optional[FundamentalsSnapshot]:
        """Return fundamentals snapshot or None if unavailable."""
        ...

    @abstractmethod
    def fetch_news(self, ticker: str, limit: int = 10) -> list[NewsItem]:
        """Return list of news items. Empty list if none."""
        ...

    @abstractmethod
    def fetch_enriched_data(self, ticker: str) -> Optional[EnrichedData]:
        """Return enriched data (financials, holders, insider tx, etc.) or None."""
        ...

    @abstractmethod
    def is_healthy(self) -> bool:
        """Quick provider health check."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging/UI provenance — 'yfinance' or 'FMP'."""
        ...
