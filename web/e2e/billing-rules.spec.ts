import { expect, test } from '@playwright/test';

import { GRACE_DAYS, paymentFailedAt } from '../lib/billing/grace';
import { nextChargeAction, nextChargeFromInvoice, nextChargeFromSubscription } from '../lib/billing/nextCharge';
import { DENIAL_COPY } from '../lib/denialCopy';
import { SIGNED_OUT_VIEWER, paymentBanner, type ViewerEntitlement } from '../lib/entitlement';
import { formatCharge } from '../lib/pricing';
import { MAX_RETURN_QUERY, POST_AUTH_HOME, returnPath, safeNextPath } from '../lib/url';

/**
 * The rules behind the billing and sign-in fixes of 2026-10-03 (owner-approved
 * designs). Pure and credential-free; the pages that use them are driven in
 * account-billing.spec.ts and auth-return-link.spec.ts.
 */

test.describe('the next charge is Stripe’s own figure', () => {
  test('which states ask Stripe, clear, or keep', () => {
    expect(nextChargeAction('active', false)).toBe('preview');
    expect(nextChargeAction('trialing', false)).toBe('preview');
    // Cancelling or cancelled: nothing more will be charged.
    expect(nextChargeAction('active', true)).toBe('clear');
    expect(nextChargeAction('trialing', true)).toBe('clear');
    expect(nextChargeAction('canceled', false)).toBe('clear');
    expect(nextChargeAction('incomplete', false)).toBe('clear');
    expect(nextChargeAction(null, false)).toBe('clear');
    // past_due keeps the FAILED invoice's amount the payment-failed handler stored.
    expect(nextChargeAction('past_due', false)).toBe('keep');
  });

  test('an invoice becomes the stored figure, discounts and tax already in it', () => {
    expect(
      nextChargeFromInvoice({ amount_due: 14310, currency: 'aud', next_payment_attempt: 1_800_000_000, period_end: 1 }),
    ).toEqual({ amount: 14310, currency: 'aud', at: new Date(1_800_000_000_000).toISOString() });
    // CONTROL: an invoice with no amount or currency stores nothing rather than a guess.
    expect(nextChargeFromInvoice({ amount_due: null as unknown as number, currency: 'aud', next_payment_attempt: null, period_end: 1 })).toBeNull();
    expect(nextChargeFromInvoice({ amount_due: 1900, currency: '', next_payment_attempt: null, period_end: 1 })).toBeNull();
  });

  test('when Stripe will not preview, the subscription’s own price — or nothing', async () => {
    type Sub = Parameters<typeof nextChargeFromSubscription>[0];
    const sub = (over: Record<string, unknown> = {}, item: Record<string, unknown> = {}): Sub =>
      ({
        currency: 'aud',
        status: 'active',
        trial_end: null,
        discounts: [],
        automatic_tax: { enabled: false },
        items: {
          data: [
            {
              price: { id: 'price_m', currency: 'aud', unit_amount: 1900 },
              quantity: 1,
              discounts: [],
              current_period_end: 1_800_000_000,
              ...item,
            },
          ],
        },
        ...over,
      }) as unknown as Sub;
    // Multi-currency price: the payload carries the default (AUD) amount only.
    const options = async (_id: string, cur: string) => ({ aud: 1900, usd: 1500, cad: 2000 })[cur] ?? null;

    expect(await nextChargeFromSubscription(sub(), options)).toEqual({
      amount: 1900, currency: 'aud', at: new Date(1_800_000_000_000).toISOString(),
    });
    expect((await nextChargeFromSubscription(sub({ currency: 'usd' }), options))?.amount).toBe(1500);
    // A trial's first charge is at the trial's end.
    expect((await nextChargeFromSubscription(sub({ status: 'trialing', trial_end: 1_799_000_000 }), options))?.at).toBe(
      new Date(1_799_000_000_000).toISOString(),
    );
    // CONTROL: whenever the price alone would be WRONG, it says nothing.
    expect(await nextChargeFromSubscription(sub({ discounts: ['di_1'] }), options)).toBeNull();
    expect(await nextChargeFromSubscription(sub({}, { discounts: ['di_2'] }), options)).toBeNull();
    expect(await nextChargeFromSubscription(sub({ automatic_tax: { enabled: true } }), options)).toBeNull();
    expect(await nextChargeFromSubscription(sub({ currency: 'nzd' }), options)).toBeNull();
  });

  test('amounts read the way prices do everywhere else', () => {
    expect(formatCharge(1900, 'aud')).toBe('A$19.00');
    expect(formatCharge(14310, 'aud')).toBe('A$143.10');
    expect(formatCharge(126000, 'usd')).toBe('US$1,260.00');
    expect(formatCharge(2000, 'CAD')).toBe('C$20.00');
    // An unknown currency keeps its own code rather than borrowing a symbol.
    expect(formatCharge(1900, 'nzd')).toBe('NZD 19.00');
  });

  test('the failure date is the grace end minus the grace the webhook grants', () => {
    const until = '2026-10-05T10:00:00.000Z';
    expect(paymentFailedAt(until)).toBe(`2026-10-0${5 - GRACE_DAYS}T10:00:00.000Z`);
    expect(paymentFailedAt(null)).toBeNull();
    expect(paymentFailedAt('not a date')).toBeNull();
  });
});

