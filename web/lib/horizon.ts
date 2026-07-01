// Shared Major Cycle horizon parsing for the Stock Detail page and its Report
// route. Both read the same `?preset=…` query (a named preset or a fully custom
// pullback/profit/lookback window chosen on Browse) and must resolve it
// identically, so this is the single source of truth (was inline in the detail
// `page.tsx` before the Report route needed the same logic).

import { CUSTOM_PARAM_BOUNDS } from '@/lib/presets';
import type { CycleSpec } from '@/lib/cycle';
import type { AnalyzeRequest, Market } from '@/lib/types';

export type RouteSearch = {
  preset?: string;
  pullback?: string;
  profit?: string;
  lookback?: string;
};

export const PRESET_LABEL = {
  short: 'Short-term (≈ 3 months)',
  medium: 'Medium-term (≈ 1 year)',
  long: 'Long-term (≈ 3 years)',
} as const;

export function isValidMarket(value: string): value is Market {
  return value === 'us' || value === 'au' || value === 'ca';
}

function inBounds(n: number, b: { min: number; max: number }): boolean {
  return n >= b.min && n <= b.max;
}

// The Browse page picks the Major Cycle window and passes it via the query:
// a named preset (?preset=short|medium|long) or a fully custom window
// (?preset=custom&pullback=-7&profit=7&lookback=300). Invalid/unknown input
// falls back to the Medium headline. Returns the spec + a human label.
export function parseSpec(sp: RouteSearch): { spec: CycleSpec; label: string } {
  if (sp.preset === 'custom') {
    const pullback = Number(sp.pullback);
    const profit = Number(sp.profit);
    const lookback = Number(sp.lookback);
    const b = CUSTOM_PARAM_BOUNDS;
    if (
      Number.isFinite(pullback) && inBounds(pullback, b.pullbackThreshold) &&
      Number.isFinite(profit) && inBounds(profit, b.profitThreshold) &&
      Number.isInteger(lookback) && inBounds(lookback, b.lookbackBars)
    ) {
      return {
        spec: { preset: 'custom', pullback, profit, lookback },
        label: `Custom (${pullback}% / +${profit}% / ${lookback} bars)`,
      };
    }
    return { spec: { preset: 'medium' }, label: PRESET_LABEL.medium };
  }
  const preset = sp.preset === 'short' || sp.preset === 'long' ? sp.preset : 'medium';
  return { spec: { preset }, label: PRESET_LABEL[preset] };
}

/**
 * Re-serialize the horizon back into a `?…` query string so a link can carry the
 * current window onto the Report route. Validates via `parseSpec` first, so only
 * a real custom window emits the 4 custom params; a named preset emits just
 * `?preset=…` (empty string for the default Medium → clean URL).
 */
export function horizonQuery(sp: RouteSearch): string {
  const { spec } = parseSpec(sp);
  if (spec.preset === 'custom') {
    const qs = new URLSearchParams({
      preset: 'custom',
      pullback: String(spec.pullback),
      profit: String(spec.profit),
      lookback: String(spec.lookback),
    });
    return `?${qs.toString()}`;
  }
  return spec.preset === 'medium' ? '' : `?preset=${spec.preset}`;
}

/**
 * Build the same `?…` horizon suffix from a Run's `AnalyzeRequest` (the shape the
 * Results/Run tabs hold in `useAnalysis().params`). Every link from a results
 * surface — the ranked table, the Opportunity Map, the briefing top pick, the
 * post-run summary — must carry the horizon the user actually ran on, otherwise
 * the Stock Detail page falls back to its Medium default (decision #15/§7) and
 * silently shows a different window than the one that produced the row. Reuses
 * `horizonQuery` so the custom-window validation and the "medium → clean URL"
 * rule stay in one place. Returns '' for Medium / null (a bare, canonical path).
 */
export function horizonQueryFromRequest(params: AnalyzeRequest | null): string {
  if (!params) return '';
  const sp: RouteSearch =
    params.preset === 'custom'
      ? {
          preset: 'custom',
          pullback: String(params.pullbackThreshold),
          profit: String(params.profitThreshold),
          lookback: String(params.lookbackBars),
        }
      : { preset: params.preset };
  return horizonQuery(sp);
}
