import { expect, test } from '@playwright/test';

import list from '../lib/tor-exits.json';
import { TOR_EXIT_COUNT, clientIp, isTorExit } from '../lib/torExits';

/**
 * Tor exits are refused site-wide — lib/torExits.ts says why (the fake sign-ups of
 * 24–25 Sep 2026 all came over Tor, in a real browser that passed Turnstile).
 *
 * The load-bearing assertion is the CONTROL: an ordinary visitor still gets every
 * page. "Refuse everyone" passes all the Tor assertions and takes the site down.
 *
 * ⚠️ On Vercel `x-forwarded-for` is written by the platform and cannot be forged; the
 * dev server passes our header through, which is what lets this test stand in for a
 * Tor visitor at all. It proves the RULE, not Vercel's header — that half was read
 * from Vercel's docs and is checked on the live site by hand.
 */

const TOR_IP = list.addresses[0]!;
const ORDINARY_IP = '203.0.113.7'; // TEST-NET-3 — reserved, can never be a Tor exit

test.describe('the list and the rule', () => {
  test('the exit list is a real list, not an empty or truncated one', () => {
    // An empty list makes every assertion below about refusal meaningless.
    expect(TOR_EXIT_COUNT).toBeGreaterThan(500);
    expect(list.addresses.every((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a))).toBe(true);
  });

  test('a listed exit is refused; an ordinary address and "unknown" are not', () => {
    expect(isTorExit(TOR_IP)).toBe(true);
    expect(isTorExit(ORDINARY_IP)).toBe(false);
    expect(isTorExit(null)).toBe(false); // no address (local dev) must never lock anyone out
  });

  test('the client address is the FIRST forwarded entry, IPv6-mapped form unwrapped', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': `${TOR_IP}, 10.0.0.1` }))).toBe(TOR_IP);
    expect(clientIp(new Headers({ 'x-forwarded-for': `::ffff:${TOR_IP}` }))).toBe(TOR_IP);
    expect(clientIp(new Headers({ 'x-real-ip': TOR_IP }))).toBe(TOR_IP);
    expect(clientIp(new Headers())).toBeNull();
  });
});

test.describe('on the wire', () => {
  // A prerendered page, a per-request page, the two forms that send email, and an API.
  for (const path of ['/', '/learn', '/login', '/signup', '/reset-password', '/api/search?q=AAPL']) {
    test(`${path}: a Tor exit gets a 403 and nothing to run`, async ({ request }) => {
      const res = await request.get(path, {
        headers: { 'x-forwarded-for': TOR_IP },
        maxRedirects: 0,
      });
      expect(res.status()).toBe(403);
      expect(res.headers()['cache-control']).toBe('private, no-store');
      expect(res.headers()['content-type']).toContain('text/plain');
      expect(await res.text()).toContain('not available over Tor');
    });
  }

  test('CONTROL — an ordinary visitor still gets the pages', async ({ request }) => {
    for (const path of ['/', '/learn', '/login', '/signup']) {
      const res = await request.get(path, { headers: { 'x-forwarded-for': ORDINARY_IP } });
      expect(res.status(), path).toBe(200);
      expect(await res.text(), path).not.toContain('not available over Tor');
    }
  });
});
