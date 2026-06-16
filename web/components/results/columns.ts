// Column + band model for the Results screener.
//
// Pure data only (no JSX) so it can be shared by the table renderer, the column-
// group toggles, the advanced filter builder, and the CSV export. Every field is
// derived from a `ResultRow` — a CycleAnalysis enriched with the light universe
// index's name/sector/market plus a computed cycle position. No fundamentals are
// available in the analyze payload, so the reference's Price&Analyst / Ratios /
// Profitability / Growth bands intentionally don't exist here (cycle-only scope,
// owner-approved). The rich metrics live one click away on each stock's detail page.

import type { CycleAnalysis, Market } from '@/lib/types';
import { cyclePosition } from '@/lib/ratings';

export interface ResultRow extends CycleAnalysis {
  name: string | null;
  sector: string | null;
  market: Market;
  /** 0–100 cycle position (computed once at row build); null when undefined. */
  cyclePos: number | null;
}

/** Enrich raw analyze results with name/sector/market + cycle position. */
export function buildRows(
  results: CycleAnalysis[],
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

/** Fallback market inference when a ticker isn't in the cached universe index. */
function marketFromTicker(ticker: string): Market {
  if (ticker.endsWith('.AX')) return 'au';
  if (ticker.endsWith('.TO')) return 'ca';
  return 'us';
}

export type BandKey = 'identity' | 'price' | 'verdict' | 'majorCycle';
export type FieldType = 'numeric' | 'categorical' | 'text';
export type CellKind = 'ticker' | 'overall' | 'valuation' | 'health' | 'cyclePos' | 'default';
export type Fmt = 'money' | 'pct' | 'pct1' | 'int' | 'score' | 'text';

export interface Field {
  key: string;
  label: string;
  /** "Title|body" header tooltip, plain text. */
  tip?: string;
  type: FieldType;
  /** Present when the field is a visible table column. */
  band?: BandKey;
  cell: CellKind;
  fmt: Fmt;
  align: 'left' | 'right';
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
  price: {
    label: 'Price',
    tip: 'Price|The latest closing price, in the stock’s home currency.',
    cssClass: 'band-price',
  },
  verdict: {
    label: 'MajorCycle Verdict',
    tip: 'MajorCycle Verdict|Our composite scores — Overall Rating, Valuation, Financial Health and Cycle Payoff — plus where the stock sits in its drawdown cycle.',
    cssClass: 'band-verdict',
  },
  majorCycle: {
    label: 'Major Cycle',
    tip: 'Major Cycle|Output of the Major Cycle engine — historical dip depth and recovery statistics from every confirmed cycle in the stock’s price history.',
    cssClass: 'band-growth',
  },
};

export const FIELDS: Field[] = [
  // Identity
  { key: 'ticker', label: 'Ticker', type: 'text', band: 'identity', cell: 'ticker', fmt: 'text', align: 'left', get: (r) => r.ticker, filterable: false },
  { key: 'name', label: 'Company', type: 'text', band: 'identity', cell: 'default', fmt: 'text', align: 'left', get: (r) => r.name, filterable: false },
  { key: 'sector', label: 'Sector', type: 'categorical', band: 'identity', cell: 'default', fmt: 'text', align: 'left', get: (r) => r.sector, filterable: true },

  // Price
  { key: 'close', label: 'Close', tip: 'Close|Most recent daily closing price, in the stock’s home currency.', type: 'numeric', band: 'price', cell: 'default', fmt: 'money', align: 'right', get: (r) => r.currentClose, filterable: true },

  // Verdict
  { key: 'overall', label: 'Overall', tip: 'Overall Rating|Our 0–100 summary: Financial Health (40%) + Valuation (35%) + Cycle Payoff (25%). 80+ High Conviction · 65+ Constructive · 50+ Neutral · 35+ Cautious · below Bearish.', type: 'numeric', band: 'verdict', cell: 'overall', fmt: 'score', align: 'left', get: (r) => r.overallRating, filterable: true },
  { key: 'valuation', label: 'Valuation', tip: 'Valuation Score|0–100 cycle-position score, quality-gated by Financial Health. Higher = more discounted versus the stock’s own history.', type: 'numeric', band: 'verdict', cell: 'valuation', fmt: 'score', align: 'left', get: (r) => r.valuationScore, filterable: true },
  { key: 'health', label: 'Health', tip: 'Financial Health Score|0–100 across five pillars — profitability, balance sheet, growth, cash flow and shareholder returns. Higher = a stronger underlying business.', type: 'numeric', band: 'verdict', cell: 'health', fmt: 'score', align: 'left', get: (r) => r.financialHealthScore, filterable: true },
  { key: 'cyclePayoff', label: 'Cycle Payoff', tip: 'Cycle Payoff|Signal reliability plus reward-to-risk from the stock’s historical cycles. Higher = a more dependable, better-paying dip-and-recover pattern.', type: 'numeric', band: 'verdict', cell: 'default', fmt: 'score', align: 'right', get: (r) => r.cyclePayoffScore, filterable: true },
  { key: 'cyclePos', label: 'Cycle Position', tip: 'Cycle Position|0 = near a recent peak, 100 = at the stock’s typical worst-case dip. Higher = deeper into its historical drawdown band.', type: 'numeric', band: 'verdict', cell: 'cyclePos', fmt: 'int', align: 'left', get: (r) => r.cyclePos, filterable: true },

  // Major Cycle
  { key: 'currentDD', label: 'Current DD%', tip: 'Current Drawdown %|How far the stock is below its recent peak right now.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct', align: 'right', get: (r) => r.currentDrawdownPct, filterable: true },
  { key: 'typicalDD', label: 'Typical DD%', tip: 'Typical Drawdown %|The average dip depth across the stock’s confirmed historical pullbacks.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct', align: 'right', get: (r) => r.typicalDrawdown, filterable: true },
  { key: 'lowerBound', label: 'Lower Bound%', tip: 'Lower Bound %|The deeper end of the typical drawdown band — a historically severe (but not unprecedented) dip.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct', align: 'right', get: (r) => r.lowerBound, filterable: true },
  { key: 'pullbacks', label: 'Pullbacks', tip: 'Pullbacks|Number of confirmed pullback events found in the price history — more events = a more reliable typical-dip estimate.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'int', align: 'right', get: (r) => r.totalPullbackEvents, filterable: true },
  { key: 'currentProfit', label: 'Current Profit%', tip: 'Current Profit %|How far the stock is above its recent trough right now.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct', align: 'right', get: (r) => r.currentProfitPct, filterable: true },
  { key: 'typicalProfit', label: 'Typical Profit%', tip: 'Typical Profit %|The average recovery size across the stock’s confirmed historical rallies.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct', align: 'right', get: (r) => r.typicalProfit, filterable: true },
  { key: 'upperBound', label: 'Upper Bound%', tip: 'Upper Bound %|The stronger end of the typical recovery band — a historically large (but not unprecedented) rally.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'pct', align: 'right', get: (r) => r.upperBound, filterable: true },
  { key: 'rallies', label: 'Rallies', tip: 'Rallies|Number of confirmed recovery events found in the price history.', type: 'numeric', band: 'majorCycle', cell: 'default', fmt: 'int', align: 'right', get: (r) => r.totalProfitEvents, filterable: true },

  // Filter-only categorical fields (rendered inside the Overall / Valuation cells,
  // so they're not separate columns — but you can still filter by them).
  { key: 'overallLabel', label: 'Rating Tier', type: 'categorical', cell: 'default', fmt: 'text', align: 'left', get: (r) => r.overallLabel, filterable: true },
  { key: 'valuationZone', label: 'Valuation Zone', type: 'categorical', cell: 'default', fmt: 'text', align: 'left', get: (r) => r.valuationZone, filterable: true },
];

export const FIELD_BY_KEY: Record<string, Field> = Object.fromEntries(
  FIELDS.map((f) => [f.key, f]),
);

/** Ordered band keys, for rendering toggles and header bands left→right. */
export const BAND_ORDER: BandKey[] = ['identity', 'price', 'verdict', 'majorCycle'];

/** Column keys for a band, in display order. */
export function columnsForBand(band: BandKey): Field[] {
  return FIELDS.filter((f) => f.band === band);
}

/** All advanced-filterable fields, in display order. */
export const FILTER_FIELDS: Field[] = FIELDS.filter((f) => f.filterable);

/** The fixed, comprehensive CSV column set (independent of visible columns). */
export const CSV_COLUMNS: ReadonlyArray<{ header: string; get: (r: ResultRow) => string | number | null }> = [
  { header: 'Ticker', get: (r) => r.ticker },
  { header: 'Company', get: (r) => r.name },
  { header: 'Sector', get: (r) => r.sector },
  { header: 'Market', get: (r) => r.market.toUpperCase() },
  { header: 'Close', get: (r) => r.currentClose },
  { header: 'Overall Rating', get: (r) => r.overallRating },
  { header: 'Rating Tier', get: (r) => r.overallLabel },
  { header: 'Valuation Score', get: (r) => r.valuationScore },
  { header: 'Valuation Zone', get: (r) => r.valuationZone },
  { header: 'Health Score', get: (r) => r.financialHealthScore },
  { header: 'Cycle Payoff', get: (r) => r.cyclePayoffScore },
  { header: 'Cycle Position', get: (r) => (r.cyclePos == null ? null : Math.round(r.cyclePos)) },
  { header: 'Current Drawdown %', get: (r) => r.currentDrawdownPct },
  { header: 'Typical Drawdown %', get: (r) => r.typicalDrawdown },
  { header: 'Lower Bound %', get: (r) => r.lowerBound },
  { header: 'Pullback Events', get: (r) => r.totalPullbackEvents },
  { header: 'Current Profit %', get: (r) => r.currentProfitPct },
  { header: 'Typical Profit %', get: (r) => r.typicalProfit },
  { header: 'Upper Bound %', get: (r) => r.upperBound },
  { header: 'Rally Events', get: (r) => r.totalProfitEvents },
];

/** Format a numeric value for table/CSV display per a field's `fmt`. */
export function formatValue(value: number | string | null, fmt: Fmt): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  switch (fmt) {
    case 'money':
      return `$${value.toFixed(2)}`;
    case 'pct':
      return `${value.toFixed(1)}%`;
    case 'pct1':
      return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    case 'int':
      return String(Math.round(value));
    case 'score':
      return String(Math.round(value));
    default:
      return String(value);
  }
}
