// Column + band model for the Results screener — mirrors the reference's
// VIEW_MODES / COL_DEF / R helpers (reference/original-design.html), but with our
// compliant tier labels (CLAUDE.md #2). Pure data only (no JSX) so it's shared by
// the table renderer, the view-mode switch, the advanced filter builder and CSV
// export.
//
// Cycle fields come from the run's CycleAnalysis; the Price&Analyst / Valuation
// Ratios / Profitability / Growth columns read the slim `fundamentals` subset now
// returned with each result (web/api/analyze.py `_screener_fundamentals`). The
// Analyst column shows the Wall-Street consensus verbatim (third-party data, #17).

import type { Market, RunResult } from '@/lib/types';
import {
  ZONE_DISPLAY,
  cyclePosition,
  fmtAnalyst,
  healthRatingLabel,
  upsidePct,
  valuationAppealLabel,
  type ExportFmt,
} from '@/lib/ratings';

export interface ResultRow extends RunResult {
  name: string | null;
  sector: string | null;
  market: Market;
  /** 0–100 cycle position (computed once at row build); null when undefined. */
  cyclePos: number | null;
}

/** Enrich raw run results with name/sector/market + cycle position. */
export function buildRows(
  results: RunResult[],
  lookup: Record<string, { name: string | null; sector: string | null; market: Market }>,
): ResultRow[] {
  return results.map((r) => {
    const meta = lookup[r.ticker];
    return {
      ...r,
      name: meta?.name ?? null,
      sector: meta?.sector ?? null,
      market: meta?.market ?? marketFromTicker(r.ticker),
      cyclePos: cyclePosition(r.currentDrawdownPct, r.lowerBound),
    };
  });
}

function marketFromTicker(ticker: string): Market {
  if (ticker.endsWith('.AX')) return 'au';
  if (ticker.endsWith('.TO')) return 'ca';
  return 'us';
}

export type BandKey =
  | 'identity'
  | 'verdict'
  | 'price'
  | 'majorCycle'
  | 'ratios'
  | 'health'
  | 'growth';
export type ViewMode = 'simple' | 'analyst' | 'full';
export type FieldType = 'numeric' | 'categorical' | 'text';
export type CellKind = 'ticker' | 'overall' | 'valuation' | 'health' | 'cyclePos' | 'analyst' | 'default';
export type TintKind = 'drawdown' | 'roe' | 'fcf' | 'de' | 'peg' | 'upside' | 'positive';
export type Fmt =
  | 'money2'
  | 'money0'
  | 'pct1'
  | 'pctSigned1'
  | 'mult1'
  | 'ratio2'
  | 'int'
  | 'num1'
  | 'score'
  | 'text';

export interface Field {
  key: string;
  label: string;
  /** "Title|body" header tooltip, plain text. */
  tip?: string;
  type: FieldType;
  band?: BandKey;
  cell: CellKind;
  fmt: Fmt;
  align: 'left' | 'right';
  /** Optional colour-tint ladder for the cell value. */
  tint?: TintKind;
  /** Display cap (matches the detail page): |value| beyond this shows ">+cap". */
  cap?: number;
  /** Sort / filter / CSV accessor. */
  get: (r: ResultRow) => number | string | null;
  /** Appears in the advanced-filter field picker. */
  filterable: boolean;
}

export const BAND_META: Record<BandKey, { label: string; tip: string; cssClass: string }> = {
  identity: {
    label: 'Identity',
    tip: 'Identity|Which stock each row is — ticker symbol, company name and market sector.',
    cssClass: 'band-identity',
  },
  verdict: {
    label: 'MajorCycle Verdict',
    tip: 'MajorCycle Verdict|Our three composite scores — Overall, Valuation and Financial Health — plus a gauge of where the stock sits in its drawdown cycle.',
    cssClass: 'band-verdict',
  },
  price: {
    label: 'Price & Analyst Targets',
    tip: 'Price & Analyst Targets|Current price versus the average 12-month Wall-Street price target, plus the consensus recommendation (third-party data).',
    cssClass: 'band-price',
  },
  majorCycle: {
    label: 'Major Cycle',
    tip: 'Major Cycle|Output of the Major Cycle engine — historical dip depth and recovery statistics from every confirmed cycle in the stock’s price history.',
    cssClass: 'band-growth',
  },
  ratios: {
    label: 'Valuation Ratios',
    tip: 'Valuation Ratios|How expensive the stock is relative to earnings and growth. Lower is generally cheaper.',
    cssClass: 'band-ratios',
  },
  health: {
    label: 'Profitability & Health',
    tip: 'Profitability & Health|How profitable, cash-generative and financially sound the underlying business is.',
    cssClass: 'band-health',
  },
  growth: {
    label: 'Growth & Sentiment',
    tip: 'Growth & Sentiment|Sales growth plus short-interest signals from the market.',
    cssClass: 'band-growth',
  },
};

