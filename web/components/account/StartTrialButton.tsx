'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { BillingCurrency } from '@/lib/stripe';
import { StartTrialModal } from './StartTrialModal';

interface StartTrialButtonProps {
  currency: BillingCurrency;
  // True when this email already used its free trial — the button becomes "Subscribe"
  // and the modal explains billing starts today (no free week). See Step 7.
  trialUsed?: boolean;
}

/**
 * The Subscription card's trial/subscribe action. Opens the in-app trial modal
 * (methodology-styled) instead of navigating to the public /pricing page — the
 * signed-in entry into checkout. Kept as a thin client wrapper so the
 * SubscriptionCard can stay a Server Component. When the email has already used its
 * free trial, the label and modal switch to an honest "subscribe, billed today" flow.
 */
export function StartTrialButton({ currency, trialUsed = false }: StartTrialButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="primary"
        className="flex-shrink-0"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="w-4 h-4" strokeWidth={1.8} aria-hidden />
        {trialUsed ? 'Subscribe' : 'Start free trial'}
      </Button>
      <StartTrialModal
        open={open}
        onOpenChange={setOpen}
        currency={currency}
        trialUsed={trialUsed}
      />
    </>
  );
}
