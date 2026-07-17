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

# NOTE: the DB `stocks.market` CHECK constraint also permits 'index' — used ONLY
# for benchmark price-only rows (^GSPC / ^AXJO / ^GSPTSE) that back the Relative
# Performance chart. 'index' is intentionally NOT part of the user-facing `Market`
# type and such rows are excluded from stock listings/routing.

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


@dataclass
class EnrichedData:
    """
    Extended Phase 1+2 data. Fetched only when the staleness check fires
    (earnings-date-driven or 7-day fallback). Stored as JSONB columns in stocks.
    """
    company_overview: Optional[str] = None

    # Financial statements — shape: {"labels": ["2024-12-31", ...], "total_revenue": [...], ...}
    income_statement_annual:    dict = field(default_factory=dict)
    income_statement_quarterly: dict = field(default_factory=dict)
    balance_sheet_annual:       dict = field(default_factory=dict)
    balance_sheet_quarterly:    dict = field(default_factory=dict)
    cashflow_annual:            dict = field(default_factory=dict)
    cashflow_quarterly:         dict = field(default_factory=dict)

    # Lists — each item is a flat dict with a 'date' key
    earnings_history:            list[dict] = field(default_factory=list)  # last 20 quarters
    top_holders:                 list[dict] = field(default_factory=list)  # top 15 institutions
    insider_transactions:        list[dict] = field(default_factory=list)  # last 50 transactions
    analyst_upgrades_downgrades: list[dict] = field(default_factory=list)  # last 50 changes

    # Computed from quarterly EPS + price history (5-year window)
    pe_history: list[dict] = field(default_factory=list)  # [{"date": "2024-03-31", "pe": 28.5}, ...]

    # Next scheduled earnings date from yfinance t.calendar — drives the staleness check
    next_earnings_date: Optional[str] = None  # 'YYYY-MM-DD' or None if unavailable


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
    def fetch_enriched_data(self, ticker: str) -> Optional[EnrichedData]:
        """Return enriched data (financials, holders, insider tx, etc.) or None."""
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
    typical_drawdown: Optional[float]      # mean of all confirmed pullback events, negative
    lower_bound: Optional[float]            # deepest CONFIRMED pullback pivot (full history); the live dip can run below it — see glossary
    typical_profit: Optional[float]         # mean of all confirmed profit events, positive
    upper_bound: Optional[float]            # strongest CONFIRMED profit pivot; display-only (feeds no score)
    total_pullback_events: int
    total_profit_events: int

    # Scores (0–100)
    financial_health_score: Optional[float]
    valuation_score: float                  # quality-gated — feeds the overall rating
    valuation_score_raw: float              # un-gated cycle-position score
    quality_factor: Optional[float]         # gate multiplier (None if no FH to gate by)
    valuation_zone: Literal["DEEP VALUE", "VALUE", "FAIR", "STRETCHED"]
    cycle_payoff_score: float               # signal-reliability + reward/risk (was "momentum_score")
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
  valuationScore: number; // quality-gated — feeds the overall rating
  valuationScoreRaw: number; // un-gated cycle-position score
  qualityFactor: number | null; // gate multiplier (null if no FH to gate by)
  valuationZone: ValuationZone;
  cyclePayoffScore: number; // signal-reliability + reward/risk (was "momentumScore")
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

// Enriched data types — mirrors EnrichedData Python dataclass

export interface FinancialStatement {
  labels: string[];           // period-end dates e.g. ["2024-12-31", "2023-12-31"]
  [key: string]: unknown;     // snake_case row names → parallel number arrays
}

export interface EarningsHistoryItem {
  date: string;
  [key: string]: number | string | null | undefined;
}

export interface TopHolder {
  holder: string;
  shares: number | null;
  pct_out: number | null;
  value: number | null;
  date_reported: string;
}

export interface InsiderTransaction {
  date: string;
  insider: string;
  position: string;
  type: 'Sale' | 'Purchase' | 'Award' | 'Gift' | 'Other';
  text: string;
  shares: number | null;
  value: number | null;
}

export interface AnalystUpgrade {
  date: string;
  firm: string;
  to_grade: string;
  from_grade: string;
  action: string;
}

export interface PeHistoryItem {
  date: string;
  pe: number;
}

