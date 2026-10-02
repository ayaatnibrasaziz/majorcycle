import { AlertCircle } from 'lucide-react';

import { LocalDate } from '@/components/LocalDate';
import type { PaymentBanner as PaymentBannerState } from '@/lib/entitlement';

/** Server-side placeholder until <LocalDate> reformats in the reader's own time zone. */
function shortFallback(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'the deadline'
    : d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * The failed-payment warning at the top of every signed-in page (owner-approved design,
 * 2026-10-03). Which one shows is decided by `paymentBanner()` in lib/entitlement.ts.
 *
 * No close button: it goes away by itself the moment Stripe confirms a payment. The
 * button is a plain form POST to /api/portal — Stripe's own billing page, the same one
 * "Manage billing" opens — so it works before the page's JavaScript has loaded.
 */
export function PaymentBanner({ state }: { state: PaymentBannerState }) {
  const grace = state.kind === 'grace';
  return (
    <div role="alert" className={`payment-banner ${grace ? 'payment-banner--grace' : 'payment-banner--paused'}`}>
      <AlertCircle className="payment-banner-icon" aria-hidden="true" />
      <p className="payment-banner-text">
        {grace ? (
          <>
            <strong>We couldn’t take your last payment.</strong>{' '}
            {state.until ? (
              <>
                Update your card by{' '}
                <strong>
                  <LocalDate iso={state.until} fallback={shortFallback(state.until)} format="short" />
                </strong>{' '}
                to keep full access.
                <span className="hidden sm:inline"> Nothing else changes until then.</span>
              </>
            ) : (
              'Update your card to keep full access.'
            )}
          </>
        ) : (
          <>
            <strong>Your access is paused</strong> because the last payment didn’t go through.
            Update your card and it comes straight back.
            <span className="hidden sm:inline"> Browsing, charts and company financials still work.</span>
          </>
        )}
      </p>
      <form action="/api/portal" method="post" className="payment-banner-action">
        <button type="submit" className="payment-banner-btn">
          Update card
        </button>
      </form>
    </div>
  );
}
