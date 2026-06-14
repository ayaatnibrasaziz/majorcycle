'use client';

import { RotateCcw } from 'lucide-react';

import type { AnalysisRunRecord } from '@/lib/types';

// "Last Analysis" — rendered from the latest analysis_runs row (INPUTS ONLY, so
// it survives reloads/new sessions). "Re-run" re-derives from those inputs;
// "View" shows the current session's results (else re-runs to repopulate them).

function relTime(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function LastAnalysisCard({
  lastRun,
  canView,
  onView,
  onRerun,
}: {
  lastRun: AnalysisRunRecord;
  canView: boolean;
  onView: () => void;
  onRerun: () => void;
}) {
  return (
    <div className="card mb-4 flex items-center gap-4 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-light)] text-[var(--brand-mid)]">
        <RotateCcw className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Last Analysis
        </div>
        <div className="text-[13px] text-[var(--text-secondary)]">
          <b className="text-[var(--text-primary)]">{lastRun.tickerCount}</b> ticker
          {lastRun.tickerCount === 1 ? '' : 's'} · {lastRun.preset} horizon ·{' '}
          <b className="text-[var(--text-primary)]">{relTime(lastRun.startedAt)}</b>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {canView && (
          <button
            type="button"
            onClick={onView}
            className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-bright)]"
          >
            View
          </button>
        )}
        <button
          type="button"
          onClick={onRerun}
          className="rounded-[var(--radius-sm)] bg-[var(--brand-mid)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--brand-bright)]"
        >
          Re-run
        </button>
      </div>
    </div>
  );
}
