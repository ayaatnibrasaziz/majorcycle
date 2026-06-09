import type { AnalystRecommendation } from '@/lib/types';

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
