'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { LocalDate } from '@/components/LocalDate';
import { SupportDialog } from '@/components/SupportDialog';
import { DISPUTE_ENDED_COPY } from '@/lib/denialCopy';
import type { PaymentBanner as PaymentBannerState } from '@/lib/entitlement';

/** Server-side placeholder until <LocalDate> reformats in the reader's own time zone. */
function longFallback(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'the deadline'
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The billing warning at the top of every signed-in page (owner-approved designs,
 * 2026-10-03). Which one shows is decided by `paymentBanner()` in lib/entitlement.ts.
 *
 * No close button: it goes away by itself the moment the cause does. A failed card's
 * button is a plain form POST to /api/portal — Stripe's own billing page — so it works
 * before the page's JavaScript has loaded. A dispute's button opens the support form in
 * place: a new card cannot lift a dispute, and the portal refuses a held account.
 */
export function PaymentBanner({
  state,
  email = '',
  displayName = '',
}: {
  state: PaymentBannerState;
  /** Prefill the support form a dispute banner opens. */
  email?: string;
  displayName?: string;
}) {
  const [supportOpen, setSupportOpen] = useState(false);

  if (state.kind === 'held') {
    return (
      <>
        <div role="alert" className="payment-banner payment-banner--held">
          <AlertCircle className="payment-banner-icon" aria-hidden="true" />
          <p className="payment-banner-text">
            {state.ended ? (
              <>
                <strong>The paid analysis is switched off on this account</strong> because a
                payment was disputed with your bank. If you’d like to talk about it, contact us
                and we’ll sort it out with you.
              </>
            ) : (
              <>
                <strong>Your account is on hold</strong> because a payment was disputed with
                your bank. Contact us and we’ll sort it out with you.
                <span className="hidden sm:inline"> Browsing, charts and company financials still work.</span>
              </>
            )}
          </p>
          <div className="payment-banner-action">
            <button type="button" className="payment-banner-btn" onClick={() => setSupportOpen(true)}>
              Contact support
            </button>
          </div>
        </div>
        <SupportDialog
          open={supportOpen}
          onOpenChange={setSupportOpen}
          defaultName={displayName}
          defaultEmail={email}
          description={
            state.ended
              ? DISPUTE_ENDED_COPY.support
              : 'Your account is on hold because a payment was disputed. Tell us what happened and we’ll sort it out with you by email.'
          }
        />
      </>
    );
  }

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
                  {/* The same date format as the Account card's "Update card by" row: the
                      two used to print one date as "Fri, Oct 9" and "October 9, 2026". */}
                  <LocalDate iso={state.until} fallback={longFallback(state.until)} />
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
