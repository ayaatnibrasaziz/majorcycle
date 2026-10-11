/**
 * The ONE name for a reader's plan state — the sidebar badge and the Account page pill
 * both read it (owner, 2026-10-03: "the account and sidebar label should match every
 * state").
 *
 * ⚠️ They were two private tables until then, and parted company in two states: a plan
 * set to cancel read "Active" in the sidebar and "Cancelling" on the Account page, and a
 * trial read "Trial Active" against "Trial active". Neither was wrong in its own file;
 * together they told one reader two things (CLAUDE.md 11c — one rule, one place).
 *
 * Pure, so `e2e/billing-rules.spec.ts` drives every state without a browser.
 */
export interface PlanStatusInput {
  status: string | null;
  billingBlocked: boolean;
  /** Has access right now — splits `past_due` into its two halves (decision #20). */
  entitled: boolean;
  /** Set to stop at the end of the period (a cancel, or an account queued for deletion). */
  cancelAtPeriodEnd: boolean;
}

export type PlanStatusTone = 'ok' | 'warn' | 'muted';

export function planStatus({ status, billingBlocked, entitled, cancelAtPeriodEnd }: PlanStatusInput): {
  label: string;
  tone: PlanStatusTone;
} {
  // A dispute outranks every Stripe status. Once the subscription has ended under one
  // (a lost dispute cancels it), the plan is simply cancelled — "on hold" would promise
  // a return that is not coming.
  if (billingBlocked) {
    return status === 'canceled' ? { label: 'Cancelled', tone: 'muted' } : { label: 'On hold', tone: 'warn' };
  }
  if (status === 'past_due') {
    return entitled ? { label: 'Payment due', tone: 'warn' } : { label: 'Access paused', tone: 'warn' };
  }
  if ((status === 'active' || status === 'trialing') && cancelAtPeriodEnd) {
    // Still a live plan until its end date — the approved card's colour for it.
    return { label: 'Cancelling', tone: 'ok' };
  }
  if (status === 'active') return { label: 'Active', tone: 'ok' };
  if (status === 'trialing') return { label: 'Trial active', tone: 'ok' };
  if (status === 'canceled') return { label: 'Cancelled', tone: 'muted' };
  return { label: 'No plan', tone: 'muted' };
}

/**
 * Has a dispute ENDED this subscription? A lost dispute cancels it and leaves the hold
 * in place, so `billing_blocked` + `canceled` is the state where "comes back as soon as
 * the dispute is settled" is no longer true.
 */
export function disputeEnded(billingBlocked: boolean, status: string | null): boolean {
  return billingBlocked && status === 'canceled';
}
