import type { AnalystRecommendation, Currency, FundamentalsSnapshot } from '@/lib/types';

/**
 * Which currency a figure taken from the FINANCIAL STATEMENTS is denominated in.
 *
 * One rule, one place. Revenue, EBITDA, debt, cash, EPS and every statement blob
 * are in the company's reporting currency, which is not always the currency its
 * shares trade in — 79 of 858 stocks in our universe differ, including a third
 * of the Canadian names. Anything that labels a statement figure must ask this,
 * never `fundamentals.currency`; `web/scripts/check-statement-currency.mjs`
 * fails the build if a statement component is handed the price currency.
 *
 * Falls back to the price currency when unknown (rows written before the field
 * existed), which is right for the ~91% of stocks that report in it anyway.
 */
export function statementCurrency(f: FundamentalsSnapshot): string {
  return f.financialCurrency ?? f.currency;
}

/**
 * Shared right-axis width (px) so EVERY chart's plot area ends at the same x and
 * the cards line up down the page. Used two ways, both keyed to this one value:
 *   - Recharts cards (Earnings, Quarterly/Annual, Valuation, Balance Sheet,
 *     Dividend, Relative Performance): `<YAxis orientation="right" width={…}>` +
 *     `margin.right = 0` (a hard fixed width).
 *   - Lightweight-Charts (Price, Drawdown/Profit, Smart Money): the right price
 *     scale auto-sizes to its labels and only honours a `minimumWidth` floor, so
 *     we set `rightPriceScale.minimumWidth` to this value. It must therefore be
 *     ≥ the widest LWC price-scale label across the universe — 72px covers the
 *     Drawdown chart's "-100.0%"-style labels (the widest), which otherwise made
 *     it 6px narrower than the rest.
 */
export const CHART_RIGHT_AXIS_WIDTH = 72;

/**
 * Currency-aware share-price formatter (via `Intl.NumberFormat`, so the symbol is
 * always correct: `$` / `A$` / `CA$`). **Uniform 2 decimals for every price ≥ $1**
 * (the finance-standard — brokers/TradingView) so a group of related prices never
 * mixes precision (e.g. analyst targets read "$95.20 / $120.00 / $145.00", not
 * "$95.20 / $120"). Below $1 it adds decimals so a small price is never rounded to
 * "$0":  ≥ $1 → 2 dp · $0.10–$1 → ≤ 3 dp · $0.01–$0.10 → ≤ 4 dp · < $0.01 → ≤ 6 dp
 * (2 dp floor throughout; trailing zeros trimmed only below $1).
 */
export function fmtPrice(n: number, currency: Currency): string {
  const a = Math.abs(n);
  let maxFrac: number;
  if (a >= 1) maxFrac = 2;
  else if (a >= 0.1) maxFrac = 3;
  else if (a >= 0.01) maxFrac = 4;
  else maxFrac = 6;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

/**
 * Per-share dollar figures (EPS, DPS) — always 2 dp, currency-aware. These are
 * conventionally shown to 2 dp regardless of size; this exists mainly to fix the
 * hardcoded "$" in EarningsHistory/DividendHistory so AUD/CAD render A$/CA$.
 */
export function fmtPerShare(n: number, currency: Currency | string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * The symbol `Intl` itself would print for an ISO currency code — `$`, `A$`,
 * `CA$`, `NZ$`, `€`, `NT$`…
 *
 * A hardcoded three-entry lookup was enough while every number on the page was
 * in the stock's own market currency. It stopped being enough once the
 * financial statements were labelled with THEIR currency (`financialCurrency`),
 * because a company may report in anything: our universe holds NZD, EUR, SGD
 * and TWD reporters. Falling back to a bare `$` for those would say "dollars"
 * about euros.
 */
const symbolCache = new Map<string, string>();

export function currencySymbol(code: string): string {
  const cached = symbolCache.get(code);
  if (cached !== undefined) return cached;
  let symbol = '$';
  try {
    const part = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    })
      .formatToParts(1)
      .find((p) => p.type === 'currency');
    if (part) symbol = part.value;
  } catch {
    symbol = '$'; // unknown/invalid code — never throw on a formatting path
  }
  symbolCache.set(code, symbol);
  return symbol;
}

/**
 * Adaptive compact number — picks K/M/B/T by magnitude so a real, non-zero value
 * NEVER collapses to a meaningless "0.0M"/"0B" (which is what happens when a small
 * company's figures are forced into a fixed billions/millions unit). Keeps ~3
 * significant figures; the mantissa is always ≥ 1 for the chosen unit. Pass a
 * `currency` for money (prefixes $/A$/CA$); omit it for plain counts like shares.
 *
 * e.g. 30_000_000 → "30.0M" · 800_000 → "800K" · 12_500 → "12.5K" · 250 → "250"
 *      1.23e9 → "1.2B" · 2.5e12 → "2.5T"
 */
