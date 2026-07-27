'use client';

import Link from 'next/link';
import { Lock, Check } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * The one place a locked feature explains itself (F3 Step 10, owner-requested).
 *
 * Every lock used to navigate straight to /pricing, which threw away whatever the
 * reader was looking at — they had to find their stock again to see what they'd
 * bought. This is the same dialog treatment as the Methodology modal (the shared
 * overlay already supplies the blurred backdrop), so the page stays put behind it
 * and Escape returns them exactly where they were.
 *
 * It deliberately shows NO price. Currency, the trial-vs-billed-today distinction
 * and the "you've already used your trial" case all live on /pricing, resolved
 * server-side; duplicating any of that here would be a second source of truth for
 * the one thing that must never be wrong.
 */

const UNLOCKS = [
  'The Overall Rating and Financial Health Score on every stock',
  'The Verdict and the five-pillar scorecard',
  'The full screener — run and rank your whole universe',
  'Downloadable interactive reports',
];

export function UpgradeDialog({
  open,
  onOpenChange,
  feature,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the reader just clicked, so the dialog answers the question they asked. */
  feature: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-light)]">
              <Lock className="h-[13px] w-[13px] text-[var(--brand-mid)]" strokeWidth={2.2} />
            </span>
            {/* Phrased so it reads for every caller — "Run Analysis", "Overall
                Rating", "The Verdict", "The downloadable report". */}
            <DialogTitle>{feature} is a premium feature</DialogTitle>
          </div>
          <DialogDescription>
            The market data on this page is free and always will be. Our judgement —
            the scores, the ratings and the screener — is what a subscription pays for.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5">
          <ul className="flex flex-col gap-2.5">
            {UNLOCKS.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2.5 text-[12.5px] leading-snug text-[var(--text-secondary)]"
              >
                <span className="mt-[2px] flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--c-tier-2)]">
                  <Check className="h-[10px] w-[10px] text-white" strokeWidth={3.5} />
                </span>
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
            Information only — not financial advice.
          </p>
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild variant="primary">
            <Link href="/pricing">See plans</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
