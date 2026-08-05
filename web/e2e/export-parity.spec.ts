import { test, expect } from '@playwright/test';

import { exportText, type ExportFmt } from '../lib/ratings';
import { cellValue } from '../lib/xlsx';

/**
 * The two exports of a screener run must show the SAME figure.
 *
 * `/results` offers Download CSV and Download Excel from one menu, over one run.
 * They went through two different rounding rules — `toFixed(2)` for the CSV,
 * `Math.round(v * 100) / 100` for the workbook — which disagree by one cent
 * whenever a value sits on a half-cent, because `toFixed` rounds the exact binary
 * double downwards there while `Math.round` and the on-screen `Intl.NumberFormat`
 * both round up.
 *
 * Found on the LIVE site on 2026-08-06 by downloading both files and reading the
 * cells: Barrick's analyst target was **CA$65.76** on the page and in the .xlsx,
 * and **65.75** in the .csv. Nothing was red — `ratings.ts` even carried a comment
 * asserting the two files "always show identical figures".
 *
 * Pure and credential-free, so it always runs (same posture as `entitlement.spec.ts`).
 * Both functions are imported, never re-implemented: a third copy of the rounding
 * rule is the very thing that caused this (CLAUDE.md 11c).
 */

/** Values that land exactly on a half-cent — the only place the two rules parted. */
const HALF_CENT = [65.755, 0.005, 1.005, 2.675, 10.125, 1234.565, -3.455];

/** Ordinary values, so the guard proves it is comparing something real. */
const ORDINARY = [0, 1, 2.39, 309.38, -26.46, 148.75, 1e6 + 0.5, 0.001];

function xlsxAsShown(value: number, xf: ExportFmt): string {
  const v = cellValue(value, xf);
  // Excel renders a numeric cell through its number format: `0` = whole,
  // `0.00` = exactly two decimals. That is what the reader compares with the CSV.
  return typeof v === 'number' ? (xf === 'int' ? String(v) : v.toFixed(2)) : String(v);
}

test.describe('CSV and Excel exports agree', () => {
  for (const xf of ['num2', 'int'] as const) {
    test(`${xf}: every sample renders identically in both files`, () => {
      for (const v of [...HALF_CENT, ...ORDINARY]) {
        expect(exportText(v, xf), `value ${v} as ${xf}`).toBe(xlsxAsShown(v, xf));
      }
    });
  }

  test('the half-cent case specifically — Barrick’s CA$65.76', () => {
    // The exact figure from the live run. It must not read 65.75 anywhere.
    expect(exportText(65.755, 'num2')).toBe('65.76');
    expect(xlsxAsShown(65.755, 'num2')).toBe('65.76');
  });

  test('both files agree with what the SCREEN shows', () => {
    // The page formats with Intl, which is the reader's reference point. If an
    // export disagreed with the page, the export would be the wrong one.
    const onScreen = (v: number) =>
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      }).format(v);
    for (const v of [...HALF_CENT, ...ORDINARY]) {
      expect(exportText(v, 'num2'), `value ${v} vs the screen`).toBe(onScreen(v));
    }
  });

  test('empty stays empty in both — a withheld figure must not become 0.00', () => {
    // Cross-currency FCF yield is deliberately withheld (CLAUDE.md 14e-2); it must
    // arrive as a blank cell, never as a number a reader would take at face value.
    for (const empty of [null, ''] as const) {
      expect(exportText(empty, 'num2')).toBe('');
      expect(cellValue(empty, 'num2')).toBe('');
    }
  });
});
