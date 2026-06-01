// Tiny pub/sub used to synchronise the crosshair across the two date-axis
// Lightweight Charts on the Stock Detail page (Price chart + Drawdown overlay).
// They share the same trading-day X-axis, so hovering one moves the crosshair
// on the other. Each participant has a unique source symbol and ignores its own
// emissions; combined with an "applying remote" flag in each chart, this
// prevents feedback loops.

import type { Time } from 'lightweight-charts';

type Listener = (time: Time | null, source: symbol) => void;

const listeners = new Set<Listener>();

/** Stable per-chart identity so a chart never reacts to its own emissions. */
export function createSyncSource(): symbol {
  return Symbol('chart-crosshair-sync');
}

export function subscribeCrosshairSync(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitCrosshairSync(time: Time | null, source: symbol): void {
  for (const l of listeners) {
    try {
      l(time, source);
    } catch {
      /* a misbehaving listener must never break the emitter */
    }
  }
}

/* ── Visible time-range (date range) sync ───────────────────────────────────
   Both charts plot the same trading days, so a date range maps identically on
   each — panning/zooming/range-buttons on one chart move the other. We sync the
   *time* range (not the logical index range) because the two charts have
   slightly different margins, which would make a shared logical range settle on
   the wrong window. The last broadcast range is replayed to new subscribers so
   a later-mounting chart (the Drawdown overlay) catches up to the Price chart. */

export interface SyncTimeRange {
  from: Time;
  to: Time;
}

/** Convert a Lightweight Charts Time to epoch ms, for tolerance comparisons.
 *  Our charts use 'yyyy-mm-dd' string times; numbers (UTCTimestamp, seconds)
 *  and BusinessDay objects are handled defensively. */
export function timeToMs(t: Time): number {
  if (typeof t === 'number') return t * 1000;
  if (typeof t === 'string') return new Date(t + 'T00:00:00Z').getTime();
  const b = t as { year: number; month: number; day: number };
  return Date.UTC(b.year, b.month - 1, b.day);
}

type RangeListener = (range: SyncTimeRange, source: symbol) => void;

const rangeListeners = new Set<RangeListener>();
let lastRange: { range: SyncTimeRange; source: symbol } | null = null;

export function subscribeTimeRangeSync(listener: RangeListener): () => void {
  rangeListeners.add(listener);
  // Replay the latest known range so a late subscriber syncs immediately.
  if (lastRange) {
    try {
      listener(lastRange.range, lastRange.source);
    } catch {
      /* ignore */
    }
  }
  return () => {
    rangeListeners.delete(listener);
  };
}

export function emitTimeRangeSync(range: SyncTimeRange, source: symbol): void {
  lastRange = { range, source };
  for (const l of rangeListeners) {
    try {
      l(range, source);
    } catch {
      /* a misbehaving listener must never break the emitter */
    }
  }
}
