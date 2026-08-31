import { test, expect, type Page } from '@playwright/test';

/**
 * The four universe endpoints behind the screener: ticker autocomplete, the
 * Request-a-Ticker menu and its status column, and the request itself.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * All four had **zero tests** until 2026-08-23 — found by the Layer G coverage
 * map, which enumerated every route the production build emits and checked each
 * against the specs rather than assuming the well-trodden pages were the whole
 * product. `/api/request-ticker` in particular has a five-branch refusal ladder
 * (400 / 404 / 409 / 500 / success) and not one branch was exercised.
 *
 * They are also the routes that carried no `Cache-Control` at all, which is the
 * same omission in a different form: nobody had looked at them since they were
 * written. The header is now asserted here as well as in
 * `check:entitlement-gates`, because the guard reads the source and this reads
 * the wire, and CLAUDE.md 11a is explicit that those are different questions.
 *
 * ── ⚠️ The success path is deliberately NOT driven ──────────────────────────
 * A successful `POST /api/request-ticker` writes a real row to the real
 * `ticker_requests` table — there is no test database — and the nightly cron
 * would then go and fetch that symbol, permanently expanding the universe from a
 * test run. Every case below is therefore a **refusal**, each of which returns
 * before any write. That is not a gap being hidden: the success path is covered
 * by the owner's guided walkthrough and by the eight real `fetched` rows in
 * production, and pinning it here would cost more than it proves.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', EMAIL!);
  await page.fill('input#password', PASSWORD!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/stocks/);
  const dialog = page.getByRole('dialog', { name: /welcome to majorcycle/i });
  await dialog.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('checkbox', { name: /i understand and acknowledge/i }).check();
    await page.getByRole('button', { name: /continue to majorcycle/i }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  }
}

/** Every response from these routes must be private and uncacheable (11a). */
function expectPrivate(headers: Record<string, string>, label: string) {
  const cc = headers['cache-control'] ?? '';
  expect(cc, `${label} must say no-store`).toContain('no-store');
  expect(cc, `${label} must say private`).toContain('private');
  expect(cc, `${label} must not carry a SHARED-cache directive`).not.toContain('s-maxage');
}

test.describe('the universe endpoints are gated', () => {
  // No session here on purpose. These run without credentials, so they still
  // execute on a fork PR where the signed-in block below cannot.
  for (const path of ['/api/search?q=AAP', '/api/listings/search?q=AAP']) {
    test(`signed out, ${path} does not answer with data`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      // The proxy bounces to /login rather than 401ing, because these are browser
      // fetches from inside the app and a redirect is what the client expects.
      expect(res.status()).toBe(307);
      expect(res.headers()['location']).toContain('/login');
      expectPrivate(res.headers(), `the ${path} refusal`);
    });
  }
});

test.describe('the universe endpoints, signed in', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /* ─────────────────────────── ticker autocomplete ─────────────────────────── */

  test('search finds a stock we cover', async ({ page }) => {
    const res = await page.request.get('/api/search?q=AAPL');
    expect(res.status()).toBe(200);
    const { results } = await res.json();
    expect(Array.isArray(results)).toBe(true);
    expect(results.map((r: { ticker: string }) => r.ticker)).toContain('AAPL');
  });

  test('search returns a shape the caller can rely on', async ({ page }) => {
    const res = await page.request.get('/api/search?q=AAPL');
    const { results } = await res.json();
    const hit = results.find((r: { ticker: string }) => r.ticker === 'AAPL');
    expect(hit).toMatchObject({ ticker: 'AAPL' });
    // `market` drives the URL the result links to, and a wrong one sends the
    // reader to another country's listing (CLAUDE.md #14 — .V and .TO collide if
    // the market is guessed rather than stored).
    expect(['us', 'au', 'ca']).toContain(hit.market);
  });

  test('an empty query returns nothing rather than everything', async ({ page }) => {
    // The failure worth guarding: a falsy-query bug that skips the filter and
    // returns the whole universe would look like a working search box.
    const res = await page.request.get('/api/search?q=');
    expect(res.status()).toBe(200);
    expect((await res.json()).results).toEqual([]);
  });

  test('a query matching nothing returns an empty list, not an error', async ({ page }) => {
    const res = await page.request.get('/api/search?q=ZZZZNOTREAL');
    expect(res.status()).toBe(200);
    expect((await res.json()).results).toEqual([]);
  });

  test('search says private, no-store', async ({ page }) => {
    const res = await page.request.get('/api/search?q=AAPL');
    expectPrivate(res.headers(), '/api/search');
  });

  /* ──────────────────────── the Request-a-Ticker menu ──────────────────────── */

  test('the listings menu finds a real listing', async ({ page }) => {
    const res = await page.request.get('/api/listings/search?q=AAPL');
    expect(res.status()).toBe(200);
    expect((await res.json()).results.length).toBeGreaterThan(0);
  });

  test('the listings menu is empty for an empty query', async ({ page }) => {
    const res = await page.request.get('/api/listings/search?q=');
    expect((await res.json()).results).toEqual([]);
  });

  test('the listings menu says private, no-store', async ({ page }) => {
    const res = await page.request.get('/api/listings/search?q=AAPL');
    expectPrivate(res.headers(), '/api/listings/search');
  });

  test('the status endpoint answers with a statuses object', async ({ page }) => {
    const res = await page.request.post('/api/listings/status', { data: { symbols: ['AAPL'] } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toHaveProperty('statuses');
  });

  test('the status endpoint tolerates a junk body', async ({ page }) => {
    const res = await page.request.post('/api/listings/status', { data: {} });
    expect(res.status()).toBe(200);
    expectPrivate(res.headers(), '/api/listings/status');
  });

  /* ───────────────────────── the refusal ladder ────────────────────────────── */

  test('requesting nothing is refused with 400', async ({ page }) => {
    const res = await page.request.post('/api/request-ticker', { data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/missing symbol/i);
    expectPrivate(res.headers(), 'the 400');
  });

  test('a blank symbol is refused too, not treated as valid', async ({ page }) => {
    // `'   '` trims to empty. A guard written as `symbol !== undefined` would let
    // this through and queue a request for the empty string.
    const res = await page.request.post('/api/request-ticker', { data: { symbol: '   ' } });
    expect(res.status()).toBe(400);
  });

  test('a symbol that is not a real listing is refused with 404', async ({ page }) => {
    // The choose-only guard. Without it a reader could queue any string and the
    // nightly cron would spend its budget chasing it.
    const res = await page.request.post('/api/request-ticker', { data: { symbol: 'ZZZZNOTREAL' } });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toMatch(/not a known/i);
    expectPrivate(res.headers(), 'the 404');
  });

  test('a stock we already cover is refused with 409, not re-queued', async ({ page }) => {
    // Returns before any write — which is why this case is safe to drive against
    // the real database while the success path is not.
    const res = await page.request.post('/api/request-ticker', { data: { symbol: 'AAPL' } });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatch(/already in coverage/i);
    expectPrivate(res.headers(), 'the 409');
  });

  test('the symbol is upper-cased before it is judged', async ({ page }) => {
    // Lower-case 'aapl' must reach the SAME 409, not fall through to 404 and
    // become a queued duplicate of a stock we already have.
    const res = await page.request.post('/api/request-ticker', { data: { symbol: 'aapl' } });
    expect(res.status()).toBe(409);
  });

  test('listing existing requests says private, no-store', async ({ page }) => {
    const res = await page.request.get('/api/request-ticker');
    expect(res.status()).toBe(200);
    expect(await res.json()).toHaveProperty('requests');
    expectPrivate(res.headers(), 'the request list');
  });
});
