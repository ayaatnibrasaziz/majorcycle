import Link from 'next/link';
import { Lock } from 'lucide-react';

/**
 * The locked states a free viewer sees in place of premium analysis (F3 Step 10).
 *
 * These are honest placeholders, NOT redactions of delivered data: for an unentitled
 * viewer the underlying numbers are stripped server-side before the response is
 * serialised (see PREMIUM_KEYS in web/api/cycle.py), so there is nothing in the page
 * to blur, un-hide or read out of the DOM. What renders here is all that exists.
 *
 * Deliberately not a hard wall — each one names what it unlocks and links to
 * /pricing, so the lock advertises the subscription rather than just refusing.
 */

/** Full-width card standing in for a locked section (Verdict, Scorecard). */
export function PremiumLockCard({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div className="card card--stack-base" role="note">
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
          <Link
            href="/pricing"
            className="font-semibold text-[var(--brand-mid)] underline underline-offset-2"
          >
            See plans
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * Locked tile for the 4-card KPI strip. Keeps the exact `kpi-card` shape so the grid
 * stays aligned — the two locked tiles sit directly beside two working ones, which is
 * the clearest possible statement of what a subscription adds.
 */
export function PremiumLockKpi({ label }: { label: string }) {
  return (
    <Link
      href="/pricing"
      className="kpi-card kpi-card--accent"
      style={
        {
          '--kpi-accent': 'var(--text-muted)',
          '--kpi-value-color': 'var(--text-muted)',
        } as React.CSSProperties
      }
      aria-label={`${label} — requires a subscription. See plans.`}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value flex items-center gap-[6px] text-[15px]">
        <Lock className="w-[15px] h-[15px]" strokeWidth={2} aria-hidden="true" />
        Unlock
      </div>
    </Link>
  );
}
