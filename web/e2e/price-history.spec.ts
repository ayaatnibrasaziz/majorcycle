import { expect, test } from '@playwright/test';

import { barsVersion, packBars, RECENT_BARS, unpackBars } from '../lib/priceHistory';
import type { PriceBar } from '../lib/types';
import { HAVE_E2E_CREDENTIALS, signIn } from './lib/session';

/**
 * The Stock Detail page carries two years of prices and fetches the rest
 * (lib/priceHistory.ts says why: the whole history was 1.77 MB of a 2 MB page).
 *
 * ⚠️ What this must never allow is a CHANGED number. So the pure half proves the
 * trip is exact to the bit — through JSON, the way it really travels — and that the
 * cache fingerprint moves when ANY price moves, since a URL that survives a dividend
 * re-adjustment would let a browser keep last night's prices for a day.
 */

// Full-precision doubles, the shape the provider stores (CLAUDE.md 11az).
const BARS: PriceBar[] = [
  { date: '1990-01-02', open: 1.0004718210364965, high: 1.027695655822754, low: 0.9902626365501418, close: 1.027695655822754, volume: 6206625 },
  { date: '1990-01-03', open: 1.0345007102377164, high: 1.0413067639395401, low: 1.0208890628579759, close: 0.1 + 0.2, volume: 0 },
  { date: '2026-09-25', open: 319.9700012207031, high: 321.5, low: 318.0000000000001, close: 320.12, volume: 48210001 },
];

test.describe('packing is exact', () => {
  test('pack → JSON → unpack gives back the identical bars', () => {
    const round = unpackBars(JSON.parse(JSON.stringify(packBars(BARS))));
    expect(round).toEqual(BARS);
    // toEqual would forgive -0/0; Object.is does not.
    for (let i = 0; i < BARS.length; i++) {
      for (const k of ['open', 'high', 'low', 'close', 'volume'] as const) {
        expect(Object.is(round[i]![k], BARS[i]![k]), `${BARS[i]!.date} ${k}`).toBe(true);
      }
    }
  });

  test('columns of different lengths are refused, not silently misaligned', () => {
    const p = packBars(BARS);
    p.l.pop();
    expect(() => unpackBars(p)).toThrow(/disagree in length/);
  });

  test('the fingerprint changes when ANY price changes — a dividend re-adjustment included', () => {
    const base = barsVersion(BARS);
    expect(barsVersion(BARS)).toBe(base); // CONTROL: stable for the same data
    const adjusted = BARS.map((b, i) => (i === 0 ? { ...b, close: b.close * 0.99 } : b));
    expect(barsVersion(adjusted)).not.toBe(base);
    const lowOnly = BARS.map((b, i) => (i === 1 ? { ...b, low: b.low + 1e-12 } : b));
    expect(barsVersion(lowOnly)).not.toBe(base);
  });
});

test.describe('the page and /api/bars', () => {
  test.skip(!HAVE_E2E_CREDENTIALS, 'set E2E_EMAIL / E2E_PASSWORD to run');

  test('the page carries only the recent window; the full history follows', async ({ page }) => {
    // Generous: on a cold dev server the page and the route both compile first.
    test.setTimeout(150_000);
    await signIn(page);
    const full = page.waitForResponse((r) => r.url().includes('/api/bars?') && r.status() === 200, { timeout: 120_000 });
    const res = await page.goto('/stocks/us/AAPL');
    const html = (await res!.text());
    // Every bar carries a date; count the dates inside the page's data. AAPL has
    // ~11,500 bars; the page must hold the window, not the history.
    const dates = html.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    expect(dates.length, 'the page embedded far more than the recent window').toBeLessThan(RECENT_BARS * 3);
    const body = (await (await full).json()) as { d: string[] };
    expect(body.d.length, 'the full history is much longer than the window').toBeGreaterThan(RECENT_BARS * 5);
    expect(body.d[0]! < body.d[body.d.length - 1]!, 'dates ascend').toBe(true);
  });

  test('no hydration error while the full history arrives — the first test run found one', async ({ page }) => {
    // The drawdown chart streams in after the page; the full history has usually
    // arrived by then, and its first browser render drew the chart where the server
    // had sent "Loading…". React logs the mismatch and redraws the tree.
    test.setTimeout(150_000);
    const hydration: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /hydrat/i.test(m.text())) hydration.push(m.text().slice(0, 200));
    });
    page.on('pageerror', (e) => {
      if (/hydrat/i.test(e.message)) hydration.push(e.message.slice(0, 200));
    });
    await signIn(page);
    const full = page.waitForResponse((r) => r.url().includes('/api/bars?') && r.status() === 200, { timeout: 90_000 });
    await page.goto('/stocks/us/AAPL');
    await full;
    // The drawdown chart is the late, streamed section — wait until it has drawn.
    await expect(page.getByText('Loading the full price history…')).toHaveCount(0, { timeout: 90_000 });
    await page.waitForTimeout(1000);
    expect(hydration, 'a hydration mismatch was logged').toEqual([]);
  });

  test('caching: private always, kept a day only when the fingerprint matches', async ({ page }) => {
    await signIn(page);
    const stale = await page.request.get('/api/bars?ticker=AAPL&v=not-the-current-one');
    expect(stale.status()).toBe(200);
    expect(stale.headers()['cache-control']).toBe('private, no-store');
    const body = (await stale.json()) as ReturnType<typeof packBars>;
    const current = barsVersion(unpackBars(body));
    const fresh = await page.request.get(`/api/bars?ticker=AAPL&v=${encodeURIComponent(current)}`);
    expect(fresh.headers()['cache-control']).toBe('private, max-age=86400, immutable');
    const bad = await page.request.get('/api/bars?ticker=%3Cscript%3E');
    expect(bad.status()).toBe(400);
    expect(bad.headers()['cache-control']).toBe('private, no-store');
  });

  test('signed out, the history is not served', async ({ request }) => {
    const res = await request.get('/api/bars?ticker=AAPL', { maxRedirects: 0 });
    expect([302, 303, 307, 401]).toContain(res.status());
  });
});
