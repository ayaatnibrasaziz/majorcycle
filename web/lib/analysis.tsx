'use client';

// Run Analysis client state + orchestration.
//
// The Run tab chunks the user's selected tickers and POSTs each chunk to the
// STATELESS /api/analyze, accumulating results — this gives an honest progress
// bar (real chunks completed, not a fake clock), a Cancel button, and graceful
// per-chunk failure (a failed chunk's tickers fall into `unavailable`).
//
// Live results are held here (context) + mirrored to sessionStorage so Layer E's
// /results tab can render them with no recompute. A single analysis_runs history
// row (INPUTS ONLY — never rating outputs, CLAUDE.md #15) is written on finish,
// failing gracefully so a run still works even if the write is rejected.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { toCamel } from '@/lib/case';
import { createBrowserClient } from '@/lib/supabase/client';
import type {
  AnalysisRunRecord,
  AnalyzeRequest,
  AnalyzeResponse,
  CycleAnalysis,
} from '@/lib/types';

// Each POST stays well under the function's per-request cap (60). Concurrency
// keeps large baskets responsive without hammering the DB.
export const CHUNK_SIZE = 40;
const POOL_SIZE = 3;
const SNAPSHOT_KEY = 'mc:analysis-snapshot-v1';

export interface RunProgress {
  done: number; // chunks completed
  total: number; // chunks total
  running: boolean;
}

export interface RunMeta {
  startedAt: string;
  finishedAt: string | null;
  tickerCount: number;
}

interface AnalysisSnapshot {
  results: CycleAnalysis[];
  unavailable: string[];
  params: AnalyzeRequest | null;
  runMeta: RunMeta | null;
}

