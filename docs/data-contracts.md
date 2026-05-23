# Data Contracts

> **Purpose:** Defines every data shape that crosses a boundary in the system — Python → DB, DB → Frontend, Frontend → API. If a shape isn't documented here, it doesn't exist yet. Read this before writing any code that creates, reads, or transforms data.
>
> See also: `architecture.md`, `coding-standards.md`.

---

## 1. Core Principle

The contract flows in one direction:

```
Python script computes  →  shape defined as @dataclass
                       →  serialised to JSON
                       →  stored in Supabase JSONB columns
                       →  read by Next.js Server Component
                       →  validated against TypeScript type
                       →  rendered
```

**Every dataclass on the Python side has a mirrored TypeScript type on the frontend side.** Names match. Optional fields match. Any change to one MUST change the other in the same commit.

---

## 2. The DataProvider Interface (Python)

This is the abstraction that makes the FMP migration trivial. Lives in `analytics/providers/base.py`.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Literal
import pandas as pd

Market = Literal["us", "au", "ca"]
Currency = Literal["USD", "AUD", "CAD"]

@dataclass
class NewsItem:
    title: str
    url: str
    published_at: str           # ISO 8601 string
    source: str                 # 'Yahoo Finance', 'Reuters', etc.

@dataclass
class FundamentalsSnapshot:
    """
    Canonical fundamentals shape. Both YFinanceProvider and FMPProvider
    return this exact shape. Frontend reads only this.
    """
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
    gross_margin: Optional[float] = None          # %
    operating_margin: Optional[float] = None      # %
    net_margin: Optional[float] = None            # %
    roe: Optional[float] = None                   # %
    roa: Optional[float] = None                   # %
    ebitda_margin: Optional[float] = None         # %

    # Valuation
    pe: Optional[float] = None
    forward_pe: Optional[float] = None
    peg: Optional[float] = None
    price_to_book: Optional[float] = None
    price_to_sales: Optional[float] = None
    ev_to_ebitda: Optional[float] = None
    ev_to_revenue: Optional[float] = None

    # Growth
    revenue_growth_yoy: Optional[float] = None    # %
    earnings_growth_yoy: Optional[float] = None   # %
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
    fcf_yield_pct: Optional[float] = None         # %
    fcf_margin_pct: Optional[float] = None        # %
    ebitda: Optional[float] = None

    # Shareholder Returns
    dividend_yield_pct: Optional[float] = None
    payout_ratio_pct: Optional[float] = None
    shares_change_yoy_pct: Optional[float] = None
    short_pct_of_float: Optional[float] = None
    short_ratio: Optional[float] = None            # days-to-cover

    # Ownership
    insider_ownership_pct: Optional[float] = None
    institution_ownership_pct: Optional[float] = None

    # Analyst (third-party data — display verbatim)
    analyst_target_price: Optional[float] = None
    analyst_low_price: Optional[float] = None
    analyst_high_price: Optional[float] = None
    analyst_recommendation: Optional[str] = None   # 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
    num_analyst_opinions: Optional[int] = None

    # Price / Technicals
    week52_high: Optional[float] = None
    week52_low: Optional[float] = None
    week52_change_pct: Optional[float] = None
    sp500_52wk_change_pct: Optional[float] = None
    rel_strength_vs_sp500: Optional[float] = None
    beta: Optional[float] = None

    # Dividends history (per year)
    dividend_history: list[dict] = field(default_factory=list)  # [{year: 2024, amount: 0.92}, ...]


class DataProvider(ABC):
    """All concrete providers implement this exactly. No deviations."""

    @abstractmethod
    def fetch_price_history(self, ticker: str, period: str = "max") -> Optional[pd.DataFrame]:
        """Return DataFrame with columns ['Open','High','Low','Close','Volume'], DatetimeIndex (UTC-naive)."""
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
    def is_healthy(self) -> bool:
        """Quick provider health check — fetches a known-good ticker."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging/UI provenance — 'yfinance' or 'FMP'."""
        ...
