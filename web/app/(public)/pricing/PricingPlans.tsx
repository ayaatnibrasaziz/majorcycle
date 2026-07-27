'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AccessDenialReason } from '@/lib/entitlement';
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
];

/**
 * The last bullet is the only one that depends on the reader: "no charge until day 7"
 * is false for anyone who has already used their trial (Step 7 bills them today) and
 * for anyone already subscribed.
 */
function closingFeature(trialAvailable: boolean): string {
  return trialAvailable ? 'Cancel anytime — no charge until day 7' : 'Cancel anytime';
}

/**
 * What to say to someone who was just bounced off a premium page (F3 Step 10).
 *
 * Each line names what actually happened and what fixes it. "no_subscription" gets
 * no banner: that's a free user meeting the paywall for the first time, and the page
 * below already explains the offer — a notice would only read as a scolding.
 */
const DENIAL_COPY: Record<
  Exclude<AccessDenialReason, 'no_subscription'>,
  { title: string; body: string }
> = {
  canceled: {
    title: 'Your subscription has ended',
    body: 'Browsing, charts and company financials are still yours on the free plan. Resubscribe below to bring back the Major Cycle rating, the health scorecard, the screener and downloadable reports.',
  },
  payment_failed: {
    title: 'We couldn’t take your last payment',
    body: 'Your access is paused until the payment goes through. Updating your card on the Account page is usually all it takes — you don’t need to buy a new plan.',
  },
  billing_blocked: {
    title: 'Your account is on hold',
    body: 'A payment on this account was disputed with the bank, so access is on hold while that’s resolved. Please contact support and we’ll sort it out with you.',
  },
};

