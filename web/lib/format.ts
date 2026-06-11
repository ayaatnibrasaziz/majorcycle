import type { AnalystRecommendation, Currency } from '@/lib/types';

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
export function fmtPerShare(n: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
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
