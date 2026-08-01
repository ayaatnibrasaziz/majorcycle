'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';

import { UpgradeDialog } from '@/components/UpgradeDialog';

/**
 * The locked states a free viewer sees in place of premium analysis (F3 Step 10).
 *
 * These are honest placeholders, NOT redactions of delivered data: for an unentitled
 * viewer the underlying numbers are stripped server-side before the response is
 * serialised (see PREMIUM_KEYS in web/api/cycle.py), so there is nothing in the page
 * to blur, un-hide or read out of the DOM. What renders here is all that exists.
 *
 * Clicking one opens the shared UpgradeDialog rather than navigating to /pricing —
 * the reader keeps their place on the stock they were actually interested in, which
 * is the whole context for the decision they're being asked to make.
 */

/**
 * Inline text CTA for prose that needs to offer the upsell mid-sentence — the
 * daily-limit panel, the "access ended mid-run" alert. It exists so those places don't
 * have to link to the public /pricing page, which drops a signed-in reader out of the
 * app shell onto a page that reads as signed-out. A client island, so Server Components
 * can use it too.
 */
export function PremiumLockInlineCta({
  feature,
  label = "See what's included",
}: {
  feature: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-semibold text-[var(--brand-mid)] underline underline-offset-2 hover:text-[var(--brand-bright)]"
      >
        {label}
      </button>
      <UpgradeDialog open={open} onOpenChange={setOpen} feature={feature} />
    </>
  );
}

/** Full-width card standing in for a locked section (Verdict, Scorecard). */
export function PremiumLockCard({
  id,
  title,
  blurb,
}: {
  /**
   * Section anchor, when this lock stands in for a section the subnav links to.
   * The pill's click handler bails on a missing element, so a locked section
   * WITHOUT this id is a silently dead nav link for free viewers.
   */
  id?: string;
  title: string;
  blurb: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div id={id} className="card card--stack-base scroll-mt-[120px]" role="note">
      <div className="card-header">
        <div className="card-title flex items-center gap-[6px]">
          <Lock
            className="w-[13px] h-[13px] text-[var(--text-muted)]"
            strokeWidth={2}
            aria-hidden="true"
          />
          {title}
        </div>
      </div>
      <div className="card-body">
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {blurb}{' '}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-semibold text-[var(--brand-mid)] underline underline-offset-2 hover:text-[var(--brand-bright)]"
          >
            See what&apos;s included
          </button>
          .
        </p>
      </div>
      <UpgradeDialog open={open} onOpenChange={setOpen} feature={title} />
    </div>
  );
}

/**
 * Locked tile for the 4-card KPI strip. Keeps the exact `kpi-card` shape so the grid
 * stays aligned — the two locked tiles sit directly beside two working ones, which is
 * the clearest possible statement of what a subscription adds.
 */
export function PremiumLockKpi({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="kpi-card kpi-card--accent text-left"
        style={
          {
            '--kpi-accent': 'var(--text-muted)',
            '--kpi-value-color': 'var(--text-muted)',
          } as React.CSSProperties
        }
        aria-label={`${label} — included with a subscription. See what's included.`}
      >
        <div className="kpi-label">{label}</div>
        <div className="kpi-value flex items-center gap-[6px] text-[15px]">
          <Lock className="w-[15px] h-[15px]" strokeWidth={2} aria-hidden="true" />
          Unlock
        </div>
      </button>
      <UpgradeDialog open={open} onOpenChange={setOpen} feature={label} />
    </>
  );
}
