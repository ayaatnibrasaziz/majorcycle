import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import {
  CONFIDENCE_TIERS,
  CONFIDENCE_TIERS_TEXT,
  HIGH_CONFIDENCE_FROM,
  LIMITED_HISTORY_BELOW,
  PAYOFF_FULL_EVENTS,
  PAYOFF_FULL_RATIO,
  RATING_BANDS,
  RATING_PARTS,
  RATING_SUMMARY,
  confidenceTier,
} from '../lib/ratingDefinition';
import { RATING_WEIGHTS, shallowDipEdge, tierFromScore } from '../lib/ratings';

/**
 * The Overall Rating is described ONE way everywhere (owner, 2026-10-03; beta review
 * D-15 / F-6). Pure and credential-free.
 */

test('the parts carry the real weights, which are the Python scorer’s', () => {
  expect(RATING_PARTS.map((p) => p.weight)).toEqual([
    RATING_WEIGHTS.health,
    RATING_WEIGHTS.valuation,
    RATING_WEIGHTS.payoff,
  ]);
  expect(RATING_PARTS.reduce((s, p) => s + p.weight, 0)).toBe(100);
  // The scorer that actually computes the rating (analytics/scoring/overall.py).
  const py = readFileSync(join('..', 'analytics', 'scoring', 'overall.py'), 'utf8');
  const w = (k: string) => Number(new RegExp(`"${k}":\\s*(\\d+)`).exec(py)?.[1]);
  expect([w('financial_health'), w('valuation_zone'), w('cycle_payoff')]).toEqual([
    RATING_WEIGHTS.health,
    RATING_WEIGHTS.valuation,
    RATING_WEIGHTS.payoff,
  ]);
});

test('the bands in words are the bands the labels are given by', () => {
  for (const [i, b] of RATING_BANDS.entries()) {
    expect(tierFromScore(b.min), `${b.label} at ${b.min}`).toBe(i + 1);
    if (b.min > 0) expect(tierFromScore(b.min - 1), `just below ${b.label}`).toBe(i + 2);
  }
});

test('the summary names all three parts and their weights', () => {
  for (const p of RATING_PARTS) expect(RATING_SUMMARY).toContain(`${p.name} (${p.weight}%)`);
});

test('no surface keeps its own wording of the rating', () => {
  // Phrases from the three old descriptions. Any of them back in the source means a
  // surface is describing the rating privately again.
  const banned = [/payoff from buying/i, /composite of all three signals/i, /Valuation Zone \(35%\)/];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== 'node_modules') walk(p);
      } else if (/\.tsx?$/.test(name)) {
        const code = readFileSync(p, 'utf8')
          .split('\n')
          .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
          .join('\n');
        for (const re of banned) if (re.test(code)) offenders.push(`${p}: ${re}`);
      }
    }
  };
  for (const root of ['components', 'app', 'lib']) walk(root);
  expect(offenders).toEqual([]);
});

test('the Cycle Payoff numbers the explanations state are the scorer’s', () => {
  // Owner, 2026-10-10. The "How we rate" window prints both; the scorer uses both.
  const py = readFileSync(join('..', 'analytics', 'scoring', 'overall.py'), 'utf8');
  const n = (k: string) => Number(new RegExp(`^${k}\\s*=\\s*([\\d.]+)`, 'm').exec(py)?.[1]);
  expect(n('PAYOFF_FULL_EVENTS')).toBe(PAYOFF_FULL_EVENTS);
  expect(n('PAYOFF_FULL_RATIO')).toBe(PAYOFF_FULL_RATIO);
  // Control: the read is value-sensitive rather than merely finding a number.
  expect(n('PAYOFF_FULL_EVENTS')).not.toBe(PAYOFF_FULL_EVENTS + 1);
});

test('confidence tiers: the boundaries, and the sentence that states them', () => {
  // Owner, 2026-10-10: 125 / 60 / 25 low points (about 10 / 5 / 2 years).
  expect(CONFIDENCE_TIERS.map((t) => t.min)).toEqual([125, 60, 25, 0]);
  for (const [i, t] of CONFIDENCE_TIERS.entries()) {
    expect(confidenceTier(t.min), `${t.name} at ${t.min}`).toBe(t.name);
    if (t.min > 0) expect(confidenceTier(t.min - 1), `just below ${t.name}`).toBe(CONFIDENCE_TIERS[i + 1]!.name);
  }
  expect(HIGH_CONFIDENCE_FROM).toBe(125);
  expect(LIMITED_HISTORY_BELOW).toBe(25);
  expect(CONFIDENCE_TIERS_TEXT).toBe(
    '125+ (about 10 years) = High · 60–124 = Solid · 25–59 = Moderate · under 25 = Limited',
  );
});

test('the near-high edge is the horizon’s own threshold, in both languages', () => {
  // Owner, 2026-10-10: Near high ends at -3 on Short, -5 on Medium, -8 on Long.
  expect(shallowDipEdge({ pullbackThreshold: -3 })).toBe(-3);
  expect(shallowDipEdge({ pullbackThreshold: -8 })).toBe(-8);
  expect(shallowDipEdge({ pullbackThreshold: 2 })).toBe(0);
  // The scorer decides the zone; it must be handed the horizon's threshold.
  const py = readFileSync(join('..', 'analytics', 'major_cycle.py'), 'utf8');
  expect(py).toContain('shallow_edge=params.pullback_threshold');
  // And no stock-page wording may go back to a fixed -5 (it did until 2026-10-10).
  const strip = (f: string) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');
  for (const f of ['components/stocks/ThesisInsights.tsx', 'components/stocks/VerdictCard.tsx', 'lib/thesisText.ts']) {
    expect(strip(f), f).not.toMatch(/(dd|tdd)\s*[<>]=?\s*-5\b/);
  }
});
