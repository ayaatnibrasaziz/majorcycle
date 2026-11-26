import type { BillingCurrency } from '@/lib/stripe';
import { CURRENCY_SYMBOL } from '@/lib/pricing';

/**
 * The big sticker price on /pricing and in the trial window — ONE component for both,
 * so the two can never draw it differently (11c).
 *
 * A$, US$ and C$ render exactly as they always have (owner, 2026-11-27: keep them).
 * ₱ is the one exception: JetBrains Mono has no ₱, so the browser draws it from a
 * fallback face that comes out taller and heavier than the digits beside it. Its span
 * is scaled so the symbol stands the same height as the numerals ("the font size just
 * needs to match the price font"), with a hairline of space before the first digit.
 * Screen readers still hear one figure ("₱899").
 */
const FALLBACK_GLYPH: Partial<Record<BillingCurrency, string>> = {
  php: 'mr-[0.1em] text-[0.74em]',
};

export function PriceFigure({ amount, currency }: { amount: number; currency: BillingCurrency }) {
  const n = amount % 1 === 0 ? String(amount) : amount.toFixed(2);
  const symbol = CURRENCY_SYMBOL[currency];
  const adjust = FALLBACK_GLYPH[currency];
  return (
    <span className="font-mono text-[38px] font-bold leading-none tracking-[-1px] text-[var(--text-primary)]">
      {adjust ? <span className={adjust}>{symbol}</span> : symbol}
      {n}
    </span>
  );
}
