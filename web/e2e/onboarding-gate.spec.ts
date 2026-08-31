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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import {
  acknowledgeWriteDecision,
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

/**
 * ── The WRITE half — finding F-033, Layer G delta audit, 2026-08-31 ──────────
 *
 * Everything above guards the READ: whether the modal is shown. Until this block
 * existed, nothing guarded what happens when the reader presses the button.
 *
 * ⚠️ **The two halves fail in opposite directions, which is why the tests above
 * proved nothing about this one.** A wrong read shows the gate to somebody who has
 * already agreed — annoying, visible, recoverable by reloading. A wrong write
 * destroys the record that they agreed at all — silent, and gone. The 2026-08-27
 * incident needed BOTH to go wrong: the read put the modal up, and the write took
 * the June date. Fixing and guarding only the read leaves the expensive half of
 * that pair unprotected.
 *
 * ⚠️ **`acknowledgeWriteDecision` was extracted so this could exist.** The rules
 * lived inside a `'use server'` action that builds its own Supabase client, so no
 * credential-free spec could reach them — four real protections, zero tests, on the
 * one path already known to destroy a compliance record. The behaviour is unchanged;
 * only its address is.
 */
test.describe('the acknowledgement is write-once', () => {
  test('an unreadable row is REFUSED, never written', () => {
    // The exact 2026-08-27 shape: a verified session, a row that did not come back.
    expect(acknowledgeWriteDecision(null, false)).toBe('refuse_unreadable');
    expect(acknowledgeWriteDecision(undefined, false)).toBe('refuse_unreadable');
  });

  test('a FAILED read is refused even when a row comes back with it', () => {
    // Defensive, and deliberately not just a duplicate of the case above: a client
    // that returns both an error and a stale/partial row must not be read as
    // permission to write. The error wins.
    expect(acknowledgeWriteDecision({ acknowledged_disclaimer_at: null }, true)).toBe(
      'refuse_unreadable',
    );
  });

  test('an EXISTING date is never overwritten — the whole point', () => {
    // The June record the incident destroyed. This is the single most important
    // assertion in the file: if it ever fails, the same date is lost again.
    expect(
      acknowledgeWriteDecision({ acknowledged_disclaimer_at: '2026-06-15T12:57:00.000Z' }, false),
    ).toBe('skip_already_acknowledged');
  });

  test('a genuine first acknowledgement DOES write', () => {
    /**
     * ⚠️ **The control, and the file is worthless without it.** Every assertion
     * above is satisfied by a function that refuses everything — `return
     * 'refuse_unreadable'` would pass all three and would also mean no reader could
     * ever get past the modal. A guard has to prove the door opens as well as that
     * it shuts (the same reason `db-grants.spec.ts` asserts a real account can still
     * save its name).
     */
    expect(acknowledgeWriteDecision({ acknowledged_disclaimer_at: null }, false)).toBe('write');
    expect(acknowledgeWriteDecision({}, false)).toBe('write');
  });

  test('an empty-string date is treated as no date, not as a record', () => {
    // Postgres cannot produce this, but a mapping layer could. It must fall to
    // 'write' rather than being read as an acknowledgement that never happened —
    // the safe direction here is the opposite of the one above, because a spurious
    // "already acknowledged" would lock a real reader behind a modal that can
    // never clear.
    expect(acknowledgeWriteDecision({ acknowledged_disclaimer_at: '' }, false)).toBe('write');
  });

  test('the UPDATE still carries its race clause', () => {
    /**
     * ⚠️ **A source check, which is weaker than everything else in this file, and
     * it says so rather than passing itself off as equivalent.**
     *
     * Three of the four protections are decisions and are driven for real above.
     * The fourth is a property of the QUERY — `.is('acknowledged_disclaimer_at',
     * null)` on the UPDATE, so that two tabs racing cannot both write and Postgres
     * decides it rather than the gap between our read and our write. That cannot be
     * exercised without a real database, and this project has no test database
     * (the same reason a valid purge-cron call is never driven).
     *
     * So the honest options were: assert the source, or leave the protection
     * completely unguarded and say nothing. This asserts the source and states the
     * limit — it would not catch a Supabase client that silently stopped applying
     * `.is()`, only somebody deleting the line. Comments are stripped first, because
     * this file's own prose names the clause and a guard that reads its own
     * documentation is testing the documentation (the mistake `check-seo.mjs`
     * records making four times).
     */
    const src = readFileSync(join(__dirname, '..', 'app', '(app)', 'actions.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(
      src,
      'acknowledgeDisclaimer must keep .is(…, null) on the UPDATE — without it two ' +
        'tabs can both write and the first acknowledgement date is overwritten',
    ).toContain(".is('acknowledged_disclaimer_at', null)");

    // The control for the check itself: prove we are reading the real file and that
    // the comment-stripping did not eat the code with the prose.
    expect(src).toContain('export async function acknowledgeDisclaimer');
  });
});
