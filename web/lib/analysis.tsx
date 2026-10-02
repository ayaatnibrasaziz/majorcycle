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
  useSyncExternalStore,
} from 'react';

import { toCamel } from '@/lib/case';
import { PRESETS } from '@/lib/presets';
// ⚠️ `createBrowserClient` is imported ON DEMAND at its two call sites below, not
// here. See the note on `loadSupabase`.
import type {
  AnalysisRunRecord,
  AnalyzeRequest,
  AnalyzeResponse,
  RunResult,
} from '@/lib/types';

// Each POST stays well under the function's per-request cap (60). Concurrency
// keeps large baskets responsive without hammering the DB.
// Smaller chunks → the progress bar (Processed / Scored / ETA) updates several
// times during a multi-ticker run instead of jumping 0→100. Each chunk is a
// fast warm function call on Vercel; per-ticker bar fetches are parallel and
// results are cached server-side, so the extra requests are cheap.
// ⚠️ RAISED 10 → 25 on 2026-09-08, and the number is an arithmetic bound rather
// than a guess. A 761-ticker screen was 77 separate function invocations; once
// the per-ticker database cost fell 25x (`get_cycle_bars_json`, see
// web/api/analyze.py) the invocation overhead became the larger share, and 77 of
// them is simply 46 more cold-start risks and 46 fewer warm-cache hits than the
// work needs.
//
// The bound that makes 25 safe is the FALLBACK case, not the fast one: if the
// new RPC were ever missing, every ticker reverts to the old ~0.85s path, so a
// 25-ticker chunk at analyze.py's 4 workers is 7 x 0.85s ≈ 6s against
// `maxDuration: 60`. That is 10x headroom on the WORST path — a margin, not a
// boundary (11i-b) — and roughly 1s on the path that actually ships.
//
// ⚠️ POOL_SIZE IS STILL 3 AND MUST STAY 3 FOR NOW. Total concurrent Supabase
// reads are POOL_SIZE x analyze.py's `max_workers`, and that product moved 6 ->
// 12 on 2026-09-08 when `max_workers` went 2 -> 4 (the reasoning, and the
// measurement behind it, are in web/api/analyze.py above `max_workers`). Moving
// this number in the same change would make the next `analysis_runs` reading
// unattributable, which is the whole reason the last change left it alone.
// Raise POOL_SIZE only after a real run has shown the step to 12 was clean.
export const CHUNK_SIZE = 25;
const POOL_SIZE = 3;
// A chunk whose POST fails (cold-start timeout, transient network blip) is retried
// inline this many extra times before its tickers are set aside — so one bad
// request doesn't silently drop 10 valid tickers.
const CHUNK_RETRIES = 1;
const RETRY_BACKOFF_MS = 600;
// Final reconciliation pass: any ticker still unavailable after the batch + warm
// retry is re-run ONE AT A TIME (single-ticker request = analyze.py's fast
// parallel-page path, zero cross-ticker contention — the same conditions as the
// detail page, which never fails for tickers that actually have data). This turns
// transient batch read-timeouts (the "false skips") into successes. Genuinely
// unknown / short-history tickers simply come back unavailable again.
const RECONCILE_POOL = 2;
/**
 * Where a finished run is mirrored so /results can render it with no recompute.
 *
 * ⚠️ EXPORTED so `e2e/fixtures/runSnapshot.ts` can seed it by importing this
 * constant rather than restating the string. A test that hard-codes a storage key
 * seeds NOTHING the day the key changes — and the page it then measures is the
 * empty state, which passes every assertion perfectly. That is 14g's failure mode
 * with a fixture attached: unmeasurable counted as clean. Nothing outside the
 * tests should read this; use the context.
 */
export const SNAPSHOT_KEY = 'mc:analysis-snapshot-v1';

/**
 * The same finished run, kept for THIS ACCOUNT across tabs and browser restarts
 * (beta review, owner-approved 2026-10-02). sessionStorage alone dies with the tab,
 * so a reader who opened /results in a new tab met "No analysis run yet" for a run
 * they had just finished.
 *
 * ⚠️ The key carries the account id, so a second person signing in on the same
 * browser never reads the first person's results, and signing out deletes every
 * copy (`clearStoredRuns`). Nothing here reaches the database — the ratings stay
 * derived and in the browser (CLAUDE.md #15).
 */
