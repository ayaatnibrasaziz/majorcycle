/**
 * What a dispute does to BILLING, as opposed to access (owner, 2026-10-03).
 *
 * Access was always handled: a real dispute sets `billing_blocked`, a win clears it, a
 * loss cancels the subscription. Billing was not: the subscription kept renewing while
 * the dispute was open — up to 75 days — so a customer locked out of the product could
 * be charged two or three more times for it, which is how one dispute becomes several.
 * Now an open dispute PAUSES collection (Stripe voids each invoice instead of charging
 * it) and a win resumes it; a loss still cancels.
 *
 * Pure, so a credential-free spec can drive every branch (e2e/billing-rules.spec.ts);
 * the webhook does the Stripe calls.
 */
export type DisputeBillingAction = 'pause' | 'resume' | 'cancel' | null;

export function disputeBillingAction(eventType: string, disputeStatus: string): DisputeBillingAction {
  switch (eventType) {
    case 'charge.dispute.created':
      // An inquiry (warning_*) has moved no money and locks nothing, so it bills as usual.
      return disputeStatus.startsWith('warning') ? null : 'pause';
    case 'charge.dispute.funds_withdrawn':
      return 'pause';
    case 'charge.dispute.funds_reinstated':
      return 'resume';
    case 'charge.dispute.closed':
      if (disputeStatus === 'won') return 'resume';
      // An inquiry that closed without escalating changed nothing.
      if (disputeStatus.startsWith('warning')) return null;
      return 'cancel';
    default:
      return null;
  }
}

/** Only a subscription that can still bill has anything to pause or resume. */
export function canPauseOrResume(subscriptionStatus: string | null): boolean {
  return subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionStatus === 'past_due';
}
