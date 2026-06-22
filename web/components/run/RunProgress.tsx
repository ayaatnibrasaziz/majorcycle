'use client';

import { useEffect, useState } from 'react';

import { CHUNK_SIZE, type RunMeta, type RunProgress as Progress } from '@/lib/analysis';

// Honest progress — driven by REAL completed chunks, not a fake clock. Elapsed
// ticks live; ETA is extrapolated from the average time per completed chunk.

function fmtSecs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RunProgress({
  progress,
  runMeta,
  resultCount,
  unavailableCount,
  onCancel,
}: {
  progress: Progress;
  runMeta: RunMeta;
  resultCount: number;
  unavailableCount: number;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!progress.running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [progress.running]);

  const startMs = new Date(runMeta.startedAt).getTime();
  const elapsed = Math.max(0, now - startMs);
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const processed = Math.min(progress.done * CHUNK_SIZE, runMeta.tickerCount);
  const eta =
    progress.done > 0 && progress.running
      ? (elapsed / progress.done) * (progress.total - progress.done)
      : 0;

  return (
    <div className="card">
      <div className="card-body card-body--compact">
        <div className="mb-1.5 flex items-center justify-between">
          <span
            className="text-[12px] font-semibold text-[var(--text-primary)]"
            aria-live="polite"
          >
            {progress.phase === 'reconciling'
              ? 'Double-checking skipped tickers…'
              : 'Analysing your selection…'}
          </span>
          <span className="font-[var(--font-mono)] text-[12px] text-[var(--text-muted)]">{pct}%</span>
        </div>

        <div
          className="progress-bar-wrap"
          role="progressbar"
          aria-label="Analysis progress"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Chip label="Elapsed" value={fmtSecs(elapsed)} />
          <Chip
            label="Est. remaining"
            value={progress.running && progress.done > 0 ? fmtSecs(eta) : '—'}
          />
          <Chip label="Processed" value={`${processed} / ${runMeta.tickerCount}`} />
          <Chip label="Scored" value={String(resultCount)} valueColor="var(--c-tier-2)" />
          {unavailableCount > 0 && (
            <Chip label="Skipped" value={String(unavailableCount)} valueColor="var(--c-tier-3)" />
          )}
        </div>

        {progress.running && (
          <button type="button" onClick={onCancel} className="btn-cancel mt-3">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="timer-chip-label">{label}</span>
      <span className="timer-chip-val" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </span>
  );
}
