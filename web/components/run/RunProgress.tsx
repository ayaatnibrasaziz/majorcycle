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
    <div className="card card-body--compact mt-4 p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">
          {progress.running ? 'Analysing your selection…' : 'Finishing up…'}
        </span>
        <span className="font-mono text-[12px] text-[var(--text-muted)]">{pct}%</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-stripe)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-mid),var(--brand-bright))] transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] text-[var(--text-muted)]">
        <span>
          Elapsed <span className="text-[var(--text-secondary)]">{fmtSecs(elapsed)}</span>
        </span>
        <span>
          Est. remaining{' '}
          <span className="text-[var(--text-secondary)]">
            {progress.running && progress.done > 0 ? fmtSecs(eta) : '—'}
          </span>
        </span>
        <span>
          Processed{' '}
          <span className="text-[var(--text-secondary)]">
            {processed} / {runMeta.tickerCount}
          </span>
        </span>
        <span>
          Scored <span className="text-[var(--c-tier-2)]">{resultCount}</span>
        </span>
        {unavailableCount > 0 && (
          <span>
            Skipped <span className="text-[#D4A017]">{unavailableCount}</span>
          </span>
        )}
      </div>

      {progress.running && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:border-[var(--c-tier-5)] hover:text-[var(--c-tier-5)]"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
