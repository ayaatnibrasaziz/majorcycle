import { test, expect } from '@playwright/test';

import {
  BENCHMARK_REFRESH_UTC,
  BENCHMARK_WINDOW_YEARS,
  benchmarkDataVersion,
  benchmarkFloorDate,
  benchmarkSinceFor,
  trimBenchmarks,
  type BenchmarkSeries,
} from '@/lib/benchmarks';

/**
 * The benchmark index series are cached in two places, and this drives the rules
 * that decide when those caches turn over.
 *
 * ── Why it needs a test at all ──────────────────────────────────────────────
 * `/api/benchmarks` lets a browser keep ~900 KB of index history so the second
 * ticker page a reader opens costs nothing (audit F-019). The obvious hazard is
 * the one the owner asked about before it shipped: the nightly crons add a new
 * close, so a cache that turns over on its own schedule will serve yesterday's
 * indices against today's stock price.
 *
 * ⚠️ **Every expected key below is BUILT from `BENCHMARK_REFRESH_UTC`, never typed.**
 * The times were literals until 2026-09-05, when the US+CA cron moved 22:30 → 01:30
 * (audit 5A-124) and this file went red for the right reason — the cache boundaries
 * and the workflow are two copies of one schedule (CLAUDE.md 11c-v), and a test that
 * restates the copy cannot tell you they have parted. Derived, it fails only when the
 * two genuinely disagree.
 *
 * ⚠️ And that failure is INVISIBLE. Nothing errors, nothing is blank: the index
 * lines simply run flat for the final day and the alpha figure quietly compares
 * today's stock against yesterday's market. Both numbers stay plausible. Only an
 * assertion about the boundary can tell the two apart, which is why the version
 * key is a pure function rather than something embedded in the fetch.
 *
 * A pure, credential-free spec: no browser, no network, no secrets, so it runs on
 * a fork PR and can never self-skip (CLAUDE.md, Testing).
 */

const at = (iso: string) => new Date(iso);

/** The keys the constant says a given day should produce, in order. */
const R = BENCHMARK_REFRESH_UTC;
const FIRST = R[0]!;
const LAST = R[R.length - 1]!;
const hhmm = (b: { hour: number; minute: number }) =>
  `${String(b.hour).padStart(2, '0')}${String(b.minute).padStart(2, '0')}`;
const key = (day: string, b: { hour: number; minute: number }) => `${day}T${hhmm(b)}`;
/** A moment `mins` after a boundary, on 2026-08-24. */
const after = (b: { hour: number; minute: number }, mins: number) =>
  new Date(Date.UTC(2026, 7, 24, b.hour, b.minute + mins));

test.describe('benchmarkDataVersion — turns over with the data, not with a stopwatch', () => {
  test('holds steady between cron runs, and changes across one', () => {
    // Two moments inside the LAST run's window must share a key, or the cache never hits.
    expect(benchmarkDataVersion(after(LAST, 61))).toBe(benchmarkDataVersion(after(LAST, 300)));

    // And two moments either side of a run must NOT, or the cache never refreshes.
    expect(benchmarkDataVersion(after(FIRST, -5))).not.toBe(benchmarkDataVersion(after(FIRST, 61)));
  });

  test('a run counts only once its data has had time to land', () => {
    // A cron STARTS at its boundary. Flipping the key then would cache whatever the
    // refresh had written by that instant and keep it for the rest of the cycle, so
    // the boundary deliberately sits SETTLE_MINUTES later.
    const justAfterStart = benchmarkDataVersion(after(FIRST, 5));
    const oncePlausiblyLanded = benchmarkDataVersion(after(FIRST, 61));

    expect(justAfterStart).toBe(key('2026-08-23', LAST));
    expect(oncePlausiblyLanded).toBe(key('2026-08-24', FIRST));
    expect(justAfterStart).not.toBe(oncePlausiblyLanded);
  });

  test('every run settles the same way, and the small hours belong to the last one', () => {
    for (let i = 1; i < R.length; i += 1) {
      const b = R[i]!;
      expect(benchmarkDataVersion(after(b, 5))).toBe(key('2026-08-24', R[i - 1]!));
      expect(benchmarkDataVersion(after(b, 61))).toBe(key('2026-08-24', b));
    }

    // Before the day's FIRST settled run it is still the previous day's last data.
    // An off-by-one here would refresh the cache for no reason every night, which is
    // wasteful rather than wrong, and therefore easy to miss.
    expect(benchmarkDataVersion(after(FIRST, -20))).toBe(key('2026-08-23', LAST));
  });

  test('a full day produces exactly two distinct keys', () => {
    // The control on all of the above: if the boundaries were mis-specified this
    // would drift to one key (never refreshes) or many (refreshes constantly), and
    // both are silent failures — one stale, one merely expensive.
    const keys = new Set<string>();
    for (let m = 0; m < 24 * 60; m += 5) {
      const d = new Date(Date.UTC(2026, 7, 24, 0, 0, 0));
      d.setUTCMinutes(m);
      keys.add(benchmarkDataVersion(d));
    }
    expect([...keys].sort()).toEqual(
      [key('2026-08-23', LAST), ...R.map((b) => key('2026-08-24', b))].sort(),
    );
    // One more than there are runs, because the day opens inside the previous
    // evening's window; the rest BELONG to this day, one per cron.
    expect(keys.size).toBe(R.length + 1);
  });
});

test.describe('the window the endpoint serves, and the per-stock trim', () => {
  test('the floor is the shared constant, not a number typed twice', () => {
    const now = at('2026-08-24T12:00:00Z');
    const floor = benchmarkFloorDate(now);
    expect(floor).toBe('2006-08-24');
    // Value-sensitive: derived from the constant, so bumping the window moves it.
    expect(Number(floor.slice(0, 4))).toBe(2026 - BENCHMARK_WINDOW_YEARS);
  });

  test('a young stock is trimmed to its own first bar, an old one to the floor', () => {
    const now = at('2026-08-24T12:00:00Z');
    // Listed after the floor → its own start wins.
    expect(benchmarkSinceFor('2020-12-10', now)).toBe('2020-12-10');
    // Listed long before → the floor wins, so we never serve decades nobody plots.
    expect(benchmarkSinceFor('1980-12-12', now)).toBe('2006-08-24');
    // No history at all → nothing to align to.
    expect(benchmarkSinceFor(undefined, now)).toBeUndefined();
  });

  test('trimming drops earlier bars and keeps the boundary date itself', () => {
    const series: BenchmarkSeries = {
      '^GSPC': [
        { date: '2019-01-02', close: 2510 },
        { date: '2020-12-10', close: 3668 },
        { date: '2020-12-11', close: 3663 },
      ],
    };
    const trimmed = trimBenchmarks(series, '2020-12-10');
    expect(trimmed['^GSPC']!.map((b) => b.date)).toEqual(['2020-12-10', '2020-12-11']);

    // ⚠️ The control. This trim moved from the server to the browser when the
    // endpoint began serving one shared window, and the baseline the chart draws
    // from is "the last index close on or before the first plotted day" — so a
    // trim that silently did nothing would change every Max-range chart while
    // still rendering perfectly.
    expect(trimBenchmarks(series, undefined)['^GSPC']).toHaveLength(3);
    expect(trimmed['^GSPC']).toHaveLength(2);
  });
});