```

---

## 3. Major Cycle Analysis Output (Python)

The output of `analytics/major_cycle.py` for a single ticker, given a set of parameters. This is what `/api/analyze` returns per ticker.

```python
@dataclass
class CycleParams:
    """User-chosen analysis parameters."""
    pullback_threshold: float       # negative %, e.g. -5.0
    profit_threshold: float         # positive %, e.g. 5.0
    lookback_bars: int              # e.g. 252
    pivot_bars: int = 5             # standard, rarely user-changed

@dataclass
class CycleAnalysis:
    """The Major Cycle output for one ticker."""
    ticker: str
    params: CycleParams
    as_of: str                      # ISO date of analysis

    # Current state
    current_close: float
    current_drawdown_pct: float     # from N-day high, negative number
    current_profit_pct: float       # from N-day low, positive number

    # Historical cycle statistics
    typical_drawdown: Optional[float]      # mean of all historical pullbacks, negative
    lower_bound: Optional[float]            # worst (most negative) historical pullback
    typical_profit: Optional[float]         # mean of all historical recoveries, positive
    upper_bound: Optional[float]            # best historical recovery, positive
    total_pullback_events: int
    total_profit_events: int

    # Scores (0–100)
    financial_health_score: Optional[float]
    valuation_score: float
    valuation_zone: Literal["DEEP VALUE", "VALUE", "FAIR", "STRETCHED"]
    momentum_score: float
    overall_rating: int                     # 0–100, rounded
    overall_label: Literal[
        "High Conviction", "Constructive", "Neutral", "Cautious", "Bearish"
    ]

    # Sub-pillar breakdown (for tooltips and detail panels)
    fh_subscores: dict = field(default_factory=dict)
    # { "profitability": 75, "balance_sheet": 60, "growth": 80, "cashflow": 70, "shareholder": 65 }
```

---

## 4. TypeScript Types (Frontend Mirror)

Lives in `web/lib/types.ts`. Must match the Python dataclasses **exactly**.

```typescript
// web/lib/types.ts

export type Market = 'us' | 'au' | 'ca';
export type Currency = 'USD' | 'AUD' | 'CAD';

export type ValuationZone = 'DEEP VALUE' | 'VALUE' | 'FAIR' | 'STRETCHED';

export type OverallLabel =
  | 'High Conviction'
  | 'Constructive'
  | 'Neutral'
  | 'Cautious'
  | 'Bearish';

export type AnalystRecommendation =
  | 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';

export interface NewsItem {
  title: string;
  url: string;
  publishedAt: string;        // ISO 8601
  source: string;
}

export interface FundamentalsSnapshot {
  // Identity
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  market: Market;
  currency: Currency;
  exchange: string | null;
  marketCap: number | null;

  // Profitability
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  roa: number | null;
  ebitdaMargin: number | null;

  // Valuation
  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  evToEbitda: number | null;
  evToRevenue: number | null;

  // Growth
  revenueGrowthYoy: number | null;
  earningsGrowthYoy: number | null;
  totalRevenue: number | null;

  // Balance Sheet
  totalDebt: number | null;
  totalCash: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  interestCoverage: number | null;

  // Cash Flow
  freeCashflow: number | null;
  operatingCashflow: number | null;
  fcfYieldPct: number | null;
  fcfMarginPct: number | null;
  ebitda: number | null;

  // Shareholder Returns
  dividendYieldPct: number | null;
  payoutRatioPct: number | null;
  sharesChangeYoyPct: number | null;
  shortPctOfFloat: number | null;
  shortRatio: number | null;

  // Ownership
  insiderOwnershipPct: number | null;
  institutionOwnershipPct: number | null;

  // Analyst (verbatim third-party data)
  analystTargetPrice: number | null;
  analystLowPrice: number | null;
  analystHighPrice: number | null;
  analystRecommendation: AnalystRecommendation | null;
  numAnalystOpinions: number | null;

