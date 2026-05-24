from typing import Optional

import pandas as pd

from analytics.providers.base import DataProvider, EnrichedData, FundamentalsSnapshot, NewsItem


class FMPProvider(DataProvider):
    """Phase 2 stub — raises NotImplementedError. Implement when migrating from yfinance."""

    @property
    def name(self) -> str:
        return "FMP"

    def fetch_price_history(self, ticker: str, period: str = "max") -> Optional[pd.DataFrame]:
        raise NotImplementedError("FMPProvider is a Phase 2 stub")

    def fetch_fundamentals(self, ticker: str) -> Optional[FundamentalsSnapshot]:
        raise NotImplementedError("FMPProvider is a Phase 2 stub")

    def fetch_news(self, ticker: str, limit: int = 10) -> list[NewsItem]:
        raise NotImplementedError("FMPProvider is a Phase 2 stub")

    def is_healthy(self) -> bool:
        raise NotImplementedError("FMPProvider is a Phase 2 stub")

    def fetch_enriched_data(self, ticker: str) -> Optional[EnrichedData]:
        raise NotImplementedError("FMPProvider is a Phase 2 stub")
