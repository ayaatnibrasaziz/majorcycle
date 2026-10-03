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
