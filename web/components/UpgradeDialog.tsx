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
import { SupportDialog } from '@/components/SupportDialog';
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

/**
 * One in-flight request per page, shared by every lock on it.
 *
 * A Stock Detail page mounts several UpgradeDialogs (both KPI tiles, the Verdict, the
 * radar, the subnav). Fetching per instance would fire the same request five times;
 * fetching per OPEN meant the answer arrived after the dialog was already on screen,
 * so the reader saw the upsell for a beat before it became "your account is on hold" —
 * the wrong content, not just a slow one. Resolving at mount means the answer is
 * almost always ready before the first click. The dialog only mounts where a lock is
 * rendered, i.e. for a viewer we already know is unentitled, so this adds one small
 * private request to pages that were going to ask anyway.
 */
let sharedContext: Promise<BillingContext | null> | null = null;

function loadBillingContext(): Promise<BillingContext | null> {
  sharedContext ??= fetch('/api/billing-context')
    .then((r) => (r.ok ? (r.json() as Promise<BillingContext>) : null))
    .catch(() => null)
    .then((v) => {
      // Don't cache a failure — the next lock should get a fresh attempt rather than
      // inheriting a dead promise and showing the fallback forever.
      if (v === null) sharedContext = null;
      return v;
    });
  return sharedContext;
}

interface BillingContext {
  currency: BillingCurrency;
  trialUsed: boolean;
  hasSubscription: boolean;
  /** Dispute lock. Outranks everything else — see the `blocked` branch below. */
  billingBlocked: boolean;
  /** Prefill the support dialog so a locked reader doesn't retype what we hold. */
  email: string | null;
  displayName: string | null;
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
  const [failed, setFailed] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  // Loaded when the dialog opens, so the CTA is already correct by the time they
  // reach for it. Fetched once per mount; billing state can't change underneath a
  // reader mid-dialog.
  //
  // `failed` is tracked SEPARATELY from `ctx === null` on purpose. Both used to mean
  // "no context", so the in-flight moment rendered the same live /pricing link as a
  // hard failure — a reader quick enough to click during that flash was thrown out to
  // the public pricing page, losing the stock they were reading and the whole point of
  // an in-place dialog. Loading is now inert; only a real failure offers a way out.
  useEffect(() => {
    let cancelled = false;
    loadBillingContext().then((d) => {
      if (cancelled) return;
      if (d) setCtx(d);
      // /account resolves the same facts server-side and stays inside the app, so it
      // is the safe destination. A failed fetch must never become a wrong offer.
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = FEATURES[feature] ?? {
    title: feature,
    what: 'This is part of the MajorCycle analysis, included with a subscription.',
  };

  // A disputed account is locked for a reason that has nothing to do with buying
  // anything, so the whole dialog changes: no feature pitch, no plan list, no CTA to
  // subscribe. /api/checkout 403s this account, so an upsell here would be an offer we
  // refuse at the till — and the reader would be left guessing why a paid-up plan
  // stopped working. Say it plainly and point at the one action that helps.
  const blocked = ctx?.billingBlocked === true;

  // Belt and braces alongside the mount-time fetch: if the answer somehow hasn't
  // arrived by the time the dialog opens, show nothing that presumes an answer. The
  // upsell body is a claim about this reader ("you could subscribe") and it is the
  // wrong claim for a disputed account, so it must not be the placeholder.
  const loading = ctx === null && !failed;

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
              <DialogTitle>
                {blocked ? 'Your account is on hold' : copy.title}
              </DialogTitle>
            </div>
            <DialogDescription>
              {loading
                ? 'Checking your plan…'
                : blocked
                  ? 'A payment on this account was disputed with the bank, so access is on hold while that’s resolved.'
                  : copy.what}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center p-5" aria-live="polite">
              <Loader2
                className="h-4 w-4 animate-spin text-[var(--text-muted)]"
                aria-hidden
              />
            </div>
          ) : blocked ? (
            <div className="p-5">
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                {copy.title} is part of the paid analysis, and it comes back as soon as
                the dispute is settled. If you think this is a mistake, contact us and
                we’ll sort it out with you.
              </p>
              <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
                Browsing, price charts and company financials stay free in the meantime.
                Information only — not financial advice.
              </p>
            </div>
          ) : (
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
          )}

          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
            {blocked ? (
              // No plan CTA: checkout refuses this account, so support is the only
              // action that can actually change anything. Handed to a dialog rather
              // than /contact so a reader who is already confused about losing access
              // doesn't also lose the page they were on.
              <Button
                variant="primary"
                onClick={() => {
                  onOpenChange(false);
                  setSupportOpen(true);
                }}
              >
                Contact support
              </Button>
            ) : ctx === null ? (
              failed ? (
                // Only a genuine failure routes away from the dialog — and it routes
                // to /account, not the public shop window, so a signed-in reader is
                // never dropped onto a page that reads as signed-out.
                <Button asChild variant="primary">
                  <Link href="/account">Go to your account</Link>
                </Button>
              ) : (
                // In flight: inert, so the offer can never be the wrong one and can
                // never be clicked before we know which offer is right.
                <Button variant="primary" disabled aria-live="polite">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Checking your plan…
                </Button>
              )
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
      {ctx && !ctx.hasSubscription && !blocked && (
        <StartTrialModal
          open={trialOpen}
          onOpenChange={setTrialOpen}
          currency={ctx.currency}
          trialUsed={ctx.trialUsed}
        />
      )}

      {/* Support, in place — the only route out of a dispute hold. */}
      <SupportDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
        defaultName={ctx?.displayName ?? ''}
        defaultEmail={ctx?.email ?? ''}
        description="Your account is on hold because a payment was disputed. Tell us what happened and we’ll sort it out with you by email."
      />
    </>
  );
}
