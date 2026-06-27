'use client';

import { useState } from 'react';
import { Printer, FileDown, Loader2 } from 'lucide-react';

import { downloadReportHtml } from '@/lib/report-download';

/**
 * Top toolbar for the chrome-free report page. Two export actions:
 *   1. Save as PDF  → the browser's print dialog (a print stylesheet renders only
 *      #report-root, so the saved PDF is the clean report — no app chrome/toolbar).
 *   2. Download HTML → a self-contained .html snapshot (charts inlined as images).
 * Lives OUTSIDE #report-root and carries `.report-toolbar` so the print rule + the
 * HTML clone both exclude it.
 */
export function ReportToolbar({ symbol, title }: { symbol: string; title: string }) {
  const [building, setBuilding] = useState(false);

  async function handleHtml() {
    if (building) return;
    setBuilding(true);
    try {
      await downloadReportHtml(`majorcycle_${symbol}_report.html`, title);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="report-toolbar flex items-center justify-end gap-2 mb-4">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 bg-[var(--brand-mid)] text-white text-[12px] font-semibold px-3.5 py-2 rounded-[var(--radius-sm)] hover:bg-[var(--brand-deep)] transition-colors"
      >
        <Printer className="w-[14px] h-[14px]" strokeWidth={1.8} />
        Save as PDF
      </button>
      <button
        type="button"
        onClick={handleHtml}
        disabled={building}
        aria-busy={building}
        className="inline-flex items-center gap-1.5 bg-white border border-[var(--border-strong)] text-[var(--text-secondary)] text-[12px] font-semibold px-3.5 py-2 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)] transition-all disabled:opacity-60"
      >
        {building ? (
          <Loader2 className="w-[14px] h-[14px] animate-spin" strokeWidth={1.8} />
        ) : (
          <FileDown className="w-[14px] h-[14px]" strokeWidth={1.8} />
        )}
        {building ? 'Preparing…' : 'Download HTML'}
      </button>
    </div>
  );
}
