'use client';

import { useEffect, useState } from 'react';

import type { RunMeta, RunProgress as Progress } from '@/lib/analysis';

// Honest progress — driven by REAL completed requests, not a fake clock. Elapsed
// ticks live.
//
// ⚠️ Three things this got wrong until 2026-10-02 (beta review C-15/16/17):
// - the bar counted CHUNKS, and a run of 25 or fewer was one chunk, so it sat at 0%
//   until the end (fixed in `chunkSizeFor`, and the bar now counts tickers);
// - "Processed" was `chunks done × 25`, which is wrong whenever the short last chunk
//   comes back before a full one — it now counts the tickers actually returned;
// - the ETA divided by the solo warm-up chunk, which carries the cold start, and it
//   grew every tenth of a second while a request was out. It now takes the pace
//   measured after the warm-up, at the moment the last request came back, and counts
//   down from there.

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
  const total = runMeta.tickerCount;
  const processed = Math.min(progress.tickersDone, total);
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  // Pace after the warm-up chunk. Unknown until a second request has come back.
  const paced = processed - progress.warmedTickers;
  const { warmedAt, lastAt } = progress;
  const eta =
    progress.running &&
    progress.phase !== 'reconciling' &&
    paced > 0 &&
    warmedAt !== null &&
    lastAt !== null &&
    lastAt > warmedAt
      ? Math.max(0, ((total - processed) * (lastAt - warmedAt)) / paced - (now - lastAt))
      : null;

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
          {/* A unitless fraction for `scaleX`, not a width — the bar is full-width
              and scaled, so growing it costs no layout mid-run. See globals.css. */}
          <div
            className="progress-bar-fill"
            style={{ '--fill': String(pct / 100) } as React.CSSProperties}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Chip label="Elapsed" value={fmtSecs(elapsed)} />
          <Chip
            label="Est. remaining"
            value={eta === null ? '—' : eta < 500 ? 'Almost done' : fmtSecs(eta)}
          />
          <Chip label="Processed" value={`${processed} / ${total}`} />
          <Chip label="Scored" value={String(resultCount)} valueColor="var(--status-success)" />
          {unavailableCount > 0 && (
            <Chip label="Skipped" value={String(unavailableCount)} valueColor="var(--status-warning)" />
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
