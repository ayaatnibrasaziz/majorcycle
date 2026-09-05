'use client';

import { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { SupportDialog } from '@/components/SupportDialog';
import type { AccessDenialReason } from '@/lib/entitlement';

/**
 * The locked state of a WHOLE premium page (F3 Step 10, owner-requested).
 *
 * /run, /results and the report used to `redirect()` an unentitled viewer to the
 * public /pricing page. That threw a signed-in reader out of the app entirely — the
 * sidebar, the header and the account menu all vanished, and the page they landed on
 * looks signed-out. A held account then got a second jump, onward to /contact, and had
 * to retype the name and email we already hold.
 *
 * This panel is the same idea as PremiumLockCard on Stock Detail, sized for a page:
 * the app shell stays, the route stays, the sidebar still shows where they are, and
 * the explanation arrives in the SAME UpgradeDialog every other lock opens (blurred
 * backdrop, Escape returns them here). Nothing about being unentitled should feel like
 * being logged out.
 *
 * SECURITY NOTE. This is presentation only. The page that renders it must return it
 * BEFORE fetching any premium payload — a panel drawn over data already loaded into
 * props would ship the scores in the RSC payload regardless of what's on screen
 * (CLAUDE.md 11b). The real boundary is the proxy's 402 and the Python functions.
 */

/** In-app voice: what happened, to a reader who is still inside the product. */
const DENIAL_COPY: Record<AccessDenialReason, { title: string; body: string } | null> = {
  // A free user meeting the paywall for the first time hasn't had anything go wrong,
  // so a warning banner would read as a telling-off. The panel below is the message.
  no_subscription: null,
  canceled: {
    title: 'Your subscription has ended',
    body: 'Browsing, charts and company financials are still yours on the free plan. Resubscribing brings this back straight away.',
  },
  payment_failed: {
    title: 'We couldn’t take your last payment',
    body: 'This is paused until the payment goes through. Updating your card on the Account page is usually all it takes — you don’t need to buy a new plan.',
  },
  billing_blocked: {
    title: 'Your account is on hold',
    body: 'A payment on this account was disputed with the bank, so access is on hold while that’s resolved.',
  },
  // ⚠️ These two exist because four Stripe statuses used to fall through to
  // `no_subscription`, i.e. to `null` above — so a reader whose subscription was
  // stuck saw the plain upgrade panel, worded for someone who had never subscribed.
  // Three of the four had already tried to pay us. Audit finding F-005.
  setup_incomplete: {
    title: 'Your subscription didn’t finish setting up',
    body: 'The payment was started but never completed — usually the bank’s confirmation step was closed before it finished. Starting again from the Account page picks up where you left off, and you have not been charged.',
  },
  subscription_paused: {
    title: 'Your subscription is paused',
    body: 'Browsing, charts and company financials are still yours while it’s paused. Resuming it from the Account page brings this back straight away.',
  },
};

export function PremiumLockPage({
  /** Key into UpgradeDialog's FEATURES map — it supplies the long explanation. */
  feature,
  /** One line naming what this page does, for someone who has never seen it. */
  blurb,
  reason,
  /** Prefill the support form so a held reader doesn't retype what we hold. */
  displayName = '',
  email = '',
}: {
  feature: string;
  blurb: string;
  reason: AccessDenialReason;
  displayName?: string;
  email?: string;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const notice = DENIAL_COPY[reason];
  // A hold isn't a sales situation: /api/checkout and /api/portal both refuse this
  // account, so an upgrade prompt would be an offer we decline at the till. Support is
  // the only action that changes anything, and it opens in place.
  const blocked = reason === 'billing_blocked';

  return (
    <div className="max-w-2xl">
      <div className="card" role="note">
        <div className="card-header">
          <div className="card-title flex items-center gap-[6px]">
            <Lock
              className="h-[13px] w-[13px] text-[var(--text-muted)]"
              strokeWidth={2}
              aria-hidden="true"
            />
            {/* Always the feature, never the situation: the banner below announces a
                hold, and having both say "Your account is on hold" read as a stutter. */}
            {feature}
          </div>
        </div>

        <div className="card-body">
          {notice && (
            <div
              role="status"
              className="mb-4 flex gap-2.5 rounded-[var(--radius-sm)] border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] px-3.5 py-3"
            >
              <AlertCircle
                className="mt-[1px] h-[15px] w-[15px] flex-shrink-0 text-[var(--status-warning)]"
                strokeWidth={2}
                aria-hidden="true"
              />
              <div>
                <p className="text-[12.5px] font-semibold text-[var(--status-warning-ink)]">{notice.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--status-warning-ink)]">
                  {notice.body}
                </p>
              </div>
            </div>
          )}

          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {blocked
              ? `${feature} is part of the paid analysis, and it comes back as soon as the dispute is settled. If you think this is a mistake, contact us and we’ll sort it out with you.`
              : blurb}
          </p>

          <div className="mt-5">
            {blocked ? (
              <Button variant="primary" onClick={() => setSupportOpen(true)}>
                Contact support
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setUpgradeOpen(true)}>
                See what&apos;s included
              </Button>
            )}
          </div>

          <p className="mt-5 border-t border-[var(--border)] pt-4 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
            Browsing, price charts and company financials stay free. Information only —
            not financial advice.
          </p>
        </div>
      </div>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} feature={feature} />

      <SupportDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
        defaultName={displayName}
        defaultEmail={email}
        description="Your account is on hold because a payment was disputed. Tell us what happened and we’ll sort it out with you by email."
      />
    </div>
  );
}
