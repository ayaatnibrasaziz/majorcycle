'use client';

import type { ReactNode } from 'react';

import { track } from '@/lib/analytics';

/**
 * The "Manage billing" / "Update card" form, with one addition: it records that the
 * reader opened Stripe's billing portal (where cancelling happens). Still a plain form
 * POST to /api/portal — no Stripe key in the browser, and it works without JavaScript.
 */
export function BillingPortalForm({ purpose, children }: { purpose: 'manage' | 'update_card'; children: ReactNode }) {
  return (
    <form
      action="/api/portal"
      method="post"
      className="sub-plan-action"
      // The submit BUTTON's click, not the form's submit: this form posts natively and
      // works before hydration, and an onSubmit handler would make it read as a form
      // the browser handles (e2e/auth-early-input.spec.ts). Enter in a form clicks its
      // submit button too, so no press is missed.
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest('button[type="submit"]')) track('open_billing_portal', { purpose });
      }}
    >
      {children}
    </form>
  );
}