test.describe('who sees the failed-payment banner', () => {
  const viewer = (v: Partial<ViewerEntitlement>): ViewerEntitlement => ({
    ...SIGNED_OUT_VIEWER,
    userId: 'u',
    ...v,
  });

  test('in the grace window: the amber warning, with its deadline', () => {
    expect(
      paymentBanner(viewer({ entitled: true, reason: null, subscriptionStatus: 'past_due', graceUntil: 'X' })),
    ).toEqual({ kind: 'grace', until: 'X' });
  });

  test('after it: the paused warning', () => {
    expect(
      paymentBanner(viewer({ entitled: false, reason: 'payment_failed', subscriptionStatus: 'past_due' })),
    ).toEqual({ kind: 'paused' });
  });

  test('CONTROL: nobody else sees it', () => {
    expect(paymentBanner(viewer({ entitled: true, reason: null, subscriptionStatus: 'active' }))).toBeNull();
    expect(paymentBanner(viewer({ entitled: false, reason: 'canceled', subscriptionStatus: 'canceled' }))).toBeNull();
    expect(paymentBanner(viewer({ entitled: false, reason: 'no_subscription' }))).toBeNull();
    // A disputed account: updating a card cannot lift a dispute.
    expect(
      paymentBanner(viewer({ entitled: false, reason: 'billing_blocked', billingBlocked: true, subscriptionStatus: 'past_due' })),
    ).toBeNull();
    expect(paymentBanner(SIGNED_OUT_VIEWER)).toBeNull();
    expect(paymentBanner(viewer({ profileUnreadable: true, subscriptionStatus: 'past_due' }))).toBeNull();
  });
});

test('every lock reason that has gone wrong has words to say so', () => {
  for (const reason of ['canceled', 'payment_failed', 'billing_blocked', 'setup_incomplete', 'subscription_paused'] as const) {
    expect(DENIAL_COPY[reason]?.title, reason).toBeTruthy();
    expect(DENIAL_COPY[reason]?.body, reason).toBeTruthy();
  }
  // A reader meeting the paywall for the first time is not told off.
  expect(DENIAL_COPY.no_subscription).toBeNull();
});

test.describe('the link to come back to after signing in', () => {
  test('keeps the query', () => {
    expect(returnPath('/stocks/us/AAPL', '?preset=long')).toBe('/stocks/us/AAPL?preset=long');
    expect(returnPath('/account', '?checkout=success&session_id=cs_test_1')).toBe(
      '/account?checkout=success&session_id=cs_test_1',
    );
    expect(returnPath('/stocks', '')).toBe('/stocks');
  });

  test('drops a query too long to be a real page’s, and keeps the page', () => {
    expect(returnPath('/stocks', `?q=${'x'.repeat(MAX_RETURN_QUERY)}`)).toBe('/stocks');
  });

  test('a full link survives the safety check; every hostile one still does not', () => {
    expect(safeNextPath('/stocks/us/AAPL?preset=long')).toBe('/stocks/us/AAPL?preset=long');
    expect(safeNextPath('/account?checkout=success&session_id=cs_test_1')).toBe('/account?checkout=success&session_id=cs_test_1');
    for (const bad of ['//evil.com', '/\\evil.com', '/\t/evil.com', 'https://evil.com', '/%09/evil.com?x=1']) {
      const out = safeNextPath(bad);
      expect(new URL(out, 'https://www.majorcycle.com').origin, bad).toBe('https://www.majorcycle.com');
    }
    expect(safeNextPath('//evil.com/?preset=long')).toBe(POST_AUTH_HOME);
  });
});
