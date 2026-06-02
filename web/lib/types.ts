// Canonical TypeScript types — mirrors Python dataclasses in analytics/.
// Any change here MUST be reflected in the corresponding Python dataclass in the same commit.

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

export interface AnalyzeResponse {
  results: CycleAnalysis[];
  unavailable: string[];
  runId: string;
  startedAt: string;
  finishedAt: string;
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
