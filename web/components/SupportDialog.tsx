'use client';

import { LifeBuoy } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ContactForm } from '@/app/(public)/contact/ContactForm';

/**
 * Contact support without leaving the page (F3 Step 10, owner-requested).
 *
 * A dispute-locked reader is already disoriented — their paid features stopped
 * working. Sending them to the public /contact page compounds it: they lose the app
 * shell, the page looks signed-out, and they have to retype details we already hold.
 * This is the same in-place treatment as UpgradeDialog and the Methodology modal (the
 * shared overlay supplies the blurred backdrop), so Escape returns them exactly where
 * they were.
 *
 * The form is the SAME component and the same server action as /contact — one
 * implementation of validation, the honeypot and the branded email.
 */
export function SupportDialog({
  open,
  onOpenChange,
  defaultName = '',
  defaultEmail = '',
  /** Shown above the form — lets the caller name the situation (e.g. a dispute hold). */
  description = 'Tell us what’s happened and we’ll get back to you by email.',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  defaultEmail?: string;
  description?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-light)]">
              <LifeBuoy
                className="h-[13px] w-[13px] text-[var(--brand-mid)]"
                strokeWidth={2.2}
              />
            </span>
            <DialogTitle>Contact support</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="p-5">
          <ContactForm
            defaultName={defaultName}
            defaultEmail={defaultEmail}
            showSignInLink={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
