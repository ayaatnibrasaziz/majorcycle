import { test, expect } from '@playwright/test';
import { usesNonce } from '../lib/csp';

/**
 * Every response carries an enforcing Content-Security-Policy, in the form its
 * route can actually accept.
 *
 * ── What this file can and cannot prove ──────────────────────────────────────
 * The suite boots `next dev`, where the policy deliberately adds `'unsafe-eval'`
 * — Turbopack compiles modules with `eval` for hot reloading, and refusing it
 * would break the dev server while proving nothing about what ships. So the
 * production-only half (no `'unsafe-eval'`, the nonce reaching every inline
 * script, zero violations in a real browser) lives in `pnpm check:csp`, which
 * drives the production build on :3200.
 *
 * What IS invariant between the two, and is asserted here, is the part that has
 * historically gone wrong by omission rather than by a wrong value: **whether
 * the header is there at all, on every kind of response.** Next attaches no CSP
 * to route handlers, redirects or refusals, and this repo has been bitten four
 * times by a per-viewer response that was safe only because of somebody else's
 * default (CLAUDE.md 11a). A redirect and a 401 cannot execute a script, so the
 * point is not that they are at risk — it is that a header applied by a helper
 * every `return` passes through cannot quietly stop applying to one branch.
 *
 * ⚠️ `usesNonce` is IMPORTED, not restated. A second copy of "which routes are
 * per-request" is how the rule drifts (11c), and this one is already shared with
 * `proxy.ts` and `check-render-modes.mjs`.
 */

/** Directives that must be on every response, whatever the route. */
const ALWAYS = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
];

/**
 * The Customer Portal is reached by a real form POST to `/api/portal`, which answers
 * `303 → https://billing.stripe.com/…`. Browsers have disagreed about whether
 * `form-action` is checked against a redirect, so the destination is named rather
 * than bet on — and it is named HERE too, because the one thing worse than a wrong
 * policy is a wrong policy on the button a paying customer uses to cancel.
 */
const PORTAL_FORM_TARGET = 'https://billing.stripe.com';

const PRERENDERED = ['/', '/learn', '/learn/pe-ratio', '/terms', '/privacy', '/disclaimer', '/contact'];
const PER_REQUEST = ['/login', '/signup', '/reset-password', '/pricing'];

function scriptSrc(policy: string): string {
  return (
    policy
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('script-src')) ?? ''
  );
}

test.describe('content-security-policy', () => {
  test('is enforcing, never report-only, on every public route', async ({ request }) => {
    for (const path of [...PRERENDERED, ...PER_REQUEST]) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h['content-security-policy'], `${path} sent no CSP`).toBeTruthy();
      expect(
        h['content-security-policy-report-only'],
        `${path} still reports instead of blocking`,
      ).toBeUndefined();
      for (const directive of ALWAYS) {
        expect(h['content-security-policy'], `${path} is missing ${directive}`).toContain(
          directive,
        );
      }
      expect(
        h['content-security-policy'],
        `${path}: form-action must still admit the Customer Portal`,
      ).toContain(PORTAL_FORM_TARGET);
    }
  });

  test('a prerendered route gets inline, a per-request route gets a nonce', async ({
    request,
  }) => {
    // The two forms are not a preference. A prerendered page's HTML was written at
    // build time and its script tags carry no nonce, so a nonce policy would refuse
    // every script in it: the page renders and then does nothing. Measured — a
    // deliberate break put 14 violations on /terms with zero nonce attributes in
    // the document.
    for (const path of PRERENDERED) {
      expect(usesNonce(path), `${path} is prerendered and must not take a nonce`).toBe(false);
      const directive = scriptSrc((await request.get(path)).headers()['content-security-policy']!);
      expect(directive, `${path}`).toContain("'unsafe-inline'");
      expect(directive, `${path} names a nonce its prebuilt HTML cannot carry`).not.toContain(
        "'nonce-",
      );
    }

    for (const path of PER_REQUEST) {
      expect(usesNonce(path), `${path} renders per request and should take a nonce`).toBe(true);
      const directive = scriptSrc((await request.get(path)).headers()['content-security-policy']!);
      expect(directive, `${path} has no nonce`).toContain("'nonce-");
      // Browsers ignore 'unsafe-inline' once a nonce is present, so both together
      // is not a hole — it is a policy that lies about what it enforces.
      expect(directive, `${path} carries a nonce AND 'unsafe-inline'`).not.toContain(
        "'unsafe-inline'",
      );
    }
  });

  test('the nonce changes between requests', async ({ request }) => {
    const read = async () =>
      scriptSrc((await request.get('/login')).headers()['content-security-policy']!).match(
        /'nonce-([^']+)'/,
      )?.[1];
    const first = await read();
    const second = await read();
    expect(first).toBeTruthy();
    // A constant nonce is decoration: anyone who can read one page can then write
    // a script that passes.
    expect(second).not.toBe(first);
  });

  test('the redirects and the refusals carry it too', async ({ request }) => {
    // Not because a 307 or a 401 can run a script, but because these are the
    // branches a header quietly stops applying to. `proxy.ts` routes every return
    // through one helper precisely so this cannot happen; this is what says so.
    const bounced = await request.get('/stocks', { maxRedirects: 0 });
    expect(bounced.status()).toBe(307);
    expect(bounced.headers()['content-security-policy']).toContain("default-src 'self'");

    const refused = await request.get('/api/cycle');
    expect(refused.status()).toBe(401);
    expect(refused.headers()['content-security-policy']).toContain("default-src 'self'");
    // The refusal's own per-viewer cache rule is unchanged by any of this (11a).
    expect(refused.headers()['cache-control']).toBe('private, no-store');
  });
});
