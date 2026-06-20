'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';

import { useAnalysis } from '@/lib/analysis';
import { PRESETS } from '@/lib/presets';
import type { AnalyzeRequest } from '@/lib/types';
import type { UniverseStock } from '@/lib/universe.server';

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

  // When a run begins (from either the Run Analysis button or Re-run), smooth-scroll
  // the live progress into view so the owner sees it working without manually
  // scrolling — the progress block renders below the (often tall) selection panel.
  const progressAnchorRef = useRef<HTMLDivElement>(null);
  const wasRunning = useRef(false);
  useEffect(() => {
    if (analysis.progress.running && !wasRunning.current) {
      progressAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    wasRunning.current = analysis.progress.running;
  }, [analysis.progress.running]);

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
    <div className="max-w-[860px]">
      <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-[var(--text-muted)]">
        Screen a basket or your own list through the Major Cycle + health scoring, then
        rank them. Pick a ready-made basket, search and add, or import a CSV.
      </p>

      {showLastRun && lastRun && (
        <LastAnalysisCard
          lastRun={lastRun}
          canView={false}
          onView={() => router.push('/results')}
          onRerun={rerunLast}
        />
      )}

      <div className="flex flex-col gap-3.5">
        <Section title="Choose what to analyse">
          <div className="space-y-4">
            <div>
              <div className="run-sublabel">Quick baskets</div>
              <BasketPicker universe={universe} onAdd={addTickers} />
            </div>
            <div>
              <div className="run-sublabel">Search &amp; add</div>
              <TickerSearchAdd selected={selectedSet} onAdd={(t) => addTickers([t])} />
            </div>
            <div>
              <div className="run-sublabel">Import CSV</div>
              <CsvImport knownTickers={knownTickers} onAdd={addTickers} />
            </div>
            <div className="border-t border-[var(--border)] pt-3.5">
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
            className="btn-run"
          >
            <Play className="h-4 w-4" />
            {selected.length > 0 ? `Run Analysis · ${selected.length}` : 'Run Analysis'}
          </button>
        </div>

        {/* Scroll target: a run start brings the live progress (rendered here) into view. */}
        <div ref={progressAnchorRef} style={{ scrollMarginTop: 72 }} className="flex flex-col gap-3.5 empty:hidden">
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
              cancelled={runMeta?.cancelled ?? false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
