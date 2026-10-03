/**
 * The Verdict's financial-health sentences, the strength it quotes and its primary
 * risk — pure, so they can be tested without rendering a page.
 *
 * ⚠️ BETA REVIEW B-4 / B-7, 2026-09-28. Two families of sentence said things the same
 * page contradicted:
 *
 *   · Any Health under 50 read "elevated balance-sheet and profitability risks warrant
 *     caution" — beside a scorecard showing Balance Sheet 100 (Adavale: Balance Sheet
 *     100, Cash Flow 5, Growth 10). The sentence named areas it had never looked at.
 *   · A company LOSING money was a "thin net margin … leaves little buffer" (Moderna,
 *     −141%; 79 stocks with a negative margin).
 *
 * The owner's rule: *make it in a way it can't contradict*. So nothing here names a
 * scorecard area unless that area's own score says so — an area is WEAK only below
 * `WEAK_PILLAR` on the number the scorecard prints (rounded), never merely "one of
 * the lowest" (two lowest can be 50 and 100) — and a strength is never quoted from an
 * area the scorecard calls weak.
 */

import { fmtCapped } from '@/lib/format';
import type { CycleAnalysis, FundamentalsSnapshot } from '@/lib/types';

export type HealthSubscores = CycleAnalysis['fhSubscores'];
type PillarKey = keyof HealthSubscores;

/** The scorecard's five areas, with the names the radar prints. */
export const HEALTH_PILLARS: ReadonlyArray<{ key: PillarKey; label: string }> = [
  { key: 'profitability', label: 'Profitability' },
  { key: 'balanceSheet', label: 'Balance Sheet' },
  { key: 'growth', label: 'Growth' },
  { key: 'cashflow', label: 'Cash Flow' },
  { key: 'shareholder', label: 'Shareholder' },
];

/** Below this (on the rounded score the scorecard shows), an area is weak. */
export const WEAK_PILLAR = 50;

/** True only when the area was scored AND scored weak. Unknown is never weak. */
export function pillarIsWeak(sub: HealthSubscores | undefined, key: PillarKey): boolean {
  const v = sub?.[key];
  return v != null && Math.round(v) < WEAK_PILLAR;
}

/** Every weak area, weakest first, as printed on the scorecard: "Cash Flow (5)". */
export function weakPillars(sub: HealthSubscores | undefined): string[] {
  return HEALTH_PILLARS.filter((p) => pillarIsWeak(sub, p.key))
    .map((p) => ({ label: p.label, score: Math.round(sub![p.key] as number) }))
    .sort((a, b) => a.score - b.score)
    .map((p) => `${p.label} (${p.score})`);
}

function andList(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The single strongest evidence point — never from an area the scorecard calls weak. */
export function bestStrength(f: FundamentalsSnapshot, sub?: HealthSubscores): string {
  const ok = (key: PillarKey) => !pillarIsWeak(sub, key);
  if (f.roe != null && f.roe >= 25 && ok('profitability'))
    return `an exceptional ${fmtCapped(f.roe, 300, 0)}% return on equity`;
  if (f.fcfYieldPct != null && f.fcfYieldPct >= 5 && ok('cashflow'))
    return `a strong ${fmtCapped(f.fcfYieldPct, 100, 1)}% free-cash-flow yield`;
  if (f.debtToEquity != null && f.debtToEquity < 0.4 && ok('balanceSheet'))
    return `a fortress balance sheet (D/E ${f.debtToEquity.toFixed(2)})`;
  if (f.grossMargin != null && f.grossMargin >= 60 && ok('profitability'))
    return `gross margins of ${fmtCapped(f.grossMargin, 300, 0)}%`;
  if (f.revenueGrowthYoy != null && f.revenueGrowthYoy >= 20 && ok('growth'))
    return `accelerating revenue growth of ${fmtCapped(f.revenueGrowthYoy, 300, 0)}% YoY`;
  if (f.operatingMargin != null && f.operatingMargin >= 20 && ok('profitability'))
    return `operating margins of ${fmtCapped(f.operatingMargin, 300, 0)}%`;
  if (f.netMargin != null && f.netMargin >= 10 && ok('profitability'))
    return `healthy net margins of ${fmtCapped(f.netMargin, 300, 0)}%`;
  return 'a solid overall financial-health profile';
}

/**
 * The Verdict's second sentence. Judged on the ROUNDED score it prints, like every
 * other score label (lib/ratings.ts `tierFromScore`).
 */
export function healthSentence(
  hs: number | null,
  f: FundamentalsSnapshot,
  sub?: HealthSubscores,
): string {
  if (hs == null) return 'Financial health data is unavailable for this ticker.';
  const shown = Math.round(hs);
  if (shown >= 85) return `Financial health is exceptional at ${shown}/100, supported by ${bestStrength(f, sub)}.`;
  if (shown >= 70) return `Financial health is solid at ${shown}/100, with ${bestStrength(f, sub)}.`;
  const weak = weakPillars(sub).slice(0, 2);
  if (shown >= 50)
    return weak.length
      ? `Financial health is adequate at ${shown}/100 — held back by ${andList(weak)}.`
      : `Financial health is adequate at ${shown}/100.`;
  return weak.length
    ? `Financial health is stressed at ${shown}/100 — weakest on ${andList(weak)}.`
    : `Financial health is stressed at ${shown}/100.`;
}

/**
 * The Verdict's primary risk — first match wins.
 *
 * ⚠️ "Near its highs" used to be the FIRST rule here. The Verdict's opening sentence
 * already says that for every stock near its highs, so the card said it twice and hid
 * whatever the real risk was — debt, falling revenue, losses (beta review B-23,
 * 2026-10-03). The fallback also read "Primary risk: the chief risk is…".
 */
export function topRisk(
  f: FundamentalsSnapshot,
  pullbackEvents: number,
): string {
  if (f.debtToEquity != null && f.debtToEquity >= 1.5)
    return `elevated debt at ${fmtCapped(f.debtToEquity, 25, 1)}× equity — sensitive to higher rates`;
  if (f.revenueGrowthYoy != null && f.revenueGrowthYoy < 0)
    return `revenue declining ${fmtCapped(Math.abs(f.revenueGrowthYoy), 300, 1)}% YoY — execution risk`;
  if (f.currentRatio != null && f.currentRatio < 1)
    return 'current ratio below 1 — short-term liquidity pressure';
  if (f.peg != null && f.peg > 3)
    return `PEG of ${fmtCapped(f.peg, 25, 1)} — valuation stretched vs growth`;
  if (pullbackEvents < 8)
    return `only ${pullbackEvents} historical cycles — limited statistical confidence`;
  if (f.netMargin != null && f.netMargin < 0)
    return `loss-making — net margin of ${fmtCapped(f.netMargin, 300, 1)}%`;
  if (f.netMargin != null && f.netMargin < 5)
    return `thin net margin of ${fmtCapped(f.netMargin, 300, 1)}% leaves little buffer`;
  if (f.revenueGrowthYoy != null && f.revenueGrowthYoy >= 0 && f.revenueGrowthYoy < 15)
    return `modest revenue growth of ${f.revenueGrowthYoy.toFixed(1)}% — multiple-compression risk`;
  return 'the historical cycle pattern not repeating as it has before';
}
