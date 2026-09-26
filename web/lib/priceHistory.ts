import type { PriceBar } from '@/lib/types';

/**
 * A stock's daily price history in the shape it travels to the browser.
 *
 * ⚠️ WHY THIS EXISTS — 2026-09-26. The Stock Detail page used to embed the WHOLE
 * history (11,344 bars for Home Depot) in its HTML, because four interactive charts
 * receive it: 1.77 MB of a 2 MB page, on every visit. Measured on the production
 * build, handing the charts 500 bars instead took the page from 1,969 KB to 363 KB
 * and the render after the data from ~0.6 s to ~0.4 s, before counting the trip to
 * Australia. Every chart opens on a one-year view, so the page now carries only the
 * last `RECENT_BARS`, and the full history follows from `/api/bars` — cached by the
 * browser under a URL that changes whenever the data does.
 *
 * ⚠️ EXACT, NOT ROUNDED. The numbers are the same JavaScript doubles the server read,
 * and `JSON.stringify` writes a double in the shortest form that parses back to the
 * identical value, so a packed-and-unpacked bar is byte-for-byte the bar that went in
 * (`e2e/price-history.spec.ts`). Rounding was measured and rejected for the screener
 * because it moved real ratings (CLAUDE.md 11ay); the same rule holds here.
 */

/** Two years of trading days: a one-year view plus the 200 bars a 200-day average needs. */
export const RECENT_BARS = 520;

/** Column per field — the field names once, not 11,000 times. */
export interface PackedBars {
  d: string[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
}

export function packBars(bars: readonly PriceBar[]): PackedBars {
  const p: PackedBars = { d: [], o: [], h: [], l: [], c: [], v: [] };
  for (const b of bars) {
    p.d.push(b.date);
    p.o.push(b.open);
    p.h.push(b.high);
    p.l.push(b.low);
    p.c.push(b.close);
    p.v.push(b.volume);
  }
  return p;
}

/**
 * Back to bars. ⚠️ Throws when the columns disagree in length: a column one short
 * does not fail on its own, it pairs one day's high with the next day's low, and
 * every number that comes out looks ordinary (the same rule as `decodeColumnarBars`).
 */
export function unpackBars(p: PackedBars): PriceBar[] {
  const n = p.d.length;
  if ([p.o, p.h, p.l, p.c, p.v].some((col) => !Array.isArray(col) || col.length !== n)) {
    throw new Error('price history columns disagree in length');
  }
  const out: PriceBar[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = { date: p.d[i]!, open: p.o[i]!, high: p.h[i]!, low: p.l[i]!, close: p.c[i]!, volume: p.v[i]! };
  }
  return out;
}

/**
 * A fingerprint of the WHOLE history, for the `/api/bars` cache key.
 *
 * ⚠️ Not just the bar count and the last date: a dividend or split re-adjusts every
 * earlier price while leaving both unchanged, and a URL built from those two alone
 * would let a browser keep last night's prices for a day. FNV-1a over every date and
 * price, so any changed value gives a new URL.
 */
export function barsVersion(bars: readonly PriceBar[]): string {
  let h = 0x811c9dc5;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  for (const b of bars) mix(`${b.date}|${b.open}|${b.high}|${b.low}|${b.close}|${b.volume};`);
  const last = bars.length ? bars[bars.length - 1]!.date : 'none';
  return `${bars.length}-${last}-${(h >>> 0).toString(36)}`;
}
