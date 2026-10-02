import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocalDate } from '@/components/LocalDate';
import { StartTrialButton } from '@/components/account/StartTrialButton';
import { ContactSupportButton } from '@/components/account/ContactSupportButton';
import { paymentFailedAt } from '@/lib/billing/grace';
import { formatCharge } from '@/lib/pricing';
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
  // True when this email has already consumed a free trial (Step 7). Flips the trial
  // entry to an honest "subscribe — billed today, no free week" flow before payment.
  trialUsed?: boolean;
  // Optional inline message shown above the action row — e.g. after a failed
  // return from the billing portal (see /account ?billing= handling).
  notice?: ReactNode;
  // Dispute lock. Overrides the status badge/detail entirely and replaces the
  // buy/manage action with support, because /api/checkout refuses this account.
  billingBlocked?: boolean;
  // Does this reader currently have access? Only `past_due` needs it: that status
  // spans both sides of the 3-day grace window (decision #20), and the two sides
  // need opposite copy — see PAST_DUE_LAPSED_META.
  entitled?: boolean;
  // Prefill the in-place support dialog shown when billingBlocked.
  displayName?: string;
  email?: string;
  // Stripe's own figure for the next charge, in minor units — or, while past_due, the
  // amount that failed (docs/data-contracts.md, profiles.next_charge_amount). NULL hides
  // the amount row; we never fall back to our own price table (11aa).
  nextChargeAmount?: number | null;
  nextChargeCurrency?: string | null;
  // End of the payment-failure grace window; the failure date is worked out from it.
  graceUntil?: string | null;
  // How the success / setting-up notice should look (it used to be an amber warning
  // even for "Payment received").
  noticeTone?: NoticeTone;
}

export type NoticeTone = 'success' | 'info' | 'warning';

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

// `past_due` AFTER the 3-day grace window has closed. Stripe's status is still just
// `past_due` — identical to a customer inside the window who can still use everything —
// so STATUS_META.past_due alone told a locked-out customer to "update your card to keep
// access" they had ALREADY lost. Status is one dimension short of the truth here;
// entitlement is what separates the two cases, so the copy follows entitlement.
const PAST_DUE_LAPSED_META: StatusMeta = {
  label: 'Access paused',
  tone: 'warn',
  detail: () =>
    'We couldn’t take your last payment, so access is paused for now. Update your card and it comes straight back — nothing has been lost.',
};

// A dispute lock is orthogonal to the Stripe status and outranks it everywhere else
// (hasAccess, accessDenialReason, /pricing). Without this the card told a locked-out
// customer "ACTIVE — You're on the Monthly plan", which is both wrong and the single
// most support-generating thing we could say to someone whose access just vanished.
const BLOCKED_META: StatusMeta = {
  label: 'On hold',
  tone: 'warn',
  detail: () =>
    'A payment on this account was disputed with the bank, so access is on hold while that’s resolved. Contact support and we’ll sort it out with you.',
};

const TONE_CLS: Record<StatusMeta['tone'], string> = {
  ok: 'bg-[var(--brand-light)] text-[var(--brand-mid)] border-[var(--brand-light-border)]',
  warn: 'bg-[var(--status-warning-tint)] text-[var(--status-warning-ink)] border-[var(--status-warning-tint-strong)]',
  muted:
    'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)]',
};

/** The amount after "Then" / "Amount": "A$19.00 a month". */
function perInterval(plan: string | null): string {
  if (plan === 'annual') return ' a year';
  if (plan === 'monthly') return ' a month';
  return '';
}

const NOTICE_CLS: Record<NoticeTone, string> = {
  success:
    'text-[var(--status-success-ink)] bg-[var(--status-success-tint)] border-[var(--status-success-tint-strong)]',
  info: 'text-[var(--brand-deep)] bg-[var(--brand-light)] border-[var(--brand-light-border)]',
  warning:
    'text-[var(--status-warning-ink)] bg-[var(--status-warning-tint)] border-[var(--status-warning-tint-strong)]',
};

/**
 * ⚠️ THREE FIXED PARTS, whatever the state (owner-approved design, 2026-10-03): the
 * plan name with its status pill, a list of details, and a footer holding the one
 * sentence and the one button. The pill used to sit beside a sentence of varying length
 * and the button beside that, so the layout moved with every wording.
 */
