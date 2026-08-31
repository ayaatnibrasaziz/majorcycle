import { test, expect } from '@playwright/test';

import {
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
 * close at 08:00 and 22:30 UTC, so a cache that turns over on its own schedule
 * will serve yesterday's indices against today's stock price.
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

test.describe('benchmarkDataVersion — turns over with the data, not with a stopwatch', () => {
  test('holds steady between cron runs, and changes across one', () => {
    // Two moments inside the same window must share a key, or the cache never hits.
    expect(benchmarkDataVersion(at('2026-08-24T10:00:00Z'))).toBe(
      benchmarkDataVersion(at('2026-08-24T20:00:00Z')),
    );

    // And two moments either side of a run must NOT, or the cache never refreshes.
    expect(benchmarkDataVersion(at('2026-08-24T20:00:00Z'))).not.toBe(
      benchmarkDataVersion(at('2026-08-24T23:59:00Z')),
    );
  });

  test('a run counts only once its data has had time to land', () => {
    // The cron STARTS at 08:00. Flipping the key then would cache whatever the
    // refresh had written by that instant and keep it for the rest of the cycle,
    // so the boundary deliberately sits an hour later.
    const before = benchmarkDataVersion(at('2026-08-24T08:05:00Z'));
    const after = benchmarkDataVersion(at('2026-08-24T09:05:00Z'));

    expect(before).toBe('2026-08-23T2230');
    expect(after).toBe('2026-08-24T0800');
    expect(before).not.toBe(after);
  });

  test('the 22:30 run settles the same way, and midnight belongs to it', () => {
    expect(benchmarkDataVersion(at('2026-08-24T22:35:00Z'))).toBe('2026-08-24T0800');
    expect(benchmarkDataVersion(at('2026-08-24T23:35:00Z'))).toBe('2026-08-24T2230');

    // Just after midnight is still the previous evening's data — the next run is
    // hours away. An off-by-one here would refresh the cache for no reason every
    // night, which is wasteful rather than wrong, and therefore easy to miss.
    expect(benchmarkDataVersion(at('2026-08-25T00:10:00Z'))).toBe('2026-08-24T2230');
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
    expect([...keys].sort()).toEqual(['2026-08-23T2230', '2026-08-24T0800', '2026-08-24T2230']);
    // Three because the day opens inside the previous evening's window; the two
    // that BELONG to this day are the 08:00 and 22:30 runs.
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
