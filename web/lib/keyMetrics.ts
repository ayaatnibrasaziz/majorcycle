/**
 * The Key Metrics table's rows — the ONE definition of each metric (Layer H6a).
 *
 * Read by `components/stocks/MetricsTable.tsx` (the table, on the page and in the
 * offline report) and by `lib/medians.server.ts` (the peer medians it compares
 * against). Until 2026-09-25 each kept its own copy: the table held the display
 * caps and the medians module held "OUTLIER_BOUND", a second list of the same
 * numbers under a comment promising they "mirror" each other. Twelve new rows
 * would have doubled the room for the two to part company, so the cap now lives
 * here once and the outlier bound IS the cap (CLAUDE.md 11c: one rule, one place).
 *
 * Also builds the table (`buildKeyMetricsTable`), so e2e/key-metrics.spec.ts can
 * drive the real formatting and verdicts. Pure — no React, no I/O, type-only
 * imports from the server module: the offline report bundles this with esbuild,
 * and the medians module imports it on the server (11d).
 *
 * Design approved by the owner 2026-09-14 — `docs/layer-h-plan.md` §10 and
 * claude.ai/code/artifact/287083d9. Row order follows that artifact.
 */
import { PAYOUT_DISPLAY_CAP } from '@/lib/dividends';
import type { MedianTables, MetricMedians } from '@/lib/medians.server';
import type { FundamentalsSnapshot } from '@/lib/types';

/** Metrics where a cross-peer median comparison is meaningful. */
export type MetricKey =
  | 'pe'
  | 'forwardPe'
  | 'peg'
  | 'priceToBook'
  | 'priceToSales'
  | 'evToEbitda'
  | 'evToRevenue'
  | 'fcfYieldPct'
  | 'grossMargin'
  | 'ebitdaMargin'
  | 'operatingMargin'
  | 'netMargin'
  | 'fcfMarginPct'
  | 'roe'
  | 'roa'
  | 'revenueGrowthYoy'
  | 'earningsGrowthYoy'
  | 'debtToEquity'
  | 'currentRatio'
  | 'quickRatio'
  | 'payoutRatioPct'
  | 'sharesChangeYoyPct'
  | 'beta'
  | 'shortPctOfFloat'
  | 'shortRatio';

// ⚠️ A COMPILE ERROR, not a blank row, if a key is not a real field. The table
// reads `fundamentals[key]`; a misspelt key reads `undefined`, and `MetricsTable`
// omits a row with no value — so a typo here would ship a row that silently never
// appears, on every stock, with nothing red anywhere.
type KeyIsAField = MetricKey extends keyof FundamentalsSnapshot ? true : never;
export const KEYS_ARE_FIELDS: KeyIsAField = true;

/**
 * Six groups. The first five match the Health Score's five pillars' vocabulary
 * closely enough that a reader can trace a pillar back to its numbers; Risk is
 * the one group that is not a quality at all (see `higherBetter`).
 */
export type MetricCategory =
  | 'Valuation'
  | 'Profitability'
  | 'Growth'
  | 'Balance Sheet'
  | 'Shareholder'
  | 'Risk';

export type MetricUnit = 'pct' | 'mult' | 'ratio';

/** Decimal places the Short Interest section prints — shared so the same figure
 *  can never read two ways on one page (11c-iii: 0.96% there, 1.0% here). */
export const SHORT_PCT_DECIMALS = 2;
export const DAYS_TO_COVER_DECIMALS = 1;

export interface MetricDef {
  key: MetricKey;
  /** snake_case field in the stored `fundamentals` JSON (Python writes it). */
  dbField: string;
  label: string;
  cat: MetricCategory;
  unit: MetricUnit;
  /**
   * Which direction is stronger — and `null` for a metric where neither is.
   *
   * ⚠️ Was a required boolean until H6a. Every comparison was coloured green or
   * red and captioned "stronger/weaker than the typical peer", which is right for
   * a margin and FALSE for a beta (more volatile is worse for one investor and
   * exactly what another wants) and for short interest (our own Short Interest
   * tooltip says heavy shorting "can also fuel a short-squeeze rally"). A market
   * fact is not a verdict — the same rule as `e2e/direction-not-rating.spec.ts`.
   * `null` renders the gap in plain ink with no claim attached.
   */
  higherBetter: boolean | null;
  tip: string;
  /**
   * Display cap: |value| beyond this shows ">+cap" instead of an absurd figure
   * (earnings growth from a near-zero base reads as +30,000%); the true value
   * stays in the cell tooltip. The SAME number excludes outliers from the peer
   * median, so the cell and the median it is compared with agree. Every cap was
   * set above the live universe's 99th percentile (layer-h-plan §10), never
   * invented. No cap where the distribution has no explosive tail.
   */
  cap?: number;
  /** Decimal places for the value, when the unit's default would disagree with
   *  another section of the page showing the same stored number. */
  decimals?: number;
}