export interface EnrichedData {
  company_overview: string | null;
  income_statement_annual: FinancialStatement;
  income_statement_quarterly: FinancialStatement;
  balance_sheet_annual: FinancialStatement;
  balance_sheet_quarterly: FinancialStatement;
  cashflow_annual: FinancialStatement;
  cashflow_quarterly: FinancialStatement;
  earnings_history: EarningsHistoryItem[];
  top_holders: TopHolder[];
  insider_transactions: InsiderTransaction[];
  analyst_upgrades_downgrades: AnalystUpgrade[];
  pe_history: PeHistoryItem[];
  next_earnings_date: string | null;
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
  // Enriched fields — present when enriched data has been fetched (optional until first enrich run)
  companyOverview?: string | null;
  incomeStatementAnnual?: FinancialStatement;
  incomeStatementQuarterly?: FinancialStatement;
  balanceSheetAnnual?: FinancialStatement;
  balanceSheetQuarterly?: FinancialStatement;
  cashflowAnnual?: FinancialStatement;
  cashflowQuarterly?: FinancialStatement;
  earningsHistory?: EarningsHistoryItem[];
  topHolders?: TopHolder[];
  insiderTransactions?: InsiderTransaction[];
  analystUpgradesDowngrades?: AnalystUpgrade[];
  peHistory?: PeHistoryItem[];
  nextEarningsDate?: string | null;
  enrichedUpdatedAt?: string | null;
}
```

**Conversion rule:** Python uses `snake_case`, TypeScript uses `camelCase`. The Python script writes snake_case JSON to Supabase. The frontend has a small `web/lib/case.ts` utility that converts snake_case → camelCase on read. Never store camelCase keys in the DB.

---

## 5. API Request/Response Contracts

### `GET /api/cycle`

Single-ticker Major Cycle analysis. Called by the Stock Detail Server Component on every page render (cached by Vercel edge for 1h, stale-while-revalidate 24h). Implemented in `web/api/cycle.py` (Python serverless function); reads price bars and fundamentals from Supabase, runs the cycle math via the vendored `web/_engine/` package, never calls yfinance.

**Query params:**
```typescript
interface CycleQuery {
  ticker: string;                                          // storage format: 'AAPL', 'BHP.AX', 'SHOP.TO'
  preset?: 'short' | 'medium' | 'long' | 'custom';         // default: 'medium'
  pullback?: number;                                       // required if preset === 'custom' (bounds §7)
  profit?: number;                                         // required if preset === 'custom'
  lookback?: number;                                       // required if preset === 'custom'
}
```
The Browse page sets the window: named presets via `?preset=`, or a fully custom
window (`?preset=custom&pullback=-7&profit=7&lookback=300`) that the detail page
passes straight through. Custom values are validated to the §7 bounds (else 400);
the result is edge-cached per full query string.

**Response (200):** the full `CycleAnalysis` shape from section 3, serialised with snake_case keys (the Python dataclass field names). The frontend converts to camelCase via `web/lib/case.ts` if typed consumption is needed. Sample:

```json
{
  "ticker": "AAPL",
  "params": { "pullback_threshold": -5.0, "profit_threshold": 5.0, "lookback_bars": 252, "pivot_bars": 5 },
  "as_of": "2026-05-25",
  "current_close": 187.42,
  "current_drawdown_pct": -3.21,
  "current_profit_pct": 18.55,
  "typical_drawdown": -7.8,
  "lower_bound": -22.4,
  "typical_profit": 12.3,
  "upper_bound": 41.7,
  "total_pullback_events": 18,
  "total_profit_events": 15,
  "financial_health_score": 78.5,
  "valuation_score": 38.2,
  "valuation_score_raw": 42.0,
  "quality_factor": 0.9095,
  "valuation_zone": "STRETCHED",
  "cycle_payoff_score": 71.4,
  "overall_rating": 64,
  "overall_label": "Neutral",
  "fh_subscores": { "profitability": 92, "balance_sheet": 68, "growth": 71, "cashflow": 80, "shareholder": 65 }
}
```

**Errors:**
- `400` — missing `ticker` or invalid `preset` → `{ "error": "..." }`
- `404` — ticker not in `stocks` table OR no `price_bars` rows → `{ "error": "..." }`
- `422` — ticker exists and has price history, but not enough bars to fill the
  requested horizon's lookback window (e.g. a recently-listed stock on the Long
  preset; `analyze_ticker` returns `None`) → `{ "error": "...", "reason": "insufficient_history" }`.
  This is an **expected outcome of a user choice, not a server fault**, so it must
  not be a 5xx (which reads as "we broke" and raises false error-level log/alert
  noise). The Stock Detail page treats any non-200 as `null` and renders the
  graceful "Major Cycle — not available at this horizon" notice.
- `500` — genuine internal error (env var missing, unhandled exception) → `{ "error": "...", "detail": "..." }`

**Caching headers (200 only):** `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`

### `POST /api/analyze`

**Stateless by design (Layer D).** The Run tab chunks the user's selection
client-side (≤ 60 tickers/request) and POSTs each chunk; the function never
writes to the DB and returns **no `runId`**. The client accumulates the chunks,
holds live results in client state (+ `sessionStorage` for the Layer E Results
handoff), and writes **one** `analysis_runs` history row itself — **inputs only**,
never the computed results (CLAUDE.md #15 / §11). Reads price bars + fundamentals
from Supabase and runs the math via the vendored `_engine`; never calls yfinance.
Auth is enforced by `proxy.ts` (this path is not in `PUBLIC_PATHS`).

**Request:**
```typescript
interface AnalyzeRequest {
  tickers: string[];                       // ['AAPL', 'MSFT', ...] in yfinance format
  preset: 'short' | 'medium' | 'long' | 'custom';
  pullbackThreshold?: number;              // required if preset === 'custom' (bounds: §7)
  profitThreshold?: number;                // required if preset === 'custom'
  lookbackBars?: number;                   // required if preset === 'custom'
}
```

**Response (200):** `results` arrive snake_case (the Python dataclass field
names); the client converts via `web/lib/case.ts`.
```typescript
interface AnalyzeResponse {
  results: RunResult[];                     // one per analysable ticker
  unavailable: string[];                    // not in universe / insufficient history / failed
  startedAt: string;
  finishedAt: string;
}

