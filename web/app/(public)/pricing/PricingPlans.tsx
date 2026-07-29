'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { BillingCurrency } from '@/lib/stripe';
import {
  PRICE_TABLE,
  CURRENCY_SYMBOL,
  CURRENCY_CODE_LABEL,
  annualPerMonth,
  annualSavingPercent,
  type PlanPrices,
} from '@/lib/pricing';

type PlanKey = keyof PlanPrices; // 'monthly' | 'annual'

const FEATURES = [
  'Every ticker, chart, and Major Cycle analysis',
  'Financial health, valuation, and overall rating',
  'US, Australian, and Canadian equities',
  'Cancel anytime — no charge until day 7',
];

/** Money with the currency's symbol; whole numbers stay whole, otherwise 2dp. */
function money(amount: number, currency: BillingCurrency): string {
  const n = amount % 1 === 0 ? String(amount) : amount.toFixed(2);
  return `${CURRENCY_SYMBOL[currency]}${n}`;
}

/**
 * The public pricing shop window — for STRANGERS, and nobody else (owner decision,
 * 2026-07-29).
 *
 * This page used to branch six ways: a denial banner driven by `?reason=`, a dispute-hold
 * heading, an in-place support dialog, "you already have a plan", "you already used your
 * trial", and a resumed-signup greeting. All six existed to serve signed-in readers who
 * had been thrown out here by the paywall. They no longer are — premium pages now show an
 * in-app locked panel, and `app/(public)/pricing/page.tsx` sends any signed-in visitor to
 * /account, where their real billing state lives alongside the actions that can change it.
 *
 * So the only reader who reaches this component is signed out, which means there is
 * exactly one honest thing to say: here are the two prices, here is what you get, sign up.
 * Every conditional removed here was a conditional that could be wrong.
 *
 * Amounts are display-only; Stripe charges the real (matching) price. The chosen plan
 * rides through signup so the flow resumes at /account instead of restarting.
 */
export function PricingPlans({ currency }: { currency: BillingCurrency }) {
  const [plan, setPlan] = useState<PlanKey>('monthly');

  const prices = PRICE_TABLE[currency];
  const isAnnual = plan === 'annual';
  const saving = annualSavingPercent(currency);

  return (
    <article className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] shadow-[0_24px_60px_-12px_rgba(15,25,35,0.12),0_8px_24px_-8px_rgba(15,25,35,0.08)] overflow-hidden">
      <div className="px-7 py-8 sm:px-9 sm:py-10">
        <h1 className="text-[22px] sm:text-[24px] font-bold text-[var(--text-primary)] tracking-[-0.4px] leading-[1.2]">
          Start your 7-day free trial
        </h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          Full access to MajorCycle for 7 days. Your card is required upfront and
          isn&apos;t charged until the trial ends — cancel any time before then and you
          pay nothing.
        </p>

        {/* Monthly / annual toggle — segmented control */}
        <div
          role="group"
          aria-label="Billing period"
          className="mt-6 grid grid-cols-2 gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-hover)] p-1"
        >
          <button
            type="button"
            aria-pressed={!isAnnual}
            onClick={() => setPlan('monthly')}
            className={`h-9 rounded-[calc(var(--radius-sm)-2px)] text-[12.5px] font-semibold transition-colors ${
              !isAnnual
                ? 'bg-[var(--bg-surface)] text-[var(--brand-mid)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={isAnnual}
            onClick={() => setPlan('annual')}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-[calc(var(--radius-sm)-2px)] text-[12.5px] font-semibold transition-colors ${
              isAnnual
                ? 'bg-[var(--bg-surface)] text-[var(--brand-mid)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Annual
            <span className="inline-flex items-center rounded-full bg-[var(--brand-light)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.3px] text-[var(--brand-mid)]">
              Save {saving}%
            </span>
          </button>
        </div>

        {/* Price */}
        <div className="mt-6 flex items-baseline gap-1.5">
          <span className="font-mono text-[38px] font-bold leading-none tracking-[-1px] text-[var(--text-primary)]">
            {money(isAnnual ? prices.annual : prices.monthly, currency)}
          </span>
          <span className="text-[13px] font-medium text-[var(--text-muted)]">
            {isAnnual ? '/year' : '/month'}
          </span>
          <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-[var(--text-muted)]">
            {CURRENCY_CODE_LABEL[currency]}
          </span>
        </div>
        <p className="mt-1.5 h-4 text-[12px] text-[var(--text-muted)]">
          {isAnnual
            ? `Works out to ${money(annualPerMonth(currency), currency)}/month, billed once a year.`
            : 'Billed monthly.'}
        </p>

        {/* Features */}
        <ul className="mt-6 flex flex-col gap-2.5">
          {FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2.5 text-[13px] text-[var(--text-secondary)] leading-relaxed"
            >
              <Check
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--brand-mid)]"
                strokeWidth={2.4}
                aria-hidden
              />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA — checkout is session-gated and the account needs email confirmation, so
            an account genuinely must exist first. Signup lands them on /account, where
            the same trial modal and the same /api/checkout finish the job. */}
        <div className="mt-7">
          <Button asChild variant="primary" size="lg" className="w-full">
            <Link href={`/signup?next=${encodeURIComponent('/account')}`}>
              Start 7-day free trial
            </Link>
          </Button>

          <p className="mt-3 text-center text-[12px] text-[var(--text-muted)]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-[var(--brand-mid)] underline underline-offset-2 hover:text-[var(--brand-deep)]"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Trust line */}
        <p className="mt-6 border-t border-[var(--border)] pt-4 text-[11.5px] text-[var(--text-muted)] leading-relaxed">
          Prices in {CURRENCY_CODE_LABEL[currency]}. No refunds — cancel any time and
          your plan runs to the end of the period you&apos;ve paid for. MajorCycle is
          educational analysis only, not financial advice.
        </p>
      </div>
    </article>
  );
}