  // Price / Technicals
  week52High: number | null;
  week52Low: number | null;
  week52ChangePct: number | null;
  sp500_52wkChangePct: number | null;
  relStrengthVsSp500: number | null;
  beta: number | null;

  dividendHistory: Array<{ year: number; amount: number }>;
}

export interface CycleParams {
  pullbackThreshold: number;
  profitThreshold: number;
  lookbackBars: number;
  pivotBars?: number;
}

export interface CycleAnalysis {
  ticker: string;
  params: CycleParams;
  asOf: string;

  currentClose: number;
  currentDrawdownPct: number;
  currentProfitPct: number;

  typicalDrawdown: number | null;
  lowerBound: number | null;
  typicalProfit: number | null;
  upperBound: number | null;
  totalPullbackEvents: number;
  totalProfitEvents: number;

  financialHealthScore: number | null;
  valuationScore: number;
  valuationZone: ValuationZone;
  momentumScore: number;
  overallRating: number;
  overallLabel: OverallLabel;

  fhSubscores: {
    profitability?: number;
    balanceSheet?: number;
    growth?: number;
    cashflow?: number;
    shareholder?: number;
  };
}

export interface PriceBar {
  date: string;               // ISO date 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockRecord {
  ticker: string;
  market: Market;
  name: string | null;
  sector: string | null;
  industry: string | null;
  currency: Currency;
  exchange: string | null;
  marketCap: number | null;
  fundamentals: FundamentalsSnapshot;
  news: NewsItem[];
  updatedAt: string;
}
```

**Conversion rule:** Python uses `snake_case`, TypeScript uses `camelCase`. The Python script writes snake_case JSON to Supabase. The frontend has a small `web/lib/case.ts` utility that converts snake_case → camelCase on read. Never store camelCase keys in the DB.

---

## 5. API Request/Response Contracts

### `POST /api/analyze`

**Request:**
```typescript
interface AnalyzeRequest {
  tickers: string[];                       // ['AAPL', 'MSFT', ...] in yfinance format
  preset: 'short' | 'medium' | 'long' | 'custom';
  pullbackThreshold?: number;              // required if preset === 'custom'
  profitThreshold?: number;                // required if preset === 'custom'
  lookbackBars?: number;                   // required if preset === 'custom'
}
```

**Response (200):**
```typescript
interface AnalyzeResponse {
  results: CycleAnalysis[];
  unavailable: string[];                   // tickers that couldn't be analysed
  runId: string;                           // UUID of stored analysis_run
  startedAt: string;
  finishedAt: string;
}
```

**Errors:**
- `400` — invalid params (missing custom values, etc.)
- `401` — not logged in
- `402` — subscription expired
- `500` — internal — return `{ error: string }`

### `POST /api/fetch-ticker`

**Request:** `{ ticker: string }`

**Response (200):** `{ stock: StockRecord }`

**Errors:**
- `404` — ticker not found on any provider
- `429` — provider rate-limited, retry later

### `GET /api/ticker/[symbol]`

**Path param:** symbol in URL form (`AAPL`, `BHP-au`, etc.) — see ticker mapping below.

**Response (200):** `{ stock: StockRecord; priceBars: PriceBar[] }`

### `GET /api/search?q={query}`

**Response:** `{ results: Array<{ ticker: string; name: string; market: Market }> }`

---

## 6. Ticker Format Mapping (URL ↔ Storage)

**Storage format:** yfinance native (`AAPL`, `BHP.AX`, `SHOP.TO`). This is also FMP-compatible.

**URL format:** market-prefixed, dot-free (`/stocks/us/AAPL`, `/stocks/au/BHP`, `/stocks/ca/SHOP`).

**Mapping utility lives in `web/lib/ticker.ts`:**

```typescript
// Storage → URL parts
function tickerToUrlParts(stored: string): { market: Market; symbol: string } {
  if (stored.endsWith('.AX')) return { market: 'au', symbol: stored.replace('.AX', '') };
  if (stored.endsWith('.TO')) return { market: 'ca', symbol: stored.replace('.TO', '') };
  return { market: 'us', symbol: stored };
}

