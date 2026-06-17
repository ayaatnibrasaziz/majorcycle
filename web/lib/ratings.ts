// Shared, pure rating/tier helpers for the Results (Layer E) view.
//
// These mirror the tier system used across the app (the `--c-tier-*` tokens and
// `.tier-badge--N` classes in globals.css, the OverallLabel / ValuationZone unions
// in lib/types). Kept framework-free (no React, no 'use client') so they're easy to
// reason about and reuse. Every label here is one of our five COMPLIANT tiers
// (CLAUDE.md #2) — no "Buy"/"Sell"/"Avoid" language anywhere.

import type { CycleAnalysis, OverallLabel, ValuationZone } from '@/lib/types';

/** Tier index 1 (strongest) … 5 (weakest) for a 0–100 score. */
export function tierFromScore(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 1;
  if (score >= 65) return 2;
  if (score >= 50) return 3;
  if (score >= 35) return 4;
  return 5;
}

const LABEL_TIER: Record<OverallLabel, 1 | 2 | 3 | 4 | 5> = {
  'High Conviction': 1,
  Constructive: 2,
  Neutral: 3,
  Cautious: 4,
  Bearish: 5,
};

export function tierFromLabel(label: OverallLabel): 1 | 2 | 3 | 4 | 5 {
  return LABEL_TIER[label];
}

/** Ordered, strongest-first — for tier filter dropdowns and legends. */
export const OVERALL_LABELS: readonly OverallLabel[] = [
  'High Conviction',
  'Constructive',
  'Neutral',
  'Cautious',
  'Bearish',
];

/** The CSS-variable colour for a tier (matches `.tier-badge--N`). */
export function tierColorVar(tier: 1 | 2 | 3 | 4 | 5): string {
  return `var(--c-tier-${tier})`;
}

/** Solid colour for a 0–100 score, via its tier. */
export function scoreColor(score: number | null): string {
  if (score == null) return 'var(--text-muted)';
  return tierColorVar(tierFromScore(score));
}

// Valuation zone → tier + display. DEEP VALUE/VALUE are favourable (green),
// FAIR is neutral (gold), STRETCHED is unfavourable (orange).
const ZONE_TIER: Record<ValuationZone, 1 | 2 | 3 | 4 | 5> = {
  'DEEP VALUE': 1,
  VALUE: 2,
  FAIR: 3,
  STRETCHED: 4,
};

export const ZONE_DISPLAY: Record<ValuationZone, string> = {
  'DEEP VALUE': 'Deep Value',
  VALUE: 'Value',
  FAIR: 'Fair',
  STRETCHED: 'Stretched',
};

export function zoneColor(zone: ValuationZone): string {
  return tierColorVar(ZONE_TIER[zone]);
}

/**
 * Cycle Position 0–100: where the stock sits in its drawdown band right now.
 * 0 = at/near a recent peak, 100 = at its typical worst-case dip (lower bound).
 * Both drawdown and lower bound are negative percentages, so their ratio is
 * positive. Null when there's no meaningful drawdown band (e.g. at a high, or no
 * lower bound) — identical formula to the reference's `cyclePos`.
 */
export function cyclePosition(
  currentDrawdownPct: number | null,
  lowerBound: number | null,
): number | null {
  if (currentDrawdownPct == null || lowerBound == null || lowerBound >= 0) return null;
  const ratio = currentDrawdownPct / lowerBound;
  return Math.min(Math.max(ratio, 0), 1) * 100;
}

/** Colour for a cycle-position value: deeper in the dip = greener (more cyclically attractive). */
export function cyclePositionColor(pos: number | null): string {
  if (pos == null) return 'var(--text-muted)';
  if (pos >= 66) return 'var(--c-tier-1)';
  if (pos >= 33) return 'var(--c-tier-3)';
  return 'var(--c-tier-5)';
}

// ── Analyst Briefing ────────────────────────────────────────────────────────
// A plain-English summary of the run, built entirely from the in-memory results
// (rating outputs — never read from the DB, CLAUDE.md #15). Strictly compliant
// language: we frame around our tiers, never "Buy Zone"/"Avoid".

export interface BriefingRow {
  ticker: string;
  name: string | null;
  overallRating: number;
  overallLabel: OverallLabel;
  financialHealthScore: number | null;
  valuationZone: ValuationZone;
}

export interface Briefing {
  /** HTML-free segments; the component renders ticker links itself. */
  sentences: string[];
  topPick: BriefingRow | null;
  constructivePlus: number;
  cautiousBearish: number;
}

const POSITIVE_LABELS: OverallLabel[] = ['High Conviction', 'Constructive'];
const NEGATIVE_LABELS: OverallLabel[] = ['Cautious', 'Bearish'];

