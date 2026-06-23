// Canonical TypeScript types — mirrors Python dataclasses in analytics/.
// Any change here MUST be reflected in the corresponding Python dataclass in the same commit.

export type Market = 'us' | 'au' | 'ca';
export type Currency = 'USD' | 'AUD' | 'CAD';

// The three indices whose constituents back the Run Analysis index baskets.
// Membership is sourced nightly into the `index_membership` table (see
// analytics/cron/refresh_index_membership.py) and read by index-membership.server.ts.
export type IndexId = 'sp500' | 'asx200' | 'tsx60';
export type IndexMembership = Record<IndexId, string[]>;
export type ValuationZone = 'DEEP VALUE' | 'VALUE' | 'FAIR' | 'STRETCHED';
export type OverallLabel =
  | 'High Conviction'
  | 'Constructive'
  | 'Neutral'
  | 'Cautious'
  | 'Bearish';
export type AnalystRecommendation =
  | 'Strong Buy'
  | 'Buy'
  | 'Hold'
  | 'Sell'
  | 'Strong Sell';

export interface NewsItem {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
}

export interface FundamentalsSnapshot {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  market: Market;
  currency: Currency;
  exchange: string | null;
  marketCap: number | null;

  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  roa: number | null;
  ebitdaMargin: number | null;

  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  evToEbitda: number | null;
  evToRevenue: number | null;

  revenueGrowthYoy: number | null;
  earningsGrowthYoy: number | null;
  totalRevenue: number | null;

  totalDebt: number | null;
  totalCash: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  interestCoverage: number | null;

  freeCashflow: number | null;
  operatingCashflow: number | null;
  fcfYieldPct: number | null;
  fcfMarginPct: number | null;
  ebitda: number | null;

  dividendYieldPct: number | null;
  payoutRatioPct: number | null;
  sharesChangeYoyPct: number | null;
  shortPctOfFloat: number | null;
  shortRatio: number | null;

  insiderOwnershipPct: number | null;
  institutionOwnershipPct: number | null;

  analystTargetPrice: number | null;
  analystLowPrice: number | null;
  analystHighPrice: number | null;
  analystRecommendation: AnalystRecommendation | null;
  numAnalystOpinions: number | null;

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
  valuationScore: number; // quality-gated (feeds the overall rating)
  valuationScoreRaw: number; // un-gated cycle-position score
  qualityFactor: number | null; // gate multiplier applied (null if no FH to gate by)
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

// A slim, display-only fundamentals subset returned alongside each scored result
// (see web/api/analyze.py `_screener_fundamentals`). Powers the Results screener's
// Analyst / Full views without a second fetch. NOT used by the cycle math.
// `analystRecommendation` is third-party Wall-Street data, shown verbatim (#17).
export interface ScreenerFundamentals {
  pe: number | null;
  peg: number | null;
  roe: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  fcfYieldPct: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  interestCoverage: number | null;
  revenueGrowthYoy: number | null;
  shortPctOfFloat: number | null;
  shortRatio: number | null;
  analystTargetPrice: number | null;
  analystRecommendation: string | null;
  numAnalystOpinions: number | null;
}

// One scored stock from a run: the CycleAnalysis plus the slim fundamentals
// subset. `fundamentals` is optional so older sessionStorage snapshots (written
// before this field existed) still hydrate — those rows just show "—" in the
// Analyst / Full columns.
export type RunResult = CycleAnalysis & { fundamentals?: ScreenerFundamentals };

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinancialStatement {
  labels: string[];
  [key: string]: unknown;
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

export interface AnalyzeRequest {
  tickers: string[];
  preset: 'short' | 'medium' | 'long' | 'custom';
  pullbackThreshold?: number;
  profitThreshold?: number;
  lookbackBars?: number;
}

// One chunk's worth of results from POST /api/analyze. The Run tab chunks the
// user's selection client-side and POSTs each chunk; the function is stateless
// (no DB write, no runId). The client accumulates these and writes a single
// analysis_runs history row itself — see AnalysisRunRecord.
export interface AnalyzeResponse {
  results: RunResult[];
  unavailable: string[];
  startedAt: string;
  finishedAt: string;
}

// A Run Analysis history entry. Persisted in analysis_runs as INPUTS ONLY —
// never the computed CycleAnalysis results (CLAUDE.md #15: scores are always
// derived). Powers the "Last Analysis" / Re-run card.
export interface AnalysisRunRecord {
  id: string;
  preset: 'short' | 'medium' | 'long' | 'custom';
  pullbackThreshold: number;
  profitThreshold: number;
  lookbackBars: number;
  tickers: string[];
  tickerCount: number;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'complete' | 'partial' | 'error';
}

export interface UserProfile {
  id: string;
  email: string;
  country: string | null;
  subscriptionStatus:
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'incomplete'
    | null;
  trialEndsAt: string | null;
  acknowledgedDisclaimerAt: string | null;
  createdAt: string;
}

// --- Request a Ticker (universe expansion via the cron-drained queue) -------
// See docs/data-contracts.md §5 + docs/architecture.md §8 (Tier 4).

export type RequestStatus = 'queued' | 'fetched' | 'unsupported' | 'failed';

/**
 * One hit on the Request-a-Ticker search. `covered` = already in `stocks`
 * (analysable now → link to detail). `requestStatus` = its row in
 * `ticker_requests`, if any — GLOBAL, so every user sees "already requested"
 * and nobody double-queues the same symbol.
 */
export interface ListingHit {
  symbol: string; // yfinance format
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
  requestedAt: string; // ISO 8601
  fetchedAt: string | null;
  lastError: string | null;
}

/**
 * Live status for a symbol the Run couldn't score (the Results "couldn't be
 * scored" strip). Lets the UI show the right state up front instead of only
 * finding out on click: `covered` = in our analysed universe (history still
 * building); `inListings` = a recognised US/AU/CA stock that can be requested;
 * `requestStatus` = its row in the GLOBAL queue, if any. Not in listings + not
 * covered = an unrecognised symbol ("Not covered" — nothing to request).
 */
export interface SkippedStatus {
  inListings: boolean;
  covered: boolean;
  requestStatus: RequestStatus | null;
}