function DenialNotice({ reason }: { reason: AccessDenialReason }) {
  if (reason === 'no_subscription') return null;
  const copy = DENIAL_COPY[reason];
  return (
    <div
      role="status"
      className="mb-6 flex gap-2.5 rounded-[var(--radius-sm)] border border-[#fcd34d] bg-[#fffbeb] px-3.5 py-3"
    >
      <AlertCircle
        className="mt-[1px] h-[15px] w-[15px] flex-shrink-0 text-[#b45309]"
        strokeWidth={2}
        aria-hidden="true"
      />
      <div>
        <p className="text-[12.5px] font-semibold text-[#92400e]">{copy.title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#92400e]">{copy.body}</p>
        {reason === 'billing_blocked' && (
          <Link
            href="/contact"
            className="mt-1.5 inline-block text-[12px] font-semibold text-[#92400e] underline underline-offset-2"
          >
            Contact support
          </Link>
        )}
      </div>
    </div>
  );
}

/** Money with the currency's symbol; whole numbers stay whole, otherwise 2dp. */
function money(amount: number, currency: BillingCurrency): string {
  const n = amount % 1 === 0 ? String(amount) : amount.toFixed(2);
  return `${CURRENCY_SYMBOL[currency]}${n}`;
}

interface PricingPlansProps {
  currency: BillingCurrency;
  isLoggedIn: boolean;
  hasSubscription: boolean;
  // Signed-in visitor who already used their free trial (Step 7). Their CTA subscribes
  // with no free week, billed today — labelled + noted honestly so it's never a surprise.
  trialUsed?: boolean;
  /** Set when `requireEntitled()` bounced them here; drives the explanatory banner. */
  reason?: AccessDenialReason | null;
  /**
   * The plan they picked BEFORE signing up, carried through the confirmation email.
   * Preselects the toggle and greets them, so the round trip reads as one flow.
   */
  startPlan?: PlanKey | null;
}

/**
 * The pricing card: monthly/annual toggle, region-aware sticker price, and a CTA
 * whose behaviour depends on who's looking —
 *  - already subscribed → "Manage your plan" (→ /account, no new checkout)
 *  - signed out → "Start free trial" routes to /signup (checkout is login-gated)
 *  - signed in, no plan → POST /api/checkout and redirect to Stripe hosted Checkout.
 * All amounts are display-only; Stripe charges the real (matching) price.
 */
export function PricingPlans({
  currency,
  isLoggedIn,
  hasSubscription,
  trialUsed = false,
  reason = null,
  startPlan = null,
}: PricingPlansProps) {
  const [plan, setPlan] = useState<PlanKey>(startPlan ?? 'monthly');
  // Only greet someone who actually came back from signup AND still needs to buy.
  const resumed = Boolean(startPlan) && isLoggedIn && !hasSubscription;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The headline has to agree with whoever is reading it. Hard-coding the trial pitch
  // put "Start your 7-day free trial" directly beneath a banner telling a past-due
  // customer they don't need a new plan, and offered a free week to someone the
  // tombstone (Step 7) will bill on day one. Three readers, three different truths.
  const heading = hasSubscription
    ? {
        title: 'Your MajorCycle plan',
        body: 'Manage your subscription, payment method and invoices from the Account page.',
      }
    : trialUsed
      ? {
          title: 'Subscribe to MajorCycle',
          body: "You've already used your free trial on this email, so a new subscription starts today. Cancel any time — you keep access to the end of the period you've paid for.",
        }
      : {
          title: 'Start your 7-day free trial',
          body: "Full access to MajorCycle for 7 days. Your card is required upfront and isn't charged until the trial ends — cancel any time before then and you pay nothing.",
        };

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
    <article className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] shadow-[0_24px_60px_-12px_rgba(15,25,35,0.12),0_8px_24px_-8px_rgba(15,25,35,0.08)] overflow-hidden">
      <div className="px-7 py-8 sm:px-9 sm:py-10">
        {/* Signed-in only. `?reason=` describes THIS account's billing state, and we
            can't know that for a signed-out reader — showing "your subscription has
            ended" to someone who merely typed the parameter would state something we
            haven't verified, right beside a first-time trial offer. */}
        {isLoggedIn && reason && <DenialNotice reason={reason} />}
        {resumed && (
          <div
            role="status"
            className="mb-6 flex gap-2.5 rounded-[var(--radius-sm)] border border-[#bfdbfe] bg-[var(--brand-light)] px-3.5 py-3"
          >
            <Check
              className="mt-[2px] h-[15px] w-[15px] flex-shrink-0 text-[var(--brand-mid)]"
              strokeWidth={2.5}
              aria-hidden
            />
            <p className="text-[12.5px] leading-relaxed text-[var(--brand-deep)]">
              <strong>Your free account is ready.</strong> Pick up where you left off —
              continue below to start your 7-day free trial.
            </p>
          </div>
        )}
        <h1 className="text-[22px] sm:text-[24px] font-bold text-[var(--text-primary)] tracking-[-0.4px] leading-[1.2]">
          {heading.title}
        </h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          {heading.body}
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
          {[...FEATURES, closingFeature(!hasSubscription && !trialUsed)].map((f) => (
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
          {hasSubscription ? (
            <Button asChild variant="primary" size="lg" className="w-full">
              <Link href="/account">Manage your plan</Link>
            </Button>
          ) : !isLoggedIn ? (
            // Carries the chosen plan through signup and the confirmation email, so
            // they come back HERE with it preselected instead of landing on /stocks
            // having lost the thing they clicked. Checkout is session-gated and the
            // account needs email confirmation, so an account genuinely must exist
            // first — this makes that a step in one flow rather than a dead end.
            <Button asChild variant="primary" size="lg" className="w-full">
              <Link
                href={`/signup?next=${encodeURIComponent(`/pricing?start=${plan}`)}`}
              >
                Start 7-day free trial
              </Link>
            </Button>
          ) : (
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
              ) : trialUsed ? (
                'Subscribe now'
              ) : (
                'Start 7-day free trial'
              )}
            </Button>
          )}

          {/* Honest note: a signed-in visitor who already used their trial is told,
              before they click through to payment, that this is billed today. */}
          {isLoggedIn && !hasSubscription && trialUsed && (
            <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden />
              <span>
                You&apos;ve already used your free trial, so subscribing starts your paid
                plan today — billed immediately, with no free week.
              </span>
            </p>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 text-[12.5px] text-[var(--c-tier-5-ink)]">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden />
              <p>{error}</p>
            </div>
          )}

          {!hasSubscription && !isLoggedIn && (
            <p className="mt-3 text-center text-[12px] text-[var(--text-muted)]">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold text-[var(--brand-mid)] underline underline-offset-2 hover:text-[var(--brand-deep)]"
              >
                Sign in
              </Link>
            </p>
          )}
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
