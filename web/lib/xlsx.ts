// Colour-coded .xlsx export for the Results screener (the Export ▸ Download Excel
// option). Mirrors the CSV path in ratings.ts (`downloadCsv`) but produces a styled
// workbook: a branded header row, and the three MajorCycle scores (Overall,
// Valuation, Health) painted by their rating tier — so the download reads like the
// on-screen table. ExcelJS is imported dynamically (only when the user actually
// exports), so it never lands in the initial page bundle.
//
// FH-incomplete rows (Financial Health withheld) get their Overall cell muted to
// mirror the on-screen "Cycle-only" badge + de-rank (Layer E / E6). Rows arrive in
// the same filtered+sorted order as the table, so the export matches it exactly.

import type { Row } from 'exceljs';

import type { ResultRow } from '@/components/results/columns';
import { exportText, RATING_TIER_HEX, tierFromScore, type ExportFmt } from '@/lib/ratings';

type ExportColumn = { header: string; get: (r: ResultRow) => string | number | null; xf?: ExportFmt };

// Excel number-format string per export precision (mirrors the CSV's toFixed):
// `0` = whole number, `0.00` = exactly two decimals (so 1 displays as "1.00").
const NUM_FMT: Record<ExportFmt, string> = { int: '0', num2: '0.00' };

// Coerce one export value to its Excel cell value — numbers stay numeric (so Excel
// can sort/sum) but are DERIVED from the string `exportText` already produced for
// the CSV, rather than rounded a second time here. This file used to round with
// `Math.round(v * 100) / 100`, which disagreed with the CSV's `toFixed(2)` by a cent
// on half-cent values and with the on-screen `Intl` on others — three rules for one
// number (CLAUDE.md 11c). Barrick's analyst target read CA$65.76 on the page and in
// this workbook, and 65.75 in the .csv of the same run, live, on 2026-08-06.
//
// Exported so `e2e/export-parity.spec.ts` binds the REAL function, never a copy.
export function cellValue(value: string | number | null, xf?: ExportFmt): string | number {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const shown = exportText(value, xf);
    // `useGrouping: false` keeps this parseable; a NaN could only mean exportText
    // returned something non-numeric, in which case the raw number is safer than a
    // blank cell.
    const n = Number(shown);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

/**
 * Tier → ARGB fill, DERIVED from the one palette rather than restated.
 *
 * ⚠️ This was a hand-typed copy of all five hexes until 2026-08-22, and it is the
 * reason the workbook mattered here at all: `paint()` below writes **white bold
 * text** onto these fills, so the downloaded `.xlsx` carried the identical
 * contrast failure as the on-screen chips — Neutral at 2.38 against a 4.5 floor.
 * Fixing the website alone would have left every customer's spreadsheet wrong,
 * and nothing would have gone red, because no guard reads a workbook's fills.
 *
 * ExcelJS wants `AARRGGBB`, so the alpha prefix is added here and the colour is
 * never restated — a second list is a second product (CLAUDE.md 11c iii/11d).
 * `web/e2e/export-parity.spec.ts` imports this real map, so it cannot drift.
 */
const TIER_ARGB: Record<1 | 2 | 3 | 4 | 5, string> = Object.fromEntries(
  ([1, 2, 3, 4, 5] as const).map((t) => [t, `FF${RATING_TIER_HEX[t].slice(1).toUpperCase()}`]),
) as Record<1 | 2 | 3 | 4 | 5, string>;

/** Financial Health uses a 3-tier scale (matches healthColor): Healthy / Adequate / At Risk. */
function healthTier(score: number): 1 | 3 | 5 {
  if (score >= 80) return 1;
  if (score >= 60) return 3;
  return 5;
}

/** Build + trigger a client-side .xlsx download. No-op on the server. */
export async function downloadXlsx(
  filename: string,
  rows: ResultRow[],
  columns: ReadonlyArray<ExportColumn>,
): Promise<void> {
  if (typeof document === 'undefined') return;

  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Results');

  // Fit each column to its widest cell — the header or any value's displayed text
  // (exportText gives the same string the cell shows, incl. "1.00" trailing zeros).
  const widths = columns.map((c) => c.header.length);
  for (const r of rows) {
    columns.forEach((c, i) => {
      const len = exportText(c.get(r), c.xf).length;
      if (len > (widths[i] ?? 0)) widths[i] = len;
    });
  }
  ws.columns = columns.map((c, i) => ({
    header: c.header,
    key: c.header,
    width: Math.min(Math.max((widths[i] ?? 10) + 2, 8), 42),
  }));

  const n = columns.length;
  // Thin border with no explicit colour = Excel's automatic (black) border, on every
  // populated cell.
  const thin = { style: 'thin' as const };
  const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

  // Branded header — styled PER CELL (not row-level), so the navy fill stays inside
  // the data columns and never bleeds across the empty tail (AL…XFD).
  const head = ws.getRow(1);
  head.height = 20;
  for (let i = 1; i <= n; i++) {
    const cell = head.getCell(i);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle' };
    cell.border = allBorders;
  }

  // 1-based column indices of the cells we colour-code.
  const colIndex = (h: string) => columns.findIndex((c) => c.header === h) + 1;
  const overallCol = colIndex('Overall Rating');
  const valuationCol = colIndex('Valuation Score');
  const healthCol = colIndex('Health Score');

  const paint = (row: Row, col: number, tier: 1 | 2 | 3 | 4 | 5) => {
    if (col <= 0) return;
    const cell = row.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TIER_ARGB[tier] } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  };

  for (const r of rows) {
    const row = ws.addRow(columns.map((c) => cellValue(c.get(r), c.xf)));
    // All borders where data is present + per-column number format (so 2dp columns
    // show trailing zeros like the CSV); tier fills/fonts are layered on top.
    for (let i = 1; i <= n; i++) {
      const cell = row.getCell(i);
      cell.border = allBorders;
      const xf = columns[i - 1]?.xf;
      if (xf && typeof cell.value === 'number') cell.numFmt = NUM_FMT[xf];
    }
    paint(row, overallCol, tierFromScore(r.overallRating));
    paint(row, valuationCol, tierFromScore(r.valuationScore));
    if (r.financialHealthScore != null) {
      paint(row, healthCol, healthTier(r.financialHealthScore));
    }
    // FH withheld → mute the Overall cell (mirror the on-screen "Cycle-only" badge).
    if (r.financialHealthScore == null && overallCol > 0) {
      const cell = row.getCell(overallCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.font = { italic: true, color: { argb: 'FF6B7787' } };
      cell.alignment = { horizontal: 'center' };
    }
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }];
  // Filter dropdowns on every column by default.
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: n } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
