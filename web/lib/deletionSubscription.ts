/**
 * What happens to a subscription when its account is scheduled for deletion — the ONE
 * rule the delete card, the "deletion scheduled" email and the /reactivate page read
 * (owner, 2026-10-03: "check … if it [is] saying wrong information at any given time").
 *
 * The mechanism: deleting does NOT cancel the subscription. It sets it not to renew
 * (`cancel_at_period_end`), so a trial ends with no charge and a paid period simply runs
 * out; signing back in within the 30 days clears that again. The purge on day 30 cancels
 * whatever is still running. The one exception is a FAILED payment (`past_due`): that
 * subscription is cancelled at once, because otherwise the provider keeps retrying the
 * unpaid invoice and could charge someone who has just deleted their account and cannot
 * use it — the textbook "I deleted my account and you still charged me" dispute
 * (owner, 2026-10-07: "ensure … doesn't trigger any disputes").
 *
 * Until this file, all three surfaces said one sentence to every paying customer —
 * "stays valid until the end of the period you've already paid for — deleting doesn't cut
 * it short". Three cases made that untrue:
 *   - an ANNUAL plan (or a monthly one renewed a day ago in a 31-day month): the period
 *     runs past the deletion date, so the purge DOES cut it short, with no refund (#21);
 *   - a FAILED payment (`past_due`): nothing has been paid for the current period, and
 *     the provider would keep retrying that one invoice (deletion now cancels it);
 *   - a DISPUTE (`billing_blocked`): access is on hold, so nothing is "valid".
 * Pure, so `e2e/deletion-subscription.spec.ts` drives every branch.
 */

export type DeletionSubscriptionKind =
  | 'none'
  | 'trial'
  | 'runs_out'
  | 'cut_short'
  | 'payment_failed'
  | 'held';

/** Subscription states with a live Stripe subscription that deletion acts on. */
export const DELETION_LIVE_STATES = new Set(['active', 'trialing', 'past_due']);

export function deletionSubscriptionKind(
  profile: {
    subscription_status: string | null;
    billing_blocked?: boolean | null;
    current_period_end?: string | null;
  },
  deletionDate: Date,
): DeletionSubscriptionKind {
  const status = profile.subscription_status;
  if (!status || !DELETION_LIVE_STATES.has(status)) return 'none';
  // A failed payment first, even under a dispute: deletion cancels that subscription at
  // once (see the header), so "on hold" would describe a plan that no longer exists.
  if (status === 'past_due') return 'payment_failed';
  if (profile.billing_blocked) return 'held';
  if (status === 'trialing') return 'trial';
  const end = profile.current_period_end ? Date.parse(profile.current_period_end) : NaN;
  // Unknown period end: say the cautious thing — it may be cut short — rather than
  // promise a period we cannot see.
  if (Number.isNaN(end)) return 'cut_short';
  return end <= deletionDate.getTime() ? 'runs_out' : 'cut_short';
}

/**
 * The one sentence about the subscription. `deletionDate` and `periodEnd` are display
 * strings (the email has them; the delete card does not, and passes null — a card
 * rendered on the server cannot know the reader's time zone).
 */
export function deletionSubscriptionLine(
  kind: DeletionSubscriptionKind,
  dates: { deletionDate: string | null; periodEnd: string | null },
): string | null {
  const by = dates.deletionDate ? ` before ${dates.deletionDate}` : ' before the deletion date';
  switch (kind) {
    case 'none':
      return null;
    case 'trial':
      return (
        `Your free trial stays active until its normal end date, with no charge. Sign back in${by} ` +
        `to keep it; if the trial ends first, you'll come back to a free account.`
      );
    case 'runs_out':
      return (
        `Your subscription stays active until the end of the period you've paid for` +
        (dates.periodEnd ? ` (${dates.periodEnd})` : '') +
        `, then it won't renew. Sign back in${by} to keep your account and your subscription.`
      );
    case 'cut_short':
      return (
        `Your subscription won't renew. Your paid period runs past the deletion date, so it ends ` +
        `when the account is deleted, and the unused time isn't refunded. Sign back in${by} to ` +
        `keep your account and your subscription.`
      );
    case 'payment_failed':
      return (
        `Your last payment hasn't gone through, so your subscription ends now and we won't try ` +
        `that payment again. Sign back in${by} to keep your account; it will be on the free plan.`
      );
    case 'held':
      return (
        `Your subscription is on hold while a payment dispute is open, and it won't renew. Sign ` +
        `back in${by} to keep your account.`
      );
  }
}

/**
 * Stripe metadata key marking a "don't renew" that DELETION set. Reactivating clears the
 * cancel only when this is present: a customer who had already cancelled in the billing
 * portal before deleting must not find their subscription renewing again because they
 * signed back in (which it did until 2026-10-03, documented as an "accepted tradeoff").
 */
export const DELETION_CANCEL_METADATA_KEY = 'mc_cancelled_by_deletion';

/**
 * What /reactivate may promise. It used to say every account got back "your profile, your
 * history, and your subscription — exactly as you left it", which is false whenever the
 * trial or the paid period ended inside the 30 days: Stripe has ended that subscription,
 * and the reader comes back on the free plan.
 */
export function reactivateLines(
  status: string | null,
  billingBlocked = false,
): { restores: string; note: string | null } {
  // A payment dispute decides what comes back, so it is asked first (owner, 2026-10-07:
  // "be aware of the dispute cases"). While one is open the subscription returns ON HOLD;
  // after a lost one it has ended AND a new one cannot be started without support — so
  // the "subscribe again at any time" sentence below would be untrue (checkout refuses
  // any account with billing_blocked).
  if (billingBlocked && status && DELETION_LIVE_STATES.has(status)) {
    return {
      restores: 'your profile, your history and your subscription',
      note:
        'Your subscription stays on hold while the payment dispute is open, so the paid ' +
        'analysis stays locked until it is resolved.',
    };
  }
  if (billingBlocked && status === 'canceled') {
    return {
      restores: 'your profile and your history',
      note:
        'Your subscription ended after a payment dispute, so you will come back on the free ' +
        'plan. To subscribe again, please contact support.',
    };
  }
  if (status && DELETION_LIVE_STATES.has(status)) {
    return {
      restores: 'your profile, your history and your subscription, as they were before you asked to delete it',
      note: null,
    };
  }
  if (status === 'canceled') {
    return {
      restores: 'your profile and your history',
      note:
        'Your subscription ended while the account was waiting to be deleted, so you will come back ' +
        'on the free plan. You can subscribe again from your account at any time.',
    };
  }
  return { restores: 'your profile and your history', note: null };
}

/** The kind for a deletion requested NOW — what the delete card shows before confirming. */
export function deletionSubscriptionKindToday(
  profile: Parameters<typeof deletionSubscriptionKind>[0],
  graceDays: number,
): DeletionSubscriptionKind {
  return deletionSubscriptionKind(profile, new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000));
}