const LAST_RUN_PREFIX = 'mc:analysis-last-v1:';

/**
 * Set when a run STARTS and removed when it ends, in sessionStorage (per tab). If a
 * reload finds it, the run in this tab was cut off — the page was reloaded or closed
 * mid-run — and the reader is told so instead of the run silently vanishing.
 */
export const RUNNING_KEY = 'mc:analysis-running-v1';

/** Every stored copy of a run on this device, for every account — called on sign-out. */
export function clearStoredRuns(): void {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try {
      const s = store();
      const doomed: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && (k.startsWith(LAST_RUN_PREFIX) || k === SNAPSHOT_KEY || k === RUNNING_KEY)) doomed.push(k);
      }
      for (const k of doomed) s.removeItem(k);
    } catch {
      // Storage unavailable (private mode) — nothing was stored, so nothing to clear.
    }
  }
}

/** A cancellable sleep — rejects (AbortError) if the run is cancelled mid-wait. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

// Production: the Vercel Python serverless function at /api/analyze. Local dev:
// `next dev` doesn't serve Vercel Python functions, so we POST to a dev-only
// route handler that spawns the same analyze.py CLI (mirrors web/lib/cycle.ts).
// NODE_ENV is inlined into the client bundle by Next; Vercel builds (incl.
// preview) are NODE_ENV=production, so only local `next dev` uses the shim.
const ANALYZE_ENDPOINT =
  process.env.NODE_ENV === 'production' ? '/api/analyze' : '/api/analyze-dev';

export interface RunProgress {
  done: number; // chunks completed
  total: number; // chunks total
  running: boolean;
  // Which work the run is doing right now, so the UI can label it honestly. The
  // bar is driven by main-pass chunks (`done`/`total`); the warm-retry +
  // single-ticker reconciliation passes that follow don't advance it, so the bar
  // reaches 100% while they run — `phase: 'reconciling'` lets RunProgress say
  // "Double-checking skipped tickers…" instead of leaving "Analysing…" at 100%.
  phase?: 'analysing' | 'reconciling';
  /** Tickers whose chunk has come back — the bar and "Processed" count read this. */
  tickersDone: number;
  /** When the solo warm-up chunk finished, and how many tickers it carried (for the ETA). */
  warmedAt: number | null;
  warmedTickers: number;
  /** When the most recent request came back. */
  lastAt: number | null;
}

const EMPTY_PROGRESS: RunProgress = {
  done: 0,
  total: 0,
  running: false,
  tickersDone: 0,
  warmedAt: null,
  warmedTickers: 0,
  lastAt: null,
};

/**
 * How many tickers go in one request.
 *
 * ⚠️ A run of 25 or fewer used to be ONE chunk, so its bar sat at 0% for the whole run
 * and jumped to 100% at the end — the progress bar told the reader nothing on exactly
 * the runs people make most (beta review C-15). Splitting a small run into about eight
 * requests lets the bar move; large runs keep `CHUNK_SIZE`, whose reasoning above is
 * about invocation count and is unchanged.
 */
export function chunkSizeFor(tickerCount: number): number {
  return Math.min(CHUNK_SIZE, Math.max(1, Math.ceil(tickerCount / 8)));
}

export interface RunMeta {
  startedAt: string;
  finishedAt: string | null;
  tickerCount: number;
  /** True when the run was stopped early via Cancel (vs. finished naturally). */
  cancelled?: boolean;
}

interface AnalysisSnapshot {
  results: RunResult[];
  unavailable: string[];
  params: AnalyzeRequest | null;
  runMeta: RunMeta | null;
  /** The account that ran it. Absent only on a snapshot written before 2026-10-02. */
  owner?: string;
}

/** A run that was cut off by a reload or a closed tab. */
export interface InterruptedRun {
  tickerCount: number;
  startedAt: string;
  /** The notice was dismissed. The run still counts as cut off for this visit. */
  dismissed?: boolean;
}

