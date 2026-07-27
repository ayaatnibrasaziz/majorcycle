'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Lock, Check, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StartTrialModal } from '@/components/account/StartTrialModal';
import type { BillingCurrency } from '@/lib/stripe';

/**
 * The one place a locked feature explains itself (F3 Step 10, owner-requested).
 *
 * Every lock used to navigate straight to /pricing, which threw away whatever the
 * reader was looking at — they had to find their stock again to see what they'd
 * bought. This is the same dialog treatment as the Methodology modal (the shared
 * overlay already supplies the blurred backdrop), so the page stays put behind it
 * and Escape returns them exactly where they were.
 *
 * Continuing hands off to StartTrialModal — the same in-app checkout entry the
 * Account page uses — rather than bouncing to /pricing. That modal and
 * /api/checkout between them already carry every subscription edge case (no second
 * free trial for a tombstoned email, 409 for someone who already has a plan), so
 * reusing them is what keeps those rules in ONE place.
 */

/** What each locked surface actually IS, in the reader's terms. */
const FEATURES: Record<string, { title: string; what: string }> = {
  'Overall Rating': {
    title: 'Overall Rating',
    what:
      'A single 0–100 score for the stock, combining its financial health (40%), how far it has pulled back versus its own typical cycle (35%), and the historical payoff from buying at this point in that cycle (25%). It maps to one of five labels, from High Conviction to Bearish.',
  },
  'Health Score': {
    title: 'Health Score',
    what:
      'A 0–100 read on how strong the underlying business is — profitability, balance-sheet safety, growth, cash generation and shareholder returns, scored together. 80+ is very healthy; below 60 signals elevated risk.',
  },
  'The Verdict': {
    title: 'The Verdict',
    what:
      'The whole picture in one card: where this stock sits in its Major Cycle right now, its rating and valuation zone, the reasoning behind them, and the price levels that would change the conclusion.',
  },
  Scorecard: {
    title: 'Scorecard',
    what:
      'The five pillars behind the Health Score broken out individually — profitability, balance sheet, growth, cash flow and shareholder returns — so you can see which part of the business is carrying the score and which is dragging it.',
  },
  'The downloadable report': {
    title: 'The downloadable report',
    what:
      'A single self-contained file with this stock’s full analysis — charts, scores, verdict and history — that opens in any browser with no internet connection. Yours to keep, annotate or share.',
  },
  'Run Analysis': {
    title: 'Run Analysis',
    what:
      'The screener. Point it at a ready-made basket, your own list or the whole universe, and it runs the Major Cycle analysis across every ticker at once instead of one stock at a time.',
  },
  Results: {
    title: 'Results',
    what:
      'The ranked output of a screener run — every stock you analysed sorted by rating, with filters, the opportunity map and CSV export, so you can narrow hundreds of names down to a short list.',
  },
};

const UNLOCKS = [
  'The Overall Rating and Health Score on every stock',
  'The Verdict and the five-pillar scorecard',
  'The full screener — run and rank your whole universe',
  'Downloadable interactive reports',
];

interface BillingContext {
  currency: BillingCurrency;
  trialUsed: boolean;
  hasSubscription: boolean;
}

export function UpgradeDialog({
  open,
  onOpenChange,
  feature,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Key into FEATURES — what the reader just clicked. */
  feature: string;
}) {
  const [ctx, setCtx] = useState<BillingContext | null>(null);
  const [trialOpen, setTrialOpen] = useState(false);

  // Loaded when the dialog opens, so the CTA is already correct by the time they
  // reach for it. Fetched once per mount; billing state can't change underneath a
  // reader mid-dialog.
  useEffect(() => {
    if (!open || ctx) return;
    let cancelled = false;
    fetch('/api/billing-context')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BillingContext | null) => {
        if (!cancelled && d) setCtx(d);
      })
      .catch(() => {
        /* Leave ctx null — the CTA falls back to /pricing, which resolves the same
           facts server-side. A failed fetch must never become a wrong offer. */
      });
    return () => {
      cancelled = true;
    };
  }, [open, ctx]);

  const copy = FEATURES[feature] ?? {
    title: feature,
    what: 'This is part of the MajorCycle analysis, included with a subscription.',
  };

  function handleContinue() {
    onOpenChange(false);
    setTrialOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-2.5">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-light)]">
                <Lock
                  className="h-[13px] w-[13px] text-[var(--brand-mid)]"
                  strokeWidth={2.2}
                />
              </span>
              <DialogTitle>{copy.title}</DialogTitle>
            </div>
            <DialogDescription>{copy.what}</DialogDescription>
          </DialogHeader>

          <div className="p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--text-muted)]">
              A subscription also includes
            </p>
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
              The market data on this page stays free. Information only — not financial
              advice.
            </p>
          </div>

          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
            {ctx === null ? (
              // Context still in flight (or it failed) — /pricing resolves the same
              // facts server-side, so this is always a safe destination.
              <Button asChild variant="primary">
                <Link href="/pricing">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  See plans
                </Link>
              </Button>
            ) : ctx.hasSubscription ? (
              <Button asChild variant="primary">
                <Link href="/account">Manage your plan</Link>
              </Button>
            ) : (
              <Button variant="primary" onClick={handleContinue}>
                {ctx.trialUsed ? 'Subscribe' : 'Start free trial'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Same in-app checkout entry as the Account page — one implementation of the
          trial rules, including "this email already used its free week". */}
      {ctx && !ctx.hasSubscription && (
        <StartTrialModal
          open={trialOpen}
          onOpenChange={setTrialOpen}
          currency={ctx.currency}
          trialUsed={ctx.trialUsed}
        />
      )}
    </>
  );
}
