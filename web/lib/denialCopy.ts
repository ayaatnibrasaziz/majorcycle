import type { AccessDenialReason } from '@/lib/entitlement';

/**
 * Why a reader is locked out, in the product's own voice — ONE copy for every lock.
 *
 * ⚠️ It lived inside `PremiumLockPage` (the Run and Results lock pages) until
 * 2026-10-03, and the lock window on a Stock Detail page had none, so a former
 * subscriber or a customer whose card had failed was pitched the free trial like a
 * stranger (beta review D-4). Both surfaces read this table now, so a reader hears the
 * same reason wherever they meet a lock (CLAUDE.md 11c).
 *
 * `null` = nothing has gone wrong (a free reader meeting the paywall for the first
 * time): a warning banner would read as a telling-off, so the pitch is the message.
 */
export const DENIAL_COPY: Record<AccessDenialReason, { title: string; body: string } | null> = {
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
