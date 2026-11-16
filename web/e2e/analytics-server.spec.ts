import { expect, test } from '@playwright/test';
import type Stripe from 'stripe';

import { gaClientIdFromCookie, gaHitForStripeEvent, gaSessionIdFromCookie } from '../lib/analyticsServer';

/**
 * Billing events → Google Analytics (lib/analyticsServer.ts). Pure: the real mapping,
 * fed event shapes Stripe sends, no network. What must hold:
 *   - each money/plan event becomes exactly the Analytics event documented there;
 *   - revenue is counted once (invoice.paid, never invoice.payment_succeeded too);
 *   - test-mode events report nothing;
 *   - nothing personal leaves: no email, no name, no user id.
 */
const CID = '123456789.1700000000';
const sub = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1', customer: 'cus_1', status: 'trialing', currency: 'aud', cancel_at_period_end: false,
  trial_end: 2_000, ended_at: null, metadata: { user_id: 'uuid-of-user', ga_client_id: CID, ga_session_id: '1794785244' },
  items: { data: [{ price: { unit_amount: 1900, recurring: { interval: 'month' } } }] },
  cancellation_details: { reason: null }, ...over,
});
const ev = (type: string, object: unknown, extra: Record<string, unknown> = {}) =>
  ({ id: 'evt_1', type, livemode: true, data: { object, ...extra } }) as unknown as Stripe.Event;
const inv = (over: Record<string, unknown> = {}) => ({
  id: 'in_1', customer: 'cus_1', amount_paid: 1900, amount_due: 1900, currency: 'aud', attempt_count: 1,
  billing_reason: 'subscription_cycle', customer_email: 'reader@example.com', customer_name: 'A Reader',
  parent: { subscription_details: { subscription: 'sub_1', metadata: { user_id: 'uuid-of-user', ga_client_id: CID, ga_session_id: '1794785244' } } },
  ...over,
});

