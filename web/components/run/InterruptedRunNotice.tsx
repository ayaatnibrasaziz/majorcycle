'use client';

import Link from 'next/link';

import { useAnalysis } from '@/lib/analysis';

/**
 * Says so when this tab was reloaded or closed while a screen was still running.
 *
 * A run lives in the page while it works, so a reload ends it. Until 2026-10-02 that
 * happened in silence: the progress simply vanished and the Results tab showed an
 * older run, or "No analysis run yet", as if nothing had been asked for (beta review).
 * The marker that makes this possible is written in `lib/analysis.tsx` (`RUNNING_KEY`).
 */
export function InterruptedRunNotice({ showRunLink = false }: { showRunLink?: boolean }) {
  const { interrupted, dismissInterrupted, progress } = useAnalysis();
  if (!interrupted || progress.running) return null;
  const n = interrupted.tickerCount;
  return (
    <div
      className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-stripe)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)]"
      role="status"
    >
      <p className="min-w-0 flex-1">
        <strong className="text-[var(--text-primary)]">Your last run did not finish.</strong>{' '}
        The page was reloaded or closed while it was screening {n} {n === 1 ? 'stock' : 'stocks'}, so
        it stopped part way.{' '}
        {showRunLink ? (
          <>
            <Link href="/run" className="results-empty-link">
              Run it again
            </Link>
            .
          </>
        ) : (
          'Choose your stocks and run it again below.'
        )}
      </p>
      <button type="button" className="results-empty-link shrink-0" onClick={dismissInterrupted}>
        Dismiss
      </button>
    </div>
  );
}
