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

  /* ── every Stripe status, not just the four we meet daily ────────────────── */

  // Stripe can put a subscription in eight states. `entitlement.spec.ts` and the
  // behavioural matrix between them exercised `active`, `trialing`, `past_due` and
  // `canceled` heavily — 84 mentions — and the other four barely or never:
  // `paused` twice, `incomplete` once, `unpaid` once, `incomplete_expired` NEVER.
  // The Layer G coverage map found the hole. What follows closes it.
  const THIN_STATES = ['incomplete', 'incomplete_expired', 'unpaid', 'paused'] as const;

  test('every status outside active/trialing denies access', () => {
    // The security property, and it holds by construction: LIVE_STATES is a
    // two-element set and everything else falls through. Asserted anyway, because
    // "correct by construction" is a statement about today's code — the day
    // someone adds a status to that set, this is what says so.
    for (const subscription_status of THIN_STATES) {
      expect(hasAccess({ subscription_status }, NOW), `${subscription_status} must not be entitled`).toBe(false);
    }
  });

  test('each rare state now says what actually happened — F-005, FIXED', () => {
    // ⚠️ This test used to PIN the defect: all four collapsed to
    // `no_subscription`, which told a reader with a stuck subscription that they
    // did not have one — and three of the four had already tried to pay us. The
    // access decision was always right; only the sentence was wrong, which is why
    // nothing failed and nobody noticed.
    //
    // `unpaid` maps to `payment_failed` on purpose, not by omission: it is what
    // `past_due` becomes once Stripe stops retrying, so the reader's situation and
    // their next action — update the card — are identical. A separate reason would
    // be a distinction that exists in Stripe's model and not in theirs.
    expect(accessDenialReason({ subscription_status: 'incomplete' }, NOW)).toBe('setup_incomplete');
    expect(accessDenialReason({ subscription_status: 'incomplete_expired' }, NOW)).toBe('setup_incomplete');
    expect(accessDenialReason({ subscription_status: 'unpaid' }, NOW)).toBe('payment_failed');
    expect(accessDenialReason({ subscription_status: 'paused' }, NOW)).toBe('subscription_paused');
  });

  // ⚠️ There is deliberately NO test here that every reason has copy. It would
  // duplicate a guarantee the compiler already gives: `DENIAL_COPY` is typed
  // `Record<AccessDenialReason, …>`, so a reason added to the union without its
  // entry is a `pnpm typecheck` failure, not a runtime surprise. Asserting it here
  // would also mean importing a React client component into a pure spec — and an
  // app-side import has taken this whole suite down once before (the `server-only`
  // incident in the legal audit).

  test('an unrecognised status from Stripe still fails closed', () => {
    // Stripe adds states over time. A status we have never seen must deny, not
    // slip through a switch that only enumerates the ones we knew about.
    expect(hasAccess({ subscription_status: 'some_future_stripe_state' }, NOW)).toBe(false);
    expect(accessDenialReason({ subscription_status: 'some_future_stripe_state' }, NOW)).toBe(
      'no_subscription',
    );
  });

  test('a dispute lock outranks even the rare states', () => {
    // `billing_blocked` is checked before the status is consulted, so a paused
    // account under dispute must say so rather than reporting the pause.
    for (const subscription_status of THIN_STATES) {
      expect(
        accessDenialReason({ subscription_status, billing_blocked: true }, NOW),
      ).toBe('billing_blocked');
    }
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
