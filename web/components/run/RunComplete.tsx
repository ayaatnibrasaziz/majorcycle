'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight } from 'lucide-react';

import type { CycleAnalysis } from '@/lib/types';
import { tickerToUrlParts } from '@/lib/ticker';

// Post-run summary. Top pick + "Constructive or better" count are computed here
// from the live results (client-side) — they are rating outputs and are never
// read from the DB (CLAUDE.md #15). "View Full Results" hands off to /results,
// where Layer E renders the ranked table from the same in-memory results.

function fmtSecs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RunComplete({
  results,
  unavailableCount,
  runtimeMs,
}: {
  results: CycleAnalysis[];
  unavailableCount: number;
  runtimeMs: number;
}) {
  const router = useRouter();

  if (results.length === 0) {
    return (
      <div className="card card-body mt-4 p-5 text-center">
        <div className="text-[14px] font-bold text-[var(--text-primary)]">
          No stocks could be analysed
        </div>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          {unavailableCount > 0
            ? `All ${unavailableCount} selected ticker${unavailableCount === 1 ? '' : 's'} were unavailable or outside our coverage.`
            : 'Try selecting some stocks and running again.'}
        </p>
      </div>
    );
  }

  const topPick = results.reduce((best, r) => (r.overallRating > best.overallRating ? r : best));
  const positive = results.filter(
    (r) => r.overallLabel === 'High Conviction' || r.overallLabel === 'Constructive',
  ).length;

  return (
    <div className="card mt-4 overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--bg-stripe)] px-5 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--c-tier-2)]">
          <CheckCircle2 className="h-4 w-4" /> Analysis Complete
        </span>
      </div>
      <div className="p-5">
        <p className="text-[14px] text-[var(--text-primary)]">
          Top pick:{' '}
          <span className="font-mono font-bold">{tickerToUrlParts(topPick.ticker).symbol}</span>{' '}
          with a rating of <span className="font-mono font-bold">{topPick.overallRating}/100</span>{' '}
          <span className="text-[12px] font-semibold text-[var(--text-muted)]">
            ({topPick.overallLabel})
          </span>
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Stocks Scored" value={String(results.length)} />
          <Stat label="Constructive or Better" value={`${positive} / ${results.length}`} />
          <Stat label="Runtime" value={fmtSecs(runtimeMs)} />
        </div>

        <button
          type="button"
          onClick={() => router.push('/results')}
          className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--brand-mid)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--brand-bright)]"
        >
          View Full Results <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[16px] font-bold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