export function fmtCompact(value: number, currency?: Currency | string): string {
  if (!Number.isFinite(value)) return '—';
  const prefix = currency ? currencySymbol(currency) : '';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const m = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1)); // mantissa ∈ [1,1000)
  if (abs >= 1e12) return `${sign}${prefix}${m(abs / 1e12)}T`;
  if (abs >= 1e9) return `${sign}${prefix}${m(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${m(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${m(abs / 1e3)}K`;
  return `${sign}${prefix}${abs.toFixed(0)}`;
}

/**
 * Build a recharts `tickFormatter` that shows T/B/M/K with the SAME unit and the
 * SAME decimals on EVERY tick of an axis (so it never mixes "70.0M" with "140M").
 * `axisMax` = the largest |value| currently plotted on the axis. Decimals are 0
 * when the axis ticks are whole in the chosen unit, else a uniform 1 dp. Pass
 * `currency` for money ($/A$/CA$); omit for counts. (Per-value `fmtCompact` stays
 * the right choice OFF-axis — stat strips, tables, tooltips, Browse.)
 */
export function makeCompactAxisFormatter(
  axisMax: number,
  currency?: Currency | string,
): (v: number) => string {
  const prefix = currency ? currencySymbol(currency) : '';
  const m = Math.abs(axisMax);
  const [div, suffix] =
    m >= 1e12 ? [1e12, 'T'] :
    m >= 1e9  ? [1e9, 'B'] :
    m >= 1e6  ? [1e6, 'M'] :
    m >= 1e3  ? [1e3, 'K'] : [1, ''];
  // recharts draws ~4 intervals across [0, max] and ROUNDS the step to a nice value
  // (e.g. dataMax 271M → ticks every 70M). Decide a single dp for the whole axis from
  // that nice step: 1 dp only when the step isn't whole in the chosen unit (e.g. 1.5B).
  const niceStep = ceilNiceStep(m / 4);
  const dp = niceStep > 0 && !Number.isInteger(niceStep / div) ? 1 : 0;
  return (v: number) => {
    if (!Number.isFinite(v)) return '—';
    if (v === 0) return `${prefix}0`;
    return `${v < 0 ? '−' : ''}${prefix}${(Math.abs(v) / div).toFixed(dp)}${suffix}`;
  };
}

/** Round a rough axis step UP to a "nice" value (1, 1.5, 2, 2.5, 3, 4…×10ⁿ),
 *  mirroring how recharts rounds its tick spacing. */
function ceilNiceStep(x: number): number {
  if (!(x > 0)) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / mag; // [1, 10)
  const niceN =
    n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 :
    n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 7 ? 7 : n <= 8 ? 8 : n <= 9 ? 9 : 10;
  return niceN * mag;
}

/**
 * Format a number for display with a sanity cap (the S8/S9 display-only pattern).
 * Real yfinance values can be absurd from a near-zero denominator (ROE 8,457%,
 * operating margin −546,607%). Beyond ±cap we render ">cap" / "<−cap" so a
 * garbage figure never appears as a confident headline. This is display-only:
 * the threshold/firing logic that decides *whether* a sentence appears still
 * uses the raw value. Mirrors `MetricDef.cap` in `MetricsTable.tsx`.
 */
export function fmtCapped(value: number, cap: number, decimals = 1): string {
  if (value > cap) return `>${cap}`;
  if (value < -cap) return `<−${cap}`;
  return value.toFixed(decimals);
}

/**
 * yfinance stores the analyst consensus as a raw `recommendationKey`
 * (e.g. `"strong_buy"`, `"buy"`, `"underperform"`). The app's
 * `AnalystRecommendation` type and the design system (§4) expect the
 * Title-Case verbatim labels. This maps the raw key onto that union so the
 * value displays correctly AND string comparisons against the union (e.g. in
 * ThesisInsights) work. Unknown / `"none"` / empty values return null.
 *
 * Mapping follows the reference design's `fmtAnalyst`: outperform/overweight
 * collapse to Buy, neutral/market_perform to Hold, underperform to Sell.
 */
export function normalizeAnalystRecommendation(
  raw: string | null | undefined,
): AnalystRecommendation | null {
  if (!raw) return null;
  const key = String(raw).toLowerCase().replace(/[\s-]/g, '_');
  const map: Record<string, AnalystRecommendation> = {
    strong_buy: 'Strong Buy',
    buy: 'Buy',
    outperform: 'Buy',
    overweight: 'Buy',
    hold: 'Hold',
    neutral: 'Hold',
    market_perform: 'Hold',
    underperform: 'Sell',
    sell: 'Sell',
    strong_sell: 'Strong Sell',
  };
  return map[key] ?? null;
}
