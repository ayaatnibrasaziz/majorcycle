import { CreditCard } from 'lucide-react';

interface SubscriptionCardProps {
  status: string | null;
  plan: string | null;
  trialEndsAt: string | null;
}

interface StatusMeta {
  label: string;
  tone: 'ok' | 'warn' | 'muted';
  detail: (plan: string | null, trialEndsAt: string | null) => string;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
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
    detail: (_plan, trialEndsAt) => {
      const end = formatDate(trialEndsAt);
      return end
        ? `Your free trial runs until ${end}.`
        : 'Your free trial is active.';
    },
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
  label: 'Free trial',
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
}: SubscriptionCardProps) {
  const meta = (status && STATUS_META[status]) || NONE_META;

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Subscription</h2>
      </div>
      <div className="card-body">
        <p className="mb-5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Your MajorCycle plan and billing.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.4px] ${TONE_CLS[meta.tone]}`}
            >
              {meta.label}
            </span>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              {meta.detail(plan, trialEndsAt)}
            </p>
          </div>

          {/* Billing management lands with Stripe in F3 — placeholder for now. */}
          <button
            type="button"
            disabled
            title="Billing management is coming soon"
            className="inline-flex items-center justify-center gap-2 h-11 px-4 text-[13px] font-semibold rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-muted)] opacity-60 cursor-not-allowed flex-shrink-0"
          >
            <CreditCard className="w-4 h-4" strokeWidth={1.8} aria-hidden />
            Manage billing (coming soon)
          </button>
        </div>
      </div>
    </section>
  );
}
