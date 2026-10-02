import type Stripe from 'stripe';

// The pure half of the next-charge rules, kept apart from lib/billing/sync.ts (which is
// `server-only`) so a plain Node test can drive them. sync.ts re-exports all of this.

/** A Stripe unix timestamp as ISO 8601, or null. */
export function toISO(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

/**
 * The next charge, as Stripe itself will make it (owner, 2026-10-03: "store the real
 * charged amount… so that it works in every case").
 *
 * ⚠️ Stripe's OWN figure, from a preview of the subscription's next invoice — never our
 * price table. The table is right only while nobody has a discount, tax or an old
 * price; the preview already includes all three. Minor units (cents), like Stripe.
 */
export interface NextCharge {
  amount: number;
  currency: string;
  at: string | null;
}

/**
 * What a sync should do with the stored next charge:
 * - `preview` — a live plan that will renew: ask Stripe and store its figure;
 * - `clear` — nothing will be charged (cancelling, cancelled, incomplete…): store NULL;
 * - `keep` — `past_due`: the payment-failed handler has stored the FAILED invoice's
 *   amount, which is what the account card shows; a preview here would replace it with
 *   the NEXT period's invoice.
 */
export function nextChargeAction(
  status: string | null,
  cancelling: boolean,
): 'preview' | 'clear' | 'keep' {
  if (status === 'past_due') return 'keep';
  if ((status === 'active' || status === 'trialing') && !cancelling) return 'preview';
  return 'clear';
}

/** The stored figure from a Stripe invoice (a preview, or the invoice that failed). */
export function nextChargeFromInvoice(
  inv: Pick<Stripe.Invoice, 'amount_due' | 'currency' | 'next_payment_attempt' | 'period_end'>,
): NextCharge | null {
  if (typeof inv.amount_due !== 'number' || !inv.currency) return null;
  return {
    amount: inv.amount_due,
    currency: inv.currency,
    at: toISO(inv.next_payment_attempt ?? inv.period_end ?? null),
  };
}
