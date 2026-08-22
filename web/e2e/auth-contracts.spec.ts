import { test, expect } from '@playwright/test';

import { safeNextPath, POST_AUTH_HOME } from '../lib/url';
import { friendlyAuthError } from '../lib/authErrors';
import {
  PW_RECOVERY_COOKIE,
  PW_RECOVERY_ALLOWED_PATHS,
  recoveryCookieSetOptions,
  recoveryCookieClearOptions,
} from '../lib/authRecovery';
import {
  DELETION_NOTICE_COOKIE,
  DELETION_NOTICE_PATH,
  deletionNoticeCookieOptions,
} from '../lib/account';

/**
 * Auth CONTRACTS — the pure half of the auth net.
 *
 * A pure, credential-free spec (the shape used by `entitlement.spec.ts` and
 * `export-parity.spec.ts`): no browser, no network, so it runs on a fork PR with
 * no secrets and can never self-skip. Its companion is `auth-forms.spec.ts`,
 * which drives the same rules through a real browser.
 *
 * It exists because three of the load-bearing pieces of auth are plain functions
 * that no test had ever called. `safeNextPath` is the open-redirect guard on
 * every post-auth destination — `/login?next=`, `/signup?next=`, and both
 * `/auth/*` exchange routes feed it attacker-supplied input — and its whole
 * implementation is two character comparisons. `friendlyAuthError` decides what
 * a failed sign-in SAYS, which is a security property and not only a copy one.
 *
 * ⚠️ Every rejection table below carries ACCEPTANCE controls. `safeNextPath`
 * could satisfy all nine rejection cases by returning POST_AUTH_HOME
 * unconditionally — which would break every legitimate `?next=` on the site and
 * go green. The controls are what stop that, and the same reasoning applies to
 * the error map: "return one fixed string" passes every non-leak assertion.
 * Imported relatively, matching the existing pure specs.
 */