test.describe('billing events → Google Analytics', () => {
  test('a trial start, a direct subscription, and a non-starting status', () => {
    expect(gaHitForStripeEvent(ev('customer.subscription.created', sub()))).toEqual({
      clientId: CID,
      events: [{ name: 'trial_started', params: {
        plan: 'monthly', currency: 'AUD', value: 19,
        items: [{ item_id: 'majorcycle_monthly', item_name: 'MajorCycle monthly', price: 19, quantity: 1 }],
        // Google's Measurement Protocol guide: engagement time always, and the checkout
        // visit's session so the trial is credited to that visit's source.
        engagement_time_msec: 1, session_id: '1794785244',
      } }],
    });
    expect(gaHitForStripeEvent(ev('customer.subscription.created', sub({ status: 'active' })))?.events[0]?.name)
      .toBe('subscription_started');
    expect(gaHitForStripeEvent(ev('customer.subscription.created', sub({ status: 'incomplete' })))).toBeNull();
  });

  test('a trial converting, a cancellation asked for and undone, and nothing for an ordinary update', () => {
    const conv = gaHitForStripeEvent(ev('customer.subscription.updated', sub({ status: 'active' }), { previous_attributes: { status: 'trialing' } }));
    expect(conv?.events.map((e) => e.name)).toEqual(['trial_converted']);
    const cancel = gaHitForStripeEvent(ev('customer.subscription.updated', sub({ cancel_at_period_end: true }), { previous_attributes: { cancel_at_period_end: false } }));
    expect(cancel?.events).toEqual([{ name: 'subscription_cancel_requested', params: { plan: 'monthly', during_trial: 'yes', engagement_time_msec: 1 } }]);
    const undo = gaHitForStripeEvent(ev('customer.subscription.updated', sub({ status: 'active' }), { previous_attributes: { cancel_at_period_end: true } }));
    expect(undo?.events[0]?.name).toBe('subscription_cancel_reverted');
    // Control: a renewal moves the period dates and nothing else — no event.
    expect(gaHitForStripeEvent(ev('customer.subscription.updated', sub({ status: 'active' }), { previous_attributes: { current_period_end: 1 } }))).toBeNull();
  });

  test('a subscription ending says whether it ended inside the trial', () => {
    const inTrial = gaHitForStripeEvent(ev('customer.subscription.deleted', sub({ status: 'canceled', ended_at: 1_500 })));
    expect(inTrial?.events[0]).toEqual({ name: 'subscription_ended', params: { plan: 'monthly', during_trial: 'yes', reason: 'unknown', engagement_time_msec: 1 } });
    const later = gaHitForStripeEvent(ev('customer.subscription.deleted', sub({ status: 'canceled', ended_at: 9_000,
      items: { data: [{ price: { unit_amount: 15900, recurring: { interval: 'year' } } }] }, cancellation_details: { reason: 'cancellation_requested' } })));
    expect(later?.events[0]?.params).toEqual({ plan: 'annual', during_trial: 'no', reason: 'cancellation_requested', engagement_time_msec: 1 });
  });

  test('revenue: one purchase per paid invoice, with its value — and never for the same payment twice', () => {
    const paid = gaHitForStripeEvent(ev('invoice.paid', inv()));
    expect(paid?.events[0]?.name).toBe('purchase');
    expect(paid?.events[0]?.params).toMatchObject({ transaction_id: 'in_1', value: 19, currency: 'AUD', payment_type: 'renewal' });
    expect(gaHitForStripeEvent(ev('invoice.paid', inv({ billing_reason: 'subscription_create' }))) ?.events[0]?.params)
      .toMatchObject({ payment_type: 'first_payment' });
    // A renewal months later must NOT reuse the checkout visit's session; a first payment
    // (no trial, made during that visit) does.
    expect(paid?.events[0]?.params).not.toHaveProperty('session_id');
    expect(gaHitForStripeEvent(ev('invoice.paid', inv({ billing_reason: 'subscription_create' })))?.events[0]?.params)
      .toMatchObject({ session_id: '1794785244', engagement_time_msec: 1 });
    // The $0 invoice a trial opens with is not revenue.
    expect(gaHitForStripeEvent(ev('invoice.paid', inv({ amount_paid: 0 })))).toBeNull();
    // Stripe sends invoice.payment_succeeded for the SAME payment — counting it would double revenue.
    expect(gaHitForStripeEvent(ev('invoice.payment_succeeded', inv()))).toBeNull();
  });

  test('a failed payment and a dispute', () => {
    expect(gaHitForStripeEvent(ev('invoice.payment_failed', inv({ attempt_count: 2 })))?.events[0])
      .toEqual({ name: 'payment_failed', params: { attempt: 2, value: 19, currency: 'AUD', engagement_time_msec: 1 } });
    const d = gaHitForStripeEvent(ev('charge.dispute.created', { amount: 1900, currency: 'aud', reason: 'fraudulent', charge: 'ch_1' }));
    expect(d?.events[0]).toEqual({ name: 'dispute_opened', params: { value: 19, currency: 'AUD', reason: 'fraudulent', engagement_time_msec: 1 } });
  });

  test('test-mode events and unrelated events report nothing', () => {
    const t = { ...ev('invoice.paid', inv()), livemode: false } as Stripe.Event;
    expect(gaHitForStripeEvent(t)).toBeNull();
    for (const type of ['checkout.session.completed', 'invoice.upcoming', 'customer.subscription.trial_will_end', 'invoice.payment_action_required']) {
      expect(gaHitForStripeEvent(ev(type, inv())), type).toBeNull();
    }
  });

  test('nothing personal is ever in a hit', () => {
    const all = [
      gaHitForStripeEvent(ev('customer.subscription.created', sub())),
      gaHitForStripeEvent(ev('invoice.paid', inv())),
      gaHitForStripeEvent(ev('invoice.payment_failed', inv())),
      gaHitForStripeEvent(ev('customer.subscription.deleted', sub({ status: 'canceled' }))),
    ];
    const text = JSON.stringify(all);
    expect(text).not.toContain('reader@example.com');
    expect(text).not.toContain('A Reader');
    expect(text).not.toContain('uuid-of-user');
    expect(text).not.toContain('cus_1');
  });

  test('the reader is credited when an Analytics id was captured, and still counted when not', () => {
    expect(gaHitForStripeEvent(ev('invoice.paid', inv()))?.clientId).toBe(CID);
    const anon = gaHitForStripeEvent(ev('invoice.paid', inv({ parent: { subscription_details: { metadata: {} } } })));
    expect(anon?.clientId).toMatch(/^\d+\.\d+$/);
    expect(anon?.clientId).not.toBe(CID);
    // Stable per customer, so one customer's renewals land on one stand-in id.
    expect(gaHitForStripeEvent(ev('invoice.paid', inv({ parent: { subscription_details: { metadata: {} } } })))?.clientId).toBe(anon?.clientId);
    // A forged id that is not Google's shape is ignored rather than trusted.
    expect(gaHitForStripeEvent(ev('invoice.paid', inv({ parent: { subscription_details: { metadata: { ga_client_id: 'x<script>' } } } })))?.clientId).not.toBe('x<script>');
  });

  test("the anonymous id is read out of Google's cookie, and nothing else is", () => {
    expect(gaClientIdFromCookie(`sb-auth=abc; _ga=GA1.1.${CID}; _ga_61W3M3VW41=GS2.1.s1`)).toBe(CID);
    expect(gaClientIdFromCookie('sb-auth=abc')).toBeNull();
    expect(gaClientIdFromCookie(null)).toBeNull();
    expect(gaClientIdFromCookie('_ga=GA1.1.not.anid')).toBeNull();
    // `_ga_<container>` must not be mistaken for `_ga`.
    expect(gaClientIdFromCookie('_ga_61W3M3VW41=GS2.1.123456789.1700000000')).toBeNull();
  });

  test("the session id is read out of Google's session cookie, both formats", () => {
    expect(gaSessionIdFromCookie('_ga=GA1.1.1.2; _ga_61W3M3VW41=GS2.1.s1794785244$o1$g1$t1794785255$j49$l0$h0')).toBe('1794785244');
    expect(gaSessionIdFromCookie('_ga_61W3M3VW41=GS1.1.1794785244.1.1.1794785255.0.0.0')).toBe('1794785244');
    expect(gaSessionIdFromCookie('_ga=GA1.1.1.2')).toBeNull();
    // Another property's cookie is not ours.
    expect(gaSessionIdFromCookie('_ga_OTHERPROP=GS2.1.s1794785244$o1')).toBeNull();
    expect(gaSessionIdFromCookie(null)).toBeNull();
  });
});