export const KEY_METRICS: readonly MetricDef[] = [
  // ── Valuation: 4 → 8 ────────────────────────────────────────────────────────
  { key: 'pe', dbField: 'pe', label: 'Trailing P/E', cat: 'Valuation', unit: 'mult', higherBetter: false, cap: 150,
    tip: 'Price ÷ EPS (last 12 months). Lower = cheaper relative to earnings.' },
  { key: 'forwardPe', dbField: 'forward_pe', label: 'Forward P/E', cat: 'Valuation', unit: 'mult', higherBetter: false, cap: 150,
    tip: 'Price ÷ the EPS analysts expect over the next 12 months. Beside the trailing P/E it shows whether earnings are expected to grow into the price. Lower = cheaper relative to expected earnings.' },
  { key: 'peg', dbField: 'peg', label: 'PEG Ratio', cat: 'Valuation', unit: 'ratio', higherBetter: false, cap: 25,
    tip: 'P/E ÷ earnings growth. Below 1 = cheap for its growth; above 2 = expensive.' },
  { key: 'priceToBook', dbField: 'price_to_book', label: 'Price / Book', cat: 'Valuation', unit: 'mult', higherBetter: false, cap: 100,
    tip: 'Share price ÷ book value (assets minus liabilities) per share. Lower = paying less for each dollar of net assets.' },
  { key: 'priceToSales', dbField: 'price_to_sales', label: 'Price / Sales', cat: 'Valuation', unit: 'mult', higherBetter: false, cap: 50,
    tip: 'Market value ÷ revenue (last 12 months). Lower = paying less for each dollar of sales.' },
  { key: 'evToEbitda', dbField: 'ev_to_ebitda', label: 'EV / EBITDA', cat: 'Valuation', unit: 'mult', higherBetter: false, cap: 150,
    tip: 'Enterprise Value ÷ EBITDA. Lower = cheaper on a capital-structure-neutral basis.' },
  { key: 'evToRevenue', dbField: 'ev_to_revenue', label: 'EV / Revenue', cat: 'Valuation', unit: 'mult', higherBetter: false, cap: 50,
    tip: 'Enterprise Value ÷ revenue. Like Price / Sales, but counting debt and cash as well as the shares. Lower = cheaper per dollar of sales.' },
  { key: 'fcfYieldPct', dbField: 'fcf_yield_pct', label: 'FCF Yield', cat: 'Valuation', unit: 'pct', higherBetter: true, cap: 100,
    tip: 'Free Cash Flow ÷ Market Cap. Higher = more cash generated per dollar invested.' },

  // ── Profitability: 5 → 7, read top to bottom as one ladder ─────────────────
  { key: 'grossMargin', dbField: 'gross_margin', label: 'Gross Margin', cat: 'Profitability', unit: 'pct', higherBetter: true,
    tip: '(Revenue − COGS) ÷ Revenue. Higher = more pricing power.' },
  { key: 'ebitdaMargin', dbField: 'ebitda_margin', label: 'EBITDA Margin', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'EBITDA ÷ Revenue — profit before interest, tax, depreciation and amortisation, per dollar of sales. Sits between gross and operating margin.' },
  { key: 'operatingMargin', dbField: 'operating_margin', label: 'Operating Margin', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Operating income ÷ Revenue. Profitability after operating costs.' },
  { key: 'netMargin', dbField: 'net_margin', label: 'Net Margin', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Net income ÷ Revenue. Bottom-line profit per dollar of sales.' },
  { key: 'fcfMarginPct', dbField: 'fcf_margin_pct', label: 'FCF Margin', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Free Cash Flow ÷ Revenue — how much of each dollar of sales becomes spare cash. Measured against sales, where FCF Yield is measured against the share price. One of the two inputs to the Cash Flow pillar.' },
  { key: 'roe', dbField: 'roe', label: 'Return on Equity', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Net income ÷ shareholders equity. How efficiently equity generates profit.' },
  { key: 'roa', dbField: 'roa', label: 'Return on Assets', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Net income ÷ total assets. How efficiently assets generate profit.' },

  // ── Growth ─────────────────────────────────────────────────────────────────
  { key: 'revenueGrowthYoy', dbField: 'revenue_growth_yoy', label: 'Revenue Growth', cat: 'Growth', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Year-over-year revenue growth.' },
  { key: 'earningsGrowthYoy', dbField: 'earnings_growth_yoy', label: 'Earnings Growth', cat: 'Growth', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Year-over-year growth in earnings (net profit). Faster = the bottom line is expanding. Very large readings usually mean last year’s earnings were near zero.' },

  // ── Balance Sheet: 2 → 3 ───────────────────────────────────────────────────
  { key: 'debtToEquity', dbField: 'debt_to_equity', label: 'Debt / Equity', cat: 'Balance Sheet', unit: 'ratio', higherBetter: false, cap: 25,
    tip: 'Total debt ÷ equity. Lower = less leverage.' },
  { key: 'currentRatio', dbField: 'current_ratio', label: 'Current Ratio', cat: 'Balance Sheet', unit: 'ratio', higherBetter: true, cap: 25,
    tip: 'Current assets ÷ current liabilities. Above 1 = covers short-term obligations.' },
  { key: 'quickRatio', dbField: 'quick_ratio', label: 'Quick Ratio', cat: 'Balance Sheet', unit: 'ratio', higherBetter: true, cap: 25,
    tip: 'The Current Ratio with inventory taken out: (current assets − inventory) ÷ current liabilities. Asks whether short-term bills could be paid without selling stock on hand.' },

  // ── Shareholder 🆕 — the two inputs to the Health Score's Shareholder pillar ──
  // Both "lower = stronger", matching how that pillar scores them.
  { key: 'payoutRatioPct', dbField: 'payout_ratio_pct', label: 'Payout Ratio', cat: 'Shareholder', unit: 'pct', higherBetter: false, cap: PAYOUT_DISPLAY_CAP,
    tip: 'Dividends ÷ net income — the share of profit paid out as dividends. Lower leaves more room to keep paying; above 100% means paying out more than it earns. Also shown in Dividend History.' },
  { key: 'sharesChangeYoyPct', dbField: 'shares_change_yoy_pct', label: 'Share Count change', cat: 'Shareholder', unit: 'pct', higherBetter: false, cap: 100,
    tip: 'Change in shares outstanding over the last year. Negative = buybacks, so each share owns more of the company; positive = new shares issued, which dilutes existing holders.' },

  // ── Risk 🆕 — facts about the SHARES, carrying no better/worse verdict ──────
  { key: 'beta', dbField: 'beta', label: 'Beta', cat: 'Risk', unit: 'ratio', higherBetter: null,
    tip: 'How far the share price has tended to move with the market. 1 = in step; above 1 = bigger swings; below 1 = smaller ones. Shown without a better/worse colour — neither is better, it depends on the investor.' },
  { key: 'shortPctOfFloat', dbField: 'short_pct_of_float', label: 'Short % of Float', cat: 'Risk', unit: 'pct', higherBetter: null, decimals: SHORT_PCT_DECIMALS,
    tip: 'Share of the tradable shares currently sold short. Shown without a better/worse colour: heavy shorting signals doubt, but can also fuel a short-squeeze rally. Not published for Australian stocks.' },
  { key: 'shortRatio', dbField: 'short_ratio', label: 'Days to Cover', cat: 'Risk', unit: 'ratio', higherBetter: null, decimals: DAYS_TO_COVER_DECIMALS,
    tip: 'Short interest ÷ average daily volume — how many trading days short sellers would need to buy back. Shown without a better/worse colour, for the same reason as Short % of Float.' },
];

// ── Building the table ───────────────────────────────────────────────────────

// Country codes (US / AU / CA) for the "vs Market" column — consistent with the
// Browse filter + per-stock badges (`marketLabel`).
const MARKET_LABEL: Record<string, string> = { us: 'US', au: 'AU', ca: 'CA' };

const UNIT_SUFFIX: Record<MetricUnit, string> = { pct: '%', mult: 'x', ratio: '' };

/** The unit's usual precision, unless the metric names its own (see `decimals`). */
const UNIT_DECIMALS: Record<MetricUnit, number> = { pct: 1, mult: 1, ratio: 2 };

export function fmtVal(v: number, unit: MetricUnit, cap?: number, decimals?: number): string {
  if (cap !== undefined && Math.abs(v) > cap) {
    return `${v > 0 ? '>+' : '<−'}${cap}${UNIT_SUFFIX[unit]}`;
  }
  return `${v.toFixed(decimals ?? UNIT_DECIMALS[unit])}${UNIT_SUFFIX[unit]}`;
}

export function fmtDelta(delta: number, unit: MetricUnit, cap?: number, decimals?: number): string {
  const sign = delta >= 0 ? '+' : '−';
  const suffix = unit === 'pct' ? 'pp' : UNIT_SUFFIX[unit];
  if (cap !== undefined && Math.abs(delta) > cap) {
    return `${delta >= 0 ? '>+' : '<−'}${cap}${suffix}`;
  }
  return `${sign}${Math.abs(delta).toFixed(decimals ?? UNIT_DECIMALS[unit])}${suffix}`;
}

/** `neutral`: a real gap, drawn in plain ink, with no better/worse claim (Risk rows). */
export type Verdict = 'better' | 'worse' | 'neutral' | 'inline' | 'na';

export interface Comparison {
  verdict: Verdict;
  /** Signed favourability score for sorting: + = better than peers. */
  score: number;
  text: string;
  tip: string;
}

function compare(
  def: MetricDef,
  value: number,
  group: MetricMedians | undefined,
  groupLabel: string,
): Comparison {
  const stat = group?.[def.key];
  if (!stat) return { verdict: 'na', score: -Infinity, text: '—', tip: `No ${groupLabel} median available.` };

  const delta = value - stat.median;
  // Relative size of the gap, used to call "in line" when the difference is small.
  const rel = Math.abs(stat.median) > 1e-9 ? delta / Math.abs(stat.median) : delta;
  // A metric with no better direction has no favourability to score.
  const favScore = def.higherBetter === null ? 0 : def.higherBetter ? rel : -rel;

  let verdict: Verdict;
  if (Math.abs(rel) < 0.05) verdict = 'inline';
  else if (def.higherBetter === null) verdict = 'neutral';
  else verdict = favScore > 0 ? 'better' : 'worse';

  const dir = delta >= 0 ? 'above' : 'below';
  // ⚠️ The neutral sentence ends at the fact. "stronger/weaker" is a claim the
  // Risk rows must never make (lib/keyMetrics.ts `higherBetter`).
  const quality =
    verdict === 'inline'
      ? ' — in line with the typical peer'
      : verdict === 'neutral'
        ? ' the typical peer'
        : verdict === 'better'
          ? ' — stronger than the typical peer'
          : ' — weaker than the typical peer';
  // Tip reveals the true (uncapped) gap; the cell text is capped for absurd values.
  const tip =
    `${groupLabel} median: ${fmtVal(stat.median, def.unit, undefined, def.decimals)} across ${stat.n} peers. ` +
    `This stock is ${fmtDelta(delta, def.unit, undefined, def.decimals).replace(/^[+−]/, '')} ${dir}${quality}.`;

  return { verdict, score: favScore, text: fmtDelta(delta, def.unit, def.cap, def.decimals), tip };
}

export interface BuiltRow {
  def: MetricDef;
  value: number;
  disp: string;
  valueTitle?: string;
  industryCmp: Comparison;
  sectorCmp: Comparison;
  marketCmp: Comparison;
}

/**
 * Every row the table draws, with its formatted value and its three comparisons.
 * The component renders this and nothing else, so what the spec asserts is what
 * a reader sees.
 */
export function buildKeyMetricsTable({
  fundamentals,
  industry,
  sector,
  market,
  medians,
}: {
  fundamentals: FundamentalsSnapshot;
  industry: string | null;
  sector: string | null;
  market: string;
  medians: MedianTables;
}): { industryLabel: string; sectorLabel: string; marketLabel: string; rows: BuiltRow[] } {
  // Industries below the peer floor are absent from medians.industry, so this is
  // undefined for them and the "vs Industry" cells render the graceful "—" state.
  const industryGroup = industry ? medians.industry[industry] : undefined;
  const sectorGroup = sector ? medians.sector[sector] : undefined;
  const marketGroup = medians.market[market];
  const industryLabel = industry ?? 'Industry';
  const sectorLabel = sector ?? 'Sector';
  const marketLabel = MARKET_LABEL[market] ?? 'Market';

  const f = fundamentals as unknown as Record<MetricKey, number | null>;
  const rows: BuiltRow[] = KEY_METRICS.flatMap((def) => {
    const value = f[def.key];
    if (value === null || value === undefined || !Number.isFinite(value)) return [];
    const capped = def.cap !== undefined && Math.abs(value) > def.cap;
    return [{
      def,
      value,
      disp: fmtVal(value, def.unit, def.cap, def.decimals),
      valueTitle: capped
        ? `Actual ${fmtVal(value, def.unit, undefined, def.decimals)} — capped for display`
        : undefined,
      industryCmp: compare(def, value, industryGroup, industryLabel),
      sectorCmp: compare(def, value, sectorGroup, sectorLabel),
      marketCmp: compare(def, value, marketGroup, marketLabel),
    }];
  });
  return { industryLabel, sectorLabel, marketLabel, rows };
}
