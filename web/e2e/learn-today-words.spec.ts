import { expect, test } from '@playwright/test';

import { LEARN_FIGURES, todayAgainstTypical } from '../lib/learn-figures';

/**
 * The drawdown explainer's worked example judges a NIGHTLY figure, so its words must
 * be right for any value (owner, 2026-09-29, beta review A-15). Pure and
 * credential-free: every band, both boundaries, and the page's real numbers.
 */

test('every band says what the printed numbers say', () => {
  const t = -24.6;
  expect(todayAgainstTypical(-1.2, t).comparison).toBe('Today’s fall is under half of that.');
  expect(todayAgainstTypical(-12.2, t).comparison).toBe('Today’s fall is under half of that.');
  expect(todayAgainstTypical(-12.3, t).comparison).toBe('Today’s fall is short of that.'); // exactly half
  expect(todayAgainstTypical(-20, t).comparison).toBe('Today’s fall is short of that.');
  expect(todayAgainstTypical(-24.64, t).comparison).toBe('Today’s fall is the same size.'); // prints 24.6
  expect(todayAgainstTypical(-30, t).comparison).toBe('Today’s fall has gone further than that.');
});

test('a share AT its high is not "0.0% below" it', () => {
  expect(todayAgainstTypical(0, -24.6)).toEqual({ atHigh: true, comparison: 'Today it has not fallen at all.' });
  expect(todayAgainstTypical(-0.04, -24.6).atHigh).toBe(true); // prints 0.0%
  expect(todayAgainstTypical(-0.05, -24.6).atHigh).toBe(false); // CONTROL: prints 0.1%
});

test('no fixed judgement survives on the page for tonight’s figures', () => {
  // CONTROL against the defect itself: the words chosen for the real snapshot must
  // be the ones its numbers call for, whatever the nightly run wrote.
  const r = todayAgainstTypical(LEARN_FIGURES.currentDrawdownPct, LEARN_FIGURES.typicalDrawdownPct);
  const today = Math.abs(LEARN_FIGURES.currentDrawdownPct);
  const typical = Math.abs(LEARN_FIGURES.typicalDrawdownPct);
  if (today * 2 < typical - 0.05) expect(r.comparison).toMatch(/under half/);
  if (today > typical + 0.05) expect(r.comparison).toMatch(/further/);
});
