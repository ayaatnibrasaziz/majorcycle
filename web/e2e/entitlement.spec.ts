import { test, expect } from '@playwright/test';

import { hasAccess, accessDenialReason } from '../lib/entitlement';

/**
 * Paywall (F3 Step 10) — contract tests.
 *
 * This file pins the DECISION — the `hasAccess` truth table below is pure and
 * credential-free, so it always runs, and it locks down decision #20 (3-day grace,
 * then hard lock) plus the fail-closed posture against silent drift.
 *
 * It deliberately does NOT drive routes — that is `entitlement-routes.spec.ts`, which
 * signs in as a throwaway account and walks all seven subscription states against real
 * pages and the real API. The split is on purpose: those tests need Supabase service
 * credentials and self-skip without them, whereas the truth table below must ALWAYS
 * run, including on a fork PR with no secrets configured.
 *
 * The rest of the net: `analytics/tests/test_cycle_handler.py` boots the real
 * /api/cycle handler and asserts the wire format (401 without the secret, premium keys
 * absent at entitled=0, present at entitled=1, `private, no-store` always), and
 * `web/scripts/check-entitlement-gates.mjs` is the credential-free tripwire for the
 * wiring itself.
 *
 * Imported relatively rather than via the `@/` alias, matching the existing specs
 * (none of which rely on the path alias being available to the Playwright transform).
 */

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-07-26T12:00:00.000Z');
const iso = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();

test.describe('hasAccess truth table', () => {
  test('active and trialing are entitled', () => {
    expect(hasAccess({ subscription_status: 'active' }, NOW)).toBe(true);
    expect(hasAccess({ subscription_status: 'trialing' }, NOW)).toBe(true);
  });

  test('no subscription is not entitled', () => {
    expect(hasAccess({ subscription_status: null }, NOW)).toBe(false);
    expect(hasAccess({}, NOW)).toBe(false);
  });

  test('canceled is not entitled', () => {
    expect(hasAccess({ subscription_status: 'canceled' }, NOW)).toBe(false);
  });

  test('past_due INSIDE the grace window keeps access', () => {
    expect(
      hasAccess({ subscription_status: 'past_due', grace_until: iso(HOUR) }, NOW),
    ).toBe(true);
  });

  test('past_due PAST the grace window loses access', () => {
    expect(
      hasAccess({ subscription_status: 'past_due', grace_until: iso(-HOUR) }, NOW),
    ).toBe(false);
  });

  test('the grace boundary is exclusive — expiring exactly now denies', () => {
    expect(
      hasAccess({ subscription_status: 'past_due', grace_until: iso(0) }, NOW),
    ).toBe(false);
  });

  test('past_due with a missing or unparseable grace marker fails CLOSED', () => {
    expect(hasAccess({ subscription_status: 'past_due' }, NOW)).toBe(false);
    expect(
      hasAccess({ subscription_status: 'past_due', grace_until: null }, NOW),
    ).toBe(false);
    expect(
      hasAccess({ subscription_status: 'past_due', grace_until: 'not-a-date' }, NOW),
    ).toBe(false);
  });

  test('billing_blocked overrides every other signal', () => {
    // A dispute lock must beat an otherwise-perfect subscription.
    expect(
      hasAccess({ subscription_status: 'active', billing_blocked: true }, NOW),
    ).toBe(false);
    expect(
      hasAccess({ subscription_status: 'trialing', billing_blocked: true }, NOW),
    ).toBe(false);
    expect(
      hasAccess(
        { subscription_status: 'past_due', grace_until: iso(HOUR), billing_blocked: true },
        NOW,
      ),
    ).toBe(false);
  });

  test('billing_blocked false does not itself grant access', () => {
    expect(
      hasAccess({ subscription_status: null, billing_blocked: false }, NOW),
    ).toBe(false);
  });

  test('a missing profile and an unknown status both fail CLOSED', () => {
    expect(hasAccess(null, NOW)).toBe(false);
    expect(hasAccess(undefined, NOW)).toBe(false);
    expect(hasAccess({ subscription_status: 'incomplete' }, NOW)).toBe(false);
    expect(hasAccess({ subscription_status: 'paused' }, NOW)).toBe(false);
    expect(hasAccess({ subscription_status: 'unpaid' }, NOW)).toBe(false);
  });
});

test.describe('accessDenialReason', () => {
  test('returns null exactly when entitled', () => {
    expect(accessDenialReason({ subscription_status: 'active' }, NOW)).toBeNull();
    expect(accessDenialReason({ subscription_status: 'trialing' }, NOW)).toBeNull();
    expect(
      accessDenialReason({ subscription_status: 'past_due', grace_until: iso(HOUR) }, NOW),
    ).toBeNull();
  });

  test('maps each denial to its own honest reason', () => {
    expect(accessDenialReason({ subscription_status: null }, NOW)).toBe('no_subscription');
    expect(accessDenialReason({ subscription_status: 'canceled' }, NOW)).toBe('canceled');
    expect(
      accessDenialReason({ subscription_status: 'past_due', grace_until: iso(-HOUR) }, NOW),
    ).toBe('payment_failed');
    expect(
      accessDenialReason({ subscription_status: 'active', billing_blocked: true }, NOW),
    ).toBe('billing_blocked');
  });

  test('a dispute lock reports as blocked, not as the underlying status', () => {
    // Otherwise a disputed past_due account would be told "update your card",
    // which is not the actionable truth.
    expect(
      accessDenialReason(
        { subscription_status: 'past_due', grace_until: iso(-HOUR), billing_blocked: true },
        NOW,
      ),
    ).toBe('billing_blocked');
  });
});
