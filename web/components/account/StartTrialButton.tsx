'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { BillingCurrency } from '@/lib/stripe';
import { StartTrialModal } from './StartTrialModal';

interface StartTrialButtonProps {
  currency: BillingCurrency;
}

/**
 * The Subscription card's "Start free trial" action. Opens the in-app trial modal
 * (methodology-styled) instead of navigating to the public /pricing page — the
 * signed-in entry into checkout. Kept as a thin client wrapper so the
 * SubscriptionCard can stay a Server Component.
 */
export function StartTrialButton({ currency }: StartTrialButtonProps) {
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
        Start free trial
      </Button>
      <StartTrialModal open={open} onOpenChange={setOpen} currency={currency} />
    </>
  );
}
