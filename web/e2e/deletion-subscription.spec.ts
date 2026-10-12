import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    // Deletion cancels a past_due subscription at once, so "on hold" would describe a
    // plan that no longer exists.
    ['dispute AND a failed payment', { subscription_status: 'past_due', billing_blocked: true }, 'payment_failed'],
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

  test('a failed payment is not told it has paid, nor that it may still be charged', () => {
    const line = deletionSubscriptionLine('payment_failed', dates)!;
    expect(line).not.toMatch(/paid for/);
    expect(line).toMatch(/hasn't gone through/);
    // Deletion cancels it outright (no retries), so no sentence may promise a retry.
    expect(line).not.toMatch(/may still retry/);
    expect(line).toMatch(/won't try that payment again/);
    expect(line).toMatch(/free plan/);
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

  // Both the email and the Delete account card say "sign back in before …" in the sentence
  // directly above this one, so this one must not say it again (owner, 2026-10-12).
  test('no sentence repeats the sign-in instruction above it, and each reads without dates', () => {
    for (const k of ['trial', 'runs_out', 'cut_short', 'payment_failed', 'held'] as const) {
      for (const d of [dates, { deletionDate: null, periodEnd: null }]) {
        const line = deletionSubscriptionLine(k, d)!;
        expect(line, k).not.toMatch(/sign back in/i);
        expect(line, k).not.toContain(dates.deletionDate);
        expect(line, k).not.toMatch(/null|undefined|\(\)/);
      }
    }
  });

  test('the email and the card say "sign back in" exactly once', () => {
    const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
    for (const f of ['lib/email/accountEmails.ts', 'components/account/DeleteAccountCard.tsx']) {
      const src = read(f);
      // The deletion email's HTML half, or the card's whole body.
      const scope = f.endsWith('.tsx') ? src : src.slice(src.indexOf('const bodyHtml'), src.indexOf('const text'));
      expect((scope.match(/sign back in/gi) ?? []).length, f).toBe(1);
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

  test('a dispute decides what comes back', () => {
    // Open dispute: the subscription returns, but on hold.
    const open = reactivateLines('active', true);
    expect(open.restores).toMatch(/subscription/);
    expect(open.note).toMatch(/on hold/);
    // Lost dispute: ended, and checkout refuses billing_blocked accounts, so the
    // ordinary "subscribe again at any time" would be untrue.
    const lost = reactivateLines('canceled', true);
    expect(lost.restores).not.toMatch(/subscription/);
    expect(lost.note).toMatch(/contact support/);
    expect(lost.note).not.toMatch(/at any time/);
    // Control: without a dispute, the plain sentences are unchanged.
    expect(reactivateLines('canceled', false).note).toMatch(/at any time/);
    expect(reactivateLines('active', false).note).toBeNull();
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
    expect(src).toMatch(/pastDue \|\| !profile\?\.cancel_at_period_end/);
    expect(src).toMatch(/cancel_at_period_end: true,\s*metadata: \{ \[DELETION_CANCEL_METADATA_KEY\]: '1' \}/);
  });

  test('deletion cancels a FAILED payment outright, so it can never be retried later', () => {
    expect(src).toMatch(/const pastDue = profile\?\.subscription_status === 'past_due'/);
    expect(src).toMatch(/if \(pastDue\) \{\s*await getStripe\(\)\.subscriptions\.cancel\(profile\.stripe_subscription_id\)/);
  });

  test('reactivation un-cancels only a subscription carrying the mark', () => {
    expect(src).toMatch(
      /metadata\?\.\[DELETION_CANCEL_METADATA_KEY\] === '1'\)\s*\{\s*(?:reactivated = )?await stripe\.subscriptions\.update\([^)]*cancel_at_period_end: false/,
    );
    // Control: the key is a real, non-empty identifier.
    expect(DELETION_CANCEL_METADATA_KEY).toMatch(/^[a-z_]{8,}$/);
  });

  test('reactivation records Stripe’s answer before the reader lands, not a webhook later', () => {
    // 2026-10-12, measured on a test-clock subscription: the redirect beat the
    // `subscription.updated` webhook, so the sidebar and Account card still said
    // "Cancelling" to someone who had just pressed Reactivate. Comments stripped, so the
    // paragraph explaining the fix cannot satisfy the guard (11c-iv).
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const body = code.slice(code.indexOf('export async function reactivateAccount'));
    expect(body).toMatch(/reactivated = await stripe\.subscriptions\.update\(/);
    expect(body).toMatch(/await syncSubscription\(admin, reactivated\)/);
    // ...and it happens before the reader is sent on.
    expect(body.indexOf('syncSubscription(admin, reactivated)')).toBeLessThan(body.indexOf("redirect('/stocks')"));
  });
});