// A scored stock = the CycleAnalysis plus a slim, display-only fundamentals
// subset for the Results screener's Analyst / Full views (web/api/analyze.py
// `_screener_fundamentals`). `fundamentals` is OPTIONAL so older sessionStorage
// snapshots still hydrate (those rows show "—" in the fundamentals columns).
// NOT used by the cycle math. `analystRecommendation` is third-party Wall-Street
// data shown verbatim (#17). Keys arrive snake_case → camelCase via case.ts.
type RunResult = CycleAnalysis & { fundamentals?: ScreenerFundamentals };

interface ScreenerFundamentals {
  pe: number | null; peg: number | null; roe: number | null;
  grossMargin: number | null; netMargin: number | null; fcfYieldPct: number | null;
  debtToEquity: number | null; currentRatio: number | null; interestCoverage: number | null;
  revenueGrowthYoy: number | null; shortPctOfFloat: number | null; shortRatio: number | null;
  analystTargetPrice: number | null; analystRecommendation: string | null;
  numAnalystOpinions: number | null;
}
```

> **Run reliability (2026-06-17):** `/api/analyze` runs ≤2 tickers concurrently
> (was 4) and retries the `get_price_bars_json` RPC before falling back to slow
> pagination, and the client (`analysis.tsx`) runs a final **single-ticker
> reconciliation pass** over any in-universe straggler — re-running it the way the
> detail page does (solo request, no cross-ticker contention) so transient
> read-timeouts no longer surface as false `unavailable` skips.

**The `analysis_runs` history row (client-written, inputs only):**
```typescript
interface AnalysisRunRecord {
  id: string;
  preset: 'short' | 'medium' | 'long' | 'custom';
  // ALWAYS populated (the table's threshold columns are NOT NULL). For a NAMED
  // preset the request omits the raw thresholds, so `writeRun` resolves them from
  // PRESETS before inserting — still inputs, just the resolved form of the preset.
  // (Persisting NULL here silently dropped every named-preset Last-Analysis row.)
  pullbackThreshold: number;
  profitThreshold: number;
  lookbackBars: number;
  tickers: string[];
  tickerCount: number;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'complete' | 'partial' | 'error';
  // NOTE: the table's `results jsonb` column is written NULL — ratings are never
  // stored (migration `analysis_runs_results_nullable` relaxes its NOT NULL).
}
```

**Errors:**
- `400` — invalid params (empty tickers, bad preset, custom out of §7 bounds, > 60/request)
- `401` — not logged in (enforced by `proxy.ts`)
- `402` — subscription expired *(Layer F)*
- `500` — internal — return `{ error: string }`

### Universe expansion — "Request a Ticker" (queue model)

Unknown tickers are **not** fetched synchronously (no `/api/fetch-ticker`). The
user picks a real listed symbol from the `listings` "menu" and queues it; the
**daily cron** drains the queue (see `architecture.md` §8 Tier 4). Two TS routes
back this — both auth-required, both authenticate with the Supabase server client
then read/write the locked-down tables with the admin client. The queue is
**user-only**: rows always carry a `requested_by`, and the GET filters
`requested_by IS NOT NULL`, so cron-driven universe additions (e.g. index
constituents, which are fetched directly and never enqueued) never surface on the
Request-a-Ticker page.

```typescript
// web/lib/types.ts — Request-a-Ticker shapes

