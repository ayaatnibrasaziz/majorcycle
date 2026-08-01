import type { BillingCurrency } from '@/lib/stripe';

/**
 * DISPLAY-ONLY pricing for the /pricing shop window and the /account card.
 *
 * These numbers mirror the locked pricing decision (CLAUDE.md decision #18) and
 * the multi-currency Stripe Prices (`majorcycle_monthly` / `majorcycle_annual`).
 * They are what we *show*; the amount actually charged always comes from Stripe
 * (source of truth). If Stripe's prices ever change, update these to match — the
 * charge is unaffected either way, only the sticker.
 *
 * This module is intentionally pure (no `stripe` SDK import — only a type import,
 * which is erased at build) so it is safe to bundle into client components.
 */

export interface PlanPrices {
  /** Monthly-plan price, per month, in the currency's major unit (e.g. 15 = US$15). */
  monthly: number;
  /** Annual-plan price, per year, in the currency's major unit (e.g. 126 = US$126). */
  annual: number;
}

/** Per-currency sticker prices. Keys match `BillingCurrency` from stripe.ts. */
export const PRICE_TABLE: Record<BillingCurrency, PlanPrices> = {
  usd: { monthly: 15, annual: 126 },
  aud: { monthly: 19, annual: 159 },
  cad: { monthly: 20, annual: 168 },
};

/** Symbol shown in front of the amount (kept distinct so US$/A$/C$ never blur together). */
export const CURRENCY_SYMBOL: Record<BillingCurrency, string> = {
  usd: 'US$',
  aud: 'A$',
  cad: 'C$',
};

/** Uppercase ISO code shown as a small suffix (e.g. "USD"). */
export const CURRENCY_CODE_LABEL: Record<BillingCurrency, string> = {
  usd: 'USD',
  aud: 'AUD',
  cad: 'CAD',
};

/**
 * Annual plan expressed as a per-month figure (annual ÷ 12), for the "works out to
 * $X/mo" line. Rounded to whole cents. Not a charge — the annual plan bills once.
 */
export function annualPerMonth(currency: BillingCurrency): number {
  return Math.round((PRICE_TABLE[currency].annual / 12) * 100) / 100;
}

/**
 * Whole-percent saving of the annual plan vs paying monthly for a year
 * (≈30% by design). Used for the "Save N%" badge on the annual option.
 */
export function annualSavingPercent(currency: BillingCurrency): number {
  const { monthly, annual } = PRICE_TABLE[currency];
  const monthlyYearly = monthly * 12;
  return Math.round(((monthlyYearly - annual) / monthlyYearly) * 100);
}