test.describe('safeNextPath — the open-redirect guard', () => {
  // Rejected: everything that could send a freshly authenticated user off-site.
  // The value flows into `window.location.assign(next)` in LoginForm and into
  // `redirect(`${origin}${next}`)` in auth/callback + auth/confirm, so a string
  // that escapes here escapes into a real navigation carrying a live session.
  const HOSTILE: Array<[string, string | null | undefined]> = [
    ['an absolute https URL', 'https://evil.example'],
    ['an absolute http URL', 'http://evil.example'],
    ['a protocol-relative host', '//evil.example'],
    ['a backslash protocol-relative host', '/\\evil.example'],
    ['a bare host with no scheme', 'evil.example'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['a backslash-rooted path', '\\evil.example'],
    ['an empty string', ''],
    ['a missing value', null],
    ['an absent value', undefined],
  ];

  for (const [label, input] of HOSTILE) {
    test(`rejects ${label} → ${POST_AUTH_HOME}`, () => {
      expect(safeNextPath(input)).toBe(POST_AUTH_HOME);
    });
  }

  // The controls. Without these, `return POST_AUTH_HOME` passes every test above
  // while silently breaking "?next=" — including the trial funnel, where /pricing
  // sends a signed-out reader to /signup?next=/account and expects them back.
  const LEGITIMATE = [
    '/stocks',
    '/stocks/us/AAPL',
    '/stocks/ca/ABC.V',
    '/account',
    '/results?sort=rating',
    '/run#presets',
  ];

  for (const path of LEGITIMATE) {
    test(`preserves the in-app destination ${path}`, () => {
      expect(safeNextPath(path)).toBe(path);
    });
  }

  test('POST_AUTH_HOME is itself an in-app path', () => {
    // The fallback is fed straight into a navigation. If it ever became an
    // absolute URL the guard would be handing out the very thing it rejects.
    expect(POST_AUTH_HOME.startsWith('/')).toBe(true);
    expect(safeNextPath(POST_AUTH_HOME)).toBe(POST_AUTH_HOME);
  });
});

test.describe('friendlyAuthError — what a failed sign-in is allowed to say', () => {
  test('wrong password and unknown email are indistinguishable', () => {
    // Supabase answers both with "Invalid login credentials", and this is the
    // function that decides whether we keep that or helpfully leak which half
    // was wrong. An account-enumeration oracle on the sign-in form is the
    // classic version of this bug, so it is asserted rather than assumed.
    const msg = friendlyAuthError('Invalid login credentials');
    expect(msg).toBe("That email or password doesn't match our records.");
    expect(msg.toLowerCase()).not.toContain('no account');
    expect(msg.toLowerCase()).not.toContain('not found');
    expect(msg.toLowerCase()).not.toContain('incorrect password');
  });

  const MAPPED: Array<[string, RegExp]> = [
    ['Invalid login credentials', /doesn't match our records/],
    ['Email not confirmed', /confirm your email first/],
    ['User already registered', /already exists/],
    ['A user with this email address has already been registered', /already exists/],
    ['Email rate limit exceeded', /too many attempts/i],
    ['For security purposes, you can only request this after 51 seconds', /too many attempts/i],
    ['Password is known to be weak and easy to guess', /known data breach/],
    ['This password has been found in a data breach', /known data breach/],
    ['Password should be at least 8 characters', /at least 8 characters/],
  ];

  for (const [raw, expected] of MAPPED) {
    test(`maps "${raw.slice(0, 40)}…"`, () => {
      const friendly = friendlyAuthError(raw);
      expect(friendly).toMatch(expected);
      // Raw upstream wording must not survive into the UI for a MAPPED case —
      // otherwise a matcher could silently stop matching and nothing would fail.
      expect(friendly).not.toBe(raw);
    });
  }

  test('an unrecognised message passes through unchanged', () => {
    // Deliberate: hiding an unknown error behind generic copy would leave the
    // owner — who cannot read a stack trace — with a dead end and nothing to
    // quote. This is the control that proves the map is a map and not a mute.
    const odd = 'Supabase said something entirely new in 2027';
    expect(friendlyAuthError(odd)).toBe(odd);
  });

  test('every mapped message is a complete sentence for a non-technical reader', () => {
    for (const [raw] of MAPPED) {
      const friendly = friendlyAuthError(raw);
      expect(friendly, `"${raw}" → "${friendly}"`).toMatch(/[.!]$/);
      expect(friendly.length, `"${friendly}" is too terse to act on`).toBeGreaterThan(20);
    }
  });
});

test.describe('the two flow markers are markers, not credentials', () => {
  /**
   * Both cookies unlock a page across a redirect the session cannot survive.
   * They are the same mechanism deliberately (CLAUDE.md 11f) — one pattern to
   * learn — so they are asserted side by side, and a change to one that is not
   * made to the other shows up here as a disagreement rather than as drift.
   */
  const MARKERS = [
    ['recovery confinement', recoveryCookieSetOptions()],
    ['deletion notice', deletionNoticeCookieOptions()],
  ] as const;

  for (const [label, opts] of MARKERS) {
    test(`${label}: httpOnly, lax, and time-boxed`, () => {
      // httpOnly: enforced in middleware, so script must never be able to mint or
      // read it. sameSite lax: it has to survive a top-level cross-site return
      // (the email link / OAuth hop) but never ride a cross-site POST.
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
      expect(opts.maxAge).toBeGreaterThan(0);
      expect(opts.maxAge, `${label} must not outlive the flow it marks`).toBeLessThanOrEqual(
        30 * 60,
      );
    });
  }

  test('the deletion marker is scoped to the one page it unlocks', () => {
    // Path-scoped, so the browser does not attach it to any other request. The
    // recovery marker is deliberately path '/' — it CONFINES a live session and
    // therefore has to be visible to the middleware on every route.
    expect(deletionNoticeCookieOptions().path).toBe(DELETION_NOTICE_PATH);
    expect(recoveryCookieSetOptions().path).toBe('/');
  });

  test('the deletion marker carries no user data', () => {
    // The value written by requestAccountDeletion is the literal '1'. Asserting
    // the NAME here would prove nothing; what matters is that the contract has
    // no field for an id, an email or a date to be smuggled into.
    expect(DELETION_NOTICE_COOKIE).toBe('mc_deletion_notice');
    expect(Object.keys(deletionNoticeCookieOptions()).sort()).toEqual(
      ['httpOnly', 'maxAge', 'path', 'sameSite', 'secure'].sort(),
    );
  });

  test('clearing the recovery marker mirrors setting it, and expires in the past', () => {
    // A Set-Cookie whose attributes do not match the original is ignored by the
    // browser — the marker would look cleared server-side and still be sent.
    const set = recoveryCookieSetOptions();
    const clear = recoveryCookieClearOptions();
    expect(clear.path).toBe(set.path);
    expect(clear.sameSite).toBe(set.sameSite);
    expect(clear.httpOnly).toBe(set.httpOnly);
    expect(clear.secure).toBe(set.secure);
    expect(clear.maxAge).toBe(0);
    expect(clear.expires.getTime()).toBeLessThan(Date.now());
  });

  test('both markers are secure in production and not on localhost', () => {
    // `secure` is computed from NODE_ENV. Under `next dev` it must be false or
    // the browser would drop it over plain http and every local run of the
    // deletion/recovery flows would silently lose its marker.
    const expected = process.env.NODE_ENV === 'production';
    expect(recoveryCookieSetOptions().secure).toBe(expected);
    expect(deletionNoticeCookieOptions().secure).toBe(expected);
  });

  test('a recovery-confined session can always reach the way out', () => {
    // The confinement list is an allow-list, so anything missing from it is
    // unreachable. /auth/signout is the page's "Cancel and return to sign in"
    // escape hatch: drop it and a Google-only account — which has no password to
    // set — is stuck on that page with no exit at all.
    expect(PW_RECOVERY_ALLOWED_PATHS).toContain('/account/update-password');
    expect(PW_RECOVERY_ALLOWED_PATHS).toContain('/auth/signout');
    expect(PW_RECOVERY_ALLOWED_PATHS).toContain('/auth/recovery-done');
    expect(PW_RECOVERY_COOKIE).toBe('mc_pw_recovery');
  });

  test('the confinement allow-list opens no app route', () => {
    // The point of confinement is that a recovery session cannot roam. If a
    // product path ever lands in this list the whole control is void.
    for (const path of PW_RECOVERY_ALLOWED_PATHS) {
      expect(
        path === '/account/update-password' || path.startsWith('/auth/'),
        `${path} is not an auth-exchange path and must not be reachable while confined`,
      ).toBe(true);
    }
  });
});
