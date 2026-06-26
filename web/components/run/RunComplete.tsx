'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight, Ban } from 'lucide-react';

import type { CycleAnalysis } from '@/lib/types';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';

// Post-run summary. Top pick + "Constructive or better" count are computed here
// from the live results (client-side) — they are rating outputs and are never
// read from the DB (CLAUDE.md #15). "View Full Results" hands off to /results,
// where Layer E renders the ranked table from the same in-memory results.
//
// A run stopped via Cancel reports honestly ("Run cancelled — N scored so far"),
// never the green "Analysis Complete" badge.

function fmtSecs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RunComplete({
  results,
  unavailableCount,
  runtimeMs,
  cancelled = false,
}: {
  results: CycleAnalysis[];
  unavailableCount: number;
  runtimeMs: number;
  cancelled?: boolean;
}) {
  const router = useRouter();

  if (results.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="text-[14px] font-bold text-[var(--text-primary)]">
            {cancelled ? 'Run cancelled' : 'No stocks could be analysed'}
          </div>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
            {cancelled
              ? 'You stopped the run before any stocks were scored. Adjust your selection and run again when ready.'
              : unavailableCount > 0
                ? `All ${unavailableCount} selected ticker${unavailableCount === 1 ? '' : 's'} were unavailable or outside our coverage.`
                : 'Try selecting some stocks and running again.'}
          </p>
        </div>
      </div>
    );
  }

  // Prefer a fully-scored name as the top pick — a stock with Financial Health
  // withheld carries a cycle-only Overall, so it shouldn't headline unless nothing
  // in the run is fully scored. Matches the Results briefing (ratings.ts buildBriefing).
  const complete = results.filter((r) => r.financialHealthScore != null);
  const pickPool = complete.length > 0 ? complete : results;
  const topPick = pickPool.reduce((best, r) => (r.overallRating > best.overallRating ? r : best));
  const positive = results.filter(
    (r) => r.overallLabel === 'High Conviction' || r.overallLabel === 'Constructive',
  ).length;

  return (
    <div className="card">
      <div className="card-body">
        <div className="mb-3">
          {cancelled ? (
            <span className="rc-badge rc-badge--cancelled">
              <Ban className="h-3.5 w-3.5" /> Run Cancelled
            </span>
          ) : (
            <span className="rc-badge">
              <CheckCircle2 className="h-3.5 w-3.5" /> Analysis Complete
            </span>
          )}
        </div>

        <p className="rc-headline mb-4">
          {cancelled && (
            <span className="text-[12px] font-semibold text-[var(--text-muted)]">
              Stopped early —{' '}
            </span>
          )}
          Top pick:{' '}
          <Link href={tickerToPath(topPick.ticker)} className="rc-mono rc-link">
            {tickerToUrlParts(topPick.ticker).symbol}
          </Link>{' '}
          with a rating of <span className="rc-mono">{topPick.overallRating}/100</span>{' '}
          <span className="text-[12px] font-semibold text-[var(--text-muted)]">
            ({topPick.overallLabel})
          </span>
        </p>

        <div className="rc-stat-row mb-4">
          <Stat label={cancelled ? 'Scored So Far' : 'Stocks Scored'} value={String(results.length)} />
          <Stat label="Constructive or Better" value={`${positive} / ${results.length}`} />
          <Stat label={cancelled ? 'Ran For' : 'Runtime'} value={fmtSecs(runtimeMs)} />
        </div>

        <button type="button" onClick={() => router.push('/results')} className="btn-run">
          View {cancelled ? 'Partial' : 'Full'} Results <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rc-stat">
      <div className="rc-stat-label">{label}</div>
      <div className="rc-stat-val">{value}</div>
    </div>
  );
}
