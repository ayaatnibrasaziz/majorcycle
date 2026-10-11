/**
 * Which "your access has changed" email a customer gets, and when (owner, 2026-10-03;
 * beta review D-5 / D-6). Pure, so `e2e/billing-rules.spec.ts` drives every branch.
 *
 * Until then nothing told a customer when access STOPPED: not when a failed card's
 * grace window closed, and not when a subscription ended. The emails themselves are in
 * lib/email/billingEmails.ts; this file decides which, if any, applies.
 */

export type EndedEmailKind = 'trial_ended' | 'ended_payment' | 'ended';

/**
 * The email for a subscription Stripe has just ended, judged from the profile AS IT
 * WAS before the webhook marked it cancelled.
 *
 * Nobody is told twice, and three cases are told nothing by this email:
 * - a disputed account — the hold banner and support already speak to it, and an
 *   email about money while a bank dispute is open is the wrong voice;
 * - an account being deleted — the purge cancels the subscription itself, and the
 *   deletion emails already say what happens;
 * - a profile already marked cancelled — a redelivered event.
 */
export function endedEmailKind(
  prev: {
    subscription_status: string | null;
    billing_blocked: boolean | null;
    deletion_scheduled_at: string | null;
  } | null,
  cancellationReason: string | null | undefined,
): EndedEmailKind | null {
  if (!prev) return null;
  if (prev.billing_blocked) return null;
  if (prev.deletion_scheduled_at) return null;
  if (prev.subscription_status === 'canceled' || prev.subscription_status === null) return null;
  if (prev.subscription_status === 'trialing') return 'trial_ended';
  if (cancellationReason === 'payment_failed' || prev.subscription_status === 'past_due') return 'ended_payment';
  return 'ended';
}

/**
 * Whether the "payment went through" email may say access carried on uninterrupted:
 * only if the grace window had NOT closed when the payment arrived. It said so to
 * everyone until 2026-10-03, including customers who had been locked out (D-6).
 */
export function accessWasPaused(graceUntil: string | null, at: Date = new Date()): boolean {
  if (!graceUntil) return false;
  const end = Date.parse(graceUntil);
  return !Number.isNaN(end) && end <= at.getTime();
}

/**
 * Days before an annual renewal that the reminder goes out. It is not ours to schedule:
 * Stripe fires `invoice.upcoming` this many days ahead, set in Dashboard → Billing →
 * Subscriptions and emails → "Upcoming renewal events" (set to 30 on 2026-10-07). The
 * constant exists so the email and the docs can say the same number as that setting.
 */
export const RENEWAL_REMINDER_DAYS = 30;

/**
 * Whether a customer gets the "your annual plan renews soon" email (owner, 2026-10-07:
 * a yearly charge nobody was warned about is the likeliest dispute an annual plan can
 * cause). Annual plans only — a reminder before every monthly charge is noise, and the
 * trial has its own reminder. Told nothing when:
 * - the event is for a subscription other than the one on file (stale / superseded);
 * - the plan is set not to renew (cancelled in the portal, or deletion requested), so
 *   there is no renewal to warn about;
 * - the account is being deleted, or a dispute is open (billing is paused);
 * - it is still in its trial, or its payment has failed (those have their own emails).
 */
export function renewalReminderDue(
  prof: {
    stripe_subscription_id: string | null;
    subscription_status: string | null;
    subscription_plan: string | null;
    cancel_at_period_end: boolean | null;
    deletion_scheduled_at: string | null;
    billing_blocked: boolean | null;
  } | null,
  subscriptionId: string | null,
): boolean {
  if (!prof || !subscriptionId) return false;
  if (prof.stripe_subscription_id !== subscriptionId) return false;
  if (prof.subscription_status !== 'active') return false;
  if (prof.subscription_plan !== 'annual') return false;
  if (prof.cancel_at_period_end) return false;
  if (prof.deletion_scheduled_at) return false;
  if (prof.billing_blocked) return false;
  return true;
}

/**
 * The zone a renewal date is written in. A system email has no browser to ask, and a
 * date written in UTC lands a day early for most Australian readers, so the plan's
 * currency stands in for where the customer is (it is chosen from their country at
 * checkout). Off by a day at worst for someone billed in a currency not their own.
 */
export function renewalTimeZone(currency: string | null | undefined): string {
  switch ((currency ?? '').toLowerCase()) {
    case 'aud':
      return 'Australia/Sydney';
    case 'cad':
      return 'America/Toronto';
    default:
      return 'America/New_York';
  }
}
