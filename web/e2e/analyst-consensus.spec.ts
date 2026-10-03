import { expect, test } from '@playwright/test';

import { analystTally, consensusFromTally, gradeGroup } from '../lib/analystConsensus';
import { normalizeAnalystRecommendation } from '../lib/format';
import { fmtAnalyst } from '../lib/ratings';
import type { AnalystUpgrade } from '../lib/types';

/**
 * The Smart Money analyst line (owner, 2026-09-28): "Feb 2025 – Sep 2026: latest view of
 * 17 firms: 3 Buy · 10 Hold · 4 Sell", beside the chip it explains. Pure and
 * credential-free. The grade lists are the real latest-per-firm grades of MRNA and AAPL
 * read off the live database that day.
 */

const ev = (firm: string, to_grade: string, date = '2026-09-01', action = 'main'): AnalystUpgrade =>
  ({ firm, to_grade, from_grade: '', action, date });

const MRNA = ['Buy', 'Equal-Weight', 'Equal-Weight', 'Hold', 'Hold', 'In-Line', 'Neutral', 'Neutral', 'Neutral',
  'Outperform', 'Overweight', 'Peer Perform', 'Sector Perform', 'Sell', 'Underperform', 'Underperform', 'Underweight'];
const AAPL = [...Array(9).fill('Buy'), 'Hold', 'Hold', 'Hold', 'Neutral', 'Neutral', 'Neutral', 'Outperform', 'Outperform',
  'Outperform', 'Overweight', 'Overweight', 'Overweight', 'Strong Buy', 'Underperform', 'Underweight', 'Underweight'];

test('Moderna: 17 firms, 3 Buy · 10 Hold · 4 Sell → NEUTRAL', () => {
  const t = analystTally(MRNA.map((g, i) => ev(`F${i}`, g)))!;
  expect([t.firms, t.buy, t.hold, t.sell]).toEqual([17, 3, 10, 4]);
  expect(consensusFromTally(t)).toBe('NEUTRAL');
});

test('Apple: 25 firms, 16 Buy · 6 Hold · 3 Sell → BULLISH', () => {
  const t = analystTally(AAPL.map((g, i) => ev(`F${i}`, g)))!;
  expect([t.firms, t.buy, t.hold, t.sell]).toEqual([25, 16, 6, 3]);
  expect(consensusFromTally(t)).toBe('BULLISH');
});

test('every grade word on record lands in the right group', () => {
  const cases: Array<[string, ReturnType<typeof gradeGroup>]> = [
    ['Action List Buy', 'buy'], // was counted as Hold before the classifiers were merged
    ['Long-Term Buy', 'buy'], ['Outperformer', 'buy'], ['Market Outperform', 'buy'], ['Sector Outperform', 'buy'],
    ['Positive', 'buy'], ['Accumulate', 'buy'],
    ['Sector Underperform', 'sell'], ['Strong Sell', 'sell'], ['Reduce', 'sell'], ['Negative', 'sell'],
    ['Perform', 'hold'], ['Sector Weight', 'hold'], ['Sector Performer', 'hold'], ['Market Perform', 'hold'],
    ['In-Line', 'hold'], ['Mixed', 'hold'],
    ['', null], ['   ', null],
  ];
  for (const [g, want] of cases) expect(gradeGroup(g), g).toBe(want);
});

test("a firm counts once, by its NEWEST rating; the period spans every stored event", () => {
  const t = analystTally([
    ev('Barclays', 'Underweight', '2025-02-18'),
    ev('Barclays', 'Equal-Weight', '2026-08-24'),
    ev('UBS', 'Buy', '2026-09-03'),
  ])!;
  expect([t.firms, t.buy, t.hold, t.sell]).toEqual([2, 1, 1, 0]);
  expect([t.from, t.to]).toEqual(['2025-02-18', '2026-09-03']);
});

test('CONTROL: an empty grade is not a view — it is skipped, not counted as Hold', () => {
  const t = analystTally([ev('A', ''), ev('B', 'Buy'), ev('C', 'Sell', '2026-01-01'), ev('C', '', '2026-09-20')])!;
  // C's newest event has no grade, so its last real view (Sell) stands.
  expect([t.firms, t.buy, t.hold, t.sell]).toEqual([2, 1, 0, 1]);
  expect(analystTally([ev('A', '')])).toBeNull();
  expect(analystTally([])).toBeNull();
});

test('the screener reads the analyst consensus with the stock page’s rule (beta review C-22)', () => {
  // Yahoo's "none" means no consensus: the stock page shows nothing, so the screener
  // must not print "None".
  expect(fmtAnalyst('none')).toBe('—');
  expect(fmtAnalyst(null)).toBe('—');
  for (const raw of ['strong_buy', 'buy', 'outperform', 'overweight', 'hold', 'neutral', 'underperform', 'underweight', 'sell']) {
    expect(fmtAnalyst(raw), raw).toBe(normalizeAnalystRecommendation(raw) ?? '—');
  }
});
