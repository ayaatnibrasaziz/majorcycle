import { expect, test } from '@playwright/test';

import { GRACE_DAYS, paymentFailedAt } from '../lib/billing/grace';
import {
  nextChargeAction,
  nextChargeFromInvoice,
  nextChargeFromSubscription,
  planFromInvoiceLines,
} from '../lib/billing/nextCharge';
import {
  accountDisputeOutcome,
  canPauseOrResume,
  disputeBillingAction,
  disputeStateFor,
} from '../lib/billing/dispute';
import { endedEmailKind, renewalReminderDue, renewalTimeZone } from '../lib/billing/accessEmails';
import { DENIAL_COPY } from '../lib/denialCopy';
import { disputeEnded, planStatus } from '../lib/planStatus';
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
    ).toEqual({ amount: 14310, currency: 'aud', at: new Date(1_800_000_000_000).toISOString(), plan: null });
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
      amount: 1900, currency: 'aud', at: new Date(1_800_000_000_000).toISOString(), plan: null,
    });
    expect(
      (await nextChargeFromSubscription(sub({}, { price: { id: 'p', currency: 'aud', unit_amount: 15900, recurring: { interval: 'year' } } }), options))?.plan,
    ).toBe('annual');
    // A scheduled switch means the item's price is NOT the next charge: say nothing.
    expect(await nextChargeFromSubscription(sub({ schedule: 'sub_sched_1' }), options)).toBeNull();
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