export function SubscriptionCard({
  status,
  plan,
  trialEndsAt,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  currency,
  trialUsed = false,
  notice,
  billingBlocked = false,
  entitled = false,
  displayName = '',
  email = '',
  nextChargeAmount = null,
  nextChargeCurrency = null,
  graceUntil = null,
  noticeTone = 'warning',
}: SubscriptionCardProps) {
  const meta = billingBlocked
    ? BLOCKED_META
    : status === 'past_due' && !entitled
      ? PAST_DUE_LAPSED_META
      : (status && STATUS_META[status]) || NONE_META;
  const date = (iso: string | null) =>
    iso ? <LocalDate iso={iso} fallback={formatFallback(iso)} /> : null;
  const trialEnd = date(trialEndsAt);

  // A scheduled cancel (portal cancel, or an account queued for deletion) only makes
  // sense for a live sub. The date is current_period_end (== Stripe cancel_at).
  const cancelDate = cancelAtPeriodEnd ? date(currentPeriodEnd) : null;
  // Never let "won't renew" mask the hold: a blocked account needs to hear why it
  // lost access, and the renewal date is the lesser fact.
  const scheduledCancel =
    !billingBlocked &&
    cancelDate !== null &&
    (status === 'active' || status === 'trialing');

  // No live subscription (never subscribed, or lapsed) → offer the trial. A LOST
  // dispute cancels the subscription, so a blocked account lands on `canceled` — which
  // is exactly the state that may re-subscribe; the billingBlocked guard stops the card
  // offering a button /api/checkout refuses.
  const canStartTrial = !billingBlocked && (!status || status === 'canceled');
  const pastDue = !billingBlocked && status === 'past_due';

  const amount =
    nextChargeAmount != null && nextChargeCurrency ? (
      <span className="font-mono">
        {formatCharge(nextChargeAmount, nextChargeCurrency)}
      </span>
    ) : null;

  // ── The three parts ────────────────────────────────────────────────────────
  const name = billingBlocked || !canStartTrial ? planLabel(plan) || 'Your plan' : 'Free plan';
  const subLine = status === 'trialing' && !billingBlocked ? 'Free trial' : null;

  const rows: Array<[string, ReactNode]> = [];
  let sentence: ReactNode = null;

  if (billingBlocked) {
    sentence = meta.detail(plan, trialEnd);
  } else if (scheduledCancel) {
    rows.push([status === 'trialing' ? 'Trial ends' : 'Plan ends', cancelDate]);
    rows.push(['Next charge', 'None']);
    sentence = <>You won&apos;t be charged again. Changed your mind? You can keep it from Manage billing.</>;
  } else if (status === 'trialing') {
    if (trialEnd) rows.push(['Trial ends', trialEnd]);
    if (amount) rows.push(['Then', <>{amount}{perInterval(plan)}</>]);
    if (amount && trialEnd) rows.push(['First charge', trialEnd]);
    sentence = trialEnd ? (
      <>Cancel any time before {trialEnd} and you won&apos;t be charged.</>
    ) : (
      meta.detail(plan, trialEnd)
    );
  } else if (status === 'active') {
    const renews = date(currentPeriodEnd);
    if (renews) rows.push(['Renews on', renews]);
    if (amount) rows.push(['Amount', <>{amount}{perInterval(plan)}</>]);
    // A plan with nothing to list (set by hand, no Stripe record) still says something.
    if (rows.length === 0) sentence = meta.detail(plan, trialEnd);
  } else if (pastDue) {
    const failedOn = date(paymentFailedAt(graceUntil));
    if (amount) rows.push(['Payment failed', failedOn ? <>{amount} on {failedOn}</> : amount]);
    if (entitled) {
      const by = date(graceUntil);
      if (by) rows.push(['Update card by', by]);
      sentence = 'Your access continues until then. Updating your card is usually all it takes.';
    } else {
      sentence = meta.detail(plan, trialEnd);
    }
  } else if (status === 'canceled') {
    sentence =
      'Your subscription has ended. Browsing, charts and company financials are still yours on the free plan.';
  } else {
    sentence = 'Browsing, charts and company financials are yours on the free plan.';
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Subscription</h2>
      </div>
      <div className="card-body">
        <p className="mb-4 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Your MajorCycle plan and billing.
        </p>

        {notice && (
          <div
            role={noticeTone === 'warning' ? 'alert' : 'status'}
            className={`mb-4 flex items-start gap-2 text-[12px] border rounded-[var(--radius-sm)] px-3 py-2.5 ${NOTICE_CLS[noticeTone]}`}
          >
            {noticeTone === 'warning' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden />
            )}
            <span className="leading-relaxed">{notice}</span>
          </div>
        )}

        <div className="sub-plan">
          <div className="sub-plan-top">
            <div className="min-w-0 flex-1">
              <div className="sub-plan-name">{name}</div>
              {subLine && <div className="sub-plan-sub">{subLine}</div>}
            </div>
            <span
              className={`inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.4px] ${TONE_CLS[meta.tone]}`}
            >
              {scheduledCancel ? 'Cancelling' : meta.label}
            </span>
          </div>

          {rows.length > 0 && (
            <dl className="sub-plan-rows">
              {rows.map(([label, value]) => (
                <div key={label} className="sub-plan-row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="sub-plan-foot">
            <p>{sentence}</p>
            {billingBlocked ? (
              /* Support is the only action that can lift a dispute hold — the portal
                 can't, and checkout refuses this account. Opens in place. */
              <ContactSupportButton defaultName={displayName} defaultEmail={email} />
            ) : canStartTrial ? (
              <StartTrialButton currency={currency} trialUsed={trialUsed} />
            ) : (
              /* Manage billing / Update card → Stripe Customer Portal. A plain form POST
                 to /api/portal, which creates a portal session and 303-redirects to it
                 (no client JS, no Stripe key in the browser). */
              <form action="/api/portal" method="post" className="sub-plan-action">
                <Button type="submit" variant={pastDue ? 'primary' : 'secondary'} className="w-full">
                  <CreditCard className="w-4 h-4" strokeWidth={1.8} aria-hidden />
                  {pastDue ? 'Update card' : 'Manage billing'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
