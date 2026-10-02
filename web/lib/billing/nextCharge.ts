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

/**
 * The next charge read off the SUBSCRIPTION itself, for when Stripe will not preview
 * the invoice (a restricted API key without Invoices access — found 2026-10-03: the
 * test key has none). It is still Stripe's own figure: the price attached to THIS
 * reader's subscription, in their currency, so an old or grandfathered price is right.
 *
 * ⚠️ It cannot see a discount or tax, so it says NOTHING when either applies — the
 * card then shows the date alone. A missing amount is honest; a wrong one is not
 * (CLAUDE.md 11aa). Only a single-item plan is read; anything else is left blank too.
 *
 * `unitAmountIn` resolves a multi-currency price's amount in the subscription's
 * currency (the payload carries only the price's default currency).
 */
export async function nextChargeFromSubscription(
  sub: Pick<Stripe.Subscription, 'currency' | 'status' | 'trial_end' | 'discounts' | 'automatic_tax' | 'items'>,
  unitAmountIn: (priceId: string, currency: string) => Promise<number | null>,
): Promise<NextCharge | null> {
  if ((sub.discounts?.length ?? 0) > 0) return null;
  if (sub.automatic_tax?.enabled) return null;
  if (sub.items.data.length !== 1) return null;
  const item = sub.items.data[0]!;
  if ((item.discounts?.length ?? 0) > 0) return null;
  const cur = sub.currency;
  const unit =
    item.price.currency === cur && typeof item.price.unit_amount === 'number'
      ? item.price.unit_amount
      : await unitAmountIn(item.price.id, cur);
  if (unit == null) return null;
  const at = sub.status === 'trialing' && sub.trial_end ? sub.trial_end : item.current_period_end;
  return { amount: unit * (item.quantity ?? 1), currency: cur, at: toISO(at) };
}