const f = (r: ResultRow) => r.fundamentals;

export const FIELDS: Field[] = [
  // Identity
  { key: 'ticker', label: 'Ticker', type: 'text', band: 'identity', cell: 'ticker', fmt: 'text', align: 'left', get: (r) => r.ticker, filterable: false },
  { key: 'name', label: 'Company', type: 'text', band: 'identity', cell: 'default', fmt: 'text', align: 'left', get: (r) => r.name, filterable: false },
  { key: 'sector', label: 'Sector', type: 'categorical', band: 'identity', cell: 'default', fmt: 'text', align: 'left', get: (r) => r.sector, filterable: true },

  // MajorCycle Verdict
  { key: 'overall', label: 'Overall', tip: 'Overall Rating|Our 0–100 summary: Financial Health (40%) + Valuation (35%) + Cycle Payoff (25%). 80+ High Conviction · 65+ Constructive · 50+ Neutral · 35+ Cautious · below Bearish.', type: 'numeric', band: 'verdict', cell: 'overall', fmt: 'score', align: 'left', get: (r) => r.overallRating, filterable: true },
  { key: 'valuation', label: 'Valuation', tip: 'Valuation Score|Our 0–100 score for how attractively a stock is valued, quality-gated by Financial Health (a cheap-but-weak name is marked down). 80+ Compelling · 65+ Attractive · 50+ Reasonable · 35+ Elevated · below Expensive.', type: 'numeric', band: 'verdict', cell: 'valuation', fmt: 'score', align: 'left', get: (r) => r.valuationScore, filterable: true },
  { key: 'health', label: 'Health', tip: 'Financial Health Score|Our 0–100 score across five pillars — profitability, balance sheet, growth, cash flow and shareholder returns. 80+ Healthy · 60+ Adequate · below At Risk.', type: 'numeric', band: 'verdict', cell: 'health', fmt: 'score', align: 'left', get: (r) => r.financialHealthScore, filterable: true },
  { key: 'cyclePos', label: 'Cycle Position', tip: 'Cycle Position|How deep today’s price sits in the stock’s own historical drawdown band: 0 = near a recent peak, 100 = at its typical worst-case dip. As a rough guide — 75+ Deep Value · 50+ Value · 25+ Fair · below Stretched. Deeper into the band = better value versus its own history.', type: 'numeric', band: 'verdict', cell: 'cyclePos', fmt: 'int', align: 'left', get: (r) => r.cyclePos, filterable: true },

  // Price & Analyst Targets
  { key: 'close', label: 'Close', tip: 'Close|Most recent daily closing price, in the stock’s home currency.', type: 'numeric', band: 'price', cell: 'default', fmt: 'money2', align: 'right', get: (r) => r.currentClose, filterable: true },
  { key: 'target', label: 'Target', tip: 'Analyst Price Target|Average 12-month Wall-Street price target (third-party data).', type: 'numeric', band: 'price', cell: 'default', fmt: 'money0', align: 'right', get: (r) => f(r)?.analystTargetPrice ?? null, filterable: true },
  { key: 'upside', label: 'Upside%', tip: 'Upside to Target%|Percentage gain (or loss) from the current price to the average analyst target.', type: 'numeric', band: 'price', cell: 'default', fmt: 'pctSigned1', align: 'right', tint: 'upside', get: (r) => upsidePct(r.currentClose, f(r)?.analystTargetPrice ?? null), filterable: true },
  { key: 'analyst', label: 'Analyst', tip: 'Analyst Consensus|The consensus recommendation from Wall-Street analysts (third-party data, shown verbatim — not our rating).', type: 'text', band: 'price', cell: 'analyst', fmt: 'text', align: 'left', get: (r) => f(r)?.analystRecommendation ?? null, filterable: false },

  // Major Cycle
  { key: 'currentDD', label: 'Current DD%', tip: 'Current Drawdown %|How far the stock is below its recent peak right now.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct1', align: 'right', tint: 'drawdown', get: (r) => r.currentDrawdownPct, filterable: true },
  { key: 'typicalDD', label: 'Typical DD%', tip: 'Typical Drawdown %|The average dip depth across the stock’s confirmed historical pullbacks.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct1', align: 'right', get: (r) => r.typicalDrawdown, filterable: true },
  { key: 'lowerBound', label: 'Lower Bound%', tip: 'Lower Bound %|The deeper end of the typical drawdown band — a historically severe (but not unprecedented) dip.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct1', align: 'right', get: (r) => r.lowerBound, filterable: true },
  { key: 'pullbacks', label: 'Pullbacks', tip: 'Pullbacks|Number of confirmed pullback events found in the price history — more events = a more reliable typical-dip estimate.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'int', align: 'right', get: (r) => r.totalPullbackEvents, filterable: true },
  { key: 'currentProfit', label: 'Current Profit%', tip: 'Current Profit %|How far the stock is above its recent trough right now.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct1', align: 'right', tint: 'positive', get: (r) => r.currentProfitPct, filterable: true },
  { key: 'typicalProfit', label: 'Typical Profit%', tip: 'Typical Profit %|The average recovery size across the stock’s confirmed historical rallies.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct1', align: 'right', get: (r) => r.typicalProfit, filterable: true },
  { key: 'upperBound', label: 'Upper Bound%', tip: 'Upper Bound %|The stronger end of the typical recovery band — a historically large (but not unprecedented) rally.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct1', align: 'right', tint: 'positive', get: (r) => r.upperBound, filterable: true },
  { key: 'rallies', label: 'Rallies', tip: 'Rallies|Number of confirmed recovery events found in the price history.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'int', align: 'right', get: (r) => r.totalProfitEvents, filterable: true },

  // Valuation Ratios
  { key: 'pe', label: 'P/E', tip: 'Price / Earnings|Share price ÷ earnings per share (trailing). Lower = cheaper relative to earnings.', type: 'numeric', band: 'ratios', cell: 'default', fmt: 'mult1', cap: 150, align: 'right', get: (r) => f(r)?.pe ?? null, filterable: true },
  { key: 'peg', label: 'PEG', tip: 'PEG Ratio|P/E ÷ earnings growth. Below 1 = potentially undervalued for its growth; above ~2.5 getting expensive.', type: 'numeric', band: 'ratios', cell: 'default', fmt: 'ratio2', cap: 25, align: 'right', tint: 'peg', get: (r) => f(r)?.peg ?? null, filterable: true },

  // Profitability & Health
  { key: 'roe', label: 'ROE%', tip: 'Return on Equity %|Net income ÷ shareholder equity. Above ~15% is generally strong.', type: 'numeric', band: 'health', cell: 'default', fmt: 'pct1', cap: 300, align: 'right', tint: 'roe', get: (r) => f(r)?.roe ?? null, filterable: true },
  { key: 'grossMargin', label: 'Gross M%', tip: 'Gross Margin %|(Revenue − COGS) ÷ revenue. Higher = more pricing power.', type: 'numeric', band: 'health', cell: 'default', fmt: 'pct1', cap: 300, align: 'right', get: (r) => f(r)?.grossMargin ?? null, filterable: true },
  { key: 'netMargin', label: 'Net M%', tip: 'Net Margin %|Net income ÷ revenue — cents of profit kept per dollar of sales.', type: 'numeric', band: 'health', cell: 'default', fmt: 'pct1', cap: 300, align: 'right', get: (r) => f(r)?.netMargin ?? null, filterable: true },
  { key: 'fcfYield', label: 'FCF Yld%', tip: 'Free Cash Flow Yield %|Free cash flow ÷ market cap. Above ~4% is generally attractive.', type: 'numeric', band: 'health', cell: 'default', fmt: 'pct1', cap: 100, align: 'right', tint: 'fcf', get: (r) => f(r)?.fcfYieldPct ?? null, filterable: true },
  { key: 'de', label: 'D/E', tip: 'Debt / Equity|Total debt ÷ shareholder equity. Below 0.5 conservative · 0.5–1.5 moderate · above 1.5 highly leveraged.', type: 'numeric', band: 'health', cell: 'default', fmt: 'ratio2', cap: 25, align: 'right', tint: 'de', get: (r) => f(r)?.debtToEquity ?? null, filterable: true },
  { key: 'currentRatio', label: 'Cur Ratio', tip: 'Current Ratio|Current assets ÷ current liabilities. Above 2 very safe · 1–2 adequate · below 1 a liquidity concern.', type: 'numeric', band: 'health', cell: 'default', fmt: 'ratio2', cap: 25, align: 'right', get: (r) => f(r)?.currentRatio ?? null, filterable: true },
  { key: 'interestCov', label: 'Int Cov', tip: 'Interest Coverage|EBIT ÷ interest expense. Above 5× very safe · below 2× financial-stress risk.', type: 'numeric', band: 'health', cell: 'default', fmt: 'mult1', cap: 100, align: 'right', get: (r) => f(r)?.interestCoverage ?? null, filterable: true },

  // Growth & Sentiment
  { key: 'revGrowth', label: 'Rev Grw%', tip: 'Revenue Growth %|Year-over-year sales growth. Quality companies typically grow 10–20%+ per year.', type: 'numeric', band: 'growth', cell: 'default', fmt: 'pct1', cap: 300, align: 'right', get: (r) => f(r)?.revenueGrowthYoy ?? null, filterable: true },
  { key: 'shortPct', label: 'Short%', tip: 'Short % of Float|Percentage of available shares sold short. Below 5% low · 5–15% some caution · above 15% heavy short conviction.', type: 'numeric', band: 'growth', cell: 'default', fmt: 'pct1', align: 'right', get: (r) => f(r)?.shortPctOfFloat ?? null, filterable: true },
  { key: 'daysToCover', label: 'Days Cvr', tip: 'Days to Cover|Short interest ÷ average daily volume. Above ~7 days can fuel a short squeeze.', type: 'numeric', band: 'growth', cell: 'default', fmt: 'num1', align: 'right', get: (r) => f(r)?.shortRatio ?? null, filterable: true },

  // Filter-only categorical fields (rendered inside the Overall / Valuation cells).
  { key: 'overallLabel', label: 'Rating Tier', type: 'categorical', cell: 'default', fmt: 'text', align: 'left', get: (r) => r.overallLabel, filterable: true },
  { key: 'valuationZone', label: 'Cycle Position Zone', type: 'categorical', cell: 'default', fmt: 'text', align: 'left', get: (r) => r.valuationZone, filterable: true },
];

export const FIELD_BY_KEY: Record<string, Field> = Object.fromEntries(
  FIELDS.map((field) => [field.key, field]),
);

// The reference's three view modes → ordered band lists (default Analyst).
export const VIEW_MODES: Record<ViewMode, BandKey[]> = {
  simple: ['identity', 'verdict'],
  analyst: ['identity', 'verdict', 'price', 'majorCycle'],
  full: ['identity', 'verdict', 'price', 'majorCycle', 'ratios', 'health', 'growth'],
};

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  simple: 'Simple',
  analyst: 'Analyst',
  full: 'Full',
};

/** Column fields for a band, in display order. */
export function columnsForBand(band: BandKey): Field[] {
  return FIELDS.filter((field) => field.band === band);
}

/** All advanced-filterable fields, in display order. */
export const FILTER_FIELDS: Field[] = FIELDS.filter((field) => field.filterable);

// The fixed, comprehensive export column set (CSV + Excel), independent of the active
// view. `xf` sets the per-column precision so both exports agree exactly (see
// docs request: scores/counts whole; prices/ratios/percentages 2dp; analyst verbatim
// & proper-cased). Columns without `xf` are text and pass through unchanged.
export const CSV_COLUMNS: ReadonlyArray<{
  header: string;
  get: (r: ResultRow) => string | number | null;
  xf?: ExportFmt;
}> = [
  { header: 'Ticker', get: (r) => r.ticker },
  { header: 'Company', get: (r) => r.name },
  { header: 'Sector', get: (r) => r.sector },
  { header: 'Market', get: (r) => r.market.toUpperCase() },
  { header: 'Overall Rating', get: (r) => r.overallRating, xf: 'int' },
  { header: 'Rating Tier', get: (r) => r.overallLabel },
  { header: 'Valuation Score', get: (r) => r.valuationScore, xf: 'int' },
  { header: 'Valuation Appeal', get: (r) => valuationAppealLabel(r.valuationScore) },
  { header: 'Health Score', get: (r) => r.financialHealthScore, xf: 'int' },
  {
    header: 'Health Rating',
    get: (r) => (r.financialHealthScore == null ? null : healthRatingLabel(r.financialHealthScore)),
  },
  {
    header: 'Data Completeness',
    get: (r) => (r.financialHealthScore == null ? 'Cycle-only (no Financial Health)' : 'Full'),
  },
  { header: 'Cycle Payoff', get: (r) => r.cyclePayoffScore, xf: 'int' },
  { header: 'Cycle Position', get: (r) => r.cyclePos, xf: 'int' },
  { header: 'Cycle Position Zone', get: (r) => ZONE_DISPLAY[r.valuationZone] },
  { header: 'Close', get: (r) => r.currentClose, xf: 'num2' },
  { header: 'Analyst Target', get: (r) => r.fundamentals?.analystTargetPrice ?? null, xf: 'num2' },
  { header: 'Upside %', get: (r) => upsidePct(r.currentClose, r.fundamentals?.analystTargetPrice ?? null), xf: 'num2' },
  { header: 'Analyst Consensus', get: (r) => fmtAnalyst(r.fundamentals?.analystRecommendation ?? null) },
  { header: 'Current Drawdown %', get: (r) => r.currentDrawdownPct, xf: 'num2' },
  { header: 'Typical Drawdown %', get: (r) => r.typicalDrawdown, xf: 'num2' },
  { header: 'Lower Bound %', get: (r) => r.lowerBound, xf: 'num2' },
  { header: 'Pullback Events', get: (r) => r.totalPullbackEvents, xf: 'int' },
  { header: 'Current Profit %', get: (r) => r.currentProfitPct, xf: 'num2' },
  { header: 'Typical Profit %', get: (r) => r.typicalProfit, xf: 'num2' },
  { header: 'Upper Bound %', get: (r) => r.upperBound, xf: 'num2' },
  { header: 'Rally Events', get: (r) => r.totalProfitEvents, xf: 'int' },
  { header: 'P/E', get: (r) => r.fundamentals?.pe ?? null, xf: 'num2' },
  { header: 'PEG', get: (r) => r.fundamentals?.peg ?? null, xf: 'num2' },
  { header: 'ROE %', get: (r) => r.fundamentals?.roe ?? null, xf: 'num2' },
  { header: 'Gross Margin %', get: (r) => r.fundamentals?.grossMargin ?? null, xf: 'num2' },
  { header: 'Net Margin %', get: (r) => r.fundamentals?.netMargin ?? null, xf: 'num2' },
  { header: 'FCF Yield %', get: (r) => r.fundamentals?.fcfYieldPct ?? null, xf: 'num2' },
  { header: 'Debt/Equity', get: (r) => r.fundamentals?.debtToEquity ?? null, xf: 'num2' },
  { header: 'Current Ratio', get: (r) => r.fundamentals?.currentRatio ?? null, xf: 'num2' },
  { header: 'Interest Coverage', get: (r) => r.fundamentals?.interestCoverage ?? null, xf: 'num2' },
  { header: 'Revenue Growth %', get: (r) => r.fundamentals?.revenueGrowthYoy ?? null, xf: 'num2' },
  { header: 'Short % of Float', get: (r) => r.fundamentals?.shortPctOfFloat ?? null, xf: 'num2' },
  { header: 'Days to Cover', get: (r) => r.fundamentals?.shortRatio ?? null, xf: 'num2' },
];

/**
 * Format a value for table display per a field's `fmt`, applying the same display
 * caps as the Stock Detail page (MetricsTable) so the table matches it: a value
 * beyond `cap` shows ">+cap" / "<−cap" instead of an absurd raw figure. Caps are
 * DISPLAY-ONLY — sort/filter/CSV use the true raw value via `Field.get`.
 */
export function formatValue(value: number | string | null, fmt: Fmt, cap?: number): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  const suffix = fmt === 'mult1' ? 'x' : fmt === 'pct1' ? '%' : '';
  if (cap !== undefined && Math.abs(value) > cap) {
    return `${value > 0 ? '>+' : '<−'}${cap}${suffix}`;
  }
  switch (fmt) {
    case 'money2':
      return `$${value.toFixed(2)}`;
    case 'money0':
      return `$${value.toFixed(0)}`;
    case 'pct1':
      return `${value.toFixed(1)}%`;
    case 'pctSigned1':
      return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    case 'mult1':
      return `${value.toFixed(1)}x`;
    case 'ratio2':
      return value.toFixed(2);
    case 'num1':
      return value.toFixed(1);
    case 'int':
    case 'score':
      return String(Math.round(value));
    default:
      return String(value);
  }
}
