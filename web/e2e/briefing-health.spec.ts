import { expect, test } from '@playwright/test';

import { buildBriefing, healthRatingLabel, type BriefingRow } from '../lib/ratings';

/**
 * The Results briefing describes its standout's Financial Health in the same tier the
 * table shows beside it (beta review C-9, 2026-09-28).
 *
 * It said "a fundamentally sound company" for EVERY score under 80 — so a standout
 * rated Adequate (CBA, Health 70) or At Risk was called fundamentally sound, one line
 * above a table colouring the same number gold or red. Pure and credential-free.
 */

function row(ticker: string, health: number | null, rating = 72): BriefingRow {
  return {
    ticker,
    name: `${ticker} Ltd`,
    overallRating: rating,
    overallLabel: 'Constructive',
    financialHealthScore: health,
    valuationZone: 'VALUE',
    valuationScore: 60,
  };
}

const standout = (health: number | null) => buildBriefing([row('ABC', health)]).sentences[1]!;

test('each Health tier is described as that tier, with its number', () => {
  expect(standout(90)).toContain('a financially healthy company, Health 90');
  expect(standout(70)).toContain('a company with adequate financial health, Health 70');
  expect(standout(45)).toContain('a company whose financial health is rated At Risk, Health 45');
  expect(standout(null)).toContain('a company without a Financial Health score,');
});

test('"fundamentally sound" is never said of any score', () => {
  for (const h of [null, 0, 30, 59.9, 60, 70, 79.9, 80, 100]) {
    expect(standout(h), String(h)).not.toContain('fundamentally sound');
  }
});

test('the description follows the SAME tier function the table uses', () => {
  // CONTROL: a sentence that ignored the score would pass the absence test above.
  // Walk every boundary and require the wording to change exactly where the label does.
  const words: Record<string, string> = {
    Healthy: 'financially healthy',
    Adequate: 'adequate financial health',
    'At Risk': 'rated At Risk',
  };
  for (const h of [0, 59, 59.99, 60, 60.01, 79.99, 80, 80.01, 100]) {
    expect(standout(h), String(h)).toContain(words[healthRatingLabel(h)]!);
  }
});
