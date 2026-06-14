'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';

import { useAnalysis } from '@/lib/analysis';
import { PRESETS } from '@/lib/presets';
import type { AnalyzeRequest } from '@/lib/types';
import type { UniverseStock } from '@/lib/universe.server';
import { cn } from '@/lib/utils';

import { BasketPicker } from './BasketPicker';
import { CsvImport } from './CsvImport';
import {
  HorizonSettings,
  validateHorizon,
  type HorizonValue,
} from './HorizonSettings';
import { LastAnalysisCard } from './LastAnalysisCard';
import { RunComplete } from './RunComplete';
import { RunProgress } from './RunProgress';
import { SelectedTickers } from './SelectedTickers';
import { TickerSearchAdd } from './TickerSearchAdd';

const LARGE_RUN_THRESHOLD = 100;

const DEFAULT_HORIZON: HorizonValue = {
  preset: 'medium',
  pullbackThreshold: PRESETS.medium.pullbackThreshold,
  profitThreshold: PRESETS.medium.profitThreshold,
  lookbackBars: PRESETS.medium.lookbackBars,
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

export function RunAnalysis({ universe }: { universe: UniverseStock[] }) {
  const router = useRouter();
  const analysis = useAnalysis();
  const { progress, results, unavailable, runMeta, lastRun, run, cancel } = analysis;

  const [selected, setSelected] = useState<string[]>([]);
  const [horizon, setHorizon] = useState<HorizonValue>(DEFAULT_HORIZON);
  const [hasRun, setHasRun] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const knownTickers = useMemo(() => new Set(universe.map((s) => s.ticker)), [universe]);

  const addTickers = (tickers: string[]) =>
    setSelected((prev) => {
      const set = new Set(prev);
      const next = [...prev];
      for (const t of tickers) {
        const up = t.trim().toUpperCase();
        if (up && !set.has(up)) {
          set.add(up);
          next.push(up);
        }
      }
      return next;
    });

  const removeTicker = (ticker: string) =>
    setSelected((prev) => prev.filter((t) => t !== ticker));
  const clearSelected = () => setSelected([]);

  const horizonError = validateHorizon(horizon);
  const canRun = selected.length > 0 && horizonError === null && !progress.running;

  const buildRequest = (): AnalyzeRequest => ({
    tickers: selected,
    preset: horizon.preset,
    ...(horizon.preset === 'custom'
      ? {
          pullbackThreshold: horizon.pullbackThreshold,
          profitThreshold: horizon.profitThreshold,
          lookbackBars: horizon.lookbackBars,
        }
      : {}),
  });

  const startRun = (req: AnalyzeRequest) => {
    setHasRun(true);
    void run(req);
  };

  const rerunLast = () => {
    if (!lastRun) return;
    const req: AnalyzeRequest = {
      tickers: lastRun.tickers,
      preset: lastRun.preset,
      ...(lastRun.preset === 'custom'
        ? {
            pullbackThreshold: lastRun.pullbackThreshold,
            profitThreshold: lastRun.profitThreshold,
            lookbackBars: lastRun.lookbackBars,
          }
        : {}),
    };
    setSelected(lastRun.tickers);
    startRun(req);
  };

  const finished = !progress.running && runMeta?.finishedAt != null;
  // Show the summary after a run this session (even if 0 scored — the card has
  // an empty state) or when results were hydrated from a prior session.
  const showComplete = finished && (hasRun || results.length > 0);
  // Returning user with DB history but no in-session results.
  const showLastRun = !progress.running && !showComplete && lastRun != null;
  const runtimeMs =
    runMeta?.finishedAt != null
      ? new Date(runMeta.finishedAt).getTime() - new Date(runMeta.startedAt).getTime()
      : 0;

  return (
    <div className="max-w-[920px]">
      <div className="mb-4">
        <h1 className="text-[18px] font-bold text-[var(--text-primary)]">Run Analysis</h1>
        <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
          Screen a list of stocks through the Major Cycle and health scoring, then rank
          them. Pick a ready-made basket or build your own list.
        </p>
      </div>

      {showLastRun && lastRun && (
        <LastAnalysisCard
          lastRun={lastRun}
          canView={false}
          onView={() => router.push('/results')}
          onRerun={rerunLast}
        />
      )}

      <div className="flex flex-col gap-4">
        <Section title="Choose what to analyse">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Quick baskets
              </div>
              <BasketPicker universe={universe} onAdd={addTickers} />
            </div>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Search &amp; add
              </div>
              <TickerSearchAdd selected={selectedSet} onAdd={(t) => addTickers([t])} />
            </div>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Import CSV
              </div>
              <CsvImport knownTickers={knownTickers} onAdd={addTickers} />
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <SelectedTickers
                tickers={selected}
                onRemove={removeTicker}
                onClear={clearSelected}
              />
            </div>
          </div>
        </Section>

        <Section title="Investing horizon">
          <HorizonSettings value={horizon} onChange={setHorizon} />
        </Section>

        <div>
          {selected.length > LARGE_RUN_THRESHOLD && (
            <p className="mb-2 text-center text-[12px] text-[var(--text-muted)]">
              Screening {selected.length} stocks — this may take a minute or two.
            </p>
          )}
          <button
            type="button"
            disabled={!canRun}
            onClick={() => startRun(buildRequest())}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-3 text-[14px] font-semibold text-white transition-colors',
              canRun
                ? 'bg-[var(--brand-mid)] hover:bg-[var(--brand-bright)]'
                : 'cursor-not-allowed bg-[var(--border-strong)]',
            )}
          >
            <Play className="h-4 w-4" />
            {selected.length > 0 ? `Run Analysis · ${selected.length}` : 'Run Analysis'}
          </button>
        </div>

        {progress.running && runMeta && (
          <RunProgress
            progress={progress}
            runMeta={runMeta}
            resultCount={results.length}
            unavailableCount={unavailable.length}
            onCancel={cancel}
          />
        )}

        {showComplete && (
          <RunComplete
            results={results}
            unavailableCount={unavailable.length}
            runtimeMs={runtimeMs}
          />
        )}
      </div>
    </div>
  );
}