interface AnalysisContextValue extends AnalysisSnapshot {
  progress: RunProgress;
  lastRun: AnalysisRunRecord | null;
  run: (req: AnalyzeRequest) => Promise<void>;
  cancel: () => void;
  clear: () => void;
  refreshLastRun: () => Promise<void>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** POST one chunk. Results arrive snake_case → converted to camelCase here. */
async function postChunk(
  tickers: string[],
  req: AnalyzeRequest,
  signal: AbortSignal,
): Promise<AnalyzeResponse> {
  const body: AnalyzeRequest = {
    tickers,
    preset: req.preset,
    ...(req.preset === 'custom'
      ? {
          pullbackThreshold: req.pullbackThreshold,
          profitThreshold: req.profitThreshold,
          lookbackBars: req.lookbackBars,
        }
      : {}),
  };
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  // A session that expired mid-run gets redirected to the /login HTML page;
  // .json() then throws — caught by the caller, which marks the chunk unavailable.
  const json = (await res.json()) as {
    results?: unknown[];
    unavailable?: string[];
    started_at?: string;
    finished_at?: string;
  };
  return {
    results: toCamel<CycleAnalysis[]>((json.results ?? []) as never),
    unavailable: json.unavailable ?? [],
    startedAt: json.started_at ?? '',
    finishedAt: json.finished_at ?? '',
  };
}

async function writeRun(req: AnalyzeRequest, meta: RunMeta, partial: boolean): Promise<void> {
  // INPUTS ONLY — never the computed results. Fails silently: a rejected write
  // (e.g. the results-nullable migration not yet applied, or RLS) must not break
  // the user's run or the results handoff.
  try {
    const supabase = createBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('analysis_runs').insert({
      user_id: user.id,
      preset: req.preset,
      pullback_threshold: req.pullbackThreshold ?? null,
      profit_threshold: req.profitThreshold ?? null,
      lookback_bars: req.lookbackBars ?? null,
      tickers: req.tickers,
      ticker_count: req.tickers.length,
      results: null,
      started_at: meta.startedAt,
      finished_at: meta.finishedAt,
      status: partial ? 'partial' : 'complete',
    });
  } catch {
    // Non-fatal — the run still succeeded; only its history entry is missing.
  }
}

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [results, setResults] = useState<CycleAnalysis[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [params, setParams] = useState<AnalyzeRequest | null>(null);
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null);
  const [progress, setProgress] = useState<RunProgress>({ done: 0, total: 0, running: false });
  const [lastRun, setLastRun] = useState<AnalysisRunRecord | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate the live snapshot from sessionStorage AFTER mount (so navigating to
  // /results and back, or a soft reload, keeps the last run visible). This must
  // be an effect, not a lazy initializer: sessionStorage is unavailable during
  // SSR, and seeding initial state from it on the client would diverge from the
  // server render and trigger a hydration mismatch. The set-state-in-effect rule
  // is a false positive for this one-time post-mount hydration.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SNAPSHOT_KEY);
      if (raw) {
        const snap = JSON.parse(raw) as AnalysisSnapshot;
        /* eslint-disable react-hooks/set-state-in-effect */
        setResults(snap.results ?? []);
        setUnavailable(snap.unavailable ?? []);
        setParams(snap.params ?? null);
        setRunMeta(snap.runMeta ?? null);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // Ignore corrupt/unavailable storage.
    }
  }, []);

  const persist = useCallback((snap: AnalysisSnapshot) => {
    try {
      sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    } catch {
      // Non-fatal (quota / private mode).
    }
  }, []);

  const refreshLastRun = useCallback(async () => {
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('analysis_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastRun(data ? toCamel<AnalysisRunRecord>(data) : null);
    } catch {
      // Non-fatal.
    }
  }, []);

  useEffect(() => {
    // Fetch the latest run history once on mount. setLastRun fires only after an
    // awaited network round-trip (not synchronously), so it cannot cascade;
    // the rule flags the call transitively — a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshLastRun();
  }, [refreshLastRun]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setUnavailable([]);
    setParams(null);
    setRunMeta(null);
    setProgress({ done: 0, total: 0, running: false });
    try {
      sessionStorage.removeItem(SNAPSHOT_KEY);
    } catch {
      // Non-fatal.
    }
  }, []);

  const run = useCallback(
    async (req: AnalyzeRequest) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      const chunks = chunk(req.tickers, CHUNK_SIZE);
      const startedAt = new Date().toISOString();
      const meta: RunMeta = { startedAt, finishedAt: null, tickerCount: req.tickers.length };

      setParams(req);
      setResults([]);
      setUnavailable([]);
      setRunMeta(meta);
      setProgress({ done: 0, total: chunks.length, running: true });

      const allResults: CycleAnalysis[] = [];
      const allUnavailable: string[] = [];
      let done = 0;
      let next = 0;

      const worker = async (): Promise<void> => {
        while (!signal.aborted) {
          const i = next++;
          if (i >= chunks.length) return;
          const tickers = chunks[i];
          if (!tickers) return;
          try {
            const r = await postChunk(tickers, req, signal);
            allResults.push(...r.results);
            allUnavailable.push(...r.unavailable);
          } catch {
            if (signal.aborted) return;
            allUnavailable.push(...tickers); // graceful: whole chunk unavailable
          } finally {
            if (!signal.aborted) {
              done += 1;
              setProgress({ done, total: chunks.length, running: true });
              setResults([...allResults]);
              setUnavailable([...allUnavailable]);
            }
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(POOL_SIZE, chunks.length) }, () => worker()),
      );

      const finishedAt = new Date().toISOString();
      const finalMeta: RunMeta = { ...meta, finishedAt };
      const aborted = signal.aborted;
      setRunMeta(finalMeta);
      setProgress((p) => ({ ...p, running: false }));
      persist({ results: allResults, unavailable: allUnavailable, params: req, runMeta: finalMeta });

      if (!aborted) {
        // A run that yielded nothing usable still records inputs; "partial" when
        // some tickers couldn't be analysed.
        await writeRun(req, finalMeta, allUnavailable.length > 0);
        await refreshLastRun();
      }
      abortRef.current = null;
    },
    [persist, refreshLastRun],
  );

  const value = useMemo<AnalysisContextValue>(
    () => ({
      results,
      unavailable,
      params,
      runMeta,
      progress,
      lastRun,
      run,
      cancel,
      clear,
      refreshLastRun,
    }),
    [results, unavailable, params, runMeta, progress, lastRun, run, cancel, clear, refreshLastRun],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used within an AnalysisProvider');
  return ctx;
}
