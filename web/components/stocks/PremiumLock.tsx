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
        <h3 className="card-title flex items-center gap-[6px]">
          <Lock
            className="w-[13px] h-[13px] text-[var(--text-muted)]"
            strokeWidth={2}
            aria-hidden="true"
          />
          {title}
        </h3>
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
        /* ⚠️ AUDIT 5A-151. There WAS an `aria-label` here naming only the label
           — "Overall Rating — included with a subscription…" — which REPLACED the
           element's content as the accessible name and so omitted the one word a
           voice-control user would actually say: **Unlock**. "Click Unlock" did
           nothing, on the paywall, which is the screen where a free reader decides
           whether to pay. WCAG 2.5.3 Level A.

           ⚠️ **My first fix restated the visible words in the label and STILL
           failed**, which is the lesson worth keeping. `.kpi-label` is
           `text-transform: uppercase`, so the words on screen are
           "OVERALL RATING Unlock" while the prop says "Overall Rating Unlock" —
           two spellings of one sentence, and a hand-written label can only ever
           be a guess at what CSS finally renders.

           So the name is not restated at all: the `aria-label` is gone and the
           name is computed from the content, with the extra sentence carried by
           an `sr-only` span INSIDE the button. A screen reader hears all of it;
           axe sees a name that contains the visible text **by construction**
           rather than by my matching it. Same move as `CsvImport`: delete the
           second copy rather than correct it (CLAUDE.md 11c). */
      >
        <div className="kpi-label">{label}</div>
        <div className="kpi-value flex items-center gap-[6px] text-[15px]">
          <Lock className="w-[15px] h-[15px]" strokeWidth={2} aria-hidden="true" />
          Unlock
        </div>
        <span className="sr-only"> — included with a subscription. See what&rsquo;s included.</span>
      </button>
      <UpgradeDialog open={open} onOpenChange={setOpen} feature={label} />
    </>
  );
}
