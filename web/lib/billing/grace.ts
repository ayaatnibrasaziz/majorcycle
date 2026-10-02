/**
 * How long a customer keeps access after a renewal payment fails (decision #20).
 *
 * ⚠️ ONE number, read in three places: the Stripe webhook sets `grace_until` from it,
 * the account card works out the day the payment failed from it, and the Terms state
 * it in words — `e2e/legal-doc.spec.ts` reads it out of THIS file and checks the
 * published sentence against it (CLAUDE.md 11c-v). It lived privately inside the
 * webhook route until 2026-10-03, when the account card needed it too; a second copy
 * there would have been the drift that rule exists to prevent.
 *
 * Kept free of `server-only` and of any import, so a client component and a plain
 * Node test can both read it.
 */
export const GRACE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the grace window started — the first failed payment — from its end. */
export function paymentFailedAt(graceUntil: string | null): string | null {
  if (!graceUntil) return null;
  const end = new Date(graceUntil).getTime();
  return Number.isNaN(end) ? null : new Date(end - GRACE_DAYS * DAY_MS).toISOString();
}