test.describe('which plan the next charge is for (annual → monthly waits for the year end)', () => {
  const DAY = 86_400;
  const line = (days: number) => ({ period: { start: 1_800_000_000, end: 1_800_000_000 + days * DAY } });

  test('the longest line on the invoice decides, so a proration line beside it cannot', () => {
    expect(planFromInvoiceLines({ lines: { data: [line(366)] } })).toBe('annual');
    expect(planFromInvoiceLines({ lines: { data: [line(31)] } })).toBe('monthly');
    expect(planFromInvoiceLines({ lines: { data: [line(3), line(30)] } })).toBe('monthly');
    expect(planFromInvoiceLines({ lines: { data: [line(2), line(365)] } })).toBe('annual');
  });

  test('CONTROL: an invoice that says nothing gets no guess', () => {
    expect(planFromInvoiceLines({ lines: { data: [] } })).toBeNull();
    expect(planFromInvoiceLines({})).toBeNull();
    expect(planFromInvoiceLines({ lines: { data: [line(5)] } })).toBeNull();
  });

  test('the stored next charge carries the invoice’s plan', () => {
    const inv = { amount_due: 1900, currency: 'aud', next_payment_attempt: 1_800_000_000, period_end: 1, lines: { data: [line(30)] } };
    expect(nextChargeFromInvoice(inv)?.plan).toBe('monthly');
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
    expect(paymentBanner(SIGNED_OUT_VIEWER)).toBeNull();
  });

  test('a disputed account gets the HOLD banner, never the card one — even mid card-failure', () => {
    expect(
      paymentBanner(viewer({ entitled: false, reason: 'billing_blocked', billingBlocked: true, subscriptionStatus: 'past_due' })),
    ).toEqual({ kind: 'held', ended: false });
    expect(
      paymentBanner(viewer({ entitled: false, reason: 'billing_blocked', billingBlocked: true, subscriptionStatus: 'active' })),
    ).toEqual({ kind: 'held', ended: false });
    // Lost: the plan was cancelled, so the banner must not promise it comes back.
    expect(
      paymentBanner(viewer({ entitled: false, reason: 'billing_blocked', billingBlocked: true, subscriptionStatus: 'canceled' })),
    ).toEqual({ kind: 'held', ended: true });
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

test.describe('a dispute decides billing as well as access', () => {
  test('open → pause, won → resume, lost → cancel', () => {
    expect(disputeBillingAction('charge.dispute.created', 'needs_response')).toBe('pause');
    expect(disputeBillingAction('charge.dispute.funds_withdrawn', 'needs_response')).toBe('pause');
    expect(disputeBillingAction('charge.dispute.funds_reinstated', 'won')).toBe('resume');
    expect(disputeBillingAction('charge.dispute.closed', 'won')).toBe('resume');
    expect(disputeBillingAction('charge.dispute.closed', 'lost')).toBe('cancel');
  });

  test('a bank INQUIRY moves no money, so it touches nothing — even when it closes', () => {
    expect(disputeBillingAction('charge.dispute.created', 'warning_needs_response')).toBeNull();
    // ⚠️ Until 2026-10-03 a closed inquiry fell into the "lost" branch and CANCELLED
    // a paying customer's subscription.
    expect(disputeBillingAction('charge.dispute.closed', 'warning_closed')).toBeNull();
    expect(disputeBillingAction('invoice.paid', 'won')).toBeNull();
  });

  test('only a plan that can still bill is paused or resumed', () => {
    for (const s of ['active', 'trialing', 'past_due']) expect(canPauseOrResume(s), s).toBe(true);
    for (const s of ['canceled', null]) expect(canPauseOrResume(s), String(s)).toBe(false);
  });
});

test.describe('one name for each plan state — the sidebar and the Account page', () => {
  const label = (o: Partial<Parameters<typeof planStatus>[0]>) =>
    planStatus({ status: null, billingBlocked: false, entitled: false, cancelAtPeriodEnd: false, ...o }).label;

  test('every state', () => {
    expect(label({})).toBe('No plan');
    expect(label({ status: 'trialing', entitled: true })).toBe('Trial active');
    expect(label({ status: 'active', entitled: true })).toBe('Active');
    expect(label({ status: 'active', entitled: true, cancelAtPeriodEnd: true })).toBe('Cancelling');
    expect(label({ status: 'trialing', entitled: true, cancelAtPeriodEnd: true })).toBe('Cancelling');
    expect(label({ status: 'past_due', entitled: true })).toBe('Payment due');
    expect(label({ status: 'past_due', entitled: false })).toBe('Access paused');
    expect(label({ status: 'canceled' })).toBe('Cancelled');
    // A dispute outranks everything — until it has ended the plan.
    expect(label({ status: 'active', billingBlocked: true })).toBe('On hold');
    expect(label({ status: 'active', billingBlocked: true, cancelAtPeriodEnd: true })).toBe('On hold');
    expect(label({ status: 'past_due', billingBlocked: true })).toBe('On hold');
    expect(label({ status: 'canceled', billingBlocked: true })).toBe('Cancelled');
  });

  test('a dispute has ENDED the plan only once the plan is cancelled', () => {
    expect(disputeEnded(true, 'canceled')).toBe(true);
    expect(disputeEnded(true, 'active')).toBe(false);
    expect(disputeEnded(false, 'canceled')).toBe(false);
  });
});

test.describe('who is told their annual plan is about to renew', () => {
  const SUB = 'sub_annual';
  const base = {
    stripe_subscription_id: SUB,
    subscription_status: 'active',
    subscription_plan: 'annual',
    cancel_at_period_end: false,
    deletion_scheduled_at: null,
    billing_blocked: false,
  };

  test('an annual plan that will really renew is told', () => {
    expect(renewalReminderDue(base, SUB)).toBe(true);
  });

  const silent: Array<[string, Partial<typeof base> | null, string | null]> = [
    ['a monthly plan', { subscription_plan: 'monthly' }, SUB],
    ['a plan set not to renew', { cancel_at_period_end: true }, SUB],
    ['an account being deleted', { deletion_scheduled_at: '2026-11-01T00:00:00Z' } as never, SUB],
    ['an open dispute', { billing_blocked: true }, SUB],
    ['a trial', { subscription_status: 'trialing' }, SUB],
    ['a failed payment', { subscription_status: 'past_due' }, SUB],
    ['a different subscription than the one on file', {}, 'sub_other'],
    ['an event with no subscription', {}, null],
  ];
  for (const [name, patch, sub] of silent) {
    test(`not told: ${name}`, () => {
      expect(renewalReminderDue({ ...base, ...patch }, sub)).toBe(false);
    });
  }
  test('not told: no profile', () => {
    expect(renewalReminderDue(null, SUB)).toBe(false);
  });

  test('the renewal date is written in the plan currency’s zone, never UTC', () => {
    expect(renewalTimeZone('aud')).toBe('Australia/Sydney');
    expect(renewalTimeZone('CAD')).toBe('America/Toronto');
    expect(renewalTimeZone('usd')).toBe('America/New_York');
    expect(renewalTimeZone(null)).toBe('America/New_York');
  });
});

test.describe('who is told their subscription has ended', () => {
  const was = (o: Partial<{ subscription_status: string | null; billing_blocked: boolean; deletion_scheduled_at: string | null }>) => ({
    subscription_status: 'active',
    billing_blocked: false,
    deletion_scheduled_at: null,
    ...o,
  });
  test('each ending gets its own wording, and three are told nothing', () => {
    expect(endedEmailKind(was({ subscription_status: 'trialing' }), null)).toBe('trial_ended');
    expect(endedEmailKind(was({ subscription_status: 'past_due' }), null)).toBe('ended_payment');
    expect(endedEmailKind(was({}), 'payment_failed')).toBe('ended_payment');
    expect(endedEmailKind(was({}), 'cancellation_requested')).toBe('ended');
    expect(endedEmailKind(was({ billing_blocked: true }), null)).toBeNull();
    expect(endedEmailKind(was({ deletion_scheduled_at: '2026-11-01T00:00:00Z' }), null)).toBeNull();
    expect(endedEmailKind(was({ subscription_status: 'canceled' }), null)).toBeNull();
    expect(endedEmailKind(null, null)).toBeNull();
  });
});

test.describe('a dispute holds the ACCOUNT until every dispute on it is settled', () => {
  test('each action leaves its dispute in a state', () => {
    expect(disputeStateFor('pause')).toBe('open');
    expect(disputeStateFor('resume')).toBe('won');
    expect(disputeStateFor('cancel')).toBe('lost');
  });

  test('a win lifts the hold only when nothing else is open or lost', () => {
    expect(accountDisputeOutcome('resume', { open: 0, lost: 0 })).toEqual({ hold: false, stripe: 'resume' });
    // The stolen card: the owner disputed two charges and we won the first.
    expect(accountDisputeOutcome('resume', { open: 1, lost: 0 })).toEqual({ hold: null, stripe: null });
    // An earlier dispute was lost: the paid access ended for good.
    expect(accountDisputeOutcome('resume', { open: 0, lost: 1 })).toEqual({ hold: null, stripe: null });
    // Could not read the others: keep the hold rather than bill a disputing card.
    expect(accountDisputeOutcome('resume', null)).toEqual({ hold: null, stripe: null });
  });

  test('a new dispute always holds, a loss always cancels, an inquiry does nothing', () => {
    expect(accountDisputeOutcome('pause', { open: 0, lost: 0 })).toEqual({ hold: true, stripe: 'pause' });
    expect(accountDisputeOutcome('cancel', { open: 2, lost: 0 })).toEqual({ hold: null, stripe: 'cancel' });
    expect(accountDisputeOutcome(null, null)).toEqual({ hold: null, stripe: null });
  });
});
