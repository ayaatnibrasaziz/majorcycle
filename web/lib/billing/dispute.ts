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

/** A dispute's state as `billing_disputes` records it. */
export type DisputeState = 'open' | 'won' | 'lost';

/** The state a per-dispute action leaves that dispute in. */
export function disputeStateFor(action: Exclude<DisputeBillingAction, null>): DisputeState {
  return action === 'pause' ? 'open' : action === 'resume' ? 'won' : 'lost';
}

/**
 * What one dispute event does to the ACCOUNT, given the OTHER real disputes on it
 * (`billing_disputes`, 2026-10-07). The per-dispute action above is right for that
 * dispute alone; the hold is per account, so a win must not lift it while another
 * dispute is still open — the stolen-card case, where the card's owner disputes every
 * charge from us at once — nor after another one was LOST, which ends the account's
 * paid access for good. `others` is null when it could not be read, and that keeps the
 * hold: wrongly holding a customer for a day costs a support email, wrongly billing a
 * disputing card costs another dispute.
 *
 * - `hold`: what `billing_blocked` should become (null = leave it).
 * - `stripe`: what to do to the subscription (null = nothing).
 */
export function accountDisputeOutcome(
  action: DisputeBillingAction,
  others: { open: number; lost: number } | null,
): { hold: boolean | null; stripe: Exclude<DisputeBillingAction, null> | null } {
  switch (action) {
    case 'pause':
      return { hold: true, stripe: 'pause' };
    case 'cancel':
      return { hold: null, stripe: 'cancel' };
    case 'resume':
      return others && others.open === 0 && others.lost === 0
        ? { hold: false, stripe: 'resume' }
        : { hold: null, stripe: null };
    default:
      return { hold: null, stripe: null };
  }
}