// URL parts → Storage
function urlPartsToTicker(market: Market, symbol: string): string {
  const upper = symbol.toUpperCase();
  if (market === 'au') return `${upper}.AX`;
  if (market === 'ca') return `${upper}.TO`;
  return upper;
}
```

**Rule:** This is the ONLY place ticker format conversion happens. Every other module uses one consistent format.

---

## 7. Run Analysis Preset Definitions

Constants live in `web/lib/presets.ts` and `analytics/presets.py`. **Both files must match.**

```typescript
// web/lib/presets.ts
export const PRESETS = {
  short:  { pullbackThreshold: -3, profitThreshold: 3, lookbackBars: 63 },
  medium: { pullbackThreshold: -5, profitThreshold: 5, lookbackBars: 252 },
  long:   { pullbackThreshold: -8, profitThreshold: 8, lookbackBars: 756 },
} as const;
```

```python
# analytics/presets.py
PRESETS = {
    "short":  {"pullback_threshold": -3.0, "profit_threshold": 3.0, "lookback_bars": 63},
    "medium": {"pullback_threshold": -5.0, "profit_threshold": 5.0, "lookback_bars": 252},
    "long":   {"pullback_threshold": -8.0, "profit_threshold": 8.0, "lookback_bars": 756},
}
```

**Custom preset:** user supplies all three values. Validation rules:
- `pullbackThreshold` must be negative, in range [-30, -1]
- `profitThreshold` must be positive, in range [1, 30]
- `lookbackBars` must be positive integer, in range [21, 5040]  (~1 month to ~20 years)

---

## 8. Currency Display Rules

**Stock prices:** always in the stock's home currency, identified by `fundamentals.currency`. Display the currency symbol or code.

**Subscription pricing:** in the user's locale currency. Detected from:
1. `profiles.country` if logged in
2. Stripe location lookup at checkout time

**No FX conversion in Phase 1.** Australian users browsing AAPL see USD prices. This is the standard for finance products.

---

## 9. Universe CSV Format

Lives in `analytics/universe/`. One file per market.

**`sp500.csv`:**
```
ticker,name,sector
AAPL,Apple Inc.,Technology
MSFT,Microsoft Corporation,Technology
...
```

**`asx200.csv`:**
```
ticker,name,sector
BHP.AX,BHP Group Limited,Materials
CBA.AX,Commonwealth Bank,Financials
...
```

**`tsx60.csv`:**
```
ticker,name,sector
SHOP.TO,Shopify Inc.,Technology
RY.TO,Royal Bank of Canada,Financials
...
```

The cron script reads all three, processes each ticker, writes to `stocks` + `price_bars`.

---

## 10. Stripe Subscription Schema

Two products in Stripe:
1. **`<APP_NAME>` Monthly**
   - 3 prices: USD $15, AUD $19, CAD $20
   - `trial_period_days: 7`
2. **`<APP_NAME>` Annual**
   - 3 prices: USD $126, AUD $159, CAD $168 (~30% off monthly equivalent)
   - `trial_period_days: 7`

Webhook events handled:
- `checkout.session.completed` → set `profiles.subscription_status = 'trialing'`
- `customer.subscription.updated` → sync status
- `customer.subscription.deleted` → set status `'canceled'`
- `invoice.payment_failed` → trigger 3-day grace period flow

---

## 11. Disallowed Patterns

- ❌ Storing computed scores (`overall_rating`, `valuation_zone`) in the DB — they're always derived
- ❌ Bypassing the `DataProvider` interface — never call `yfinance` directly anywhere except inside `yfinance_provider.py`
- ❌ Adding fields to `FundamentalsSnapshot` without updating BOTH the Python dataclass AND the TS type in the same commit
- ❌ Storing camelCase keys in Supabase — always snake_case at the DB boundary
- ❌ Returning raw provider responses to the frontend — always go through the canonical shapes

---

**End of data-contracts.md.**
