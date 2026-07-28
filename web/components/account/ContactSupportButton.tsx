'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { SupportDialog } from '@/components/SupportDialog';

/**
 * The action on a dispute-held subscription card. A client island purely so the
 * server-rendered SubscriptionCard can still open a dialog — support opens in place
 * rather than navigating to the public /contact page, which would drop a signed-in
 * user into a signed-out-looking shell at the worst possible moment.
 */
export function ContactSupportButton({
  defaultName = '',
  defaultEmail = '',
}: {
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="flex-shrink-0"
        onClick={() => setOpen(true)}
      >
        Contact support
      </Button>
      <SupportDialog
        open={open}
        onOpenChange={setOpen}
        defaultName={defaultName}
        defaultEmail={defaultEmail}
        description="Your account is on hold because a payment was disputed. Tell us what happened and we’ll sort it out with you by email."
      />
    </>
  );
}
