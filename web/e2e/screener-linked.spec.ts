import { expect, test } from '@playwright/test';

import { buildRows } from '../components/results/columns';
import {
  INITIAL_FILTER,
  applyFilters,
  onlyTier,
  shownTiers,
  toggleTier,
} from '../components/results/filters';
import { CHUNK_SIZE, chunkSizeFor } from '../lib/analysis';
import { RUN_SNAPSHOT } from './fixtures/runSnapshot';

/**
 * The Results table and the Opportunity Map share ONE list of tiers switched off
 * (owner, 2026-10-02: "both the table and opportunity map is linked"), and a small
 * screen is split so its progress bar can move (beta review C-15). Pure and
 * credential-free: these drive the real functions both surfaces call.
 */

const rows = () => buildRows(RUN_SNAPSHOT.results, {});
const tiersOf = (f: typeof INITIAL_FILTER) =>
  [...new Set(applyFilters(rows(), f).map((r) => r.overallLabel))].sort();

test.describe('one tier list for the table and the map', () => {
  test('hiding a tier on the map hides it in the table', () => {
    const f = toggleTier(INITIAL_FILTER, 'Bearish');
    expect(tiersOf(f)).not.toContain('Bearish');
    expect(tiersOf(f)).toContain('Cautious');
    // ...and switching it back on restores it.
    expect(tiersOf(toggleTier(f, 'Bearish'))).toContain('Bearish');
  });

  test('the dropdown picks one tier, and the map legend then shows only that one on', () => {
    const f = onlyTier(INITIAL_FILTER, 'Constructive');
    expect(shownTiers(f)).toEqual(['Constructive']);
    expect(tiersOf(f)).toEqual(['Constructive']);
  });

  test('asking for the only tier showing again shows every tier', () => {
    const f = onlyTier(onlyTier(INITIAL_FILTER, 'Neutral'), 'Neutral');
    expect(f.hiddenTiers).toEqual([]);
  });

  test('"All Tiers" clears whatever the legend switched off', () => {
    const f = onlyTier(toggleTier(toggleTier(INITIAL_FILTER, 'Bearish'), 'Neutral'), '');
    expect(f.hiddenTiers).toEqual([]);
  });

  test('CONTROL: the map is given every non-tier filter, so a search narrows it too', () => {
    // Results.tsx hands the map `applyFilters(rows, { ...filter, hiddenTiers: [] })`.
    const f = { ...toggleTier(INITIAL_FILTER, 'Bearish'), query: 'AAAA' };
    const forMap = applyFilters(rows(), { ...f, hiddenTiers: [] });
    expect(forMap.map((r) => r.ticker)).toEqual(['AAAA']);
  });
});

test.describe('a small screen is split so the progress bar moves', () => {
  for (const [n, size] of [[1, 1], [8, 1], [20, 3], [25, 4], [100, 13], [200, 25]] as const) {
    test(`${n} tickers → requests of ${size}`, () => expect(chunkSizeFor(n)).toBe(size));
  }

  test('CONTROL: a large screen still uses the full chunk', () => {
    expect(chunkSizeFor(761)).toBe(CHUNK_SIZE);
  });
});
