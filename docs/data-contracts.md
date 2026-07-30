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

// F3 Step 10 — the paywall splits this in TWO. The free half is what an unentitled
// viewer receives; the premium half is our judgement and is STRIPPED server-side in
// web/api/cycle.py before serialisation (PREMIUM_KEYS), so those bytes never leave the
// server for a free viewer. Nothing is hidden client-side.
//
// STRIPPED IN TWO PLACES, deliberately (added 2026-07-28). web/lib/cycle.ts's
// `stripPremium()` removes the same keys again — in camelCase — at both parse seams of
// `fetchCycleAnalysis` whenever `entitled` is false. Redundant when the API behaves.
// It exists because this object is passed to CLIENT components, so React serialises it
// into the RSC payload embedded in the HTML: withholding a value from the *render* does
// not withhold it from the *page source*. Keep the two lists in step — the Python side
// is pinned by `pnpm check:entitlement-gates`.
//
// Two types rather than making the scored fields optional: /results, /run, RunComplete,
// ReportDocument, columns.ts, filters.ts, OpportunityMap and ResultsTable are all
// premium-only and keep the full `CycleAnalysis` unchanged. Only KpiStrip,
// ThesisInsights and StockHeader accept the union and narrow with `isFullCycle()` —
// and KpiStrip/StockHeader additionally require an `entitled` viewer, so the type guard
// is never the sole control on the two headline scores.
export interface CycleAnalysisFree {
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
}

/** Narrowing guard. Tests `overallLabel` — `overallRating` can legitimately be 0, and
 *  `financialHealthScore` is nullable even for a paying viewer, so neither is safe. */
export function isFullCycle(c: CycleAnalysisFree | CycleAnalysis | null): c is CycleAnalysis;

