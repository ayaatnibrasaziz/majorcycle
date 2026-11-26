import type { BillingCurrency } from '@/lib/stripe';
import { CURRENCY_SYMBOL } from '@/lib/pricing';

/**
 * The big sticker price on /pricing and in the trial window — ONE component for both,
 * so the two can never draw it differently (11c).
 *
 * The symbol is set smaller, lighter and a few pixels apart from the number (owner,
 * 2026-11-27: "very less gap between the number and the symbol"). At 38px bold with
 * negative tracking, a full-size symbol butted against the first digit — worst for
 * ₱, whose glyph JetBrains Mono lacks, so it came from a heavier fallback face. A
 * smaller symbol is the usual pricing-page treatment and reads the same in every
 * currency. Screen readers still hear one figure ("₱899").
 */
export function PriceFigure({ amount, currency }: { amount: number; currency: BillingCurrency }) {
  const n = amount % 1 === 0 ? String(amount) : amount.toFixed(2);
  return (
    <span className="font-mono text-[38px] font-bold leading-none tracking-[-1px] text-[var(--text-primary)]">
      <span className="mr-[0.12em] align-[0.42em] text-[0.55em] font-semibold tracking-normal text-[var(--text-secondary)]">
        {CURRENCY_SYMBOL[currency]}
      </span>
      {n}
    </span>
  );
}
