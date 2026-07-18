import type { ReactNode } from 'react';
import { AlertCircle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocalDate } from '@/components/LocalDate';
import { StartTrialButton } from '@/components/account/StartTrialButton';
import type { BillingCurrency } from '@/lib/stripe';

interface SubscriptionCardProps {
  status: string | null;
  plan: string | null;
  trialEndsAt: string | null;
  // True when the subscription is set to stop at the end of the current period (user
  // cancelled in the portal, or the account is scheduled for deletion). Drives the
  // "Cancels on <date>" line below.
  cancelAtPeriodEnd: boolean;
  // End of the current paid/trial period — the date the sub cancels when
  // cancelAtPeriodEnd is true (== Stripe cancel_at for a period-end cancel).
  currentPeriodEnd: string | null;
  // The signed-in user's billing currency (from their saved country), used by the
  // in-app "Start free trial" modal to show the right region price.
  currency: BillingCurrency;
  // Optional inline message shown above the action row — e.g. after a failed
  // return from the billing portal (see /account ?billing= handling).
  notice?: string | null;
}

interface StatusMeta {
  label: string;
  tone: 'ok' | 'warn' | 'muted';
  // `trialEnd` is a <LocalDate> node (renders in the viewer's device timezone),
  // or null when there's no trial-end date. See docs/coding-standards.md.
  detail: (plan: string | null, trialEnd: ReactNode | null) => ReactNode;
}

// Server-side fallback string only — shown until <LocalDate> reformats in the
// device zone on mount. This Card is a Server Component, so this runs in the
// runtime (UTC) zone; the on-mount swap is what makes the date the user's own.
function formatFallback(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function planLabel(plan: string | null): string {
  if (!plan) return '';
  if (plan === 'monthly') return 'Monthly plan';
  if (plan === 'annual') return 'Annual plan';
  return plan;
}

const STATUS_META: Record<string, StatusMeta> = {
  active: {
    label: 'Active',
    tone: 'ok',
    detail: (plan) =>
      plan
        ? `You're on the ${planLabel(plan)}.`
        : 'Your subscription is active.',
  },
  trialing: {
    label: 'Trial active',
    tone: 'ok',
    detail: (_plan, trialEnd) =>
      trialEnd ? (
        <>Your free trial runs until {trialEnd}.</>
      ) : (
        'Your free trial is active.'
      ),
  },
  past_due: {
    label: 'Payment due',
    tone: 'warn',
    detail: () =>
      'We couldn’t take your last payment. Update your card to keep access.',
  },
  canceled: {
    label: 'Cancelled',
    tone: 'muted',
    detail: () => 'Your subscription has been cancelled.',
  },
};

const NONE_META: StatusMeta = {
  label: 'No plan',
  tone: 'muted',
  detail: () => 'You don’t have an active subscription yet.',
};

const TONE_CLS: Record<StatusMeta['tone'], string> = {
  ok: 'bg-[var(--brand-light)] text-[var(--brand-mid)] border-[#bfdbfe]',
  warn: 'bg-[var(--tint-tier-3)] text-[var(--c-tier-3-ink)] border-[var(--tint-tier-3-strong)]',
  muted:
    'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)]',
};

export function SubscriptionCard({
  status,
  plan,
  trialEndsAt,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  currency,
  notice,
}: SubscriptionCardProps) {
  const meta = (status && STATUS_META[status]) || NONE_META;
  const trialEnd = trialEndsAt ? (
    <LocalDate iso={trialEndsAt} fallback={formatFallback(trialEndsAt)} />
  ) : null;

  // A scheduled cancel (portal cancel, or an account queued for deletion) only makes
  // sense for a live sub. When set, we override the normal "runs until / active"
  // detail with an explicit "won't renew" line so the user isn't misled into thinking
  // it'll convert or renew. The date is current_period_end (== Stripe cancel_at).
  const cancelDate =
    cancelAtPeriodEnd && currentPeriodEnd ? (
      <LocalDate iso={currentPeriodEnd} fallback={formatFallback(currentPeriodEnd)} />
    ) : null;
  const scheduledCancel =
    cancelDate !== null && (status === 'active' || status === 'trialing');

  // No live subscription (never subscribed, or lapsed) → offer the trial. The
  // button opens the in-app trial modal (methodology-styled) for the plan choice
  // + checkout. Subscribed states show "Manage billing", which opens the Stripe
  // Customer Portal via a plain form POST to /api/portal.
  const canStartTrial = !status || status === 'canceled';

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Subscription</h2>
      </div>
      <div className="card-body">
        <p className="mb-5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Your MajorCycle plan and billing.
        </p>

        {notice && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 text-[12px] text-[var(--c-tier-3-ink)] bg-[var(--tint-tier-3)] border border-[var(--tint-tier-3-strong)] rounded-[var(--radius-sm)] px-3 py-2.5"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden />
            <span className="leading-relaxed">{notice}</span>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.4px] ${TONE_CLS[meta.tone]}`}
            >
              {meta.label}
            </span>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              {scheduledCancel ? (
                status === 'trialing' ? (
                  <>Your free trial ends {cancelDate} and won&apos;t renew.</>
                ) : (
                  <>Your subscription is active until {cancelDate} and won&apos;t renew.</>
                )
              ) : (
                meta.detail(plan, trialEnd)
              )}
            </p>
          </div>

          {canStartTrial ? (
            <StartTrialButton currency={currency} />
          ) : (
            /* Manage billing → Stripe Customer Portal. A plain form POST to
               /api/portal, which creates a portal session and 303-redirects to
               it (no client JS, no Stripe key in the browser). */
            <form action="/api/portal" method="post" className="flex-shrink-0">
              <Button type="submit" variant="secondary">
                <CreditCard className="w-4 h-4" strokeWidth={1.8} aria-hidden />
                Manage billing
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
