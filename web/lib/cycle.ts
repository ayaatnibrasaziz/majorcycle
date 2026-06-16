import { cache } from 'react';

import { toCamel } from '@/lib/case';
import type { CycleAnalysis } from '@/lib/types';

export type CyclePreset = 'short' | 'medium' | 'long';

/**
 * Which Major Cycle window to compute: a named preset, or fully custom
 * pullback/profit/lookback values (chosen on the Browse page).
 */
export type CycleSpec =
  | { preset: CyclePreset }
  | { preset: 'custom'; pullback: number; profit: number; lookback: number };

/** Stable string key for caching/spawn-dedup. */
function specKey(spec: CycleSpec): string {
  return spec.preset === 'custom'
    ? `custom:${spec.pullback}:${spec.profit}:${spec.lookback}`
    : spec.preset;
}

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  // Prefer the project's production custom domain (e.g. majorcycle.com). A custom
  // domain is exempt from Vercel Deployment Protection, whereas the per-deployment
  // *.vercel.app URL (VERCEL_URL) is walled with a 401 "Authentication Required"
  // — even in production. Since the Stock Detail page fetches its own /api/cycle
  // server-side, using VERCEL_URL meant that internal call hit the 401 wall and
  // the page got no cycle data (blank rating/KPI/radar/verdict).
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/**
 * In production (Vercel), cycle math is served by the Python serverless
 * function at /api/cycle. Under `next dev` that function isn't executed, so
 * for local development we compute the cycle by spawning the same Python file
 * as a CLI (`web/api/cycle.py --ticker … --preset …`). This branch is strictly
 * dev-only and never runs in a deployed build.
 */
function useLocalCompute(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.VERCEL || process.env.VERCEL_URL) return false;
  // An explicit base URL means a real /api/cycle is reachable — prefer HTTP.
  if (process.env.NEXT_PUBLIC_BASE_URL) return false;
  return true;
}

// Dev-only in-memory cache so repeat page loads/HMR don't re-spawn Python
// (the local compute reads the full price history from Supabase, which is slow).
const _devCycleCache = new Map<string, { at: number; value: CycleAnalysis | null }>();
const _DEV_CACHE_TTL = 5 * 60 * 1000;

function specToCliArgs(spec: CycleSpec): string[] {
  if (spec.preset === 'custom') {
    return [
      '--preset', 'custom',
      '--pullback', String(spec.pullback),
      '--profit', String(spec.profit),
      '--lookback', String(spec.lookback),
    ];
  }
  return ['--preset', spec.preset];
}

async function computeCycleLocally(
  ticker: string,
  spec: CycleSpec,
): Promise<CycleAnalysis | null> {
  const key = `${ticker}:${specKey(spec)}`;
  const hit = _devCycleCache.get(key);
  if (hit && Date.now() - hit.at < _DEV_CACHE_TTL) return hit.value;
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { existsSync } = await import('node:fs');
  const path = await import('node:path');
  const run = promisify(execFile);

  // `next dev` runs with cwd = web/ (pnpm --dir web dev); fall back to repo root.
  const candidates = [
    path.join(process.cwd(), 'api', 'cycle.py'),
    path.join(process.cwd(), 'web', 'api', 'cycle.py'),
  ];
  const script = candidates.find((p) => existsSync(p));
  if (!script) return null;

  const python = process.env.PYTHON_BIN || 'python';
  let result: CycleAnalysis | null = null;
  try {
    const { stdout } = await run(
      python,
      [script, '--ticker', ticker, ...specToCliArgs(spec)],
      { env: process.env, maxBuffer: 10 * 1024 * 1024 },
    );
    const raw: unknown = JSON.parse(stdout);
    if (!(raw && typeof raw === 'object' && 'error' in (raw as Record<string, unknown>))) {
      result = toCamel<CycleAnalysis>(raw as never);
    }
  } catch {
    // Non-zero exit (404/500), bad JSON, or python missing — degrade gracefully.
    result = null;
  }
  _devCycleCache.set(key, { at: Date.now(), value: result });
  return result;
}

function specToQuery(ticker: string, spec: CycleSpec): string {
  const qs = new URLSearchParams({ ticker, preset: spec.preset });
  if (spec.preset === 'custom') {
    qs.set('pullback', String(spec.pullback));
    qs.set('profit', String(spec.profit));
    qs.set('lookback', String(spec.lookback));
  }
  return qs.toString();
}

/**
 * Fetch cycle analysis for one ticker + spec (named preset or custom). In
 * production this calls the co-located Python serverless function at /api/cycle;
 * in local dev it computes via the same Python file run as a CLI. Cached per
 * render (and per Vercel data cache / dev map) so the page's many cycle sections
 * share a single underlying compute. Pass the SAME `spec` object reference to
 * every consumer in a render so React's cache() dedupes them.
 *
 * Returns null on any error (404, 500, network failure) so the UI can degrade
 * gracefully — cycle data is enriching, not blocking.
 */
export const fetchCycleAnalysis = cache(
  async (ticker: string, spec: CycleSpec): Promise<CycleAnalysis | null> => {
    if (useLocalCompute()) {
      return computeCycleLocally(ticker, spec);
    }
    try {
      const url = `${baseUrl()}/api/cycle?${specToQuery(ticker, spec)}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return null;
      const raw: unknown = await res.json();
      return toCamel<CycleAnalysis>(raw as never);
    } catch {
      return null;
    }
  },
);
