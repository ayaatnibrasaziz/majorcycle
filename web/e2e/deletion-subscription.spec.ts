import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  DELETION_CANCEL_METADATA_KEY,
  deletionSubscriptionKind,
  deletionSubscriptionLine,
  reactivateLines,
  type DeletionSubscriptionKind,
} from '@/lib/deletionSubscription';

/**
 * What deleting an account says about its subscription (owner, 2026-10-03).
 *
 * The delete card, the "deletion scheduled" email and /reactivate all read
 * lib/deletionSubscription.ts. Before it, every paying customer was told their plan
 * "stays valid until the end of the period you've already paid for — deleting doesn't
 * cut it short", which was untrue for an annual plan (the day-30 purge DOES cut it
 * short), a failed payment (nothing was paid for this period) and a dispute (access is
 * on hold); and /reactivate promised the subscription back after it had already ended.
 *
 * Pure: no browser, no network, no credentials.
 */

const DELETION = new Date('2026-11-02T00:00:00Z');
const BEFORE = '2026-10-20T00:00:00Z';
const AFTER = '2027-09-01T00:00:00Z'; // an annual plan renewed last month

test.describe('which sentence a subscriber gets when they delete their account', () => {
  const cases: Array<[string, Parameters<typeof deletionSubscriptionKind>[0], DeletionSubscriptionKind]> = [
    ['no subscription', { subscription_status: null }, 'none'],
    ['ended subscription', { subscription_status: 'canceled' }, 'none'],
    ['trial', { subscription_status: 'trialing', current_period_end: BEFORE }, 'trial'],
    ['monthly, period ends before deletion', { subscription_status: 'active', current_period_end: BEFORE }, 'runs_out'],
    ['annual, period runs past deletion', { subscription_status: 'active', current_period_end: AFTER }, 'cut_short'],
    ['unknown period end', { subscription_status: 'active', current_period_end: null }, 'cut_short'],
    ['failed payment', { subscription_status: 'past_due', current_period_end: BEFORE }, 'payment_failed'],
    ['dispute', { subscription_status: 'active', billing_blocked: true, current_period_end: BEFORE }, 'held'],
    ['dispute on a trial', { subscription_status: 'trialing', billing_blocked: true }, 'held'],
  ];
  for (const [name, profile, want] of cases) {
    test(name, () => {
      expect(deletionSubscriptionKind(profile, DELETION)).toBe(want);
    });
  }

  test('the period ending ON the deletion date runs out rather than being cut short', () => {
    expect(
      deletionSubscriptionKind({ subscription_status: 'active', current_period_end: DELETION.toISOString() }, DELETION),
    ).toBe('runs_out');
  });
});

test.describe('the sentences say what actually happens', () => {
  const dates = { deletionDate: 'Monday, 2 November 2026', periodEnd: 'Tuesday, 20 October 2026' };

  test('only a period that ends before the deletion date is promised in full', () => {
    expect(deletionSubscriptionLine('runs_out', dates)).toContain('stays active until the end of the period');
    expect(deletionSubscriptionLine('runs_out', dates)).toContain('(Tuesday, 20 October 2026)');
    // The old promise must not survive in the one case where it is false.
    const cut = deletionSubscriptionLine('cut_short', dates)!;
    expect(cut).not.toMatch(/stays (valid|active) until/);
    expect(cut).toMatch(/isn't refunded/);
  });

  test('a failed payment is not told it has paid', () => {
    const line = deletionSubscriptionLine('payment_failed', dates)!;
    expect(line).not.toMatch(/paid for/);
    expect(line).toMatch(/hasn't gone through/);
  });

  test('a disputed account is not told its plan is active', () => {
    const line = deletionSubscriptionLine('held', dates)!;
    expect(line).toMatch(/on hold/);
    expect(line).not.toMatch(/stays active/);
  });

  test('a trial is told there is no charge; no subscription gets no sentence', () => {
    expect(deletionSubscriptionLine('trial', dates)).toMatch(/no charge/);
    expect(deletionSubscriptionLine('none', dates)).toBeNull();
  });

  test('every sentence names the deletion date when it has one, and reads without one', () => {
    for (const k of ['trial', 'runs_out', 'cut_short', 'payment_failed', 'held'] as const) {
      expect(deletionSubscriptionLine(k, dates), k).toContain(dates.deletionDate);
      const bare = deletionSubscriptionLine(k, { deletionDate: null, periodEnd: null })!;
      expect(bare, k).toContain('before the deletion date');
      expect(bare, k).not.toMatch(/null|undefined|\(\)/);
    }
  });
});

test.describe('reactivating promises only what comes back', () => {
  test('a live subscription comes back; an ended one is said to have ended', () => {
    expect(reactivateLines('active').restores).toMatch(/your subscription/);
    expect(reactivateLines('trialing').note).toBeNull();
    const ended = reactivateLines('canceled');
    expect(ended.restores).not.toMatch(/subscription/);
    expect(ended.note).toMatch(/free plan/);
    expect(reactivateLines(null)).toEqual({ restores: 'your profile and your history', note: null });
  });
});

test.describe('reactivating undoes only the cancel that deletion set', () => {
  // The two halves live in a server action that needs Stripe and a session, so this
  // reads the source: deletion must MARK its cancel and skip an already-cancelling
  // subscription, and reactivation must check the mark before un-cancelling. Without
  // both, a customer who cancelled in the billing portal and then deleted was charged
  // again the moment they signed back in.
  const src = readFileSync('app/(app)/account/actions.ts', 'utf8');

  test('deletion marks its own cancel and leaves an existing one alone', () => {
    expect(src).toMatch(/!profile\?\.cancel_at_period_end/);
    expect(src).toMatch(/cancel_at_period_end: true,\s*metadata: \{ \[DELETION_CANCEL_METADATA_KEY\]: '1' \}/);
  });

  test('reactivation un-cancels only a subscription carrying the mark', () => {
    expect(src).toMatch(
      /metadata\?\.\[DELETION_CANCEL_METADATA_KEY\] === '1'\)\s*\{\s*await stripe\.subscriptions\.update\([^)]*cancel_at_period_end: false/,
    );
    // Control: the key is a real, non-empty identifier.
    expect(DELETION_CANCEL_METADATA_KEY).toMatch(/^[a-z_]{8,}$/);
  });
});