export type RequestStatus = 'queued' | 'fetched' | 'unsupported' | 'failed';

// One search hit on the Request-a-Ticker page. `covered` = already in `stocks`
// (analysable now → link to detail). `requestStatus` = its row in
// `ticker_requests`, if any (so the UI shows "Requested — arriving next update"
// instead of a Request button — visible to ALL users, global dedup).
export interface ListingHit {
  symbol: string;          // yfinance format
  name: string | null;
  exchange: string | null;
  market: Market;
  covered: boolean;
  requestStatus: RequestStatus | null;
}

export interface TickerRequest {
  symbol: string;
  market: Market;
  status: RequestStatus;
  requestedAt: string;     // ISO 8601
  fetchedAt: string | null;
  lastError: string | null;
}

// Live status for a symbol the Run couldn't score (the Results "couldn't be
// scored" strip). Lets the UI show the right state up front: covered = in our
// analysed universe (link to detail); inListings = a recognised US/AU/CA stock
// that can be requested; requestStatus = its queue row, if any. Not covered + not
// in listings = an unrecognised symbol ("Not covered" — nothing to request).
export interface SkippedStatus {
  inListings: boolean;
  covered: boolean;
  requestStatus: RequestStatus | null;
}
```

#### `GET /api/listings/search?q={query}`

Choose-only autocomplete over `listings`. A single `search_listings(p_q)` Postgres
RPC (migration `20260620120000`) does the trigram match, the `covered` (join to
`stocks`) + `requestStatus` (join to `ticker_requests`) annotation, and the ranking
(symbol-prefix > symbol-contains > name-prefix, then shortest symbol) server-side in
**one round-trip**. The RPC is `STABLE`, called with the service-role admin client,
and `EXECUTE` is revoked from anon/authenticated (mirrors `get_price_bars_json`).

**Response (200):** `{ results: ListingHit[] }` (≤ 20)

#### `POST /api/request-ticker`

Enqueue a listed symbol. Validates the symbol **exists in `listings`** (so only
real US/AU/CA stocks can be queued — never free-typed input), dedups globally
(one row per symbol; a prior `failed`/`unsupported` row is reset to `queued`),
and records `requested_by` = the authed user.

**Request:** `{ symbol: string }`  — yfinance format, must be in `listings`

**Response (200):** `{ request: TickerRequest }` (the queued/updated row)

**Errors:**
- `400` — missing `symbol`
- `404` — `{ error }` symbol not in `listings` (not a known US/AU/CA stock)
- `409` — `{ request }` already `covered` (in `stocks`) — nothing to queue
- `401` — not logged in (enforced by `proxy.ts`)

#### `GET /api/request-ticker`

Recent requests + live status for the page's "recent requests" panel.

**Response (200):** `{ requests: TickerRequest[] }` (most recent first)

#### `POST /api/listings/status`

Batch status for the Results "couldn't be scored" strip — drives the smart
per-ticker state (Request / Requested / Not supported / Not covered / No data yet)
so the UI never shows a request control that would just fail on click. Three
parallel admin-client reads (`listings`, `stocks`, `ticker_requests`), one entry
per input symbol. Symbols are upper-cased + deduped; capped at 200.

**Request:** `{ symbols: string[] }` (the run's `unavailable[]`)

**Response (200):** `{ statuses: Record<string, SkippedStatus> }`

**Note — CSV import (`CsvImport.tsx`):** unknown tickers in an uploaded CSV are
**added to the run** (not silently dropped), so they surface here as `unavailable`
and can be requested from the strip. Baskets + the search-add are universe-only, so
CSV is the only Run input that can carry an uncovered ticker.

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

**`profiles.country` drives currency only — never date/timezone display.** Dates shown to a
user (trial end, renewal, deletion date) are rendered in their **device timezone**, not a
country-derived zone. See `coding-standards.md` §16 for the full convention (client-side
`<LocalDate>` on screen; device-zone captured at action time for user-triggered emails;
relative phrasing for cron/webhook emails).

---

## 9. Universe Source & Index Membership

**Universe (what the nightly refresh fetches):** sourced from the **DB**, not static
CSVs. `daily_refresh._load_universe()` reads every ticker in `stocks` (the live,
auto-expanding universe) plus the benchmark indices (`^GSPC`, `^IXIC`, `^AXJO`,
`^GSPTSE`, always included). New names enter the universe via the Request-a-Ticker
drain and the index-membership refresh (below); delisted names simply fail to fetch
(logged). There are **no hand-maintained ticker CSVs**.

**`index_membership` table** — the real constituents of each index, backing the Run
Analysis index baskets:

```sql
index_membership (
  index_id   text,          -- 'sp500' | 'asx200' | 'tsx60'
  ticker     text,          -- yfinance format ('AAPL', 'BHP.AX', 'SHOP.TO')
  is_active  boolean,       -- false when a name drops out of the index (never deleted)
  updated_at timestamptz,
  primary key (index_id, ticker)
)
```

Server-only (RLS enabled, no policies — service-role access, like `stocks` /
`listings`). Refreshed **nightly** by `analytics/cron/refresh_index_membership.py`
from official ETF holdings files — **SPY** (US, State Street `.xlsx`), **IOZ** (AU,
iShares `.csv`), **XIU** (CA, iShares `.csv`); the ETF replicates the index, so its
holdings are the constituents. Each source URL is env-overridable; per-index
sane-count + max-churn guards prevent a bad pull from wiping a basket. The Run page
reads active members via `web/lib/index-membership.server.ts` (cached daily) →
intersected with the universe in `baskets.ts`, so an update is live with **no
redeploy**. Any constituent missing from `stocks` is fetched **directly** by the
same cron run (via `daily_refresh.run`) and audited in `universe_log` as
`added_by='index_membership'` — it does **not** use the `ticker_requests` queue
(that queue is for the user-facing Request-a-Ticker page only; cron-added
constituents never appear there). A name with no data simply isn't added and is
retried next run.

**`split_events` table** — dated state for the smart stock-split pipeline, giving
the owner backend visibility into what the nightly refresh did with each split:

```sql
split_events (
  id             uuid primary key,
  ticker         text references stocks(ticker) on delete cascade,
  split_date     date,          -- yfinance's reported split action date
  ratio          numeric,       -- 'Stock Splits' value (0.3333 = 1-for-3 reverse; 2.0 = 2-for-1)
  status         text,          -- 'pending' | 'resolved' | 'failed'
  detected_at    timestamptz,
  last_repull_at timestamptz,
  repull_count   integer,
  resolved_at    timestamptz,
  cliff_date     date,          -- where the measured discontinuity sits (visibility/debug)
  cliff_ratio    numeric,       -- measured adjacent-day close ratio at the cliff
  updated_at     timestamptz,
  unique (ticker, split_date)
)
```

Written **only by `analytics/cron/daily_refresh.py`**. On detecting a split (via the
provider's `df.attrs['recent_split_events']` = `[{date, ratio}]`, which drops spurious
near-1.0 ratios via the `_MIN_SPLIT_DEVIATION = 0.10` sanity floor — see architecture.md
§Tier 1 and the SPGI 1.057 case) it records a
`pending` row, re-pulls the full `max` history, then **verifies** the price
discontinuity is gone (`_verify_split_resolved`): resolved → `status='resolved'` and
it **stops re-pulling**; still broken after 30 days → `status='failed'`. This is the
C-R9 fix for the **DD** case, where yfinance lists a 1-for-3 reverse split (ratio
0.3333) but never back-adjusts the prices, leaving a ~3× cliff a fresh pull still
returns. **DB-record-only** — no email/notification channel; the `failed` row is the
flag. Server-only (RLS enabled, no policies — service-role access, like `stocks` /
`index_membership`). The re-pull set is driven by the `pending` rows (not the 1-month
incremental window), so a fixed split is never re-pulled again.

---

## 10. Stripe Subscription Schema (F3)

**Stripe is the source of truth; the DB is a synced cache.** One product, addressed
by `lookup_key` (never hard-coded price ids — test and live ids differ, lookup_keys
are stable across both modes):

- **Product `MajorCycle`** (`prod_UrMvM8SaVr5YIl`), two active recurring **multi-currency** prices:
  - **Monthly** — `lookup_key: majorcycle_monthly` — USD $15 / AUD $19 / CAD $20
  - **Annual** — `lookup_key: majorcycle_annual` — USD $126 / AUD $159 / CAD $168 (~30% off)
- The **7-day trial is NOT on the price.** It is applied in checkout code via
  `subscription_data.trial_period_days: 7` (so the abuse guard can drop it for a
  repeat email/card — see plan §6). Currency is fixed per subscription by country:
  `AU→aud`, `CA→cad`, everyone-else→`usd`.
- `automatic_tax: { enabled: false }` at launch (a one-line switch for GST later).

### `profiles` billing columns (all SERVICE-ROLE-ONLY — client-immutable)

Written **only** by the Stripe webhook via the service-role admin client; excluded
from the `authenticated` UPDATE grant (`20260705032433`) so a browser session can
never forge entitlement. Migration `20260523133635` + `20260711000000` +
`20260715000000_f3_stripe_billing`:

| Column | Type | Meaning |
|---|---|---|
| `stripe_customer_id` | text UNIQUE | Stripe `cus_…`. |
| `stripe_subscription_id` | text | Active `sub_…` — portal/cancel/sync. |
| `subscription_status` | text | `trialing`/`active`/`past_due`/`canceled` (our mapped view of Stripe status). |
| `subscription_plan` | text | `monthly`/`annual` (from the Price lookup_key). |
| `subscription_currency` | text | Locked `usd`/`aud`/`cad`. |
| `trial_ends_at` | timestamptz | Stripe `sub.trial_end`. |
| `current_period_end` | timestamptz | Stripe `current_period_end` — "renews on" + delete-during-paid. |
| `cancel_at_period_end` | boolean (default false) | Sub set to end at period end (user cancel / delete-during-paid). |
| `grace_until` | timestamptz | `now()+3d` on `invoice.payment_failed`; `past_due` beyond it hard-locks. |
| `frozen_trial_ms` | bigint | Remaining trial (ms) saved when a *trialing* account is deleted; restored on reactivation. |
| `billing_blocked` | boolean (default false) | Chargeback/fraud dispute revoked access; cleared only if the dispute is won. |
| `trial_reminder_sent` | text | Which trial-ending reminders (day5/day7) already sent — prevents double-send by the cron. |

**Stripe status → our `subscription_status`:** `trialing→trialing`, `active→active`,
`past_due→past_due` (+`grace_until`), `unpaid→` hard-locked (past_due-equivalent),
`canceled→canceled`, `incomplete`/`incomplete_expired`/`paused→ null` (no active sub).
`paused` is defensive only — we don't offer pause, and because the trial requires a card
upfront (decision #19) Stripe won't emit it (that needs a trial ending with no payment
method). **Cancel** has two paths, both handled: *cancel at period end* keeps the status
(`active`/`trialing`) and stores `cancel_at_period_end=true`, then `subscription.deleted`
fires at period end → `canceled`; *immediate cancel* fires `subscription.deleted` directly
→ `canceled`. **Hard-lock rule:** `past_due` AND `now > grace_until` ⇒ the gate denies
access (status stays `past_due`; the gate reads grace). `billing_blocked = true` ⇒ no
access regardless of status. Enforcing these statuses (the paywall gate) is build step 10;
the webhook only *records* them.

### Supporting tables (server-only — RLS on, no policies)

- **`stripe_events`** (`id text pk`, `type text`, `received_at timestamptz`) — webhook
  **idempotency ledger**. Insert-on-first-sight of the Stripe event id; if it already
  exists, the webhook returns 200 and skips (exactly-once side effects).
- **`trial_tombstones`** (`id uuid pk`, `email_hash text`, `card_fingerprint text`,
  `created_at timestamptz`; indexed on both hash columns) — **trial-abuse guard**.
  `sha256(lower(email))` + Stripe card `fingerprint` of consumed trials. **Not** a FK
  to `profiles` — it must survive account deletion so a purged user can't farm a fresh
  free trial. Reused email → no-trial checkout; reused card fingerprint → trial ended
  at the webhook. Written when a trial is first consumed and at purge time.

### Webhook events handled (`/api/stripe/webhook`) — BUILT (F3 step 4, `ec0b441`)

Verified (`constructEvent(rawBody via req.text(), sig, secret)`; bad signature → 400),
idempotent (`stripe_events`: claim the event id; duplicate → 200 skip; a handler throw
releases the claim so Stripe retries), all writes via the service-role admin client.
**Handlers re-derive state straight from the event object — no live Stripe retrieves —
so they're order-independent and replay-safe.** The subscription lifecycle drives the
state sync; checkout just links the customer:

- `customer.subscription.created` / `.updated` — **full sync**: `subscription_status`
  (`mapStripeStatus`), `subscription_plan` (from the item's Price `lookup_key`),
  `subscription_currency` (`sub.currency`), `current_period_end` (from
  `sub.items.data[0].current_period_end` — note: on the ITEM in the pinned API version,
  not the subscription), `cancel_at_period_end`, `trial_ends_at`; a healthy state
  (active/trialing) clears `grace_until`. Resolves the profile via `sub.metadata.user_id`
  (set at checkout) → falls back to `stripe_customer_id`.
- `customer.subscription.deleted` — status `canceled`; clear `stripe_subscription_id`,
  `trial_ends_at`, `grace_until`, `cancel_at_period_end`.
- `invoice.payment_succeeded` / `invoice.paid` — **clear `grace_until`**, and recover
  `past_due → active` **only** (an atomic guarded update, `.eq('subscription_status',
  'past_due')`). It must NOT set `active` unconditionally: a 7-day trial's `$0` invoice is
  marked paid the instant the trial starts, so this fires alongside `subscription.created`
  — forcing `active` here would clobber `trialing` (found + fixed 2026-07-17 by the real
  end-to-end test; the offline contract tests missed it because they fire events singly).
  `customer.subscription.*` stays the authoritative status writer. Profile resolved via
  `invoice.parent.subscription_details.metadata.user_id` → customer.
- `invoice.payment_failed` — status `past_due`; `grace_until = now()+3d`.
- `checkout.session.completed` — **links `stripe_customer_id`** to the user (via
  `client_reference_id`); subscription state itself comes from `subscription.created`.
- `customer.subscription.trial_will_end` — no-op (recorded in `stripe_events` only;
  the primary day-5/day-7 reminders are cron-driven — step 8).

**Deferred by design (subscribed but not yet acted on — TODO markers in the route):**
trial-tombstone write + card-fingerprint guard (step 7); billing emails —
trial-started / payment-failed (step 8); dispute events
(`charge.dispute.created`/`.closed`/`.funds_withdrawn`/`.funds_reinstated` →
`billing_blocked`, step 8). The `charge.dispute.*` and email/tombstone effects above
remain the *target* behaviour; the plan (§3/§6/§7B) is the spec, this list is the
current build state.

Contract-tested by `web/e2e/stripe-webhook.spec.ts` (plan §14) — offline signed events
asserting the `profiles` write, idempotency, and bad-signature rejection.

---

## 11. Disallowed Patterns

- ❌ Storing computed scores (`overall_rating`, `valuation_zone`) in the DB — they're always derived. This includes `analysis_runs`: it persists run **inputs only** (preset, params, tickers, counts, timestamps, status); its `results` column is written `NULL`. The Run Analysis results live in client state and are re-derived on "Re-run".
- ❌ Bypassing the `DataProvider` interface — never call `yfinance` directly anywhere except inside `yfinance_provider.py`
- ❌ Adding fields to `FundamentalsSnapshot` or `EnrichedData` without updating BOTH the Python dataclass AND the TS type in the same commit
- ❌ Storing camelCase keys in Supabase — always snake_case at the DB boundary
- ❌ Returning raw provider responses to the frontend — always go through the canonical shapes
- ❌ Calling `fetch_enriched_data` on every cron run — the `_should_fetch_enriched` helper in `daily_refresh.py` is the single gatekeeper; bypass it only via `--mode full`
- ❌ Storing `next_earnings_date` anywhere other than `stocks.next_earnings_date` — it is the source of truth for the staleness check and the future earnings calendar UI

---

## 12. Database access & Row-Level Security

- **`profiles` is created automatically** by the `handle_new_user` trigger on `auth.users` (every sign-in method). Do not insert profiles from the client; only **update own row** (RLS policy `users update own profile`).
- **RLS is on for every table.** `profiles` + `analysis_runs` have per-user policies (own-row). `stocks` / `price_bars` / `universe_log` / `listings` / `ticker_requests` / `index_membership` / `split_events` have RLS enabled with **no policies** — read/write them **only server-side with the service-role key** (`createAdminClient` / the Python service client), never with the browser anon client. The `/api/listings/search` + `/api/request-ticker` routes gate on the authed user (server client) then touch `listings` / `ticker_requests` via `createAdminClient`.
- The `get_price_bars_json(p_ticker)` RPC is the one-request way to read a ticker's full history (bypasses the 1000-row cap); it's service-role only. Schema lives in `supabase/migrations/` (mirrors the Supabase migration log).
- **Account deletion (F2 Part B).** `profiles.deletion_scheduled_at timestamptz` marks a soft-deleted account: set = scheduled for permanent purge at that time (30-day grace); `NULL` = active. It is **service-role-only** — deliberately excluded from the authenticated column-UPDATE grant (`20260705032433`), so only the server (delete action / reactivation / the purge route) can set or clear it. The hard delete runs `admin.auth.admin.deleteUser(id)` and cascades: `auth.*` + `profiles` (`ON DELETE CASCADE`) + `analysis_runs` (CASCADE); `universe_log.added_by_user` and `ticker_requests.requested_by` are **`ON DELETE SET NULL`** (audit breadcrumbs kept, the user reference nulled). Migration `20260711000000_account_deletion.sql` flipped `universe_log`'s FK from `NO ACTION`→`SET NULL` — it was the last constraint that would have blocked a delete. The daily **`/api/cron/purge-accounts`** route (Vercel Cron, guarded by `CRON_SECRET` via the `Authorization: Bearer` header) purges rows whose `deletion_scheduled_at` has passed, emailing the branded "account deleted" notice first.
- **Stripe billing (F3).** The eight billing columns added to `profiles` by
  `20260715000000_f3_stripe_billing` (`stripe_subscription_id`, `subscription_currency`,
  `current_period_end`, `cancel_at_period_end`, `grace_until`, `frozen_trial_ms`,
  `billing_blocked`, `trial_reminder_sent`) — like the pre-existing `subscription_status`
  / `subscription_plan` / `trial_ends_at` / `stripe_customer_id` — are **service-role-only**:
  deliberately excluded from the authenticated column-UPDATE grant (`20260705032433`), so
  only the Stripe webhook (service-role admin client) writes them. This is the anti-freeload
  backbone: entitlement is server-derived Stripe truth the browser cannot forge. The two new
  tables **`stripe_events`** (webhook idempotency) and **`trial_tombstones`** (trial-abuse
  guard; **not** a FK to `profiles` so it outlives a deleted account) are server-only —
  **RLS enabled, no policies** (service-role access only, like `stocks` / `split_events`);
  their "RLS enabled, no policy" advisor notice is intentional. See §10 for the full schema.
- **Referrals (F2 Part C — refer-a-friend).** `referrals` (`id uuid pk`, `referrer_id uuid → profiles ON DELETE CASCADE`, `friend_email text`, `message text`, `created_at timestamptz`) records one row per invite sent — it powers the per-user daily rate-limit and the duplicate-invite guard, and is a plain audit trail (no rewards/tracking yet — deferred to F3). **RLS: owner-only** `select` + `insert` (`auth.uid() = referrer_id`); **no `update`/`delete` policy** (immutable) and a deleted account's rows cascade away. Unlike the server-only tables, this one **is written with the user's own session client** (the RLS `insert` check enforces `referrer_id = auth.uid()`). Migration `20260712000000_referrals.sql`. The `sendReferral` server action layers the app-level guards on top (honeypot, email validity, required referrer name, no self-referral, ≤10/day, no re-invite within 30 days) and only records a **successful** email send.

---

**End of data-contracts.md.**