interface AnalysisContextValue extends AnalysisSnapshot {
  progress: RunProgress;
  lastRun: AnalysisRunRecord | null;
  /**
   * True when the run stopped because the subscription is no longer live (a 402
   * from /api/analyze — typically a trial expiring mid-run). Lets the UI show an
   * honest "your access ended" prompt instead of a wall of unavailable tickers.
   */
  lapsed: boolean;
  /** Set when this tab was reloaded or closed while a run was still going. */
  interrupted: InterruptedRun | null;
  dismissInterrupted: () => void;
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

/**
 * Raised when /api/analyze answers 402 — the viewer's subscription is no longer
 * live. Distinct from a transient chunk failure so the run aborts cleanly rather
 * than burning its retries against a wall.
 */
export class EntitlementLapsedError extends Error {
  constructor() {
    super('subscription required');
    this.name = 'EntitlementLapsedError';
  }
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
  const res = await fetch(ANALYZE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  // 402 means entitlement lapsed — most plausibly a trial that expired PART WAY
  // through a long run. Thrown as a distinct error so the caller aborts and says
  // "your access ended" instead of retrying and quietly reporting the remaining
  // tickers as "unavailable", which would look like a broken app rather than a
  // billing state. (F3 Step 10 audit, finding B6.)
  if (res.status === 402) throw new EntitlementLapsedError();
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
    results: toCamel<RunResult[]>((json.results ?? []) as never),
    unavailable: json.unavailable ?? [],
    startedAt: json.started_at ?? '',
    finishedAt: json.finished_at ?? '',
  };
}

/**
 * The Supabase browser client, fetched only when it is actually needed.
 *
 * ── Why this is a dynamic import (audit F-022, 2026-08-24) ──────────────────
 * `AnalysisProvider` wraps EVERY signed-in page from `app/(app)/layout.tsx`, so a
 * static import at the top of this file put the whole Supabase JS client — auth,
 * token refresh, and the realtime/websocket module this app never uses — into the
 * initial bundle of Browse, Stock Detail and everything else. Confirmed by
 * signature in the built chunk (`GoTrueClient`, `SupabaseAuthClient`,
 * `onAuthStateChange`, 22 hits for `realtime`): **236 KB, on every signed-in page**.
 *
 * It is used for exactly two things, both of which happen only when someone runs
 * the screener: writing a run's INPUTS to history, and reading the last run back.
 * The Stock Detail page never reaches either, and paid 236 KB for the privilege.
 *
 * ⚠️ **The singleton survives this, which is the thing that had to be checked.**
 * `lib/supabase/client.ts` memoises its client at module scope precisely because
 * multiple `GoTrueClient` instances race on refresh-token rotation and cause
 * intermittent, unrecoverable sign-outs. A dynamic `import()` resolves to the SAME
 * module instance as any static import elsewhere in the page — the module registry
 * is per document, not per import site — so there is still exactly one client and
 * one refresh loop. This changes WHEN the module loads, never how many exist.
 *
 * Both call sites already sit inside `async` functions wrapped in try/catch whose
 * failure is deliberately non-fatal, so the extra await introduces no new failure
 * mode: a network hiccup fetching the chunk lands in the same catch that a rejected
 * insert already did.
 */
async function loadSupabase() {
  const { createBrowserClient } = await import('@/lib/supabase/client');
  return createBrowserClient();
}

async function writeRun(req: AnalyzeRequest, meta: RunMeta, partial: boolean): Promise<void> {
  // INPUTS ONLY — never the computed results. Fails silently: a rejected write
  // (e.g. RLS) must not break the user's run or the results handoff.
  try {
    const supabase = await loadSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // The threshold columns are NOT NULL, and a named preset's request omits the
    // raw thresholds — so resolve them from PRESETS before inserting. (These are
    // still inputs, just the resolved form of the chosen preset.) Without this a
    // Short/Medium/Long run would silently fail to persist its Last-Analysis row.
    const t =
      req.preset === 'custom'
        ? {
            pullback_threshold: req.pullbackThreshold ?? null,
            profit_threshold: req.profitThreshold ?? null,
            lookback_bars: req.lookbackBars ?? null,
          }
        : {
            pullback_threshold: PRESETS[req.preset].pullbackThreshold,
            profit_threshold: PRESETS[req.preset].profitThreshold,
            lookback_bars: PRESETS[req.preset].lookbackBars,
          };
    await supabase.from('analysis_runs').insert({
      user_id: user.id,
      preset: req.preset,
      ...t,
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

/*
 * ⚠️ THE RUN'S STATE LIVES HERE, IN THE TAB — NOT IN THE PROVIDER (owner, 2026-10-03).
 *
 * The provider wraps only the signed-in pages. Moving to a public page (Pricing,
 * Learn) unmounts it, and while it held this state in `useState` the run lost its
 * screen: the work carried on in the background and finished, but returning showed
 * "your last run did not finish" about a run that had. The public and signed-in pages
 * share one root layout, so the tab's JavaScript survives that move; keeping the state
 * at module level means a remounted provider reconnects to the live run — progress
 * still moving, or the results there. Only a reload or a closed tab ends a run now,
 * and the provider warns before either while one is going (`beforeunload`, below).
 *
 * Module state is per TAB, so two tabs still run independently, and a full reload
 * starts it empty — exactly the cases sessionStorage / localStorage already cover.
 */
interface RunStore {
  results: RunResult[];
  unavailable: string[];
  params: AnalyzeRequest | null;
  runMeta: RunMeta | null;
  progress: RunProgress;
  lastRun: AnalysisRunRecord | null;
  lapsed: boolean;
  interrupted: InterruptedRun | null;
}

const EMPTY_STORE: RunStore = {
  results: [],
  unavailable: [],
  params: null,
  runMeta: null,
  progress: EMPTY_PROGRESS,
  lastRun: null,
  lapsed: false,
  interrupted: null,
};

let store: RunStore = EMPTY_STORE;
const storeListeners = new Set<() => void>();
/** The run in flight in this tab, if any — what Cancel aborts. */
let activeRun: AbortController | null = null;
/** Which account this tab has already read its stored run for (`undefined` = not yet). */
let hydratedFor: string | null | undefined;

function subscribeStore(listener: () => void): () => void {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}
const readStore = () => store;
const readServerStore = () => EMPTY_STORE;

/** A `useState`-shaped setter for one field of the tab's run store. */
function storeSetter<K extends keyof RunStore>(key: K) {
  return (next: RunStore[K] | ((prev: RunStore[K]) => RunStore[K])) => {
    const value =
      typeof next === 'function' ? (next as (prev: RunStore[K]) => RunStore[K])(store[key]) : next;
    if (Object.is(value, store[key])) return;
    store = { ...store, [key]: value };
    for (const l of storeListeners) l();
  };
}

const setResults = storeSetter('results');
const setUnavailable = storeSetter('unavailable');
const setParams = storeSetter('params');
const setRunMeta = storeSetter('runMeta');
const setProgress = storeSetter('progress');
const setLastRun = storeSetter('lastRun');
const setLapsed = storeSetter('lapsed');
const setInterrupted = storeSetter('interrupted');

export function AnalysisProvider({
  ownerId = null,
  children,
}: {
  /** The signed-in account's id; null only in the local dev-bypass render. */
  ownerId?: string | null;
  children: React.ReactNode;
}) {
  const { results, unavailable, params, runMeta, progress, lastRun, lapsed, interrupted } =
    useSyncExternalStore(subscribeStore, readStore, readServerStore);
  const lastRunKey = ownerId ? LAST_RUN_PREFIX + ownerId : null;

  // A reload or a closed tab is the one thing that still ends a run, so the browser
  // asks first while one is going (owner, 2026-10-03). The box is the browser's own;
  // no site can change its words. Moving between MajorCycle's pages does not trigger
  // it — the run carries on, above.
  useEffect(() => {
    if (!progress.running) return undefined;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [progress.running]);

  // Hydrate the live snapshot from sessionStorage AFTER mount (so navigating to
  // /results and back, or a soft reload, keeps the last run visible). This must
  // be an effect, not a lazy initializer: sessionStorage is unavailable during
  // SSR, and seeding initial state from it on the client would diverge from the
  // server render and trigger a hydration mismatch. The set-state-in-effect rule
  // is a false positive for this one-time post-mount hydration.
  //
  // Order: this tab's own copy first (it is the newest thing THIS tab did), then the
  // account's copy in localStorage, which is what a brand-new tab finds. A snapshot
  // naming a DIFFERENT account is ignored: a session that expired and was replaced by
  // someone else's in the same tab must not show the first person's results.
  const applySnapshot = useCallback((snap: AnalysisSnapshot) => {
    setResults(snap.results ?? []);
    setUnavailable(snap.unavailable ?? []);
    setParams(snap.params ?? null);
    setRunMeta(snap.runMeta ?? null);
  }, []);

  useEffect(() => {
    // Once per tab per account. A provider remounting after a visit to a public page
    // finds the run (or its results) still in the store, so there is nothing to read —
    // and reading would put an older stored run over a newer one in memory.
    if (hydratedFor === ownerId) return;
    hydratedFor = ownerId;
    if (store.progress.running) return;
    const read = (raw: string | null): AnalysisSnapshot | null => {
      if (!raw) return null;
      const snap = JSON.parse(raw) as AnalysisSnapshot;
      return snap.owner && snap.owner !== ownerId ? null : snap;
    };
    try {
      const snap =
        read(sessionStorage.getItem(SNAPSHOT_KEY)) ??
        (lastRunKey ? read(localStorage.getItem(lastRunKey)) : null);
      if (snap) applySnapshot(snap);
    } catch {
      // Ignore corrupt/unavailable storage.
    }
    try {
      const raw = sessionStorage.getItem(RUNNING_KEY);
      if (raw) {
        // Kept until it is dismissed or a new run starts, so Results says it too.
        const mark = JSON.parse(raw) as InterruptedRun & { owner?: string | null };
        if (!mark.owner || mark.owner === ownerId) {
          setInterrupted({ tickerCount: mark.tickerCount, startedAt: mark.startedAt });
        }
      }
    } catch {
      // Ignore corrupt/unavailable storage.
    }
  }, [ownerId, lastRunKey, applySnapshot]);

  // Another tab of the same account finished a run: show it here too, unless this tab
  // is in the middle of its own.
  useEffect(() => {
    if (!lastRunKey) return undefined;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== lastRunKey || !e.newValue || store.progress.running) return;
      try {
        applySnapshot(JSON.parse(e.newValue) as AnalysisSnapshot);
        sessionStorage.setItem(SNAPSHOT_KEY, e.newValue);
      } catch {
        // Ignore a corrupt value.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [lastRunKey, applySnapshot]);

  const persist = useCallback(
    (snap: AnalysisSnapshot) => {
      const json = JSON.stringify({ ...snap, owner: ownerId ?? undefined });
      try {
        sessionStorage.setItem(SNAPSHOT_KEY, json);
      } catch {
        // Non-fatal (quota / private mode).
      }
      try {
        if (lastRunKey) localStorage.setItem(lastRunKey, json);
      } catch {
        // Non-fatal: the run still shows in this tab.
      }
    },
    [ownerId, lastRunKey],
  );

  // Dismissing hides the notice but keeps the fact for this visit, so the "re-run your
  // last analysis" card does not come back offering an OLDER run in its place.
  const dismissInterrupted = useCallback(() => {
    try {
      sessionStorage.removeItem(RUNNING_KEY);
    } catch {
      // Non-fatal.
    }
    setInterrupted((i) => (i ? { ...i, dismissed: true } : i));
  }, []);

  const refreshLastRun = useCallback(async () => {
    try {
      const supabase = await loadSupabase();
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

  /*
   * ⚠️ THE HISTORY FETCH USED TO RUN HERE, ON MOUNT, and moving it is the whole
   * point of the change (audit F-022).
   *
   * This provider wraps EVERY signed-in page, so a mount-time fetch meant Browse
   * and Stock Detail each: pulled the 236 KB Supabase client onto the critical
   * path, and made a database round trip for a row only the Run tab ever displays.
   *
   * Making the Supabase import dynamic did NOT fix that by itself — measured, the
   * chunk still arrived before `load`. Code-splitting only decides which file the
   * code lives in; something has to stop CALLING it. This effect was the caller.
   *
   * `refreshLastRun` stays on the context and is still awaited after a run
   * finishes (below), so the Run tab's behaviour is unchanged. `RunAnalysis` — the
   * only component that reads `lastRun` — now asks for it on its own mount.
   */

  const cancel = useCallback(() => {
    activeRun?.abort();
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setUnavailable([]);
    setParams(null);
    setRunMeta(null);
    setLapsed(false);
    setProgress(EMPTY_PROGRESS);
    try {
      sessionStorage.removeItem(SNAPSHOT_KEY);
      if (lastRunKey) localStorage.removeItem(lastRunKey);
    } catch {
      // Non-fatal.
    }
  }, [lastRunKey]);

  const run = useCallback(
    async (req: AnalyzeRequest) => {
      const controller = new AbortController();
      activeRun = controller;
      const { signal } = controller;
      setLapsed(false);
      setInterrupted(null);

      const chunks = chunk(req.tickers, chunkSizeFor(req.tickers.length));
      const startedAt = new Date().toISOString();
      const meta: RunMeta = { startedAt, finishedAt: null, tickerCount: req.tickers.length };
      try {
        sessionStorage.setItem(
          RUNNING_KEY,
          JSON.stringify({ tickerCount: meta.tickerCount, startedAt, owner: ownerId }),
        );
      } catch {
        // Non-fatal: only the "your run was interrupted" notice depends on it.
      }

      setParams(req);
      setResults([]);
      setUnavailable([]);
      setRunMeta(meta);
      setProgress({ ...EMPTY_PROGRESS, total: chunks.length, running: true, phase: 'analysing' });

      const allResults: RunResult[] = [];
      // Genuine "not in our universe / insufficient history" — the server returns
      // these in a 200; they never succeed on retry, so they're final.
      const serverUnavailable: string[] = [];
      // Tickers whose whole chunk request FAILED (cold-start timeout, transient
      // network). Worth one warm retry pass — that's where the real skips came from.
      const chunkFailed: string[] = [];
      let done = 0;
      let tickersDone = 0;
      let warmedAt: number | null = null;
      let warmedTickers = 0;

      const bump = (size: number) => {
        done += 1;
        tickersDone += size;
        // The first chunk runs alone and pays the cold start, so the pace that
        // predicts the rest is measured from the moment it finished.
        if (warmedAt === null) {
          warmedAt = Date.now();
          warmedTickers = tickersDone;
        }
        setProgress({
          done,
          total: chunks.length,
          tickersDone,
          warmedAt,
          warmedTickers,
          lastAt: Date.now(),
          running: true,
          phase: 'analysing',
        });
        setResults([...allResults]);
        // Failed-chunk tickers are shown only if the retry pass can't recover them.
        setUnavailable([...serverUnavailable]);
      };

      // POST one chunk, retrying a transient failure inline before giving up.
      const postWithRetry = async (tickers: string[]): Promise<AnalyzeResponse> => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await postChunk(tickers, req, signal);
          } catch (e) {
            if (signal.aborted || attempt >= CHUNK_RETRIES) throw e;
            await delay(RETRY_BACKOFF_MS * (attempt + 1), signal);
          }
        }
      };

      // Run one chunk; accumulate its results / split its failures.
      const processChunk = async (tickers: string[]): Promise<void> => {
        try {
          const r = await postWithRetry(tickers);
          allResults.push(...r.results);
          serverUnavailable.push(...r.unavailable);
        } catch (err) {
          // A lapsed subscription is not a transient failure — every remaining
          // chunk would fail identically. Abort the whole run and let the UI say so,
          // rather than retrying into a wall and calling the tickers "unavailable".
          if (err instanceof EntitlementLapsedError) {
            setLapsed(true);
            controller.abort();
            return;
          }
          if (!signal.aborted) chunkFailed.push(...tickers);
        } finally {
          if (!signal.aborted) bump(tickers.length);
        }
      };

      // Pre-warm: run the FIRST chunk solo and await it. That boots one instance
      // (Python + DB connection) with real work, so the remaining chunks fire
      // against a warm instance instead of three cold requests racing at once
      // (the cold-start storm behind most skips). No throwaway request needed.
      if (chunks[0]) await processChunk(chunks[0]);

      // Remaining chunks through the worker pool (peak concurrency unchanged).
      let next = 1;
      const worker = async (): Promise<void> => {
        while (!signal.aborted) {
          const i = next++;
          if (i >= chunks.length) return;
          const tickers = chunks[i];
          if (!tickers) return;
          await processChunk(tickers);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(POOL_SIZE, Math.max(0, chunks.length - 1)) }, () =>
          worker(),
        ),
      );

      // Warm retry pass: re-run only the tickers whose chunk FAILED (never the
      // genuine server-unavailable). The instance is warm now, so this is fast and
      // recovers transient skips; anything that still fails is truly unavailable.
      let stillFailed: string[] = chunkFailed;
      if (!signal.aborted && chunkFailed.length > 0) {
        // The main pass is done (bar at 100%); switch the label to the recheck phase.
        setProgress((p) => ({ ...p, phase: 'reconciling' }));
        stillFailed = [];
        const retryChunks = chunk(chunkFailed, CHUNK_SIZE);
        let rn = 0;
        const retryWorker = async (): Promise<void> => {
          while (!signal.aborted) {
            const i = rn++;
            if (i >= retryChunks.length) return;
            const tickers = retryChunks[i];
            if (!tickers) return;
            try {
              const r = await postWithRetry(tickers);
              allResults.push(...r.results);
              serverUnavailable.push(...r.unavailable);
            } catch {
              if (!signal.aborted) stillFailed.push(...tickers);
            } finally {
              if (!signal.aborted) {
                setResults([...allResults]);
                setUnavailable([...serverUnavailable, ...stillFailed]);
              }
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(POOL_SIZE, retryChunks.length) }, () => retryWorker()),
        );
      }

      // Reconciliation pass: retry every still-unavailable ticker ONE AT A TIME.
      // This is the decisive fix for false skips — a transient cross-region
      // read-timeout during the concurrent batch lands a ticker in `unavailable`
      // even though it has data (it loads fine on its own detail page). Re-running
      // it as a solo request removes the cross-ticker contention, so it succeeds
      // here just like the detail page does. Truly unknown / short-history tickers
      // return unavailable again (cheaply), so this is safe to run over all of them.
      let reconcileFailed: string[] = [...new Set([...serverUnavailable, ...stillFailed])];
      if (!signal.aborted && reconcileFailed.length > 0) {
        setProgress((p) => ({ ...p, phase: 'reconciling' }));
        // Snapshot the set being rechecked. The displayed "Skipped" count is this
        // set MINUS the tickers recovered so far, so it starts at the full count
        // and only ever shrinks (monotonic) — instead of resetting to 0 and
        // climbing back as each failure lands.
        const reconcileInput = reconcileFailed;
        const recovered = new Set<string>();
        const stillOut: string[] = [];
        let ri = 0;
        const reconcileWorker = async (): Promise<void> => {
          while (!signal.aborted) {
            const i = ri++;
            if (i >= reconcileInput.length) return;
            const t = reconcileInput[i];
            if (!t) continue;
            try {
              const r = await postWithRetry([t]);
              if (r.results.length > 0) {
                allResults.push(...r.results);
                recovered.add(t);
              } else {
                stillOut.push(t);
              }
            } catch {
              if (!signal.aborted) stillOut.push(t);
            } finally {
              if (!signal.aborted) {
                setResults([...allResults]);
                setUnavailable(reconcileInput.filter((x) => !recovered.has(x)));
              }
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(RECONCILE_POOL, reconcileFailed.length) }, () =>
            reconcileWorker(),
          ),
        );
        reconcileFailed = stillOut;
      }

      const finalUnavailable = reconcileFailed;
      const finishedAt = new Date().toISOString();
      const aborted = signal.aborted;
      const finalMeta: RunMeta = { ...meta, finishedAt, cancelled: aborted };
      setRunMeta(finalMeta);
      setProgress((p) => ({ ...p, running: false }));
      setResults([...allResults]);
      setUnavailable(finalUnavailable);
      persist({ results: allResults, unavailable: finalUnavailable, params: req, runMeta: finalMeta });
      try {
        sessionStorage.removeItem(RUNNING_KEY);
      } catch {
        // Non-fatal.
      }

      if (!aborted) {
        // A run that yielded nothing usable still records inputs; "partial" when
        // some tickers couldn't be analysed.
        await writeRun(req, finalMeta, finalUnavailable.length > 0);
        await refreshLastRun();
      }
      activeRun = null;
    },
    [persist, refreshLastRun, ownerId],
  );

  const value = useMemo<AnalysisContextValue>(
    () => ({
      results,
      unavailable,
      params,
      runMeta,
      progress,
      lastRun,
      lapsed,
      interrupted,
      dismissInterrupted,
      run,
      cancel,
      clear,
      refreshLastRun,
    }),
    [
      results,
      unavailable,
      params,
      runMeta,
      progress,
      lastRun,
      lapsed,
      interrupted,
      dismissInterrupted,
      run,
      cancel,
      clear,
      refreshLastRun,
    ],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used within an AnalysisProvider');
  return ctx;
}
