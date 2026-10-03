import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { RATING_BANDS, RATING_PARTS, RATING_SUMMARY } from '../lib/ratingDefinition';
import { RATING_WEIGHTS, tierFromScore } from '../lib/ratings';

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
