'use client';

import { useState } from 'react';
import { Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

interface StartTrialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: BillingCurrency;
}

/**
 * In-app "Start your 7-day free trial" modal, opened from the Account
 * Subscription card. Deliberately shares the Methodology modal's shell (gradient
 * header + icon, scrollable body, disclaimer footer — see MethodologyModal /
 * reference/original-design.html) so the trial entry looks native to the app
 * rather than a separate page jump. The plan chooser + checkout mirror the public
 * /pricing card, but only the signed-in path exists here: the button is shown
 * only to a signed-in user with no live plan, so it always POSTs /api/checkout
 * and hands off to Stripe hosted Checkout.
 */
export function StartTrialModal({ open, onOpenChange, currency }: StartTrialModalProps) {
  const [plan, setPlan] = useState<PlanKey>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prices = PRICE_TABLE[currency];
  const isAnnual = plan === 'annual';
  const saving = annualSavingPercent(currency);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!res.ok || !data?.url) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      // Hand off to Stripe's hosted Checkout page.
      window.location.href = data.url;
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[480px] p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header — mirrors the Methodology modal's gradient header. */}
        <div className="flex flex-col gap-0.5 px-6 py-[18px] border-b border-[var(--border)] bg-gradient-to-br from-[#FAFBFC] to-[#F4F7FB]">
          <DialogTitle className="flex items-center gap-2.5 text-[16px]">
            <Sparkles
              className="w-[18px] h-[18px] text-[var(--brand-mid)] flex-shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            Start your 7-day free trial
          </DialogTitle>
          <DialogDescription className="pl-[28px]">
            Full access to MajorCycle for 7 days — your card is required upfront and
            isn&apos;t charged until the trial ends.
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Monthly / annual toggle — segmented control */}
          <div
            role="group"
            aria-label="Billing period"
            className="grid grid-cols-2 gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-hover)] p-1"
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

          {/* CTA */}
          <div className="mt-7">
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={startCheckout}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Redirecting to checkout…
                </>
              ) : (
                'Start 7-day free trial'
              )}
            </Button>

            {error && (
              <div className="mt-3 flex items-start gap-2 text-[12.5px] text-[var(--c-tier-5-ink)]">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden />
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer — mirrors the Methodology modal's disclaimer footer. */}
        <div className="border-t border-[var(--border)] bg-[var(--bg-stripe)] px-6 py-3 text-center text-[11px] tracking-[0.1px] text-[var(--text-muted)] leading-relaxed">
          Prices in {CURRENCY_CODE_LABEL[currency]}. No refunds — cancel any time and your
          plan runs to the end of the paid period. Information only — not financial advice.
        </div>
      </DialogContent>
    </Dialog>
  );
}