export function buildBriefing<T extends BriefingRow>(rows: T[]): Briefing {
  const n = rows.length;
  if (n === 0) {
    return { sentences: [], topPick: null, constructivePlus: 0, cautiousBearish: 0 };
  }
  const top = rows.reduce((best, r) => (r.overallRating > best.overallRating ? r : best));
  const constructivePlus = rows.filter((r) => POSITIVE_LABELS.includes(r.overallLabel)).length;
  const weak = rows.filter((r) => NEGATIVE_LABELS.includes(r.overallLabel));

  const topName = top.name ? ` (${top.name})` : '';
  const healthWord =
    top.financialHealthScore != null && top.financialHealthScore >= 80 ? 'financially healthy' : 'fundamentally sound';
  const healthClause =
    top.financialHealthScore != null ? `, Health ${Math.round(top.financialHealthScore)}` : '';

  const sentences: string[] = [];
  sentences.push(
    `Of ${n} ${n === 1 ? 'stock' : 'stocks'} analysed, ${constructivePlus} ` +
      `${constructivePlus === 1 ? 'rates' : 'rate'} Constructive or better.`,
  );

  if (constructivePlus > 0) {
    sentences.push(
      `The standout is {{TICKER}}${topName} — a ${healthWord} company${healthClause}, currently ` +
        `rated ${top.overallLabel} with a ${ZONE_DISPLAY[top.valuationZone]} valuation.`,
    );
  } else {
    sentences.push(
      `None reached the Constructive tier — at current levels this list looks fully or richly priced, ` +
        `so patience may beat forcing an entry. The highest-rated is {{TICKER}}${topName} ` +
        `(rating ${top.overallRating}) — one to keep on the radar.`,
    );
  }

  if (weak.length > 0) {
    const names = weak.slice(0, 2).map((d) => d.ticker).join(', ');
    sentences.push(
      `${weak.length} ${weak.length === 1 ? 'stock is' : 'stocks are'} rated Cautious or Bearish ` +
        `(${names}${weak.length > 2 ? ', …' : ''}) — limited margin of safety at current levels.`,
    );
  }

  return { sentences, topPick: top, constructivePlus, cautiousBearish: weak.length };
}

// ── CSV export ───────────────────────────────────────────────────────────────

/** Escape one CSV field (RFC 4180). */
function csvField(value: string | number | null): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialise rows to a CSV string given ordered [header, accessor] columns. */
export function toCsv<T>(
  rows: T[],
  columns: ReadonlyArray<{ header: string; get: (r: T) => string | number | null }>,
): string {
  const head = columns.map((c) => csvField(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => csvField(c.get(r))).join(','))
    .join('\n');
  return `${head}\n${body}`;
}

/** Trigger a client-side CSV download. No-op on the server. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Convenience: the OverallRating composition (engine weights 40/35/25). */
export function ratingComposition(r: CycleAnalysis): { health: number; valuation: number; payoff: number } {
  return {
    health: (r.financialHealthScore ?? 0) * 0.4,
    valuation: r.valuationScore * 0.35,
    payoff: r.cyclePayoffScore * 0.25,
  };
}

/**
 * Three shades of a score's tier colour — for the Overall composition micro-bar
 * (Health / Valuation / Cycle Payoff segments), mirroring the reference's
 * `zoneRamp`. Darkest → lightest.
 */
export function compositionRamp(score: number): [string, string, string] {
  const t = tierFromScore(score);
  const rgb: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: '0,100,0',
    2: '34,139,34',
    3: '212,160,23',
    4: '255,69,0',
    5: '178,34,34',
  };
  const c = rgb[t];
  return [`rgba(${c},0.85)`, `rgba(${c},0.55)`, `rgba(${c},0.30)`];
}

/**
 * Wall-Street analyst consensus, shown VERBATIM (third-party data — CLAUDE.md
 * #17, the one place Buy/Sell wording is allowed because it isn't our rating).
 * Normalises yfinance's raw recommendation key to a display string.
 */
export function fmtAnalyst(raw: string | null): string {
  if (!raw) return '—';
  const map: Record<string, string> = {
    strong_buy: 'Strong Buy',
    buy: 'Buy',
    outperform: 'Buy',
    overweight: 'Buy',
    hold: 'Hold',
    neutral: 'Hold',
    market_perform: 'Hold',
    underperform: 'Sell',
    underweight: 'Sell',
    sell: 'Sell',
    strong_sell: 'Strong Sell',
  };
  const key = String(raw).toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
  return map[key] ?? String(raw).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Upside % from current price to the analyst target. Null when either is missing. */
export function upsidePct(close: number | null, target: number | null): number | null {
  if (close == null || target == null || close === 0) return null;
  return ((target - close) / close) * 100;
}

/**
 * Colour for a tinted metric cell, ported from the reference's `cellClass`
 * thresholds and mapped to our `--c-tier-*` palette (green = favourable …
 * red = unfavourable). Returns null for "no tint". `kind` selects the metric's
 * threshold ladder.
 */
export function metricTintColor(
  kind: 'drawdown' | 'roe' | 'fcf' | 'de' | 'peg' | 'upside' | 'positive',
  val: number | null,
): string | null {
  if (val == null || Number.isNaN(val)) return null;
  const tier = (n: 1 | 2 | 3 | 4 | 5) => tierColorVar(n);
  switch (kind) {
    case 'drawdown': // deeper dip = more cyclically favourable (greener)
      if (val <= -20) return tier(1);
      if (val <= -10) return tier(2);
      if (val <= -5) return tier(3);
      if (val <= -2) return tier(4);
      return tier(5);
    case 'roe':
      if (val >= 20) return tier(1);
      if (val >= 15) return tier(2);
      if (val >= 10) return tier(3);
      if (val >= 5) return tier(4);
      return tier(5);
    case 'fcf':
      if (val >= 6) return tier(1);
      if (val >= 4) return tier(2);
      if (val >= 2) return tier(3);
      if (val >= 0) return tier(4);
      return tier(5);
    case 'de':
      if (val < 0.3) return tier(1);
      if (val < 0.5) return tier(2);
      if (val < 1.0) return tier(3);
      if (val < 2.0) return tier(4);
      return tier(5);
    case 'peg':
      if (val <= 0) return null;
      if (val < 1.0) return tier(1);
      if (val < 1.5) return tier(2);
      if (val < 2.5) return tier(3);
      if (val < 4.0) return tier(4);
      return tier(5);
    case 'upside':
      return val >= 0 ? tier(2) : tier(5);
    case 'positive':
      return tier(2);
    default:
      return null;
  }
}
