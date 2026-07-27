import { cache } from 'react';

import { toCamel } from '@/lib/case';
import { INTERNAL_HEADER } from '@/lib/internalAuth';
import type { CycleAnalysis, CycleAnalysisFree } from '@/lib/types';

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

/**
 * The premium keys, in the camelCase shape the app uses after `toCamel`. Mirrors
 * the snake_case strip list in `api/cycle.py::_serialise_analysis`.
 */
const PREMIUM_FIELDS = [
  'financialHealthScore',
  'fhSubscores',
  'valuationScore',
  'valuationScoreRaw',
  'qualityFactor',
  'valuationZone',
  'cyclePayoffScore',
  'overallRating',
  'overallLabel',
] as const;

/**
 * Belt-and-braces strip on the way IN, for an unentitled viewer.
 *
 * `api/cycle.py` already withholds these keys when `entitled=0`, so in a healthy
 * system this removes nothing. It exists because hiding a score in the UI does not
 * take it off the wire: this object is passed to client components, so React
 * serialises it into the RSC payload embedded in the HTML. A viewer who never sees
 * the number in the page can still read it in View Source.
 *
 * Observed live on 2026-07-28 — the preview renders "🔒 Unlock" while the page
 * source carried `"overallRating":60,"overallLabel":"Neutral"`. That was the M4
 * cross-environment artifact (a preview fetches PRODUCTION's ungated /api/cycle),
 * not a shipping leak, but it makes the point exactly: the API strip was the only
 * thing standing between a free viewer and the payload, and a regression there
 * would leave the UI looking locked while quietly shipping the data — the worst
 * kind of failure, because it looks safe.
 *
 * Stripping here also makes preview deployments behave like production instead of
 * silently more permissive.
 */
function stripPremium<T>(value: T, entitled: boolean): T {
  if (entitled || !value || typeof value !== 'object') return value;
  const out = { ...(value as Record<string, unknown>) };
  for (const key of PREMIUM_FIELDS) delete out[key];
  return out as T;
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
const _devCycleCache = new Map<
  string,
  { at: number; value: CycleAnalysis | CycleAnalysisFree | null }
>();
const _DEV_CACHE_TTL = 5 * 60 * 1000;

function specToCliArgs(spec: CycleSpec, entitled: boolean): string[] {
  const base = entitled ? ['--entitled', '1'] : ['--entitled', '0'];
  if (spec.preset === 'custom') {
    return [
      ...base,
      '--preset', 'custom',
      '--pullback', String(spec.pullback),
      '--profit', String(spec.profit),
      '--lookback', String(spec.lookback),
    ];
  }
  return [...base, '--preset', spec.preset];
}

async function computeCycleLocally(
  ticker: string,
  spec: CycleSpec,
  entitled: boolean,
): Promise<CycleAnalysis | CycleAnalysisFree | null> {
  // Entitlement is part of the cache key — otherwise a free render and a subscribed
  // render of the same ticker would share one entry (the local mirror of the Data
  // Cache hazard in `fetchCycleAnalysis`).
  const key = `${ticker}:${specKey(spec)}:${entitled ? '1' : '0'}`;
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
  let result: CycleAnalysis | CycleAnalysisFree | null = null;
  try {
    const { stdout } = await run(
      python,
      [script, '--ticker', ticker, ...specToCliArgs(spec, entitled)],
      { env: process.env, maxBuffer: 10 * 1024 * 1024 },
    );
    const raw: unknown = JSON.parse(stdout);
    if (!(raw && typeof raw === 'object' && 'error' in (raw as Record<string, unknown>))) {
      result = stripPremium(
        toCamel<CycleAnalysis | CycleAnalysisFree>(raw as never),
        entitled,
      );
    }
  } catch {
    // Non-zero exit (404/500), bad JSON, or python missing — degrade gracefully.
    result = null;
  }
  _devCycleCache.set(key, { at: Date.now(), value: result });
  return result;
}

function specToQuery(ticker: string, spec: CycleSpec, entitled: boolean): string {
  // `entitled` rides in the QUERY STRING, never a header. Next's Data Cache (and any
  // shared cache) keys on the URL alone, so a header-borne flag would let the free
  // and paid variants of one ticker collide on a single cache entry — serving a
  // stripped payload to a subscriber, or a scored one to a free user.
  // (F3 Step 10 audit, finding B3.)
  const qs = new URLSearchParams({
    ticker,
    preset: spec.preset,
    entitled: entitled ? '1' : '0',
  });
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
 * `entitled` is REQUIRED, not optional, so every call site has to decide — and it
 * is part of the cache() key, so the free and subscribed renders never share a
 * memoised result. When false the response is the `CycleAnalysisFree` shape: the
 * scoring keys are absent, having been stripped server-side before serialisation.
 * Narrow with `isFullCycle` before reading any premium field.
 *
 * Returns null on any error (401, 404, 500, network failure) so the UI can degrade
 * gracefully — cycle data is enriching, not blocking.
 */
export const fetchCycleAnalysis = cache(
  async (
    ticker: string,
    spec: CycleSpec,
    entitled: boolean,
  ): Promise<CycleAnalysis | CycleAnalysisFree | null> => {
    if (useLocalCompute()) {
      return computeCycleLocally(ticker, spec, entitled);
    }
    try {
      const url = `${baseUrl()}/api/cycle?${specToQuery(ticker, spec, entitled)}`;
      // /api/cycle is internal-only. The Stock Detail page renders on the server and
      // fetches it over the PUBLIC url carrying no cookies, so it can't be gated by
      // session auth — this shared secret is what distinguishes our own render from
      // anyone else on the internet. Missing secret ⇒ 401 ⇒ null ⇒ graceful degrade.
      const res = await fetch(url, {
        next: { revalidate: 3600 },
        headers: { [INTERNAL_HEADER]: process.env.CYCLE_INTERNAL_SECRET ?? '' },
      });
      if (!res.ok) return null;
      const raw: unknown = await res.json();
      return stripPremium(
        toCamel<CycleAnalysis | CycleAnalysisFree>(raw as never),
        entitled,
      );
    } catch {
      return null;
    }
  },
);
