// Client-safe benchmark metadata + types for the Relative Performance chart.
// The server-only fetch lives in benchmarks.server.ts so this module can be
// imported from Client Components without pulling in next/headers.

import type { Market } from '@/lib/types';

export interface BenchmarkMeta {
  ticker: string;
  label: string;
  market: Market;
}

/** Benchmark indices, in display order. `market` is the home market each one
 *  benchmarks; the stock's own home index drives the summary strip. S&P 500 is
 *  listed before Nasdaq so it stays the US home index for the Alpha calc. */
export const BENCHMARKS: readonly BenchmarkMeta[] = [
  { ticker: '^GSPC', label: 'S&P 500', market: 'us' },
  { ticker: '^IXIC', label: 'Nasdaq', market: 'us' },
  { ticker: '^AXJO', label: 'ASX 200', market: 'au' },
  { ticker: '^GSPTSE', label: 'S&P/TSX', market: 'ca' },
] as const;

export interface BenchmarkBar {
  date: string;
  close: number;
}

export type BenchmarkSeries = Record<string, BenchmarkBar[]>;

/**
 * The most index history any ticker page can use: the chart's Max range tops out
 * here, so nothing beyond this window is ever plotted.
 *
 * ⚠️ ONE definition, used by BOTH sides (CLAUDE.md 11c). The page computes each
 * stock's floor from it, and `/api/benchmarks` serves exactly this window — if the
 * two ever disagreed, the endpoint would quietly stop covering the oldest stocks
 * and their Max range would lose its earliest years with nothing going red.
 */
export const BENCHMARK_WINDOW_YEARS = 20;

/** The oldest date `/api/benchmarks` serves — `BENCHMARK_WINDOW_YEARS` back. */
export function benchmarkFloorDate(now: Date = new Date()): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - BENCHMARK_WINDOW_YEARS);
  return d.toISOString().slice(0, 10);
}

/**
 * How far back THIS stock's chart should reach: the later of its first bar and
 * the window floor, so a young stock is never handed index history it does not
 * span.
 *
 * ⚠️ This trim used to happen on the server, which is why it must still happen at
 * all. `/api/benchmarks` now serves one shared payload so the browser can cache it
 * across every ticker page, and that payload reaches further back than a young
 * stock's own history. Feeding it in whole would change the chart: the baseline is
 * "the last index close on or before the first plotted day", and extra earlier
 * points can supply one where previously there was none. Same data as before,
 * trimmed one layer later.
 */
export function benchmarkSinceFor(firstBarDate: string | undefined, now?: Date): string | undefined {
  if (!firstBarDate) return undefined;
  const floor = benchmarkFloorDate(now);
  return firstBarDate > floor ? firstBarDate : floor;
}

/**
 * When the index data actually changes: the two nightly cron runs.
 *
 * `.github/workflows/daily-refresh.yml` at 01:30 UTC (US+CA) and
 * `daily-refresh-au.yml` at 08:00 UTC (locked decision #32 — the split exists
 * because no single time is after every market close, so do not re-merge them).
 *
 * ⚠️ A copy of a schedule that lives somewhere else (CLAUDE.md 11c). If those
 * workflows move, this must move with them, and the symptom of forgetting is
 * silent: the chart's index lines simply lag by hours with nothing going red.
 *
 * ⚠️ **That warning earned itself on 2026-09-05.** The US+CA run moved 22:30 →
 * 01:30 (audit 5A-124) as a one-line schedule edit, and this array is the reason a
 * one-line edit was not enough — `benchmarks-cache.spec.ts` now DERIVES its
 * expected keys from this constant rather than restating them, so the next move
 * cannot leave the two silently disagreeing.
 *
 * Ascending order is load-bearing: `benchmarkDataVersion` walks it backwards and
 * takes the first boundary already settled.
 */
export const BENCHMARK_REFRESH_UTC = [
  { hour: 1, minute: 30 },
  { hour: 8, minute: 0 },
] as const;

/**
 * How long after a cron STARTS before its data is assumed to have landed. The
 * boundary is the start of the job, not the end, so flipping the cache key at
 * exactly 08:00 would re-read the database and cache whatever the refresh had
 * managed to write by then — for the rest of the cycle.
 */
const SETTLE_MINUTES = 60;

/**
 * A key that changes when the index data changes, and at no other time.
 *
 * ── Why this exists (audit F-019b, 2026-08-24) ─────────────────────────────
 * The server held these series for a flat 24 hours measured from whenever it
 * first happened to load them (`BENCHMARKS_TTL_MS`), which is unrelated to when
 * new closes actually arrive. So an instance that warmed at 09:00 kept serving
 * pre-cron data through the 22:30 refresh and on until 09:00 the next day. It was
 * survivable only because Vercel restarts instances often enough to paper over it
 * — safe by someone else's default, which is the failure CLAUDE.md 11a keeps
 * recording.
 *
 * That became load-bearing the moment `/api/benchmarks` let BROWSERS hold the
 * data too: a browser does not restart on a whim, so the same stale copy would
 * have been reliably reused. The owner asked what happens the next day, which is
 * exactly the right question, and the honest answer was "the index lines lag".
 *
 * Keyed to the schedule instead: the cache refreshes twice a day, right after each
 * cron, and costs no more database reads than the old flat day did.
 */
export function benchmarkDataVersion(now: Date = new Date()): string {
  const stamp = (d: Date, h: number, m: number) =>
    `${d.toISOString().slice(0, 10)}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;

  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (let i = BENCHMARK_REFRESH_UTC.length - 1; i >= 0; i--) {
    const b = BENCHMARK_REFRESH_UTC[i]!;
    if (mins >= b.hour * 60 + b.minute + SETTLE_MINUTES) return stamp(now, b.hour, b.minute);
  }
  // Before today's first settled run — still on the last run of the previous day.
  const prev = new Date(now.getTime() - 86_400_000);
  const last = BENCHMARK_REFRESH_UTC[BENCHMARK_REFRESH_UTC.length - 1]!;
  return stamp(prev, last.hour, last.minute);
}

/** Trim a series to dates on or after `since`. A no-op when `since` is absent. */
export function trimBenchmarks(series: BenchmarkSeries, since: string | undefined): BenchmarkSeries {
  if (!since) return series;
  const out: BenchmarkSeries = {};
  for (const [ticker, bars] of Object.entries(series)) {
    out[ticker] = bars.filter((b) => b.date >= since);
  }
  return out;
}
