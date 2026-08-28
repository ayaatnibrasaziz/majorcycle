/**
 * A failed profile read must never be reported as "this reader has never agreed".
 *
 * THE BUG THIS GUARDS (found on the live site 2026-08-27, fixed 2026-08-28).
 * `getViewerEntitlement` discarded the error from its `profiles` read and mapped a
 * null row onto `acknowledgedDisclaimerAt: null`. The (app) layout gated the
 * first-login disclaimer modal on that field alone, so one unreadable row put the
 * onboarding gate in front of an account that had acknowledged on 2026-06-15.
 *
 * ⚠️ WHY THAT IS WORSE THAN A COSMETIC RE-PROMPT. The modal's only button WRITES.
 * The owner pressed it, and `acknowledged_disclaimer_at` went from June to August —
 * the original acknowledgement date, which is a compliance record under locked
 * decisions #23/#24, no longer exists. Confirmed against the live database: the
 * account created 2026-06-15 12:54 now carries an acknowledgement of 2026-08-27
 * 04:09, while a sibling account created a day later still shows its own, three
 * minutes after signup.
 *
 * WHY A NULL ROW ALWAYS MEANS "UNREADABLE" HERE. `on_auth_user_created` (migration
 * 20260614030000) creates the `profiles` row for every account. Verified live on
 * 2026-08-28: 7 auth users, 7 profiles, none missing. So for a caller that already
 * holds a verified `userId`, the row exists by construction and an empty read did
 * not see it. Measured cause candidate: an expired JWT falls back to `anon`, and
 * RLS answers that with zero rows — HTTP 406 / PGRST116, reproduced against the
 * live project.
 *
 * WHY THESE TESTS ARE PURE. They import the real `viewerFromProfileRead` and
 * `shouldShowOnboarding` from `lib/entitlement.ts` — no browser, no network, no
 * credential — so they run on a fork PR with no secrets and can never self-skip
 * (CLAUDE.md, Testing row). ⚠️ They must NOT import `lib/entitlement.server.ts`:
 * it carries `import 'server-only'`, which takes the entire suite down rather than
 * failing one file. That is why the decision lives in the pure module.
 */

import { expect, test } from '@playwright/test';

import {
  shouldShowOnboarding,
  viewerFromProfileRead,
  SIGNED_OUT_VIEWER,
} from '../lib/entitlement';

const USER = '11111111-2222-3333-4444-555555555555';

const ACKNOWLEDGED = {
  email: 'reader@example.com',
  display_name: 'Reader',
  subscription_status: 'active',
  grace_until: null,
  billing_blocked: false,
  acknowledged_disclaimer_at: '2026-06-15T12:57:00.000Z',
  deletion_scheduled_at: null,
};

test.describe('onboarding gate — unreadable is not "never agreed"', () => {
  test('an unreadable row does NOT show the onboarding modal', () => {
    const viewer = viewerFromProfileRead(USER, null);

    expect(viewer.profileUnreadable).toBe(true);
    expect(shouldShowOnboarding(viewer)).toBe(false);
  });

  /**
   * THE CONTROL. Without it, a `shouldShowOnboarding` that simply returned `false`
   * for everyone would pass every other assertion in this file — and the product
   * would silently stop asking anyone to acknowledge anything, which breaks locked
   * decision #23 in the opposite direction.
   */
  test('a readable row that has never acknowledged DOES show the modal', () => {
    const viewer = viewerFromProfileRead(USER, {
      ...ACKNOWLEDGED,
      acknowledged_disclaimer_at: null,
    });

    expect(viewer.profileUnreadable).toBe(false);
    expect(shouldShowOnboarding(viewer)).toBe(true);
  });

  test('a readable row that HAS acknowledged does not show the modal', () => {
    const viewer = viewerFromProfileRead(USER, ACKNOWLEDGED);

    expect(viewer.acknowledgedDisclaimerAt).toBe('2026-06-15T12:57:00.000Z');
    expect(shouldShowOnboarding(viewer)).toBe(false);
  });

  test('a signed-out viewer is never shown the modal', () => {
    expect(shouldShowOnboarding(SIGNED_OUT_VIEWER)).toBe(false);
  });

  /**
   * THE SECURITY CONTROL, and the reason this fix is not a paywall change.
   * Suppressing the modal on an unreadable read must not also suppress the
   * entitlement denial: unreadable still FAILS CLOSED, exactly as before.
   */
  test('an unreadable row still denies entitlement', () => {
    const viewer = viewerFromProfileRead(USER, null);

    expect(viewer.entitled).toBe(false);
    expect(viewer.subscriptionStatus).toBeNull();
    expect(viewer.deletionScheduled).toBe(false);
  });

  /**
   * The two states the old code could not tell apart, asserted as genuinely
   * different objects. `acknowledgedDisclaimerAt` is null in both — that is the
   * whole trap — so the discriminator has to be its own field.
   */
  test('unreadable and never-acknowledged are distinguishable', () => {
    const unreadable = viewerFromProfileRead(USER, null);
    const neverAgreed = viewerFromProfileRead(USER, {
      ...ACKNOWLEDGED,
      acknowledged_disclaimer_at: null,
    });

    expect(unreadable.acknowledgedDisclaimerAt).toBeNull();
    expect(neverAgreed.acknowledgedDisclaimerAt).toBeNull();
    expect(unreadable.profileUnreadable).not.toBe(neverAgreed.profileUnreadable);
    expect(shouldShowOnboarding(unreadable)).not.toBe(shouldShowOnboarding(neverAgreed));
  });

  /**
   * Parity control for the refactor that made the above possible: moving the
   * mapping out of `entitlement.server.ts` must not have changed any entitlement
   * answer. A deletion-scheduled account and a lapsed one are the two that decide
   * where a reader is sent.
   */
  test('the entitlement mapping is unchanged by the extraction', () => {
    expect(viewerFromProfileRead(USER, ACKNOWLEDGED).entitled).toBe(true);

    const lapsed = viewerFromProfileRead(USER, {
      ...ACKNOWLEDGED,
      subscription_status: 'canceled',
    });
    expect(lapsed.entitled).toBe(false);
    expect(lapsed.reason).toBe('canceled');

    const deleting = viewerFromProfileRead(USER, {
      ...ACKNOWLEDGED,
      deletion_scheduled_at: '2026-08-27T00:00:00.000Z',
    });
    expect(deleting.deletionScheduled).toBe(true);

    const disputed = viewerFromProfileRead(USER, {
      ...ACKNOWLEDGED,
      billing_blocked: true,
    });
    expect(disputed.entitled).toBe(false);
    expect(disputed.billingBlocked).toBe(true);
  });
});
