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
    <div className="lastrun-card mb-4">
      <span className="lastrun-icon">
        <RotateCcw className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="lastrun-title">Last Analysis</div>
        <div className="lastrun-stats">
          <b>{lastRun.tickerCount}</b> ticker{lastRun.tickerCount === 1 ? '' : 's'} ·{' '}
          {lastRun.preset} horizon · <b>{relTime(lastRun.startedAt)}</b>
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {canView && (
          <button type="button" onClick={onView} className="lastrun-btn">
            View
          </button>
        )}
        <button type="button" onClick={onRerun} className="lastrun-btn primary">
          Re-run
        </button>
      </div>
    </div>
  );
}
