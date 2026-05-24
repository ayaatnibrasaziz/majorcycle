from analytics.providers.base import DataProvider
from analytics.providers.yfinance_provider import YFinanceProvider

# To migrate to FMP in Phase 2:
# 1. Comment out YFinanceProvider import + line below
# 2. Uncomment FMPProvider import + line
# from analytics.providers.fmp_provider import FMPProvider

DATA_PROVIDER: DataProvider = YFinanceProvider()