export interface CycleAnalysis extends CycleAnalysisFree {
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

Single-ticker Major Cycle analysis. Called by the Stock Detail Server Component on every page render. Implemented in `web/api/cycle.py` (Python serverless function); reads price bars and fundamentals from Supabase, runs the cycle math via the vendored `web/_engine/` package, never calls yfinance.

> ⚠️ **INTERNAL ONLY, and NEVER edge-cached (F3 Step 10).** This endpoint used to send
> `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`, which was a
> paywall bypass: `s-maxage` is a *shared*-cache directive keyed on the URL alone, so once
> a server render warmed Vercel's edge with a fully scored payload, any later request —
> no secret, no session — would have been served the paid analysis **before the function
> ran**. It now sends **`Cache-Control: private, no-store`**. Caching is preserved by
> Next's Data Cache (`next: { revalidate: 3600 }` in `web/lib/cycle.ts`), which is
> server-side and can only ever be filled by us.
>
> Every request must carry `x-mc-internal: $CYCLE_INTERNAL_SECRET`. Checked twice — at the
> edge in `web/proxy.ts` (**401**, never a redirect: a 302 would be parsed as JSON by our
> own SSR fetch and blank every cycle section) and authoritatively in `cycle.py`, which
> returns **503** if the env var is unset. It fails CLOSED; there is no "open" fallback.
> `pnpm check:entitlement-gates` fails CI if `s-maxage`/`public` ever returns.

**Query params:**
```typescript
interface CycleQuery {
  ticker: string;                                          // storage format: 'AAPL', 'BHP.AX', 'SHOP.TO'
  preset?: 'short' | 'medium' | 'long' | 'custom';         // default: 'medium'
  pullback?: number;                                       // required if preset === 'custom' (bounds §7)
  profit?: number;                                         // required if preset === 'custom'
  lookback?: number;                                       // required if preset === 'custom'
  entitled?: '0' | '1';                                    // F3 Step 10 — default '0'
}
```

**`entitled` rides in the QUERY STRING, never a header.** Next's Data Cache keys on the
URL alone, so a header-borne flag would let the free and paid variants of the same ticker
collide on one cache entry — a free viewer could be served a scored payload from a
subscriber's earlier render, or vice versa. It is therefore part of the
`fetchCycleAnalysis(ticker, spec, entitled)` signature (required, not optional) so React's
`cache()` dedupe key includes it too. At `entitled=0` the nine premium keys are **absent
from the JSON**, not null — see the response note below.
The Browse page sets the window: named presets via `?preset=`, or a fully custom
window (`?preset=custom&pullback=-7&profit=7&lookback=300`) that the detail page
passes straight through. Custom values are validated to the §7 bounds (else 400);
the result is edge-cached per full query string.

**Response (200):** the `CycleAnalysis` shape from section 3, serialised with snake_case keys (the Python dataclass field names). The frontend converts to camelCase via `web/lib/case.ts` if typed consumption is needed.

At **`entitled=1`** the full shape below. At **`entitled=0`** these nine `PREMIUM_KEYS` are
omitted entirely — `financial_health_score`, `fh_subscores`, `valuation_score`,
`valuation_score_raw`, `quality_factor`, `valuation_zone`, `cycle_payoff_score`,
`overall_rating`, `overall_label`. **Absent, not null**: a null would still tell a scraper
the field exists and let a client distinguish "no score" from "not paid for". The stripping
happens in `_serialise_analysis()` at serialisation time — deliberately *not* by adding an
`include_scoring` flag to the engine, because `analytics/` is mirrored into `web/_engine/`
under a CI drift check and CLAUDE.md #9 makes it sacred. Scoring is pure arithmetic over
already-loaded fundamentals, so computing-then-stripping costs nothing. Sample (`entitled=1`):

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
- `401` — missing or wrong `x-mc-internal` secret (F3 Step 10). Returned by the edge
  (`proxy.ts`) before the function is invoked, and again by `cycle.py` itself. **Never a
  redirect** — a 302 to `/login` would be parsed as JSON by our own SSR fetch.
- `500` — genuine internal error (env var missing, unhandled exception) → `{ "error": "...", "detail": "..." }`
- `503` — `CYCLE_INTERNAL_SECRET` is not configured. Fails **closed** with a loud log rather
  than falling back to "open", which would silently reopen the paywall.

**Caching headers (all responses):** `Cache-Control: private, no-store`. **Never `public`
or `s-maxage`** — see the boxed note at the top of this section. Caching is provided by
Next's Data Cache (`revalidate: 3600`, keyed on the full URL *including* `entitled`).

### `POST /api/analyze`

**Stateless by design (Layer D).** The Run tab chunks the user's selection
client-side (≤ 60 tickers/request) and POSTs each chunk; the function never
writes to the DB and returns **no `runId`**. The client accumulates the chunks,
holds live results in client state (+ `sessionStorage` for the Layer E Results
handoff), and writes **one** `analysis_runs` history row itself — **inputs only**,
never the computed results (CLAUDE.md #15 / §11). Reads price bars + fundamentals
from Supabase and runs the math via the vendored `_engine`; never calls yfinance.
Auth is enforced by `proxy.ts` (this path is not in `PUBLIC_PATHS`).

**Premium-only, and gated in the proxy (F3 Step 10).** The screener has no free form — it
is the highest-value feature and the only one with a meaningful per-use cost — so an
unentitled caller is refused outright with **402**, body `{ error: 'Payment Required',
reason }` where `reason` is the `AccessDenialReason`. The check must live in `proxy.ts`
because `analyze.py` is a Vercel Python function with no way to read a Supabase session
cookie; the proxy has already verified the JWT locally, so it is the session authority. It
costs one PK-indexed profile read, scoped to this path so ordinary page requests never pay
for it. On success the proxy **injects** `x-mc-internal`, and `analyze.py` requires it — so
the function cannot be reached at all except through the gate, even if platform routing
changed underneath us. The dev shim `/api/analyze-dev` is gated identically, so local dev
is never quietly more permissive than production. Client-side, a mid-run 402 raises
`EntitlementLapsedError` and **aborts the whole run** with an upgrade message rather than
retrying and reporting tickers as "unavailable" (audit finding B6).

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
- `401` — not logged in (enforced by `proxy.ts`), or the internal secret is absent/wrong
  (`analyze.py` re-checks the header the proxy injects)
- `402` — **no live subscription** (F3 Step 10). Body `{ error: 'Payment Required', reason }`
  with `reason` ∈ `no_subscription` / `canceled` / `payment_failed` / `billing_blocked`
- `500` — internal — return `{ error: string }`
- `503` — `CYCLE_INTERNAL_SECRET` unset (fails closed, loud log)

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

> **`GET /api/ticker/[symbol]` was specified here but never built, and is not needed.**
> Removed 2026-07-30 after a docs-vs-disk sweep found no `web/app/api/ticker/` directory
> and no caller anywhere in the codebase. The Stock Detail page is a **Server Component**:
> it reads `stocks` + `price_bars` from Supabase directly during the render
> (`fetchStockDetail`), so there is no browser round-trip for a client endpoint to serve.
> Adding one would reintroduce exactly the client-fetch anti-pattern in
> `coding-standards.md` — and, post-paywall, a second surface returning stock data would be
> a second surface needing its own entitlement gate. Don't rebuild it.

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
| `grace_until` | timestamptz | **Single-owner dunning marker** — set `now()+3d` on the FIRST `invoice.payment_failed` (renewal only), cleared only by the paid/succeeded handler + `markCanceled`. `past_due` beyond it hard-locks (step 10). |
| `billing_blocked` | boolean (default false) | Chargeback/fraud dispute revoked access — set by `charge.dispute.created`/`.funds_withdrawn`, cleared only if the dispute is won (`.closed` won / `.funds_reinstated`). |
| `trial_reminder_sent` | text | Set to `'trial_will_end'` when the branded trial-ending reminder is sent (event-driven, ~3 days out) — guards against a double-send on webhook redelivery. |

### `profiles` free-tier counter columns (F3 Step 10 — also service-role-only)

Migration `20260726010000_free_tier_view_counter`. An **anti-scraping fence**, not a
revenue lever: premium fields are already stripped from every response a free viewer gets,
so what is left worth protecting is the *bulk* (walking all ~866 tickers to rebuild the
corpus). Subscribers are never counted — locked decision #18 promises them no usage limits.

| Column | Type | Meaning |
|---|---|---|
| `free_views_date` | date | The UTC day the set below applies to. Null for subscribers. |
| `free_views_tickers` | text[] | Distinct tickers a free user opened on that day; cap **25** (`FREE_VIEW_DAILY_LIMIT`). |

**Why a distinct-ticker SET and not a counter.** `next/link` prefetches on hover/viewport
in production, which *runs the server component* — a plain counter would be burned by
scrolling the Browse list. A set makes prefetch-then-click, a refresh, and any re-visit
cost exactly one view. (Stock links also pass `prefetch={false}`.)

**🔑 What actually makes these unwritable by the user — not what you'd assume.** The
migration's column-level `REVOKE` is only a tripwire: **Postgres cannot subtract a column
from a table-level GRANT**, and `authenticated` does hold table-level SELECT/INSERT on
`profiles`. The real guarantee is that **`authenticated` has no table-level UPDATE at
all** — its UPDATE is granted per column (`display_name`, `country`,
`acknowledged_disclaimer_at`), so any new column is unwritable the moment it is added.
If anyone ever runs `grant update on public.profiles to authenticated`, the counter becomes
user-resettable and the revokes will NOT save you. `check-entitlement-gates.mjs` fails CI
on exactly that statement. (`anon` does hold table-level UPDATE from the Supabase defaults;
not exploitable — the RLS policy requires `auth.uid() = id` and anon has none.)

### Function `record_free_view(p_user_id uuid, p_ticker text, p_limit int)`

Migration `20260726020000`. Returns `(allowed boolean, used int)`. `service_role` EXECUTE
only, `search_path` pinned.

**Why this is a database function and not application code.** The obvious version — read
the array, append in TypeScript, write it back — is read-modify-write across two round
trips, and it is defeated by exactly the traffic this fence exists to stop. A scraper
firing N concurrent requests would have all N read the same stale array, and each write
would clobber the others: the row ends holding one or two tickers while the scraper walked
away with N pages. `select … for update` row-locks the profile so the check and the append
cannot be raced. **Fails OPEN** on a missing profile row — this is a fence, not the
paywall, so denying would be a lie with no security gain.

**Stripe status → our `subscription_status`:** `trialing→trialing`, `active→active`,
`past_due→past_due` (+`grace_until`), `unpaid→` hard-locked (past_due-equivalent),
`canceled→canceled`, `incomplete`/`incomplete_expired`/`paused→ null` (no active sub).
`paused` is defensive only — we don't offer pause, and because the trial requires a card
upfront (decision #19) Stripe won't emit it (that needs a trial ending with no payment
method). **Cancel** has two paths, both handled: *cancel at period end* keeps the status
(`active`/`trialing`) until `subscription.deleted` fires at period end → `canceled`;
*immediate cancel* fires `subscription.deleted` directly → `canceled`.
> ⚠ **API-shape gotcha (found 2026-07-19, FIXED in Step 6):** in the pinned
> `2026-06-24.dahlia` API a cancel-at-period-end leaves `sub.cancel_at_period_end =
> **false**` and instead sets `sub.cancel_at` (= the period/trial end) + `cancellation_details`.
> `syncSubscription` therefore derives "scheduled to cancel" as `sub.cancel_at != null` (the
> deprecated boolean is only a fallback), so the DB records the interim "scheduled" state and
> the account card renders a "…cancels on <date>, won't renew" line. The display date is the
> stored `current_period_end` (== `cancel_at` for a period-end cancel; == `trial_end` for a
> trialing sub). **Hard-lock rule:** `past_due` AND `now > grace_until` ⇒ the gate denies
access (status stays `past_due`; the gate reads grace). `billing_blocked = true` ⇒ no
access regardless of status.

> **Dashboard settings this depends on — read live 2026-07-30, identical in the sandbox.**
> Neither is visible from code, so they are recorded here rather than re-discovered.
>
> - **Revenue recovery → Retries → "If all retries for a payment fail":
>   `cancel the subscription`** (invoice left overdue). So the terminal state is
>   **`canceled`, never `unpaid`** — the `unpaid → past_due` fold in `mapStripeStatus`
>   is insurance that will not fire. The full path: day 0 `invoice.payment_failed` →
>   `past_due` + `grace_until` = +3d (access retained, decision #20) → day 3 grace closes
>   (locked, status unchanged — this is the "Access paused" card) → ~day 14 retries
>   exhausted → `customer.subscription.deleted` → `canceled` (still locked). Fixing the
>   card at any point before that pays the invoice and recovers `past_due → active`.
> - **All five Stripe customer emails are OFF** (trial-ending reminder, upcoming renewals,
>   expiring cards, card-payment failed, bank-debit failed). Deliberate: our branded Resend
>   senders own trial-ending, payment-failed and payment-recovered, and two senders would
>   mean two different dates and two voices for one event. **If any of these is ever
>   switched on, retire our matching sender in the same change.**
> - The one-time "trial over" statement-descriptor message is **off by owner decision**
>   (2026-07-30): the descriptor already names the site, and fewer moving parts wins.

**The gate that enforces all of this is BUILT (F3 Step 10)** — `web/lib/entitlement.ts`,
the single source of truth. The webhook still only *records* status; `hasAccess()` is the
only thing that interprets it, and it fails **closed** (missing profile, unreadable row or
unrecognised status all deny). Enforced at three layers: the `(app)` layout +
`requirePremiumPage()` for premium pages (UX — it reports rather than redirects, and the
page returns `<PremiumLockPage>` in place), `web/proxy.ts` for premium APIs (**402**), and
the Python functions themselves (authoritative — they strip the premium keys and re-check
the internal secret). See `architecture.md` §7.1 for the full rule and the two cache traps.

**Report payload — `GET /stocks/[market]/[ticker]/report/data`.** The one-click "Download
Report" fetches this JSON and wraps it with the prebuilt offline bundle into a single
self-contained `.html`. It is the report's **only** surface (the on-screen preview page was
removed on 2026-07-29 — nothing linked to it). Being a route handler it is *not* wrapped by
the `(app)` layout, so it gates itself: **401** signed out, **402** unentitled (body names
the `reason`), **404** unknown market/ticker, **200** + `ReportData` otherwise. Every branch
sends `Cache-Control: private, no-store` — the 200 carries the full scorecard and even the
402 names the caller's own denial reason, and a shared cache keys on the URL alone
(CLAUDE.md 11a). It sent **no** `Cache-Control` at all until 2026-07-29; the gap was found
by e2e, not by reading the code, and `check:entitlement-gates` now pins it.

### Supporting tables (server-only — RLS on, no policies)

- **`stripe_events`** (`id text pk`, `type text`, `received_at timestamptz`, plus
  traceability columns `user_id uuid` (FK `auth.users` **ON DELETE SET NULL**),
  `stripe_customer_id text`, `stripe_subscription_id text`; indexed on `user_id` +
  `stripe_customer_id`) — webhook **idempotency ledger + audit trail**. Claim the Stripe
  event id via an **`ON CONFLICT DO NOTHING`** upsert
  (`.upsert({id,type},{onConflict:'id',ignoreDuplicates:true}).select('id')`); an empty
  returned array = already processed → 200 skip (exactly-once side effects). Deliberately
  NOT insert-then-catch-23505 — that logged a Postgres `duplicate key` error on every
  legitimate Stripe redelivery (audit 2026-07-18, `907b948`). **After** a successful
  handle, the row is enriched with the resolved `user_id`/customer/subscription (F3 Step 6,
  best-effort — a failed enrich never 500s), so a post-launch issue is one
  `select … where user_id = …` instead of guesswork. The `ON DELETE SET NULL` keeps the
  audit row after an account purge.
- **`trial_tombstones`** (`id uuid pk`, `email_hash text`, `created_at timestamptz`; indexed
  on `email_hash`) — **trial-abuse guard (Step 7)**.
  Enforcement is by `email_hash` = `sha256(lower(trim(email)))` (`web/lib/trialGuard.ts`):
  written once a subscription goes trialing (in `syncSubscription`) and at purge; read at
  checkout (omit `trial_period_days` for a repeat email) and on the account/pricing UI to
  show the honest "already used your free trial — billed today, no free week" copy *before*
  payment. **Not** a FK to `profiles` — it must survive account deletion so a purged user
  can't farm a fresh free trial. The same-card-across-different-emails vector would be Stripe
  Radar's Free-trial-abuse control, but that's deliberately **left off** (its prerequisite bills
  a per-signup SetupIntent fee; owner chose the free email guard 2026-07-20) — an **accepted
  gap** covered only by base Radar's always-on high-risk blocking + the enabled CVC-fail/
  postal-fail Radar rules. So the originally reserved `card_fingerprint` column + its index were
  **dropped as dead** (`20260720120000_drop_trial_tombstones_card_fingerprint`; never written or
  read, and the index was flagged unused by the Supabase performance advisor).

### Webhook events handled (`/api/stripe/webhook`) — BUILT (F3 step 4, `ec0b441`)

Verified (`constructEvent(rawBody via req.text(), sig, secret)`; bad signature → 400),
idempotent (`stripe_events`: claim the event id via ON CONFLICT DO NOTHING; duplicate →
200 skip; a handler throw releases the claim so Stripe retries), all writes via the
service-role admin client.
**Handlers re-derive state straight from the event object — no live Stripe retrieves —
so they're order-independent and replay-safe.** The subscription lifecycle drives the
state sync; checkout just links the customer:

- `customer.subscription.created` / `.updated` — **full sync**: `subscription_status`
  (`mapStripeStatus`), `subscription_plan` (from the item's Price `lookup_key`),
  `subscription_currency` (`sub.currency`), `current_period_end` (from
  `sub.items.data[0].current_period_end` — note: on the ITEM in the pinned API version,
  not the subscription), `cancel_at_period_end`, `trial_ends_at`. **Does NOT touch
  `grace_until`** (that is single-owner — see below). Resolves the profile via
  `sub.metadata.user_id` (set at checkout) → falls back to `stripe_customer_id`.
- `customer.subscription.deleted` — status `canceled`; clear `stripe_subscription_id`,
  `trial_ends_at`, `grace_until`, `cancel_at_period_end`. **Guarded on the sub id**
  (`WHERE stripe_subscription_id = sub.id OR IS NULL`) so an out-of-order deletion of an *old*
  subscription can't lapse a *newer* active one the user has since started.
- `invoice.payment_succeeded` / `invoice.paid` — recover `past_due → active` **only** (an
  atomic guarded update, `.eq('subscription_status','past_due')`; never forces `active`, so
  a 7-day trial's `$0` invoice can't clobber `trialing`). Then **clear `grace_until` with a
  guarded update** (`WHERE grace_until IS NOT NULL`): a returned row means we recovered from
  a real failure → send the branded **payment-recovered** email. Of the two events (both
  fire for one payment), only the first to clear grace emails; the second no-ops. A normal
  renewal / the $0 trial invoice never set grace, so no email. Both updates are also guarded
  on `stripe_subscription_id = <invoice's sub>` (skip if the invoice has no sub) so an
  *old/superseded* sub's payment can't recover a *different* current subscription. Profile
  resolved via `invoice.parent.subscription_details.metadata.user_id` → customer.
- `invoice.payment_failed` **and `invoice.payment_action_required`** — a renewal that's
  declined *or* needs off-session authentication (e.g. 3-D Secure) both land the sub in
  `past_due` and share this dunning path. **Renewals only** (skip `billing_reason =
  subscription_create`, the signup charge Checkout owns). Set `past_due` + anchor
  `grace_until = now()+3d`, both guarded on `stripe_subscription_id = <invoice's sub>` (and
  the grace anchor also `WHERE grace_until IS NULL`) so it fires exactly once on the first
  failure regardless of event ordering, and a stale/old failure — or one arriving *after*
  cancellation (sub id now null) — can't lock a cancelled or newer-active account → send the
  branded **payment-failed / update-card** email. ⚠ The LIVE webhook endpoint must include
  `invoice.payment_action_required` in its event list (sandbox `stripe listen` forwards all).
- `checkout.session.completed` — **links `stripe_customer_id`** to the user (via
  `client_reference_id`); subscription state itself comes from `subscription.created`.
- `customer.subscription.created` — syncs the new subscription, then — **only when the new
  sub is `trialing`** (and not already scheduled to cancel) — sends the branded **trial-started
  welcome** email (`sendTrialStartedEmail`). Fires exactly once (the `.created` event is
  one-shot; `stripe_events` dedups a redelivery; Resend `Idempotency-Key = <event.id>:trial_started`).
  A repeat customer whose trial was already used is created straight into `active`/`incomplete`
  → no welcome; they get Stripe's payment receipt instead (see receipts note below). No new
  DB column — the `trialing` status on the created event is the single-fire signal.
- `customer.subscription.trial_will_end` — fires ~3 days out → send the branded
  **trial-ending** reminder and set `trial_reminder_sent = 'trial_will_end'`. **Skipped** if
  `sub.cancel_at != null` (the user cancelled during the trial — no charge is coming).
  Because this reminder is Stripe's **one-time** ~3-days-out signal and is suppressed while a
  trial is scheduled to cancel, `reactivateAccount` (in `account/actions.ts`) fills the gap: if
  a reactivation un-cancels a *trialing* sub inside the last 3 days of its trial and the
  reminder wasn't already sent, it sends the branded trial-ending email then (idempotency-keyed;
  `trial_reminder_sent` set first). Earlier reactivations need nothing — the normal event fires
  again once `cancel_at` is cleared.
- `charge.dispute.created` / `.funds_withdrawn` — set `billing_blocked = true`, but only for
  a **real chargeback** (funds moved / status not `warning_*`); a mere inquiry doesn't lock a
  legit customer. `charge.dispute.closed` — won ⇒ `billing_blocked = false`; lost ⇒ keep
  blocked **and cancel the subscription** so it can't renew. `charge.dispute.funds_reinstated`
  ⇒ `billing_blocked = false`. The `Dispute` object carries no customer, so these are the ONE
  place the webhook does a live Stripe retrieve (charge → customer); best-effort.
- **Step 7 (done):** `syncSubscription` writes the email trial-tombstone once the sub is
  trialing (the card-fingerprint guard was dropped — that vector is Stripe Radar's job).

**Branded billing emails (four, all in `web/lib/email/billingEmails.ts`):** trial-started
welcome (`subscription.created`, trialing) · trial-ending reminder (`trial_will_end`, or the
reactivation gap-fill) · payment-failed (first renewal failure) · payment-recovered. Copy uses
relative date phrasing ("soon" / "a few days beforehand") — no device date at webhook time — so
the trial-ending line is also correct on the reactivation path where days-remaining can vary.

**Payment receipts / invoices are NOT app code — they're Stripe's, via a Dashboard toggle.**
Subscriptions auto-generate an invoice per charge; enabling **Settings → Emails → "Successful
payments"** makes Stripe email a branded receipt (with a downloadable invoice PDF link) after
every *real* charge — trial-conversion + each renewal. Stripe does **not** send a receipt for the
$0 trial-start invoice, so this never spams and never overlaps the welcome email. The Customer
Portal (`/api/portal`) also lists every past invoice for download on demand. This toggle is
**LIVE-only** (sandbox never sends Stripe customer emails) → flip it in the Part C do-together
dashboard pass near merge, alongside turning **off** Stripe's own trial-ending + failed-payment
customer emails (so they don't collide with our branded ones).

**`grace_until` is the single-owner dunning marker** — set only by `invoice.payment_failed`,
cleared only by the paid/succeeded handler + `markCanceled`. This one-writer discipline (plus
gating both dunning emails on its transitions, and making each email the last best-effort
action in its handler) is what makes the emails ordering-proof and duplicate-proof despite
Stripe not guaranteeing event order. Each send also carries a Resend `Idempotency-Key`
(`<event.id>:<type>`) as a second guarantee.

Contract-tested by `web/e2e/stripe-webhook.spec.ts` (plan §14) — offline signed events
asserting the `profiles` write, idempotency, and bad-signature rejection. **Also
live-verified end-to-end** (2026-07-18): real Stripe Checkout (test card 4242) →
`stripe listen` forwarded the event storm [200] → `/account` flipped to Trial Active.

### Customer Portal — `POST /api/portal` — BUILT (F3 step 5, `89424af`)

Auth-gated (NOT in `PUBLIC_PATHS`). `getUser` → read `profiles.stripe_customer_id` →
`stripe.billingPortal.sessions.create({ customer, return_url: origin+'/account' })` →
**303 redirect** to the hosted portal. No customer on file → `/account?billing=none`;
Stripe error (usually "no portal config in this Stripe mode") → `console.error` +
`/account?billing=error`. The `/account` "Manage billing" button is a plain form POST
(no client JS, no Stripe key in the browser). **The portal must be activated per Stripe
mode** (sandbox config `bpc_1TuR6R…`: update/cancel-at-period-end/payment/invoice).

**Stripe client** (`web/lib/stripe.ts`) sets `maxNetworkRetries: 2` (SDK default 0;
retried POSTs get automatic idempotency keys).

### Upgrade-dialog context — `GET /api/billing-context` — BUILT (F3 step 10)

Auth-gated. Returns exactly what the upgrade dialog needs to offer the right thing:

```ts
{
  currency: BillingCurrency;
  trialUsed: boolean;
  hasSubscription: boolean;
  billingBlocked: boolean;
  email: string | null;
  displayName: string | null;
}
```

- `hasSubscription` — `subscription_status ∈ {active, trialing, past_due}`. CTA becomes
  **Manage your plan** → `/account`; no trial is offered and `StartTrialModal` isn't rendered.
- `trialUsed` — the Step 7 email tombstone. CTA becomes **Subscribe**, and the modal states
  that billing starts today with no free week. **Skipped** (returned `false`) when
  `hasSubscription`, which also avoids a pointless admin-client read for the common case.
- `currency` — same resolver as `/pricing` and `/api/checkout` (see above).
- `billingBlocked` — the dispute hold, and it **outranks every field above it**. It is an
  orthogonal flag, not a status: a held account keeps its Stripe status, so `hasSubscription`
  can be `true` while the reader is locked out. The dialog keys its entire copy off this —
  no feature pitch, no plan list, **Contact support** instead of any buy button, because
  `/api/checkout` and `/api/portal` both refuse a held account.
- `email` / `displayName` — prefill for the in-place `SupportDialog`, so a locked reader
  doesn't retype what we already hold.

Sends `Cache-Control: private, no-store` — per-viewer billing state must never reach a
shared cache (CLAUDE.md 11a). Signed-out callers never reach the handler: `proxy.ts`
redirects them to `/login` first.

> **Not a source of truth.** `POST /api/checkout` independently re-derives all three and
> remains the authority — it 409s a caller who already has a subscription and omits
> `trial_period_days` for a tombstoned email regardless of what this endpoint said. This
> exists so the UI can be honest *before* the click; a failed fetch degrades to an
> `/account` link rather than to a wrong offer. **In flight is a third state**, distinct
> from failed: the CTA is a disabled "Checking your plan…" button, never a live control
> carrying a guessed default (see coding-standards).

### Billing currency resolution + trial entry (F3, `e30c7aa` / `767c9da`)

- **One currency resolver, four call sites.** `effectiveBillingCountry(saved, edge)`
  (`web/lib/stripe.ts`) → `currencyForCountry` (AU→aud/CA→cad/else usd). Precedence:
  `profiles.country` → Vercel `x-vercel-ip-country` edge header → USD. Used identically by
  `/pricing`, the account **Start-free-trial** modal, `GET /api/billing-context` (which
  feeds that same modal when it is opened from a lock), and `POST /api/checkout`, so the
  displayed price always equals the charged currency (Stripe locks a subscription's
  currency at creation, so a display/charge drift would be unfixable after the fact).
- **`POST /api/checkout` persists the resolved country** when `profiles.country` was empty
  — before creating the session — so the (soon-locked) stored country matches the charged
  currency. Written with the user's own cookie-bound client (not yet subscribed → not
  locked). Non-fatal on failure (logs, continues).
- **Country auto-fill:** the account page passes the edge-detected country to
  `ProfileForm` as `suggestedCountry` (pre-selects the dropdown as a *changeable default*
  when nothing is saved; the saved baseline stays empty so it's savable in one click).
  Never written until the user saves or starts a trial. **Only observable on live/preview**
  — the edge header is empty on localhost.
- **Start-free-trial modal:** `web/components/account/StartTrialModal.tsx` +
  `StartTrialButton.tsx` reuse the Methodology modal's shell (blurred backdrop, gradient
  header, disclaimer footer) with the plan chooser + `/api/checkout` hand-off. It is the
  ONLY in-app entry to checkout — the public `/pricing` page is a marketing/SEO
  shop-window for signed-out visitors and **redirects a signed-in one to `/account`**
  (2026-07-29), so it never has to reason about anybody's billing state.

### Returning from Checkout — `/account?checkout=…` (F3 Step 10, `b2d2343`)

`success_url` = `/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
`cancel_url` = `/account?checkout=cancelled` (both land inside the app — a signed-in user
must never be returned to the public shop-window).

**Why the session id is there.** Stripe sends `checkout.session.completed` *before*
redirecting and holds the redirect for our 2xx — **but only 10 seconds**. A slow, failing
or misconfigured webhook would therefore land a customer who has just paid on a page
reading "No plan", beside a button inviting them to subscribe again. So `/account` calls
`reconcileCheckoutSession()` (`web/lib/billing/reconcileCheckout.ts`) **before** it reads
the profile:

1. Retrieve the Checkout Session from Stripe.
2. **Refuse** unless its own `client_reference_id`/`metadata.user_id` (stamped by
   `/api/checkout`) matches the signed-in caller — `session_id` arrives in the URL bar and
   is never treated as proof. A forged id grants nothing (asserted by e2e).
3. Require `session.status === 'complete'`. Note `payment_status` is
   **`no_payment_required`** for a 7-day trial — no money has moved yet — so treating that
   as unpaid would refuse exactly the flow we sell.
4. Link `stripe_customer_id`, then **re-retrieve the subscription** from Stripe (never the
   session's embedded copy, so a stale session can't overwrite newer state) and apply
   `syncSubscription()`.

**It is not a second source of truth.** `syncSubscription()` is the *same* function the
webhook uses — which is why it lives in `web/lib/billing/sync.ts` rather than inside the
webhook route. Two derivations of "who has paid" would drift. Re-running after the webhook
already ran writes identical values. The webhook remains the guarantee (it runs even if the
customer closes the tab, and Stripe retries it for three days); this only removes the wait.

Best-effort throughout: it runs during a page render, and a Stripe outage must never turn
"your payment worked" into an error page. `/account` shows "Payment received — your plan is
set up below", or after cancelling, "You haven't been charged."

### Local webhook testing (F3, `120501d`)

- `pnpm stripe:listen` (`web/scripts/stripe-listen.mjs`) forwards Stripe webhooks to the
  local dev server. It forces the **sandbox** account by reading `STRIPE_SECRET_KEY` from
  `web/.env.local` and passing it as `STRIPE_API_KEY` (env, not argv; never printed),
  sidestepping the Stripe-CLI-default-account gotcha. Run it from `web/` with the dev server up.

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
- **Stripe billing (F3).** The billing columns added to `profiles` by
  `20260715000000_f3_stripe_billing` (`stripe_subscription_id`, `subscription_currency`,
  `current_period_end`, `cancel_at_period_end`, `grace_until`,
  `billing_blocked`, `trial_reminder_sent`; the original `frozen_trial_ms` was dropped in
  `20260719120000_drop_frozen_trial_ms` — see Step 6/7) — like the pre-existing `subscription_status`
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
